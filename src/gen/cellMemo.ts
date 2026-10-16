import { Rng, deriveSeed } from '@futuremagic/core';

/**
 * Things scattered one per grid cell (shafts, rat nests), decided by a pure function of the cell
 * and worked out once: the first look at a cell asks `decide(i, j, key)`, later looks reuse it.
 * `key` is the cell's number, unique for |i|, |j| < 32768.
 */
export class CellMemo<T> {
  private readonly cells = new Map<number, T>();

  constructor(private readonly decide: (i: number, j: number, key: number) => T) {}

  /** What cell (i, j) holds. */
  at(i: number, j: number): T {
    const key = (i + 32768) * 65536 + (j + 32768);
    let v = this.cells.get(key);
    if (v === undefined && !this.cells.has(key)) {
      v = this.decide(i, j, key);
      this.cells.set(key, v);
    }
    return v as T;
  }
}

/** A thing standing at a place (x, z). */
export interface Sited {
  readonly x: number;
  readonly z: number;
}

/**
 * Things seeded at most one per cell `size` wide over a level (living stalagmites, glow-worm skies,
 * salt blooms): a subclass decides a cell (`cellSite`, with that cell's own seeded `Rng`), and the
 * field finds them near a place.
 */
export abstract class SiteField<T extends Sited> {
  private readonly cells: CellMemo<T | null>;

  constructor(private readonly size: number, seed: number) {
    this.cells = new CellMemo((i, j, key) => this.cellSite(i, j, new Rng(deriveSeed(seed, key))));
  }

  /** The thing of cell (i, j), if it has one. */
  protected abstract cellSite(i: number, j: number, rng: Rng): T | null;

  /** The things within `r` of (x, z), into `out`. */
  near(x: number, z: number, r: number, out: T[] = []): T[] {
    const size = this.size;
    out.length = 0;
    for (let j = Math.floor((z - r) / size); j <= Math.floor((z + r) / size); j++) for (let i = Math.floor((x - r) / size); i <= Math.floor((x + r) / size); i++) {
      const s = this.cells.at(i, j);
      if (s && (s.x - x) ** 2 + (s.z - z) ** 2 <= r * r) out.push(s);
    }
    return out;
  }

  /** The thing nearest (x, z) within `far` m, or null. */
  nearest(x: number, z: number, far = 300): T | null {
    let best: T | null = null, bd = Infinity;
    for (const s of this.near(x, z, far)) {
      const d = (s.x - x) ** 2 + (s.z - z) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }
}
