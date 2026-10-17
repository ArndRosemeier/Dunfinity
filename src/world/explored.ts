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

/** A cell's quarter points, tried when its centre is shut: a 1 m door whose edges fall on cell centres is still seen. */
const QUARTERS = [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]] as const;

/** Open floor at (x, z) within a storey of height y (not the rock, not a hall far above or below); the map asks it of the rock beside what was seen. */
export function onStorey(level: Level, x: number, z: number, y: number): boolean {
  const g = level.groundAt(x, z);
  return Math.abs(g - y) < 6 && level.sdf(x, g + 1, z) > 0.1;
}

export class Explored {
  private readonly seen = new Map<number, Set<number>>();

  /** Mark the open floor within `radius` m (EXPLORE.radius: the nobody's own eyes) of (x, y, z) on `level` seen. */
  see(level: Level, x: number, y: number, z: number, radius: number = EXPLORE.radius): void {
    let s = this.seen.get(level.depth);
    if (!s) this.seen.set(level.depth, (s = new Set()));
    const c = EXPLORE.cell, n = Math.ceil(radius / c), ci = Math.floor(x / c), cj = Math.floor(z / c);
    for (let j = cj - n; j <= cj + n; j++) for (let i = ci - n; i <= ci + n; i++) {
      const k = key(i, j);
      if (s.has(k)) continue;
      const px = (i + 0.5) * c, pz = (j + 0.5) * c;
      if (Math.hypot(px - x, pz - z) > radius) continue;
      if (onStorey(level, px, pz, y) || QUARTERS.some(([a, b]) => onStorey(level, px + a * c, pz + b * c, y))) s.add(k);
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
