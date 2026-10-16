/**
 * A country village, generated from a seed (Scale's `world/rural` village layout, cut to one place):
 * a square with a church and its spired tower in the widest gap between the streets, country roads
 * wandering out from the square, lanes as spokes and side lanes branching off them in a fishbone,
 * houses along every street (denser and taller round the square, barns at the edge), and farmsteads
 * out in the fields, each yard with its farmhouse, barn and shed and a track to the nearest road.
 *
 * The place hands in its ground, where nothing may be built (a hill), and what stands already:
 * streets with their houses flush to them, buildings kept as they are. Everything else is laid out
 * here. The result answers the queries a field and its props ask per point (the nearest building,
 * how far the nearest road is, how much a point belongs to the village), through grids. Pure.
 */
import { Rng, angleDiff, clamp, deriveSeed, smoothstep } from '@futuremagic/core';
import { cellKey } from './cellMemo';
import { alongPolyline, boxesOverlap, chaikin, closestOnPolyline, polylineLength, resample, reversed } from './polyline';
import { unlocal } from './propMesh';

export type RoadKind = 'main' | 'lane' | 'track';
/** Half widths of the road kinds, metres (a lane's includes its pavements). */
export const ROAD_HW: Readonly<Record<RoadKind, number>> = { main: 3.2, lane: 2.6, track: 1.4 };

export interface Road {
  readonly id: number;
  readonly kind: RoadKind;
  /** Centre line (x, z, ...), points about 4 m apart. */
  readonly pts: readonly number[];
  readonly hw: number;
  /** Laid down by the place (its houses stand flush to it). */
  readonly given: boolean;
}

export type BuildingKind = 'house' | 'church' | 'tower' | 'barn' | 'farmhouse';
/** Which way the roof's ridge runs: along the front (the eaves to the street), across it (the gable to the street), or a spire. */
export type Ridge = 'along' | 'across' | 'spire';

/**
 * A building: a box in plan turned by `yaw` (its front looks along (sin yaw, cos yaw), the frame of
 * `PropBuilder.upright`), its walls up to the eaves and a roof over them.
 */
export interface Building {
  readonly kind: BuildingKind;
  readonly cx: number;
  readonly cz: number;
  readonly yaw: number;
  /** Half its width along the front, half its depth. */
  readonly hu: number;
  readonly hv: number;
  /** The ground at its foot, the height of its eaves (both y, metres), its roof's pitch and ridge. */
  readonly base: number;
  readonly eaves: number;
  readonly pitch: number;
  readonly ridge: Ridge;
  /** A number for its look (plaster, roof), 0–1. */
  readonly look: number;
  /** Where along its front its door is, metres from the middle (along the front's own sideways axis). */
  readonly door: number;
  /** What the place made of it (a shop, someone's home): the place's own business. */
  readonly role?: string;
}

/** A farmstead: its yard (a box in plan, the gate in the middle of its front), the ground it was levelled to. */
export interface Farm {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly hu: number;
  readonly hv: number;
  readonly base: number;
}

export interface VillageSpec {
  readonly seed: number;
  /** The square's centre, and how far the built-up village reaches from it, metres. */
  readonly x: number;
  readonly z: number;
  readonly r: number;
  /** The ground's height. */
  ground(x: number, z: number): number;
  /** Where nothing may be built or laid (a hill, water). */
  blocked(x: number, z: number): boolean;
  /** Streets laid down already (their houses stand flush to them, close together), each joined to the square by a lane (to `join` on it, else its point nearest the square). */
  readonly streets?: readonly { readonly pts: readonly number[]; readonly kind: RoadKind; readonly hw?: number; readonly join?: readonly [number, number] }[];
  /** Buildings standing already, kept as they are. */
  readonly buildings?: readonly Building[];
  /** How many farmsteads to try for. */
  readonly farms?: number;
}

/** A building's signed distance (negative inside its walls or under its roof). */
export function buildingDistance(b: Building, x: number, y: number, z: number): number {
  const [s, f] = unlocal(x, z, b.cx, b.cz, b.yaw), as = Math.abs(s), af = Math.abs(f);
  const plan = Math.max(as - b.hu, af - b.hv);
  const top = b.eaves + (b.ridge === 'across' ? b.hu - as : b.ridge === 'along' ? b.hv - af : Math.min(b.hu, b.hv) - Math.max(as, af)) * b.pitch;
  return Math.max(plan, (y - top) / Math.hypot(1, b.pitch));
}

/** The highest point of a building's roof. */
export function ridgeHeight(b: Building): number {
  return b.eaves + (b.ridge === 'across' ? b.hu : b.ridge === 'along' ? b.hv : Math.min(b.hu, b.hv)) * b.pitch;
}

/** Grid cells, metres; how far beyond a building or a road's edge its cells reach. */
const CELL = 16;
const PAD = 8;
const EMPTY: readonly number[] = [];

export class Village {
  readonly square: { readonly x: number; readonly z: number; readonly r: number };
  readonly roads: Road[] = [];
  readonly buildings: Building[] = [];
  readonly farms: Farm[] = [];
  private readonly roadGrid = new Map<number, number[]>();
  private readonly buildingGrid = new Map<number, number[]>();
  private readonly farmGrid = new Map<number, number[]>();
  /** Street segments within the village (ax, az, bx, bz, ...): the built-up strip along them. */
  private readonly streetSegs: number[] = [];
  private readonly rng: Rng;

  constructor(readonly spec: VillageSpec) {
    const r = (this.rng = new Rng(deriveSeed(spec.seed, 'village')));
    this.square = { x: spec.x, z: spec.z, r: r.range(12, 16) };
    const given = (spec.streets ?? []).map((s) => this.addRoad(s.kind, resample(s.pts, 4), true, s.hw));
    given.forEach((g, i) => this.join(g, spec.streets![i].join));
    this.mainRoads();
    this.lanes();
    for (const b of spec.buildings ?? []) this.addBuilding(b);
    this.placeChurch();
    for (const road of this.roads) if (road.kind !== 'track') this.houses(road);
    for (const road of this.roads) {
      const P = road.pts;
      for (let i = 0; i + 3 < P.length; i += 2) if (road.given || Math.hypot(P[i] - spec.x, P[i + 1] - spec.z) < spec.r * 1.05) this.streetSegs.push(P[i], P[i + 1], P[i + 2], P[i + 3]);
    }
    this.streetGrid();
    this.farmsteads(spec.farms ?? 4);
  }

  // ------------------------------------------------------------------ queries

  /**
   * Distance from (x, z) to the edge of the nearest road (negative on it); Infinity farther than
   * PAD beyond every edge. `hit` (when given) receives the road.
   */
  roadEdge(x: number, z: number, hit?: { road: Road | null }): number {
    const l = this.roadGrid.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (hit) hit.road = null;
    if (!l) return Infinity;
    let best = Infinity;
    for (let q = 0; q < l.length; q += 2) {
      const R = this.roads[l[q]], i = l[q + 1] * 2, P = R.pts;
      const ax = P[i], az = P[i + 1], dx = P[i + 2] - ax, dz = P[i + 3] - az, l2 = dx * dx + dz * dz;
      const t = l2 > 0 ? clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1) : 0;
      const d = Math.hypot(ax + dx * t - x, az + dz * t - z) - R.hw;
      if (d < best) { best = d; if (hit) hit.road = R; }
    }
    return best;
  }

  /** Distance from (x, z) to the square's edge (negative on it). */
  squareEdge(x: number, z: number): number {
    return Math.hypot(x - this.square.x, z - this.square.z) - this.square.r;
  }

  /** The buildings that may be within PAD of (x, z). */
  buildingsNear(x: number, z: number): readonly number[] {
    return this.buildingGrid.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL))) ?? EMPTY;
  }

  /** The building nearest (x, y, z) and its distance (negative: inside it); `d` is PAD, `building` null, when none is that near. */
  nearestBuilding(x: number, y: number, z: number): { building: Building | null; d: number } {
    let best: Building | null = null, d: number = PAD;
    for (const i of this.buildingsNear(x, z)) {
      const b = this.buildings[i], e = buildingDistance(b, x, y, z);
      if (e < d) { d = e; best = b; }
    }
    return { building: best, d };
  }

  /** The farmyard (x, z) is in or near: how far inside its edge (negative outside, beyond PAD: none). */
  farmAt(x: number, z: number): { farm: Farm | null; d: number } {
    let best: Farm | null = null, d = -PAD;
    for (const i of this.farmGrid.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL))) ?? EMPTY) {
      const F = this.farms[i], [s, f] = unlocal(x, z, F.x, F.z, F.yaw), e = Math.min(F.hu - Math.abs(s), F.hv - Math.abs(f));
      if (e > d) { d = e; best = F; }
    }
    return { farm: best, d };
  }

  /** How much (x, z) belongs to the village or a farmyard (0..1): houses, gardens and yards; the fields give way. */
  clearing(x: number, z: number): number {
    const S = this.spec, f = this.farmAt(x, z);
    let c = f.farm ? 1 - smoothstep(-6, -1, -f.d) : 0;
    const dc = Math.hypot(x - S.x, z - S.z);
    let ds = dc - this.square.r;
    for (const o of this.streetGrid_.get(cellKey(Math.floor(x / STREET_CELL), Math.floor(z / STREET_CELL))) ?? EMPTY) {
      const P = this.streetSegs, ax = P[o], az = P[o + 1], dx = P[o + 2] - ax, dz = P[o + 3] - az, l2 = dx * dx + dz * dz;
      const t = l2 > 0 ? clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1) : 0;
      ds = Math.min(ds, Math.hypot(ax + dx * t - x, az + dz * t - z));
    }
    // Houses and their gardens along the streets (the fields reach up to the back gardens).
    c = Math.max(c, 1 - smoothstep(STREET_DEPTH, STREET_DEPTH + 8, ds));
    return c;
  }

  // ------------------------------------------------------------------ roads

  private addRoad(kind: RoadKind, pts: number[], given = false, hw = ROAD_HW[kind]): Road {
    const R: Road = { id: this.roads.length, kind, pts, hw, given };
    this.roads.push(R);
    const m = R.hw + PAD;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const x0 = Math.min(pts[i], pts[i + 2]) - m, x1 = Math.max(pts[i], pts[i + 2]) + m, z0 = Math.min(pts[i + 1], pts[i + 3]) - m, z1 = Math.max(pts[i + 1], pts[i + 3]) + m;
      for (let a = Math.floor(x0 / CELL); a <= Math.floor(x1 / CELL); a++) for (let b = Math.floor(z0 / CELL); b <= Math.floor(z1 / CELL); b++) {
        const k = cellKey(a, b);
        let l = this.roadGrid.get(k);
        if (!l) this.roadGrid.set(k, (l = []));
        l.push(R.id, i >> 1);
      }
    }
    return R;
  }

  /** Whether a road could run along `pts`: nothing blocked, and off the other roads but near its first `skipA` and last `skipB` metres. */
  private clear(pts: readonly number[], hw: number, gap: number, skipA: number, skipB: number): boolean {
    const n = pts.length >> 1, ex = pts[pts.length - 2], ez = pts[pts.length - 1];
    for (let i = 0; i < n; i++) {
      const x = pts[i * 2], z = pts[i * 2 + 1];
      if (this.spec.blocked(x, z)) return false;
      if (Math.hypot(x - pts[0], z - pts[1]) < skipA || Math.hypot(x - ex, z - ez) < skipB) continue;
      if (this.roadEdge(x, z) < hw + gap) return false;
    }
    return true;
  }

  /** The directions the roads leave the square in. */
  private squareDirs(): number[] {
    const S = this.square, out: number[] = [];
    for (const R of this.roads) {
      const P = R.pts;
      for (const i of [0, P.length - 2]) {
        if (Math.hypot(P[i] - S.x, P[i + 1] - S.z) > S.r + 2) continue;
        const j = i === 0 ? Math.min(P.length - 2, 6) : Math.max(0, P.length - 8);
        out.push(Math.atan2(P[j + 1] - S.z, P[j] - S.x));
      }
    }
    return out;
  }

  /** A lane from the square to a given street (at `to`, else its point nearest the square). */
  private join(street: Road, to?: readonly [number, number]): void {
    const S = this.square, c = to ? { px: to[0], pz: to[1] } : closestOnPolyline(street.pts, S.x, S.z);
    const a = Math.atan2(c.pz - S.z, c.px - S.x), L = Math.hypot(c.px - S.x, c.pz - S.z);
    const bend = this.rng.range(-0.08, 0.08) * L;
    const sx = S.x + Math.cos(a) * S.r * 0.5, sz = S.z + Math.sin(a) * S.r * 0.5;
    const mx = S.x + Math.cos(a) * L * 0.5 - Math.sin(a) * bend, mz = S.z + Math.sin(a) * L * 0.5 + Math.cos(a) * bend;
    const pts = resample(chaikin([sx, sz, mx, mz, c.px, c.pz], 3), 4);
    pts[pts.length - 2] = c.px; pts[pts.length - 1] = c.pz;
    this.addRoad('lane', pts);
  }

  /** A gently wandering polyline from a to b (its ends fixed, straight for `lead` metres at each end). */
  private wander(ax: number, az: number, bx: number, bz: number, amp: number, lead: number): number[] {
    const r = this.rng, L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
    const n = Math.max(2, Math.round(L / 110)), ph = r.range(0, 100), f = r.range(0.6, 1.4);
    const ctrl: number[] = [ax, az, ax + ux * lead, az + uz * lead];
    for (let i = 1; i < n; i++) {
      const s = (i / n) * L;
      if (s < lead * 1.5 || s > L - lead) continue;
      const off = (Math.sin(i * f + ph) * 0.6 + Math.sin(i * f * 2.3 + ph * 1.7) * 0.4) * amp * smoothstep(lead, lead * 3, s);
      ctrl.push(ax + ux * s - uz * off, az + uz * s + ux * off);
    }
    ctrl.push(bx, bz);
    const pts = resample(chaikin(ctrl, 3), 4);
    pts[0] = ax; pts[1] = az;
    return pts;
  }

  /** Country roads: out of the square in directions well apart, wandering off across the fields; cut where blocked. */
  private mainRoads(): void {
    const r = this.rng, S = this.square, want = r.int(2, 3), hw = ROAD_HW.main;
    const dirs = this.squareDirs();
    for (let k = 0, tries = 0; k < want && tries < 40; tries++) {
      const a = r.range(-Math.PI, Math.PI);
      if (dirs.some((d) => Math.abs(angleDiff(d, a)) < 1.1)) continue;
      const L = r.range(520, 820);
      let pts = this.wander(S.x + Math.cos(a) * S.r * 0.5, S.z + Math.sin(a) * S.r * 0.5, S.x + Math.cos(a) * L, S.z + Math.sin(a) * L, Math.min(40, L * 0.06), S.r + 40);
      let cut = pts.length;
      for (let i = 0; i < pts.length; i += 2) if (this.spec.blocked(pts[i], pts[i + 1])) { cut = i; break; }
      pts = pts.slice(0, cut);
      if (polylineLength(pts) < this.spec.r * 1.4 || !this.clear(pts, hw, 6, S.r + 6, 0)) continue;
      this.addRoad('main', pts);
      dirs.push(a);
      k++;
    }
  }

  /** Village lanes: spokes from the square into the directions the roads leave free, then side lanes off the streets (a fishbone). */
  private lanes(): void {
    const r = this.rng, S = this.square, R = this.spec.r, hw = ROAD_HW.lane;
    const dirs = this.squareDirs();
    const cutAt = (pts: number[], from: number) => {
      for (let i = 0; i < pts.length; i += 2) {
        const x = pts[i], z = pts[i + 1];
        if (this.spec.blocked(x, z) || (i >= from && this.roadEdge(x, z) < hw + 6)) return pts.slice(0, i);
      }
      return pts;
    };
    for (let k = 0, want = r.int(2, 3), tries = 0; k < want && tries < 16; tries++) {
      const a = r.range(-Math.PI, Math.PI);
      if (dirs.some((d) => Math.abs(angleDiff(d, a)) < 0.75)) continue;
      const L = R * r.range(0.6, 0.95), bend = r.range(-0.18, 0.18) * L;
      const sx = S.x + Math.cos(a) * S.r * 0.5, sz = S.z + Math.sin(a) * S.r * 0.5;
      const mx = S.x + Math.cos(a) * L * 0.55 - Math.sin(a) * bend, mz = S.z + Math.sin(a) * L * 0.55 + Math.cos(a) * bend;
      const ex = S.x + Math.cos(a) * L - Math.sin(a) * bend * 0.6, ez = S.z + Math.sin(a) * L + Math.cos(a) * bend * 0.6;
      const pts = resample(chaikin([sx, sz, mx, mz, ex, ez], 3), 4);
      // (Past the square before it may meet another road.)
      const cut = cutAt(pts, 2 * Math.ceil((S.r + 12) / 4));
      if (cut.length < 20) continue;
      dirs.push(a);
      this.addRoad('lane', cut);
      k++;
    }
    const parents = this.roads.filter((p) => !p.given);
    for (let k = 0, want = r.int(3, 5), tries = 0; k < want && tries < 30 && parents.length; tries++) {
      const P0 = r.pick(parents), P = Math.hypot(P0.pts[0] - S.x, P0.pts[1] - S.z) < S.r + 2 ? P0.pts : reversed(P0.pts);
      const s = R * r.range(0.3, 0.75);
      if (s > polylineLength(P) - 10) continue;
      const [px, pz, tx, tz] = alongPolyline(P, s), side = r.sign(), a = Math.atan2(tz, tx) + side * (Math.PI / 2 + r.range(-0.3, 0.3));
      const sx = px - tz * side * (P0.hw - 0.5), sz = pz + tx * side * (P0.hw - 0.5), L = r.range(40, 90);
      const pts = resample([sx, sz, sx + Math.cos(a) * L, sz + Math.sin(a) * L], 4);
      let cut = cutAt(pts, 10);
      for (let i = 0; i < cut.length; i += 2) if (Math.hypot(cut[i] - S.x, cut[i + 1] - S.z) > R * 1.05) { cut = cut.slice(0, i); break; }
      if (cut.length < 14) continue;
      this.addRoad('lane', cut);
      k++;
    }
  }

  // ------------------------------------------------------------------ buildings

  private addBuilding(b: Building): void {
    const id = this.buildings.length;
    this.buildings.push(b);
    const R = Math.hypot(b.hu, b.hv) + PAD;
    for (let a = Math.floor((b.cx - R) / CELL); a <= Math.floor((b.cx + R) / CELL); a++) for (let c = Math.floor((b.cz - R) / CELL); c <= Math.floor((b.cz + R) / CELL); c++) {
      const k = cellKey(a, c);
      let l = this.buildingGrid.get(k);
      if (!l) this.buildingGrid.set(k, (l = []));
      l.push(id);
    }
  }

  /**
   * Can a box stand here: its front and middle on open ground (its back may go into a hill), fairly
   * level, off the roads and the square, `gap` metres clear of every other building?
   */
  private fits(cx: number, cz: number, yaw: number, hu: number, hv: number, gap: number, kerb = 0.6): boolean {
    const S = this.spec, ca = Math.cos(yaw), sa = Math.sin(yaw);
    const at = (s: number, f: number): [number, number] => [cx + ca * s + sa * f, cz - sa * s + ca * f];
    let lo = Infinity, hi = -Infinity;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0], [0, 1], [-1, 0], [1, 0], [0, -1]]) {
      const [x, z] = at(a * hu, b * hv);
      if (this.roadEdge(x, z) < (b > 0 ? kerb : 0.6) || this.squareEdge(x, z) < 2) return false;
      if (b >= 0 && S.blocked(x, z)) return false;
      if (b >= 0) { const h = S.ground(x, z); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    }
    if (hi - lo > 2.5) return false;
    for (const i of this.buildingsNear(cx, cz)) {
      const o = this.buildings[i];
      if (Math.hypot(o.cx - cx, o.cz - cz) > Math.hypot(hu, hv) + Math.hypot(o.hu, o.hv) + gap) continue;
      if (boxesOverlap(cx, cz, Math.cos(yaw), -Math.sin(yaw), hu + gap / 2, hv + gap / 2, o.cx, o.cz, Math.cos(o.yaw), -Math.sin(o.yaw), o.hu + gap / 2, o.hv + gap / 2)) return false;
    }
    // (Its whole box may reach past the grid's pad round its centre: check the near cells' too.)
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const [x, z] = at(a * hu, b * hv);
      for (const i of this.buildingsNear(x, z)) {
        const o = this.buildings[i];
        if (boxesOverlap(cx, cz, Math.cos(yaw), -Math.sin(yaw), hu + gap / 2, hv + gap / 2, o.cx, o.cz, Math.cos(o.yaw), -Math.sin(o.yaw), o.hu + gap / 2, o.hv + gap / 2)) return false;
      }
    }
    return true;
  }

  /** The church in the widest gap between the streets leaving the square, its tower to the square, its spire. */
  private placeChurch(): void {
    const r = this.rng, S = this.square;
    const dirs = this.squareDirs().sort((p, q) => p - q);
    if (!dirs.length) return;
    const gaps: { a: number; w: number }[] = dirs.map((p, i) => {
      const q = i + 1 < dirs.length ? dirs[i + 1] : dirs[0] + Math.PI * 2;
      return { a: (p + q) / 2, w: q - p };
    }).sort((p, q) => q.w - p.w);
    const len = r.range(20, 26), wid = r.range(10, 12), tw = r.range(5.5, 7), look = r.float();
    for (const g of gaps) {
      for (const d0 of [S.r + 5, S.r + 9, S.r + 14]) {
        const ux = Math.cos(g.a), uz = Math.sin(g.a), yaw = Math.atan2(-ux, -uz); // (its front to the square)
        const tcx = S.x + ux * (d0 + tw / 2), tcz = S.z + uz * (d0 + tw / 2);
        const ncx = S.x + ux * (d0 + tw - 1 + len / 2), ncz = S.z + uz * (d0 + tw - 1 + len / 2);
        if (!this.fits(ncx, ncz, yaw, wid / 2, len / 2, 2) || !this.fits(tcx, tcz, yaw, tw / 2, tw / 2, 2)) continue;
        const base = this.spec.ground(tcx, tcz);
        this.addBuilding({ kind: 'church', cx: ncx, cz: ncz, yaw, hu: wid / 2, hv: len / 2, base, eaves: base + r.range(8, 10), pitch: r.range(0.95, 1.2), ridge: 'across', look, door: 0 });
        this.addBuilding({ kind: 'tower', cx: tcx, cz: tcz, yaw, hu: tw / 2, hv: tw / 2, base, eaves: base + r.range(17, 21), pitch: r.range(2.4, 3.2), ridge: 'spire', look, door: 0 });
        return;
      }
    }
  }

  /** Houses along a street, both sides: denser and taller near the square, now and then a barn at the edge; flush and close on a given street. */
  private houses(road: Road): void {
    const r = this.rng, S = this.spec, sq = this.square;
    const P = road.given || Math.hypot(road.pts[0] - sq.x, road.pts[1] - sq.z) < sq.r + 2 ? road.pts : reversed(road.pts);
    const total = polylineLength(P), flush = road.given;
    const fromSquare = Math.hypot(P[0] - sq.x, P[1] - sq.z) < sq.r + 2;
    const s0 = flush ? 0 : fromSquare ? sq.r + 4 : 6, sMax = flush ? total : Math.min(total - 3, road.kind === 'lane' ? total : S.r * 1.05);
    const coreR = S.r * 0.35;
    for (const side of [-1, 1]) {
      let s = s0 + (flush ? 0 : r.range(0, 6));
      while (s < sMax) {
        const [px0, pz0] = alongPolyline(P, s), dc = Math.hypot(px0 - S.x, pz0 - S.z), core = dc < coreR;
        const w = flush ? r.range(6.5, 10.5) : core ? r.range(7, 11) : r.range(8.5, 13);
        const gap = flush ? r.range(0.6, 2.4) : core ? r.range(0.8, 3) : r.range(3, 9);
        const sm = s + w / 2;
        if (sm > sMax) break;
        const pIn = flush ? 1 : core ? 0.95 : 0.9 - 0.4 * smoothstep(coreR, S.r, dc);
        if (r.chance(pIn)) {
          const [px, pz, tx, tz] = alongPolyline(P, sm), nx = -tz * side, nz = tx * side;
          const d = flush ? r.range(8.6, 9.6) : core ? r.range(9, 12) : r.range(8, 11);
          const off = road.hw + (flush ? 0 : core ? r.range(0.8, 2.5) : r.range(3, 8)) + d / 2;
          const cx = px + nx * off, cz = pz + nz * off, yaw = Math.atan2(-nx, -nz);
          if (!(flush || Math.hypot(cx - S.x, cz - S.z) < S.r * 1.05) || !this.fits(cx, cz, yaw, w / 2, d / 2, flush ? 0.4 : 1.2, flush ? -0.05 : 0.6)) {
            // (On a given street the houses close up: try again a metre on.)
            if (flush) { s += 1; continue; }
          } else {
            const base = S.ground(px, pz), barn = !core && !flush && r.chance(0.12), look = r.float();
            if (barn) this.addBuilding({ kind: 'barn', cx, cz, yaw, hu: w / 2, hv: d / 2, base, eaves: base + r.range(4.2, 5.5), pitch: r.range(0.5, 0.8), ridge: 'along', look, door: 0 });
            else {
              const floors = core || flush ? (r.chance(0.6) ? 2 : 1) : r.chance(0.3) ? 2 : 1;
              this.addBuilding({ kind: 'house', cx, cz, yaw, hu: w / 2, hv: d / 2, base, eaves: base + 0.5 + floors * 2.8 + r.range(0, 0.6), pitch: r.range(0.55, 1.0), ridge: r.chance(0.6) ? 'across' : 'along', look, door: (r.float() - 0.5) * Math.max(0, w - 3) });
            }
          }
        }
        s += w + gap;
      }
    }
  }

  // ------------------------------------------------------------------ farms

  /** Farmsteads out in the fields round the village, each with a track to the nearest road. */
  private farmsteads(want: number): void {
    const r = this.rng, S = this.spec;
    for (let tries = 0; this.farms.length < want && tries < want * 12; tries++) {
      const a = r.range(-Math.PI, Math.PI), dist = S.r + r.range(90, 380);
      const x = S.x + Math.cos(a) * dist, z = S.z + Math.sin(a) * dist;
      if (this.farms.some((f) => Math.hypot(f.x - x, f.z - z) < 180)) continue;
      // The nearest road (not a track), not too near nor too far.
      let best: { d: number; px: number; pz: number } | null = null;
      for (const R of this.roads) {
        if (R.kind === 'track') continue;
        const c = closestOnPolyline(R.pts, x, z);
        if (!best || c.d < best.d) best = c;
      }
      const hu = r.range(17, 21), hv = r.range(12, 15);
      if (!best || best.d > 360 || best.d < hv + 35) continue;
      // The gate (its front) towards the road.
      const yaw = Math.atan2(best.px - x, best.pz - z), ca = Math.cos(yaw), sa = Math.sin(yaw);
      const at = (s: number, f: number): [number, number] => [x + ca * s + sa * f, z - sa * s + ca * f];
      let ok = true, lo = Infinity, hi = -Infinity;
      for (let i = -1; i <= 1 && ok; i++) for (let j = -1; j <= 1; j++) {
        const [px, pz] = at(i * (hu + 6), j * (hv + 6));
        if (S.blocked(px, pz) || this.roadEdge(px, pz) < 4 || this.clearing(px, pz) > 0.05) { ok = false; break; }
        const h = S.ground(px, pz);
        lo = Math.min(lo, h); hi = Math.max(hi, h);
      }
      if (!ok || hi - lo > 8) continue;
      const [gx, gz] = at(0, hv);
      const track = resample([gx, gz, best.px, best.pz], 4);
      if (!this.clear(track, ROAD_HW.track, 2, 0, ROAD_HW.main + 4)) continue;
      const base = S.ground(x, z), F: Farm = { x, z, yaw, hu, hv, base };
      this.farms.push(F);
      this.addRoad('track', track);
      const fi = this.farms.length - 1, RR = Math.hypot(hu, hv) + 14;
      for (let i = Math.floor((x - RR) / CELL); i <= Math.floor((x + RR) / CELL); i++) for (let j = Math.floor((z - RR) / CELL); j <= Math.floor((z + RR) / CELL); j++) {
        const k = cellKey(i, j);
        let l = this.farmGrid.get(k);
        if (!l) this.farmGrid.set(k, (l = []));
        l.push(fi);
      }
      this.farmBuildings(F);
    }
  }

  /** A farm's buildings round its yard: the farmhouse across the back, facing the gate; the barn down one side; a shed or stable on the other (each only where it fits). */
  private farmBuildings(F: Farm): void {
    const r = this.rng, ca = Math.cos(F.yaw), sa = Math.sin(F.yaw);
    const raise = (kind: BuildingKind, s: number, f: number, turn: number, hu: number, hv: number, eaves: number, pitch: number) => {
      const cx = F.x + ca * s + sa * f, cz = F.z - sa * s + ca * f, yaw = F.yaw + turn;
      if (!this.fits(cx, cz, yaw, hu, hv, 1.5)) return;
      this.addBuilding({ kind, cx, cz, yaw, hu, hv, base: F.base, eaves: F.base + eaves, pitch, ridge: 'along', look: r.float(), door: kind === 'farmhouse' ? r.range(-2, 2) : 0 });
    };
    const hw = r.range(6, 7.5), hd = r.range(4.5, 5.5);
    raise('farmhouse', r.range(-F.hu + hw + 1, F.hu - hw - 1), -F.hv + hd + 1, 0, hw, hd, r.range(5.6, 6.4), r.range(0.7, 1.0));
    // (Turned to face across the yard: its own width runs along the yard's depth, from in front of the house to the gate.)
    const side = r.sign(), bw = r.range(5.5, 7), room = F.hv * 2 - hd * 2 - 3.5, bl = Math.min(r.range(8, 11), room / 2);
    raise('barn', side * (F.hu - bw - 1), F.hv - bl - 0.5, -side * Math.PI / 2, bl, bw, r.range(5, 6.5), r.range(0.5, 0.75));
    if (r.chance(0.7)) {
      const sl = Math.min(r.range(3.5, 5), room / 2), sw = r.range(3, 4);
      raise('barn', -side * (F.hu - sw - 1), F.hv - sl - 0.5, side * Math.PI / 2, sl, sw, r.range(3.2, 4), r.range(0.4, 0.6));
    }
  }

  // ------------------------------------------------------------------ the built-up strip

  private readonly streetGrid_ = new Map<number, number[]>();
  private streetGrid(): void {
    const P = this.streetSegs, m = STREET_DEPTH + 8;
    for (let o = 0; o < P.length; o += 4) {
      const x0 = Math.min(P[o], P[o + 2]) - m, x1 = Math.max(P[o], P[o + 2]) + m, z0 = Math.min(P[o + 1], P[o + 3]) - m, z1 = Math.max(P[o + 1], P[o + 3]) + m;
      for (let a = Math.floor(x0 / STREET_CELL); a <= Math.floor(x1 / STREET_CELL); a++) for (let b = Math.floor(z0 / STREET_CELL); b <= Math.floor(z1 / STREET_CELL); b++) {
        const k = cellKey(a, b);
        let l = this.streetGrid_.get(k);
        if (!l) this.streetGrid_.set(k, (l = []));
        l.push(o);
      }
    }
  }
}

/** How deep the built-up strip along a street reaches (houses and gardens), metres; its grid's cells. */
const STREET_DEPTH = 24;
const STREET_CELL = 32;
