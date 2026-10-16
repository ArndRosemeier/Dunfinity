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
import { local, type V3 } from './propMesh';
import { openFloor, searchOut } from './searchOut';

export const DIARY = {
  /** How far from the arrival it is looked for, metres. */
  near: 60,
  far: 300,
  /** Marks need a face this near the page, flat and upright for this far either side of their middle, metres. */
  wall: 3,
  flat: 1.3,
  /** How far the rock under a line of marks may stray up and down, or step from one point to the next, metres. */
  rough: 0.05,
} as const;

export interface PageSpot {
  readonly page: DiaryPage;
  /** Where the stone lies, on the floor, and which way the paper's corner sticks out from under it. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  /** For a page with marks: the rock face beside it they are on, a point of it at the floor's height, looking out along (nx, nz). */
  readonly face?: { readonly x: number; readonly z: number; readonly nx: number; readonly nz: number };
}

/**
 * The page on `level`, or null (none on this level, or no floor for it). A page with marks lies at the
 * foot of a face they can be written on; where the level has no such face, it lies without them.
 */
export function diaryPage(level: Level): PageSpot | null {
  const page = level.depth > 0 ? pageOn(level.depth) : null;
  if (!page) return null;
  const look = (marks: boolean) => searchOut(level, hash3f(level.seed, level.depth, 19, 59) * Math.PI * 2, DIARY.near, DIARY.far, 7, (x, z, t): PageSpot | null => {
    if (level.descents.at(x, z, 4) || !level.dry(x, z, 0.3)) return null;
    const g = level.groundAt(x, z), at = local(x, z, t);
    if (!openFloor(level, [at(0, 0), at(-0.8, 0), at(0.8, 0), at(0, 0.8), at(0, -0.8)], g, 0.2, 1.6, 0.6)) return null;
    if (!marks || !page.marks) return { page, x, y: g, z, yaw: t };
    const face = faceBeside(level, x, g, z);
    if (!face) return null;
    // (The stone at the foot of the face, the paper's corner pointing out from it.)
    const sx = face.x + face.nx * 0.5, sz = face.z + face.nz * 0.5, sy = level.groundAt(sx, sz);
    if (!level.dry(sx, sz, 0.3) || Math.abs(sy - g) > 0.4 || page.marks.some((m) => !markLine(level, face, sy + m.high))) return null;
    return { page, x: sx, y: sy, z: sz, yaw: Math.atan2(face.nx, face.nz), face };
  });
  return look(true) ?? (page.marks ? look(false) : null);
}

/** The nearest rock within `DIARY.wall` of (x, z), at head height over the floor g: a point of it and the way it looks out, or null. */
export function faceBeside(level: Level, x: number, g: number, z: number): PageSpot['face'] | null {
  let best: { t: number; dx: number; dz: number } | null = null;
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    for (let t = 0.3; t < DIARY.wall && (!best || t < best.t); t += 0.1) if (level.sdf(x + dx * t, g + 1.6, z + dz * t) < 0) { best = { t, dx, dz }; break; }
  }
  return best && { x: x + best.dx * best.t, z: z + best.dz * best.t, nx: -best.dx, nz: -best.dz };
}

/**
 * A line of writing along the rock of `face` at height y, `DIARY.flat` either side of its middle, left
 * to right as one faces it: points on the rock, each at the outermost of the rock a hand's breadth
 * above and below so the letters never sink into it. Null where the rock breaks off or is too rough
 * (more than `DIARY.rough` up and down, or a step along).
 */
export function markLine(level: Level, face: NonNullable<PageSpot['face']>, y: number): V3[] | null {
  const { x, z, nx, nz } = face, n: [number, number, number] = [nx, 0, nz], pts: V3[] = [];
  let last = NaN;
  for (let along = -DIARY.flat; along <= DIARY.flat + 1e-6; along += 0.1) {
    let out = -Infinity, back = Infinity;
    for (const h of [-0.06, 0.06, 0.18]) {
      const p = level.ontoRock(x + nz * along + nx * 0.3, y + h, z - nx * along + nz * 0.3, n, true);
      if (!p) return null;
      const t = (p[0] - x) * nx + (p[2] - z) * nz;
      out = Math.max(out, t); back = Math.min(back, t);
    }
    if (out - back > DIARY.rough || Math.abs(out - last) > DIARY.rough) return null;
    last = out;
    pts.push([x + nz * along + nx * out, y, z - nx * along + nz * out]);
  }
  return pts;
}
