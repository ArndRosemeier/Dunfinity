/**
 * Things standing in a karst-shaped cave's chambers (roots, giant mushrooms): the one way a style
 * built on `Karst` puts solid things of its own in the air of each chamber, made per chamber from
 * a seed, and asks a column only for the few that pass near it.
 *
 * A column keeps the things within THING_REACH of it in plan; a style using this caps its field at
 * THING_REACH, so a thing that leaves the list (it was further than that) changes nothing.
 *
 * Pure, like every style.
 */
import { hash2i, hashToFloat } from '@futuremagic/core';
import { KARST, type Karst } from './karst';
import type { Column } from './quarry';

/** A chamber of the cave. */
export type Chamber = NonNullable<ReturnType<Karst['chamber']>>;

/** How far in plan a column looks for things, metres; the field is capped at this. */
export const THING_REACH = 3;

export interface ThingKind<T> {
  /** The things in chamber `c`, rolled with `f` (a fresh number in [0, 1) each call). */
  make(c: Chamber, f: () => number): T[];
  /** How far from (x, z) to the thing in plan (a lower bound on the 3D distance). */
  plan(t: T, x: number, z: number): number;
  /** How far from (x, y, z) to the thing (positive outside it). */
  dist(t: T, x: number, y: number, z: number): number;
  /** No thing reaches further than this many chamber radii from its chamber's middle, plus `pad` metres. */
  radii: number;
  pad: number;
}

export class CaveThings<T> {
  private readonly made = new Map<number, T[]>();
  private readonly near = new WeakMap<Column, T[]>();

  constructor(private readonly cave: Karst, private readonly seed: number, private readonly kind: ThingKind<T>) {}

  /** The things of the chamber of karst cell (i, j). */
  private of(i: number, j: number, c: Chamber): T[] {
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

  /** Keeps the things near (x, z) with the column (call from the style's `column`). */
  column(x: number, z: number, col: Column): void {
    let near = this.near.get(col);
    if (!near) { near = []; this.near.set(col, near); }
    near.length = 0;
    const K = this.kind, i0 = Math.floor(x / KARST.cell), j0 = Math.floor(z / KARST.cell);
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) {
      const c = this.cave.chamber(i, j);
      if (!c || Math.hypot(x - c.x, z - c.z) > c.r * K.radii + K.pad + THING_REACH) continue;
      for (const t of this.of(i, j, c)) if (K.plan(t, x, z) < THING_REACH) near.push(t);
    }
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
