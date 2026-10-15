/**
 * The excavation field: room-and-pillar workings, the Quarry's limestone (levels 1–2) and, with
 * the Salt Works' band, the salt mine's carved chambers (docs/design/town-and-first-strata.md §4;
 * the numbers per band are in src/gen/bands.ts). Layer 1 of the generator (docs/design/level-generator.md §3) for the excavation process.
 *
 * The level is a mosaic of *workings*: Voronoi cells about 220 m across. Each working was cut by a
 * different crew: its own pillar grid (spacing, pillar size, orientation), its own floor terrace and
 * ceiling height, and some have collapsed (missing and broken pillars, rubble hills, a higher broken
 * ceiling). Between workings stands natural rock, broken through in many places.
 *
 * Signed distance in metres: positive in air, negative in rock. The 2D part of the field (everything
 * except roughness) is computed once per column, so a chunk costs one column pass plus a cheap
 * per-sample pass.
 */
import { QUARRY, type Band } from './bands';
import { Noise, hash2i, hashToFloat, deriveSeed, smoothstep, clamp } from '@futuremagic/core';

/**
 * Pillars older than the Cisterns (docs/design/town-and-first-strata.md §4): the drum's radius as a
 * share of the pillar's half side, its top above the floor (min, extra up to 40% of the hall), its
 * courses and the depth of the worn joints between them, metres, and its stone's tint.
 */
export const OLDER = { drum: 1.55, top: [2.5, 4] as const, course: 1.1, joint: 0.07, stone: [0.62, 0.7, 0.6] as const };

/** Flutes across a pillar side: 0 on the ridges, 1 deep in a flute; none near the corners. */
function fluting(along: number, half: number, count: number): number {
  const t = (along / half + 1) / 2; // 0..1 across the side
  const edge = smoothstep(0, 0.12, t) * smoothstep(1, 0.88, t);
  return edge * (0.5 - 0.5 * Math.cos(t * count * 2 * Math.PI));
}

/** Average size of a working, metres. */
const WORKING = 220;
/** Floors, ceilings and collapse blend into the neighbouring working over this distance from the border, metres. */
const BLEND = 14;
/** How far the workings' feature points stray from their cell's middle (0..1). */
const JITTER = 0.85;

/**
 * The workings round a point: the one it is in, how far it is from that working's border (the
 * nearest Voronoi edge, exact), and every neighbour near enough to blend with, with its blend distance
 * (`blends`, under BLEND). A neighbour comes in and goes out smoothly, so anything blended from these
 * is continuous (blending with the second-nearest working alone is not: it switches at a three-way corner).
 */
interface Near {
  id: number;
  px: number;
  pz: number;
  border: number;
  count: number;
  ids: number[];
  pxs: number[];
  pzs: number[];
  blends: number[];
}

/** The workings round (x, z) (in WORKING cells, `seed` the cells' seed), into `out`. */
function workingsNear(seed: number, x: number, z: number, out: Near): Near {
  const xi = Math.floor(x), zi = Math.floor(z);
  const fx: number[] = FX, fz: number[] = FZ, hs: number[] = HS;
  let best = 0, f1 = Infinity;
  for (let k = 0, dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++, k++) {
      const cx = xi + dx, cz = zi + dz, h = hash2i(seed, cx, cz);
      hs[k] = h;
      fx[k] = cx + 0.5 + (hashToFloat(h) - 0.5) * JITTER;
      fz[k] = cz + 0.5 + (hashToFloat(h * 2654435761) - 0.5) * JITTER;
      const d = (fx[k] - x) ** 2 + (fz[k] - z) ** 2;
      if (d < f1) { f1 = d; best = k; }
    }
  }
  out.id = hs[best]; out.px = fx[best]; out.pz = fz[best];
  out.border = Infinity;
  out.count = 0;
  for (let k = 0; k < 25; k++) {
    if (k === best) continue;
    const ex = fx[k] - fx[best], ez = fz[k] - fz[best];
    const e = (fx[k] - x) ** 2 + (fz[k] - z) ** 2 - f1;
    out.border = Math.min(out.border, (e / (2 * Math.hypot(ex, ez))) * WORKING);
    // For blending, the border's distance as if every neighbour were one cell away: the same seen
    // from either side of any border, so a blend never jumps (the exact one does at a three-way corner).
    const b = (e / 2) * WORKING;
    if (b >= BLEND) continue;
    out.ids[out.count] = hs[k]; out.pxs[out.count] = fx[k]; out.pzs[out.count] = fz[k]; out.blends[out.count] = b;
    out.count++;
  }
  return out;
}
const FX: number[] = new Array(25), FZ: number[] = new Array(25), HS: number[] = new Array(25);
const newNear = (): Near => ({ id: 0, px: 0, pz: 0, border: 0, count: 0, ids: [], pxs: [], pzs: [], blends: [] });

/** What one working looks like (all derived from its cell hash). */
export interface Working {
  id: number;
  /** Pillar grid rotation, radians. */
  angle: number;
  /** Centre-to-centre pillar distance, metres. */
  spacing: number;
  /** Pillar side, metres. */
  pillar: number;
  /** Floor terrace height, metres. */
  floor: number;
  /** Floor to ceiling, metres. */
  height: number;
  /** 0 intact … 1 badly collapsed. */
  collapse: number;
  /** Not a working at all: a natural cavern the mine broke into (no pillars; rough, domed, uneven; rock columns, stalagmites and stalactites). */
  cavern: boolean;
  /** Feature point (centre) of the working. */
  cx: number;
  cz: number;
}

/** Per-column values: everything that does not depend on y. */
export interface Column {
  floor: number;
  ceiling: number;
  /** 2D distance to the nearest pillar side (positive outside it); Infinity where there is none. */
  pillarD: number;
  /** Pillar broken off: stump top and stub bottom heights (only for broken pillars). */
  stumpTop: number;
  stubBottom: number;
  /** Air term of the walls between workings (positive in air). */
  wall: number;
  working: Working;
  /** 0..1, how much of this column is rubble (for colour). */
  rubble: number;
  /** Distance to the border of the working, metres. */
  border: number;
  /** Collapse here, blended across the border like the floor. */
  collapse: number;
  /** 0..1, how much this is a natural cavern (blended across the border like the floor). */
  cavern: number;
  /**
   * The nearest pillar stands on an older one (the Cisterns): up to `olderTop` it is a round drum of
   * older stone (`pillarD` is the drum), above it the square pillar (`squareD`). -Infinity: not so.
   */
  olderTop: number;
  squareD: number;
}

/** Whether a pillar stands at a grid position: not at all, whole, or broken. */
export type PillarState = 'none' | 'whole' | 'broken';

/** How far it is from a column to the rock beside it (a pillar or a wall; not the floor or the roof), metres. */
export function rockDistance(col: Column): number {
  return Math.min(col.pillarD, col.wall);
}

export function newColumn(): Column {
  return { floor: 0, ceiling: 0, pillarD: Infinity, stumpTop: Infinity, stubBottom: -Infinity, wall: Infinity, working: workingFrom(0, 0, 0), rubble: 0, border: 0, collapse: 0, cavern: 0, olderTop: -Infinity, squareD: Infinity };
}

function workingFrom(id: number, cx: number, cz: number, b: Band = QUARRY): Working {
  const f = (k: number) => hashToFloat(hash2i(id, k, 7));
  // Most crews cut ordinary galleries; some cut grand halls with few, massive pillars.
  const grand = f(9) < b.grand;
  const spacing = grand ? b.grandSpacing[0] + b.grandSpacing[1] * f(1) : b.spacing[0] + b.spacing[1] * f(1);
  const cathedral = f(5) < b.cathedral;
  const [h0, h1] = cathedral ? b.cathedralHeight : grand ? b.grandHeight : b.height;
  return {
    id,
    angle: f(0) * Math.PI * 0.5,
    spacing,
    pillar: spacing * (grand ? 0.22 + 0.12 * f(2) : 0.32 + 0.18 * f(2)),
    floor: (Math.floor(f(3) * 3) - 1) * b.step,
    height: h0 + h1 * f(4),
    collapse: f(6) < b.collapse ? 0.3 + 0.5 * f(8) : 0,
    cavern: f(10) < b.caverns,
    cx,
    cz,
  };
}

export class QuarryField {
  private readonly noise: Noise;
  private readonly rough: Noise;
  private readonly cellSeed: number;
  private readonly pillarSeed: number;
  private readonly rubbleSeed: number;
  private readonly near: Near = newNear();
  private readonly probe: Near = newNear();
  private readonly workings = new Map<number, Working>();
  private readonly pillarCache = new Map<number, boolean>();

  constructor(readonly seed: number, readonly band: Band = QUARRY) {
    this.noise = new Noise(deriveSeed(seed, 'quarry', 'shape'));
    this.rough = new Noise(deriveSeed(seed, 'quarry', 'rough'));
    this.cellSeed = deriveSeed(seed, 'quarry', 'workings');
    this.pillarSeed = deriveSeed(seed, 'quarry', 'pillars');
    this.rubbleSeed = deriveSeed(seed, 'quarry', 'rubble');
  }

  /** The working that owns column (x, z). */
  workingAt(x: number, z: number): Working {
    const c = workingsNear(this.cellSeed, x / WORKING, z / WORKING, this.near);
    return this.working(c.id, c.px, c.pz);
  }

  private working(id: number, px: number, py: number): Working {
    let w = this.workings.get(id);
    if (!w) {
      if (this.workings.size > 4096) this.workings.clear();
      w = workingFrom(id, px * WORKING, py * WORKING, this.band);
      this.workings.set(id, w);
    }
    return w;
  }

  /** Fill `col` with the y-independent part of the field at (x, z). */
  column(x: number, z: number, col: Column): Column {
    const w = this.workingAt(x, z);
    const n = this.noise;
    col.working = w;

    // Near a border, floor, ceiling and collapse blend into the neighbouring workings (halfway on the
    // border), so the field is continuous where they meet (in an opening, a ramp instead of a cliff).
    const ring = this.near, border = ring.border;
    let sum = 1, floor = w.floor, height = w.height, collapse = w.collapse, cavern = w.cavern ? 1 : 0;
    for (let i = 0; i < ring.count; i++) {
      const nb = this.working(ring.ids[i], ring.pxs[i], ring.pzs[i]), s = smoothstep(0, BLEND, ring.blends[i]);
      const k = (1 - s) / (1 + s); // (one neighbour: its share is (1 - s) / 2, as a lerp to halfway)
      sum += k; floor += k * nb.floor; height += k * nb.height; collapse += k * nb.collapse; cavern += k * (nb.cavern ? 1 : 0);
    }
    floor /= sum; height /= sum; collapse /= sum; cavern /= sum;
    col.border = border;
    col.collapse = collapse;
    col.cavern = cavern;

    // Walls between workings: natural rock, broken through where the opening noise is high.
    const thick = 7 + 5 * n.n2(x / 90 + 31.7, z / 90);
    const opening = (n.n2(x / 70 - 12.3, z / 70 + 4.1) - 0.1) * 30;
    col.wall = Math.max(border - thick, opening);

    // Rubble: cones of fallen rock, many in collapsed workings, a few elsewhere.
    let rubble = 0;
    const rx = Math.floor(x / 40), rz = Math.floor(z / 40);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const h = hash2i(this.rubbleSeed, rx + dx, rz + dz);
        // A cone grows in as collapse rises past its roll (no cone pops in at a border).
        const grow = clamp((0.08 + 0.8 * collapse - hashToFloat(h)) / 0.1, 0, 1);
        if (grow === 0) continue;
        const px = (rx + dx + hashToFloat(h * 31 + 1)) * 40, pz = (rz + dz + hashToFloat(h * 31 + 2)) * 40;
        const r = 14 + 18 * hashToFloat(h * 31 + 3);
        const ht = (3 + 11 * hashToFloat(h * 31 + 4)) * (0.4 + collapse) * grow;
        const d = Math.hypot(x - px, z - pz) / r;
        if (d < 1) rubble = Math.max(rubble, ht * (1 - d) ** 1.6);
      }
    }
    col.rubble = clamp(rubble / 6, 0, 1);
    // A cavern's floor rolls in long swells (gentle enough to walk), its roof vaults and dips.
    const swell = cavern * n.fbm2(x / 45 + 3.1, z / 45 - 8.2, 3) * 2.8;
    col.floor = floor + n.fbm2(x / 30, z / 30, 3) * 0.6 + rubble + swell;

    // Ceiling: a cut ceiling with a slight sag; collapsed workings break upwards into domes.
    const dome = collapse * (10 + 14 * n.n2(x / 60 + 7.7, z / 60 - 3.3));
    const vault = cavern * n.fbm2(x / 38 - 5.5, z / 38 + 2.9, 3) * 9;
    col.ceiling = floor + height + n.n2(x / 50, z / 50) * 1.2 + Math.max(0, dome) + swell + vault;

    // Pillars: a rotated square grid; some missing, in collapsed workings many broken.
    const [u, v] = this.toGrid(w, x, z);
    const s = w.spacing;
    const iu = Math.floor(u / s), iv = Math.floor(v / s);
    // The nearest standing pillar among the 3 × 3 grid cells around (missing ones are skipped, so the
    // distance stays continuous where a pillar is missing).
    col.pillarD = Infinity;
    col.stumpTop = Infinity;
    col.stubBottom = -Infinity;
    col.olderTop = -Infinity;
    col.squareD = Infinity;
    const half = w.pillar / 2;
    const near = border < half * Math.SQRT2 + 3 + 2.2 * s; // only then can a pillar be cut by the border
    for (let dv = -1; dv <= 1; dv++) {
      for (let du = -1; du <= 1; du++) {
        const state = this.pillarAt(w, iu + du, iv + dv, near);
        if (state === 'none') continue;
        const lu = u - (iu + du + 0.5) * s, lv = v - (iv + dv + 0.5) * s;
        const qx = Math.abs(lu) - half, qz = Math.abs(lv) - half;
        let d = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
        // Carved pillars: flutes down each side (the salt miners carved theirs like a church's).
        if (this.band.flutes > 0 && d > -1) d += this.band.flutes * fluting(qx > qz ? lv : lu, half, this.band.fluteCount);
        // Some stand on something older: a round drum, wider than the pillar, up to a few metres.
        const ph = hash2i(this.pillarSeed ^ w.id, iu + du, iv + dv);
        const older = state === 'whole' && hashToFloat(ph * 13 + 7) < this.band.older;
        const square = d;
        if (older) d = Math.hypot(lu, lv) - half * OLDER.drum;
        if (d >= col.pillarD) continue;
        col.pillarD = d;
        col.olderTop = older ? w.floor + OLDER.top[0] + hashToFloat(ph * 13 + 8) * Math.min(OLDER.top[1], w.height * 0.4) : -Infinity;
        col.squareD = square;
        if (state === 'broken') {
          // A stump from the floor and a stub from the ceiling.
          col.stumpTop = w.floor + 1 + hashToFloat(ph * 13 + 5) * w.height * 0.45;
          col.stubBottom = w.floor + w.height * (0.7 + 0.25 * hashToFloat(ph * 13 + 6));
        } else {
          col.stumpTop = Infinity;
          col.stubBottom = -Infinity;
        }
      }
    }
    // A cavern's rock: columns where the rock was never dissolved, and where they did not join up,
    // a stalagmite from the floor and a stalactite from the roof. They fade out at the border.
    if (cavern > 0) {
      const blob = (0.42 - n.n2(x / 26 - 21.7, z / 26 + 13.9)) * 14 + (1 - cavern) * 24;
      if (blob < col.pillarD) {
        col.pillarD = blob;
        col.olderTop = -Infinity;
        const join = n.n2(x / 70 + 9.1, z / 70 - 4.4);
        if (join < 0.15) {
          const h = col.ceiling - col.floor;
          col.stumpTop = col.floor + h * (0.15 + 0.3 * (0.5 + 0.5 * n.n2(x / 9, z / 9)));
          col.stubBottom = col.ceiling - h * (0.12 + 0.25 * (0.5 + 0.5 * n.n2(x / 11 + 4, z / 11)));
        } else {
          col.stumpTop = Infinity;
          col.stubBottom = -Infinity;
        }
      }
    }
    // Safety: nothing of a pillar reaches the border itself.
    col.pillarD = Math.max(col.pillarD, 1.5 - border);
    return col;
  }

  /** World (x, z) to the working's pillar-grid coordinates (u, v), metres from its centre. */
  toGrid(w: Working, x: number, z: number): [number, number] {
    const ca = Math.cos(w.angle), sa = Math.sin(w.angle);
    const lx = x - w.cx, lz = z - w.cz;
    return [lx * ca - lz * sa, lx * sa + lz * ca];
  }

  /** Pillar-grid (u, v) back to world (x, z). */
  fromGrid(w: Working, u: number, v: number): [number, number] {
    const ca = Math.cos(w.angle), sa = Math.sin(w.angle);
    return [w.cx + u * ca + v * sa, w.cz - u * sa + v * ca];
  }

  /**
   * Pillar (iu, iv) of working w (centred at grid ((iu + 0.5)·s, (iv + 0.5)·s)). `nearBorder: false`
   * skips the border check, for callers that know the pillar is far inside the working.
   */
  pillarAt(w: Working, iu: number, iv: number, nearBorder = true): PillarState {
    if (w.cavern) return 'none';
    const roll = hashToFloat(hash2i(this.pillarSeed ^ w.id, iu, iv));
    if (roll < 0.04 + 0.45 * w.collapse) return 'none';
    // Crews left no pillar standing across the border of their working.
    if (nearBorder && !this.pillarInside(w, iu, iv)) return 'none';
    return roll < 0.04 + 0.9 * w.collapse ? 'broken' : 'whole';
  }

  /** Whether pillar (iu, iv) stands clear of its working's border (cached). */
  private pillarInside(w: Working, iu: number, iv: number): boolean {
    const key = hash2i(w.id, iu, iv);
    let inside = this.pillarCache.get(key);
    if (inside === undefined) {
      const [x, z] = this.fromGrid(w, (iu + 0.5) * w.spacing, (iv + 0.5) * w.spacing);
      const c = workingsNear(this.cellSeed, x / WORKING, z / WORKING, this.probe);
      inside = c.id === w.id && c.border > (w.pillar / 2) * Math.SQRT2 + 3;
      if (this.pillarCache.size > 65536) this.pillarCache.clear();
      this.pillarCache.set(key, inside);
    }
    return inside;
  }

  /**
   * The water table at (x, z): groundwater fills every hollow below it. It sits a little above the
   * lowest floor terrace and wanders slowly across the level, so some low workings are flooded,
   * some only have puddles, and higher terraces stay dry.
   */
  water(x: number, z: number): number {
    return this.band.water[0] + this.band.water[1] * (0.5 + 0.5 * this.noise.n2(x / 450 - 17.9, z / 450 + 41.3));
  }

  /** Whether the rock nearest (x, y, z), a point in the air, can be climbed: all rock can (decision L1); built walls (src/gen/cellar.ts) cannot. */
  climbable(_x: number, _y: number, _z: number): boolean {
    return true;
  }

  /** The field at height y in a column filled by `column`. */
  at(col: Column, x: number, y: number, z: number): number {
    let pillar = col.pillarD;
    if (col.stumpTop !== Infinity) pillar = Math.min(Math.max(pillar, y - col.stumpTop), Math.max(pillar, col.stubBottom - y));
    // An older drum (in courses, the joints worn into grooves) with the square pillar built on it.
    if (col.olderTop !== -Infinity) {
      const course = Math.abs(((y - col.working.floor) / OLDER.course) % 1 - 0.5) * 2;
      pillar = Math.min(Math.max(col.squareD, col.olderTop - y), Math.max(pillar + OLDER.joint * smoothstep(0.75, 1, course), y - col.olderTop));
    }
    // Natural rock between workings is rough in 3D; the cut stone is nearly smooth.
    const k = smoothstep(9, 3, col.wall);
    const wall = k > 0 ? col.wall + k * (this.rough.n3(x / 8, y / 8, z / 8) * 1.6 + this.rough.n3(x / 3, y / 3, z / 3) * 0.5) : col.wall;
    const d = Math.min(y - col.floor, col.ceiling - y, pillar, wall);
    let r = this.rough.n3(x / 6, y / 6, z / 6) * 0.35 + this.rough.n3(x / 1.7, y / 1.7, z / 1.7) * 0.08;
    // A cavern is all natural rock: rough everywhere above the floor (which stays walkable).
    if (col.cavern > 0) r += col.cavern * smoothstep(0.8, 3, y - col.floor) * (this.rough.n3(x / 10 + 3, y / 10, z / 10) * 1.8 + this.rough.n3(x / 3.5, y / 3.5, z / 3.5) * 0.45);
    return d + r;
  }

  /** Limestone colour at a surface point (linear RGB, written into out). */
  color(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    const B = this.band;
    const band = 0.5 + 0.5 * Math.sin(y * 1.3 + this.noise.n2(x / 25, z / 25) * 2);
    const dust = smoothstep(2.5, 0, y - col.floor); // floors are dusty and lighter
    const soot = smoothstep(col.ceiling - 3, col.ceiling, y) * 0.35; // lamp soot under the ceiling
    let r = B.rock[0] + B.layers[0] * band, g = B.rock[1] + B.layers[1] * band, b = B.rock[2] + B.layers[2] * band;
    if ((col.wall < 1.5 || col.cavern > 0.5) && y - col.floor > 0.5) { r *= B.natural[0]; g *= B.natural[1]; b *= B.natural[2]; } // natural rock between workings
    r += dust * B.dust[0]; g += dust * B.dust[1]; b += dust * B.dust[2];
    r += col.rubble * 0.04; g += col.rubble * 0.03;
    // The older stone: darker, greener, nothing like the cistern's concrete.
    if (y < col.olderTop + 0.05 && col.pillarD < 1.5 && y - col.floor > 0.15) { r *= OLDER.stone[0]; g *= OLDER.stone[1]; b *= OLDER.stone[2]; }
    const k = 1 - soot;
    out[o] = r * k; out[o + 1] = g * k; out[o + 2] = b * k;
  }
}
