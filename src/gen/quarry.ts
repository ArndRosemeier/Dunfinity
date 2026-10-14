/**
 * The Quarry (levels 1–2, docs/design/town-and-first-strata.md §4): room-and-pillar limestone
 * workings. Layer 1 of the generator (docs/design/level-generator.md §3) for the excavation process.
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
import { Noise, cellular2, cellBorder, hash2i, hashToFloat, deriveSeed, smoothstep, clamp, lerp, type CellResult } from '@futuremagic/core';

/** Average size of a working, metres. */
const WORKING = 220;
/** Floors, ceilings and collapse blend into the neighbouring working over this distance from the border, metres. */
const BLEND = 14;

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
}

export function newColumn(): Column {
  return { floor: 0, ceiling: 0, pillarD: Infinity, stumpTop: Infinity, stubBottom: -Infinity, wall: Infinity, working: workingFrom(0, 0, 0), rubble: 0 };
}

function workingFrom(id: number, cx: number, cz: number): Working {
  const f = (k: number) => hashToFloat(hash2i(id, k, 7));
  // Most crews cut ordinary galleries; some cut grand halls with few, massive pillars.
  const grand = f(9) < 0.3;
  const spacing = grand ? 32 + 22 * f(1) : 14 + 12 * f(1);
  const cathedral = f(5) < 0.15;
  return {
    id,
    angle: f(0) * Math.PI * 0.5,
    spacing,
    pillar: spacing * (grand ? 0.22 + 0.12 * f(2) : 0.32 + 0.18 * f(2)),
    floor: (Math.floor(f(3) * 3) - 1) * 4,
    height: cathedral ? 45 + 20 * f(4) : grand ? 28 + 22 * f(4) : 12 + 26 * f(4),
    collapse: f(6) < 0.3 ? 0.3 + 0.5 * f(8) : 0,
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
  private readonly cell: CellResult = { f1: 0, f2: 0, cx: 0, cy: 0, cz: 0, id: 0, px: 0, py: 0, pz: 0, id2: 0, px2: 0, py2: 0, pz2: 0 };
  private readonly probe: CellResult = { f1: 0, f2: 0, cx: 0, cy: 0, cz: 0, id: 0, px: 0, py: 0, pz: 0, id2: 0, px2: 0, py2: 0, pz2: 0 };
  private readonly workings = new Map<number, Working>();
  private readonly pillarCache = new Map<number, boolean>();

  constructor(readonly seed: number) {
    this.noise = new Noise(deriveSeed(seed, 'quarry', 'shape'));
    this.rough = new Noise(deriveSeed(seed, 'quarry', 'rough'));
    this.cellSeed = deriveSeed(seed, 'quarry', 'workings');
    this.pillarSeed = deriveSeed(seed, 'quarry', 'pillars');
    this.rubbleSeed = deriveSeed(seed, 'quarry', 'rubble');
  }

  /** The working that owns column (x, z). */
  workingAt(x: number, z: number): Working {
    const c = cellular2(this.cellSeed, x / WORKING, z / WORKING, 0.85, this.cell);
    return this.working(c.id, c.px, c.py);
  }

  private working(id: number, px: number, py: number): Working {
    let w = this.workings.get(id);
    if (!w) {
      if (this.workings.size > 4096) this.workings.clear();
      w = workingFrom(id, px * WORKING, py * WORKING);
      this.workings.set(id, w);
    }
    return w;
  }

  /** Fill `col` with the y-independent part of the field at (x, z). */
  column(x: number, z: number, col: Column): Column {
    const w = this.workingAt(x, z);
    const n = this.noise;
    col.working = w;

    // Near the border, floor, ceiling and collapse blend halfway into the neighbouring working, so the
    // field is continuous where the two meet (in an opening, a ramp instead of a cliff).
    const border = cellBorder(this.cell) * WORKING;
    const nb = this.working(this.cell.id2, this.cell.px2, this.cell.py2);
    const t = 0.5 + 0.5 * smoothstep(0, BLEND, border);
    const floor = lerp(nb.floor, w.floor, t);
    const height = lerp(nb.height, w.height, t);
    const collapse = lerp(nb.collapse, w.collapse, t);

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
    col.floor = floor + n.fbm2(x / 30, z / 30, 3) * 0.6 + rubble;

    // Ceiling: a cut ceiling with a slight sag; collapsed workings break upwards into domes.
    const dome = collapse * (10 + 14 * n.n2(x / 60 + 7.7, z / 60 - 3.3));
    col.ceiling = floor + height + n.n2(x / 50, z / 50) * 1.2 + Math.max(0, dome);

    // Pillars: a rotated square grid; some missing, in collapsed workings many broken.
    const ca = Math.cos(w.angle), sa = Math.sin(w.angle);
    const lx = x - w.cx, lz = z - w.cz;
    const u = lx * ca - lz * sa, v = lx * sa + lz * ca;
    const s = w.spacing;
    const iu = Math.floor(u / s), iv = Math.floor(v / s);
    // The nearest standing pillar among the 3 × 3 grid cells around (missing ones are skipped, so the
    // distance stays continuous where a pillar is missing).
    col.pillarD = Infinity;
    col.stumpTop = Infinity;
    col.stubBottom = -Infinity;
    const half = w.pillar / 2;
    for (let dv = -1; dv <= 1; dv++) {
      for (let du = -1; du <= 1; du++) {
        const ph = hash2i(this.pillarSeed ^ w.id, iu + du, iv + dv);
        const roll = hashToFloat(ph);
        if (roll < 0.04 + 0.45 * w.collapse) continue; // missing
        const pu = (iu + du + 0.5) * s, pv = (iv + dv + 0.5) * s;
        // Crews left no pillar standing across the border of their working.
        if (border < half * Math.SQRT2 + 3 + 2.2 * s && !this.pillarInside(w, iu + du, iv + dv, pu * ca + pv * sa, -pu * sa + pv * ca, half)) continue;
        const fu = u - pu, fv = v - pv;
        const qx = Math.abs(fu) - half, qz = Math.abs(fv) - half;
        const d = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
        if (d >= col.pillarD) continue;
        col.pillarD = d;
        if (roll < 0.04 + 0.9 * w.collapse) {
          // Broken: a stump from the floor and a stub from the ceiling.
          col.stumpTop = w.floor + 1 + hashToFloat(ph * 13 + 5) * w.height * 0.45;
          col.stubBottom = w.floor + w.height * (0.7 + 0.25 * hashToFloat(ph * 13 + 6));
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

  /** Whether pillar (iu, iv), centred at (lx, lz) from the working's centre, stands clear of its border. */
  private pillarInside(w: Working, iu: number, iv: number, lx: number, lz: number, half: number): boolean {
    const key = hash2i(w.id, iu, iv);
    let inside = this.pillarCache.get(key);
    if (inside === undefined) {
      const c = cellular2(this.cellSeed, (w.cx + lx) / WORKING, (w.cz + lz) / WORKING, 0.85, this.probe);
      inside = c.id === w.id && cellBorder(c) * WORKING > half * Math.SQRT2 + 3;
      if (this.pillarCache.size > 65536) this.pillarCache.clear();
      this.pillarCache.set(key, inside);
    }
    return inside;
  }

  /** The field at height y in a column filled by `column`. */
  at(col: Column, x: number, y: number, z: number): number {
    let pillar = col.pillarD;
    if (col.stumpTop !== Infinity) pillar = Math.min(Math.max(pillar, y - col.stumpTop), Math.max(pillar, col.stubBottom - y));
    // Natural rock between workings is rough in 3D; the cut stone is nearly smooth.
    const k = smoothstep(9, 3, col.wall);
    const wall = k > 0 ? col.wall + k * (this.rough.n3(x / 8, y / 8, z / 8) * 1.6 + this.rough.n3(x / 3, y / 3, z / 3) * 0.5) : col.wall;
    const d = Math.min(y - col.floor, col.ceiling - y, pillar, wall);
    const r = this.rough.n3(x / 6, y / 6, z / 6) * 0.35 + this.rough.n3(x / 1.7, y / 1.7, z / 1.7) * 0.08;
    return d + r;
  }

  /** Limestone colour at a surface point (linear RGB, written into out). */
  color(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    const band = 0.5 + 0.5 * Math.sin(y * 1.3 + this.noise.n2(x / 25, z / 25) * 2);
    const dust = smoothstep(2.5, 0, y - col.floor); // floors are dusty and lighter
    const soot = smoothstep(col.ceiling - 3, col.ceiling, y) * 0.35; // lamp soot under the ceiling
    let r = 0.46 + 0.05 * band, g = 0.42 + 0.045 * band, b = 0.35 + 0.035 * band;
    if (col.wall < 1.5 && y - col.floor > 0.5) { r *= 0.82; g *= 0.82; b *= 0.85; } // natural rock between workings
    r += dust * 0.08; g += dust * 0.075; b += dust * 0.065;
    r += col.rubble * 0.04; g += col.rubble * 0.03;
    const k = 1 - soot;
    out[o] = r * k; out[o + 1] = g * k; out[o + 2] = b * k;
  }
}
