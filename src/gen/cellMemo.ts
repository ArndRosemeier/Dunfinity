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
