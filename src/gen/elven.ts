/**
 * The elven vaults style (catalog §4.3): tall, slender, curved, like a gothic nave grown from the
 * rock. Long parallel naves all lying the same way, each under a pointed vault 25–35 m high, with a
 * lower aisle either side behind an arcade of slender clustered columns; ribs spring from every
 * column and cross the vault at each bay. Here and there a transept crosses from one nave to the
 * next. The floor is smooth and dished a little to the middle. Pale silver-grey stone, the ribs and
 * columns paler still: the tallest of the built styles, and the most curved.
 *
 * In section a vault is two circles meeting at a point (an equilateral arch), carried down to the
 * floor as straight walls: the air is the intersection of two such stadiums, exact. A column is a
 * core with four shafts round it (circles in plan); a rib is a band of rock a metre wide just under
 * the vault. Naves run along u (the level's grain, src/gen/grainLines.ts) one to a stripe of v;
 * the field is the union of the naves and transepts near a column, less the columns and ribs.
 * Envelope (E1): the floors weighted by how near each is, and a roof over all of them.
 *
 * Pure, like every style.
 */
import { Noise, deriveSeed, hash2i, hashToFloat, smoothstep } from '@futuremagic/core';
import { dryAbove, type Band } from './bands';
import { Envelope } from './envelope';
import { Grain, grainOf } from './grainLines';
import { unworked, type Column, type Working } from './quarry';
import { rockMix } from './rockTypes';
import type { Style, StyleId } from './style';
import type { Dress } from './styleProps';
import { alongPath, type Inscription } from './inscriptions';
import type { V3 } from './propMesh';
import { thread } from '../lore/scripts';
import { ribLine } from '../lore/fragments';

export const ELVEN = {
  /** One nave to a stripe this wide across the grain, metres, strayed by up to `jitter`. */
  spacing: 72,
  jitter: 6,
  /** A nave's half span (min, extra), where its vault springs over the floor (min, extra), metres. */
  half: [7, 3] as const,
  spring: [12, 5] as const,
  /** The aisles: how wide, where their vaults spring, metres. */
  aisle: { wide: 4.5, spring: 6.5 },
  /** Bays along a nave this long, metres: a column each side and a rib across at each. */
  bay: 7,
  /** A clustered column: its core's and shafts' radii, the shafts this far out, metres. */
  column: { core: 1, shaft: 0.55, out: 1 },
  /** A rib: half its width along the nave, how far it hangs under the vault, metres. */
  rib: { half: 0.6, deep: 1.2 },
  /** Transepts: one to a stretch of nave this long, metres, with this chance; half span and spring. */
  transept: { every: 110, chance: 0.6, half: 4, spring: 7 },
  /** How far the floor dishes down to a nave's middle, and how far it rolls along it (up from clear of the water) over what distance, metres. */
  dish: 0.4,
  roll: [3, 320] as const,
  /**
   * Thread script along the ribs (docs/design/lore.md §4.3): the chance a rib carries a line, its
   * thread this far in under the vault, at most this many metres to a unit, strokes this share of
   * a unit wide.
   */
  writing: { rib: 0.2, inset: 0.3, scale: 0.55, pen: 0.16 },
} as const;

/** Salt-white, faintly alight, like the ward round grandma's circle. */
const SALT = [0.72, 0.84, 0.95] as const;
const RIB = 'High along the rib, in pale salt-white that catches the light: one unbroken line running up and over the arch, marks hanging from it. The same hand as the ring round grandma\'s circle.';

/** Rock further than this from a nave or transept counts as this far, metres; every one this near is looked at. */
const FAR = 14;
const SQRT3 = Math.sqrt(3);

/** What an elven column is to the code that asks about workings: built, not by the miners. */
const GROWN: Working = { id: 0x656c7666, angle: 0, spacing: 1e9, pillar: 0, floor: 0, height: 25, collapse: 0, cavern: false, cx: 0, cz: 0 };

interface Nave {
  /** Its middle across the grain, half span, spring height over the floor; its aisles' middles are at ± (half + aisle/2). */
  v: number;
  half: number;
  spring: number;
}

/** A nave near a column: which, where across it (v from its middle), its floor here. */
interface NearNave {
  k: number;
  nave: Nave;
  across: number;
  floor: number;
}

/** A transept near a column: how far in from its sides (along u), its floor, how far it reaches across (v from the first nave's middle to the second's). */
interface NearTransept {
  along: number;
  floor: number;
  t: number;
  len: number;
}

interface ElvenColumn {
  naves: NearNave[];
  transepts: NearTransept[];
  /** Plan distance to the nearest clustered column (positive outside), and where along the bay (u from the nearest bay line). */
  column: number;
  bay: number;
}

export class Elven implements Style {
  readonly id: StyleId = 'elven';
  /** The rock it is cut through (src/gen/rockTypes.ts). */
  readonly rocks = rockMix({ marble: 0.6, limestone: 0.3, slate: 0.1 });
  /** Pale silver on the map (M). */
  readonly mapFloor = [0.62, 0.66, 0.7] as const;
  private readonly noise: Noise;
  private readonly cells: number;
  private readonly grain: Grain;
  private readonly own = new WeakMap<Column, ElvenColumn>();

  constructor(readonly seed: number, readonly band: Band) {
    this.noise = new Noise(deriveSeed(seed, 'elven', 'shape'));
    this.cells = deriveSeed(seed, 'elven', 'cells');
    this.grain = new Grain(grainOf(seed, 'elven'));
  }

  /** Nave k. */
  private nave(k: number): Nave {
    const E = ELVEN, h = hash2i(this.cells, k, 0), f = (m: number) => hashToFloat(hash2i(h, m, 3));
    return { v: k * E.spacing + (f(0) - 0.5) * 2 * E.jitter, half: E.half[0] + E.half[1] * f(1), spring: E.spring[0] + E.spring[1] * f(2) };
  }

  /** Nave k's floor (its middle's) at u: rolling slowly along it, never under the water. */
  private floor(k: number, u: number): number {
    const R = ELVEN.roll;
    return dryAbove(this.band) + (1 + this.noise.n2(u / R[1], k * 3.7 + 0.5)) * R[0];
  }

  column(x: number, z: number, col: Column): Column {
    const E = ELVEN, u = this.grain.u(x, z), v = this.grain.v(x, z);
    let o = this.own.get(col);
    if (!o) { o = { naves: [], transepts: [], column: Infinity, bay: 0 }; this.own.set(col, o); }
    o.naves.length = o.transepts.length = 0;
    o.column = Infinity;
    const b = Math.round(u / E.bay);
    o.bay = u - b * E.bay;
    const env = new Envelope(FAR);
    const k0 = Math.round(v / E.spacing);
    for (let k = k0 - 1; k <= k0 + 1; k++) {
      const n = this.nave(k), across = v - n.v, reach = n.half + E.aisle.wide;
      const inside = reach - Math.abs(across), mid = this.floor(k, u);
      if (inside > -FAR) {
        const floor = mid - E.dish * Math.max(0, 1 - (across / n.half) ** 2);
        o.naves.push({ k, nave: n, across, floor });
        env.add(inside, mid, mid + n.spring + n.half * SQRT3);
        // The arcade's columns at the bay lines, each side.
        const pv = Math.abs(across) - n.half, C = E.column;
        let d = Math.hypot(o.bay, pv) - C.core;
        for (const [du, dv] of [[C.out, 0], [-C.out, 0], [0, C.out], [0, -C.out]]) d = Math.min(d, Math.hypot(o.bay - du, pv - dv) - C.shaft);
        o.column = Math.min(o.column, d);
      }
      // The transepts from this nave on to the next, across the grain.
      const T = E.transept, c0 = Math.round(u / T.every);
      for (let c = c0 - 1; c <= c0 + 1; c++) {
        const h = hash2i(this.cells ^ 0x7a5e, k, c);
        if (hashToFloat(h) >= T.chance) continue;
        // (On a bay line midway between two, so its walls meet the arcades between columns.)
        const at = (c + 0.25 + 0.5 * hashToFloat(hash2i(h, 1, 1))) * T.every, tu = (Math.round(at / E.bay - 0.5) + 0.5) * E.bay;
        const m = this.nave(k + 1), t = v - n.v, len = m.v - n.v;
        const along = T.half - Math.abs(u - tu), off = Math.max(0, -t, t - len);
        const inside = Math.min(along, -off);
        if (inside <= -FAR) continue;
        const f0 = this.floor(k, tu), f1 = this.floor(k + 1, tu), floor = f0 + (f1 - f0) * Math.max(0, Math.min(1, t / len));
        o.transepts.push({ along, floor, t, len });
        env.add(inside, floor, floor + T.spring + T.half * SQRT3);
      }
    }
    col.floor = env.floor();
    col.ceiling = env.ceiling();
    let wall = -FAR;
    for (const nn of o.naves) wall = Math.max(wall, nn.nave.half + E.aisle.wide - Math.abs(nn.across));
    for (const t of o.transepts) wall = Math.max(wall, t.along);
    col.wall = wall;
    unworked(col, GROWN, 1000, 0);
    return col;
  }

  at(col: Column, _x: number, y: number, _z: number): number {
    const E = ELVEN, o = this.own.get(col)!;
    let d = -FAR;
    for (const { nave: n, across, floor } of o.naves) {
      const h = y - floor;
      // The nave's vault, and each aisle's, all down to the floor; the ribs under the nave's vault at each bay.
      const nave = vault(across, h, n.half, n.spring);
      const side = n.half + E.aisle.wide / 2, aisle = vault(Math.abs(across) - side, h, E.aisle.wide / 2, E.aisle.spring);
      let air = Math.min(Math.max(nave, aisle), h);
      const rib = Math.max(Math.abs(o.bay) - E.rib.half, nave - E.rib.deep, n.spring - h);
      air = Math.min(air, rib);
      d = Math.max(d, air);
    }
    for (const t of o.transepts) {
      const T = E.transept, h = y - t.floor;
      d = Math.max(d, Math.min(vault(t.along - T.half, h, T.half, T.spring), -Math.max(0, -t.t, t.t - t.len), h));
    }
    return Math.max(Math.min(d, o.column), -FAR);
  }

  color(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    const B = this.band, n = this.noise, own = this.own.get(col);
    let floor = col.floor, onRib = 0;
    const near = own?.naves.find((nn) => Math.abs(nn.across) < nn.nave.half + ELVEN.aisle.wide + 1);
    if (near) {
      floor = near.floor;
      // Ribs and columns paler: near a bay line, high up or on a column.
      onRib = (1 - smoothstep(0.4, 1.2, Math.abs(own!.bay))) * smoothstep(near.nave.spring - 2, near.nave.spring, y - floor);
      onRib = Math.max(onRib, 1 - smoothstep(0.2, 0.8, own!.column));
    }
    const h = y - floor;
    // Pale silver-grey, cool; a darker polished floor with pale lines along the nave every few metres.
    const grain = 0.93 + 0.07 * n.n2(x / 3 + y * 0.3, z / 3 - y * 0.3);
    const flooring = 1 - smoothstep(0.05, 0.3, h);
    const line = near ? 1 - smoothstep(0.35, 0.75, Math.abs(((near.across % 3) + 4.5) % 3 - 1.5)) : 0;
    const STONE = [0.5, 0.55, 0.62], PALE = [0.78, 0.82, 0.88], FLOOR = [0.26, 0.29, 0.34];
    for (let c = 0; c < 3; c++) {
      const wall = (STONE[c] + B.rock[c] * 0.05) * grain * (1 - onRib) + PALE[c] * onRib;
      const flr = FLOOR[c] * grain * (1 - line * 0.6) + PALE[c] * line * 0.6;
      out[o + c] = wall * (1 - flooring) + flr * flooring;
    }
  }

  /** A passage from another style ends in the middle of the nearest nave (E3). */
  portal(x: number, z: number): [number, number] {
    const u = this.grain.u(x, z), n = this.nave(Math.round(this.grain.v(x, z) / ELVEN.spacing));
    return this.grain.xz(u, n.v);
  }

  /**
   * The vaults' writing: on some ribs, a line of Thread script in salt-white running up one face of
   * the rib and over the point of the arch, the keepers' account. Placed only where the rib is there
   * to carry it, by the tile that owns the nave's floor before it.
   */
  props(d: Dress): void {
    const E = ELVEN, W = E.writing, us: number[] = [], vs: number[] = [];
    for (const [x, z] of [[d.x0, d.z0], [d.x0 + d.size, d.z0], [d.x0, d.z0 + d.size], [d.x0 + d.size, d.z0 + d.size]]) { us.push(this.grain.u(x, z)); vs.push(this.grain.v(x, z)); }
    const seed = d.seed ^ 0x72696273;
    for (let k = Math.round(Math.min(...vs) / E.spacing) - 1; k <= Math.round(Math.max(...vs) / E.spacing) + 1; k++) {
      const n = this.nave(k);
      for (let b = Math.floor(Math.min(...us) / E.bay); b <= Math.ceil(Math.max(...us) / E.bay); b++) {
        const r = (m: number) => hashToFloat(hash2i(hash2i(seed, k, b), m, 7));
        if (r(0) >= W.rib) continue;
        const side = r(1) < 0.5 ? 1 : -1, ub = b * E.bay, [fx, fz] = this.grain.xz(ub + side * 2, n.v);
        if (!d.mine(fx, fz)) continue;
        const ins = this.rib(k, n, b, side, ribLine((m) => r(m + 2)), d.level.depth);
        // Rock behind the line and air before it, all along it.
        const p = ins.place, ok = p.kind === 'path' && p.pts.every((q, i) => i % 4 || (d.level.sdf(q[0] - p.nx * 0.3, q[1], q[2] - p.nz * 0.3) < 0 && d.level.sdf(q[0] + p.nx * 0.6, q[1], q[2] + p.nz * 0.6) > 0.1));
        if (!ok) continue;
        d.write(ins, W.pen * p.scale, 0.02, SALT);
        d.placed();
      }
    }
  }

  /** The line along rib b of nave k, on its face looking along u's `side`: up from where the vault springs on the left, over its point, down to its spring on the right. */
  private rib(k: number, n: Nave, b: number, side: number, text: string, depth: number): Inscription {
    const E = ELVEN, W = E.writing, ub = b * E.bay, u = ub + side * E.rib.half, mid = this.floor(k, ub);
    const [nx, nz] = this.grain.xz(side, 0), [ax, az] = this.grain.xz(0, 1);
    // Which way across the nave is right, as one faces the rib.
    const right = Math.sign(ax * nz - az * nx) || 1;
    // (From where it clears the arcade's columns, which stand on the rib's feet.)
    const C = E.column, L = 2 * n.half - W.inset, top = Math.acos(n.half / L), low = Math.acos((2 * n.half - C.out - C.shaft - 0.3) / L), N = 24, pts: V3[] = [];
    for (let i = 0; i <= 2 * N; i++) {
      // Up the left half of the arch to its point, then down the right; each half is a circle about the far side's spring.
      const phi = low + ((top - low) * (i <= N ? i : 2 * N - i)) / N, half = i <= N ? -1 : 1;
      const across = right * half * (L * Math.cos(phi) - n.half), floor = mid - E.dish * Math.max(0, 1 - (across / n.half) ** 2);
      const [x, z] = this.grain.xz(u, n.v + across);
      pts.push([x, floor + n.spring + L * Math.sin(phi), z]);
    }
    return { id: `rib:${depth}:${k}:${b}:${side}`, script: 'thread', text, where: RIB, place: alongPath(thread(text), pts, nx, nz, W.scale) };
  }

  climbable(): boolean {
    return true;
  }
}

/**
 * How far inside a vault (positive inside), at `across` from its middle and h over its floor: an
 * equilateral pointed arch of half span `half` springing `spring` over the floor, carried straight
 * down to the floor (the floor itself is not counted). Exact: two stadiums' intersection.
 */
function vault(across: number, h: number, half: number, spring: number): number {
  const up = Math.max(0, h - spring), r = 2 * half;
  return Math.min(r - Math.hypot(across + half, up), r - Math.hypot(across - half, up));
}
