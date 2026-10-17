/**
 * Things standing in a cave's chambers (roots, giant mushrooms, crystals): the one way a style puts
 * solid things of its own in the air of each chamber of a grid of cells (the karst's, the geodes'),
 * made per chamber from a seed, and asks a column only for the few that pass near it.
 *
 * A column keeps the things within THING_REACH of it in plan; a style using this caps its field at
 * THING_REACH, so a thing that leaves the list (it was further than that) changes nothing.
 *
 * Pure, like every style.
 */
import { hash2i, hashToFloat } from '@futuremagic/core';
import type { Karst } from './karst';
import type { Column } from './quarry';

/** A chamber of the karst's cave. */
export type Chamber = NonNullable<ReturnType<Karst['chamber']>>;

/** Where the chambers are: at most one in each cell of a grid `cell` metres square, its middle (x, z) and radius r in plan. */
export interface Chambers<C extends { x: number; z: number; r: number }> {
  readonly cell: number;
  chamber(i: number, j: number): C | null;
}

/** The karst cave's chambers, as a style built on a `Karst` asks for them. */
export const karstChambers = (cave: Karst): Chambers<Chamber> => ({ cell: cave.K.cell, chamber: (i, j) => cave.chamber(i, j) });

/** How far in plan a column looks for things, metres; the field is capped at this. */
export const THING_REACH = 3;

/** The side of the squares `column` keeps its lists for, metres. */
const BUCKET = 2;
const BIAS = 2 ** 24, SPAN = 2 ** 25;

export interface ThingKind<T, C = Chamber> {
  /** The things in chamber `c`, rolled with `f` (a fresh number in [0, 1) each call). */
  make(c: C, f: () => number): T[];
  /** How far from (x, z) to the thing in plan (a lower bound on the 3D distance). */
  plan(t: T, x: number, z: number): number;
  /** How far from (x, y, z) to the thing (positive outside it). */
  dist(t: T, x: number, y: number, z: number): number;
  /** No thing reaches further than this many chamber radii from its chamber's middle, plus `pad` metres. */
  radii: number;
  pad: number;
}

export class CaveThings<T, C extends { x: number; z: number; r: number } = Chamber> {
  private readonly made = new Map<number, T[]>();
  private readonly near = new WeakMap<Column, readonly T[]>();
  /** The things near each BUCKET square, as `column` hands them out. */
  private readonly buckets = new Map<number, readonly T[]>();

  constructor(private readonly cave: Chambers<C>, private readonly seed: number, private readonly kind: ThingKind<T, C>) {}

  /** The things of the chamber of cell (i, j) (its chamber `c`). */
  of(i: number, j: number, c: C): T[] {
    const key = hash2i(this.seed, i, j);
    let things = this.made.get(key);
    if (!things) {
      let m = 0;
      things = this.kind.make(c, () => hashToFloat(hash2i(key, m++, 5)));
      if (this.made.size > 4096) this.made.clear();
      this.made.set(key, things);
    }
    return things;
  }

  /**
   * Keeps the things near (x, z) with the column (call from the style's `column`). The list is the
   * one of the BUCKET-metre square (x, z) lies in, made once: every thing within THING_REACH in plan
   * of any point of the square (more than the column needs, which changes nothing: the extra ones are
   * further than THING_REACH from it). Creatures walking ask for columns thousands of times a frame.
   */
  column(x: number, z: number, col: Column): void {
    const bi = Math.floor(x / BUCKET), bj = Math.floor(z / BUCKET), key = (bi + BIAS) * SPAN + (bj + BIAS);
    let near = this.buckets.get(key);
    if (!near) {
      near = this.bucket(bi, bj);
      if (this.buckets.size > 8192) this.buckets.clear();
      this.buckets.set(key, near);
    }
    this.near.set(col, near);
  }

  /** The things within THING_REACH in plan of the bucket (bi, bj). */
  private bucket(bi: number, bj: number): readonly T[] {
    const near: T[] = [];
    const K = this.kind, cell = this.cave.cell, half = BUCKET / 2, cx = (bi + 0.5) * BUCKET, cz = (bj + 0.5) * BUCKET;
    // (Plan distances change by at most a metre a metre, so what is within REACH of any point of the square is within REACH + its half diagonal of its middle.)
    const reach = THING_REACH + half * Math.SQRT2;
    const i0 = Math.floor((cx - half) / cell), i1 = Math.floor((cx + half) / cell), j0 = Math.floor((cz - half) / cell), j1 = Math.floor((cz + half) / cell);
    for (let j = j0 - 1; j <= j1 + 1; j++) for (let i = i0 - 1; i <= i1 + 1; i++) {
      const c = this.cave.chamber(i, j);
      if (!c || Math.hypot(cx - c.x, cz - c.z) > c.r * K.radii + K.pad + reach) continue;
      for (const t of this.of(i, j, c)) if (K.plan(t, cx, cz) < reach) near.push(t);
    }
    return near;
  }

  /** How far from the nearest thing near the column (Infinity: none near). */
  at(col: Column, x: number, y: number, z: number): number {
    let d = Infinity;
    for (const t of this.near.get(col) ?? []) d = Math.min(d, this.kind.dist(t, x, y, z));
    return d;
  }

  /** The nearest thing near the column, if one is within `within` metres. */
  nearest(col: Column, x: number, y: number, z: number, within: number): T | null {
    let best: T | null = null, bd = within;
    for (const t of this.near.get(col) ?? []) { const d = this.kind.dist(t, x, y, z); if (d < bd) { bd = d; best = t; } }
    return best;
  }
}

/** A straight piece of something round (a root, a crystal): from a to b, radius ra to rb. */
export interface Taper {
  ax: number; ay: number; az: number;
  bx: number; by: number; bz: number;
  ra: number; rb: number;
}

/** Plan distance from (x, z) to a piece's outside (a lower bound on the 3D distance). */
export function taperPlan(s: Taper, x: number, z: number): number {
  const ex = s.bx - s.ax, ez = s.bz - s.az, l2 = ex * ex + ez * ez;
  const t = l2 > 1e-9 ? Math.max(0, Math.min(1, ((x - s.ax) * ex + (z - s.az) * ez) / l2)) : 0;
  return Math.hypot(x - s.ax - ex * t, z - s.az - ez * t) - Math.max(s.ra, s.rb);
}

/** Distance from a point to a piece: a capsule thinning from one end to the other. */
export function taperDist(s: Taper, x: number, y: number, z: number): number {
  const ex = s.bx - s.ax, ey = s.by - s.ay, ez = s.bz - s.az, l2 = ex * ex + ey * ey + ez * ez;
  const t = Math.max(0, Math.min(1, ((x - s.ax) * ex + (y - s.ay) * ey + (z - s.az) * ez) / l2));
  return Math.hypot(x - s.ax - ex * t, y - s.ay - ey * t, z - s.az - ez * t) - (s.ra + (s.rb - s.ra) * t);
}
