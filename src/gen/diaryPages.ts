/**
 * Where a page torn out of grandma's diary lies on its level (docs/design/grandmas-diary.md): folded
 * under a stone, its corner showing, on dry floor a good walk from the arrival, where she would have
 * stopped to write. One on each level that has a page (src/lore/diary.ts).
 *
 * Pure: found from the level's seed; the stone and paper are built with the tile it falls in.
 */
import { hash3f } from '@futuremagic/core';
import { pageOn, type DiaryPage } from '../lore/diary';
import type { Level } from './level';
import { local } from './propMesh';
import { openFloor, searchOut } from './searchOut';

export const DIARY = {
  /** How far from the arrival it is looked for, metres. */
  near: 60,
  far: 300,
} as const;

export interface PageSpot {
  readonly page: DiaryPage;
  /** Where the stone lies, on the floor, and which way the paper's corner sticks out from under it. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
}

/** The page on `level`, or null (none on this level, or no floor for it). */
export function diaryPage(level: Level): PageSpot | null {
  const page = level.depth > 0 ? pageOn(level.depth) : null;
  if (!page) return null;
  return searchOut(level, hash3f(level.seed, level.depth, 19, 59) * Math.PI * 2, DIARY.near, DIARY.far, 7, (x, z, t) => {
    if (level.descents.at(x, z, 4) || !level.dry(x, z, 0.3)) return null;
    const g = level.groundAt(x, z), at = local(x, z, t);
    return openFloor(level, [at(0, 0), at(-0.8, 0), at(0.8, 0), at(0, 0.8), at(0, -0.8)], g, 0.2, 1.6, 0.6) ? { page, x, y: g, z, yaw: t } : null;
  });
}
