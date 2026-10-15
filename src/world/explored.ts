/**
 * What a grandchild has seen of each level (exploration memory, dunfinity-plan.md G10): the floor
 * round them, in 1 m cells, marked as they go. The map (src/app/mapView.ts) draws it. Pure; kept
 * with the grandchild in the save.
 */
import type { Level } from '../gen/level';

export const EXPLORE = {
  /** Cell size, metres. */
  cell: 1,
  /** How far round the nobody the floor is marked seen, metres. */
  radius: 9,
} as const;

/** One number per cell (i, j), for cells within ±2^20 of the origin. */
const key = (i: number, j: number) => (i + 0x100000) * 0x200000 + (j + 0x100000);

export class Explored {
  private readonly seen = new Map<number, Set<number>>();

  /** Mark the open floor within EXPLORE.radius of (x, y, z) on `level` seen. */
  see(level: Level, x: number, y: number, z: number): void {
    let s = this.seen.get(level.depth);
    if (!s) this.seen.set(level.depth, (s = new Set()));
    const c = EXPLORE.cell, n = Math.ceil(EXPLORE.radius / c), ci = Math.floor(x / c), cj = Math.floor(z / c);
    for (let j = cj - n; j <= cj + n; j++) for (let i = ci - n; i <= ci + n; i++) {
      const k = key(i, j);
      if (s.has(k)) continue;
      const px = (i + 0.5) * c, pz = (j + 0.5) * c;
      if (Math.hypot(px - x, pz - z) > EXPLORE.radius) continue;
      // Open floor within a storey of the nobody (not the rock, not a hall far above or below).
      const g = level.groundAt(px, pz);
      if (Math.abs(g - y) < 6 && level.sdf(px, g + 1, pz) > 0.1) s.add(k);
    }
  }

  /** Whether cell (i, j) of `depth` has been seen. */
  has(depth: number, i: number, j: number): boolean {
    return this.seen.get(depth)?.has(key(i, j)) ?? false;
  }

  /** How many cells of `depth` have been seen. */
  cells(depth: number): number {
    return this.seen.get(depth)?.size ?? 0;
  }

  /** The seen cells, to keep (src/persist/save.ts); `Explored.from` puts them back. */
  get data(): Record<number, number[]> {
    return Object.fromEntries([...this.seen].map(([d, s]) => [d, [...s]]));
  }

  static from(d: Record<string, readonly number[]>): Explored {
    const e = new Explored();
    for (const depth in d) e.seen.set(Number(depth), new Set(d[depth]));
    return e;
  }
}
