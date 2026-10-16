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

/** The things of `memo` (at most one per cell `size` wide) within `r` of (x, z), into `out`. */
export function sitesNear<T extends Sited>(memo: CellMemo<T | null>, size: number, x: number, z: number, r: number, out: T[] = []): T[] {
  out.length = 0;
  for (let j = Math.floor((z - r) / size); j <= Math.floor((z + r) / size); j++) for (let i = Math.floor((x - r) / size); i <= Math.floor((x + r) / size); i++) {
    const s = memo.at(i, j);
    if (s && (s.x - x) ** 2 + (s.z - z) ** 2 <= r * r) out.push(s);
  }
  return out;
}

/** The thing of `memo` nearest (x, z) within `far`, or null. */
export function siteNearest<T extends Sited>(memo: CellMemo<T | null>, size: number, x: number, z: number, far: number): T | null {
  let best: T | null = null, bd = Infinity;
  for (const s of sitesNear(memo, size, x, z, far)) {
    const d = (s.x - x) ** 2 + (s.z - z) ** 2;
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
