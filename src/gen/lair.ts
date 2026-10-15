/**
 * The Tall One's lair on level 10 (docs/design/town-and-first-strata.md §5), and the circles of
 * infused salt round it that grandma laid in 1966 to get away from it: it will not cross infused
 * salt. The lair is a wide cavern floor a long walk from the arrival; the circles lie out from it,
 * each big enough to stand in.
 *
 * Pure: found from the level's seed; the circles are built as props with the tile they fall in.
 */
import { hash3f } from '@futuremagic/core';
import type { Level } from './level';
import { openFloor, searchOut } from './searchOut';

export const LAIR = {
  depth: 10,
  /** How far from the arrival it is looked for, metres. */
  near: 140,
  far: 420,
  /** Its circles: how many, how far out from the lair, their radius (to the crystals), metres. */
  circles: 7,
  inner: 18,
  outer: 75,
  radius: 1.7,
} as const;

/** A circle of infused salt on the floor at (x, z), radius r. */
export interface SaltCircle {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly r: number;
}

export interface Lair {
  /** Where it stands, facing `yaw`. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly circles: readonly SaltCircle[];
}

/** The lair on `level`, or null (only on level 10, and only where a cavern allows). */
export function lairOf(level: Level): Lair | null {
  if (level.depth !== LAIR.depth) return null;
  return searchOut(level, hash3f(level.seed, 10, 66, 1) * Math.PI * 2, LAIR.near, LAIR.far, 8, (x, z, t) => {
    if (level.columnAt(x, z).border < 15 || !open(level, x, z, 5, 4.5)) return null;
    const circles = circlesRound(level, x, z);
    return circles.length < LAIR.circles - 2 ? null : { x, y: level.groundAt(x, z), z, yaw: t, circles };
  });
}

/** Whether the floor round (x, z) out to `r` is dry, near level, and clear `head` metres up. */
function open(level: Level, x: number, z: number, r: number, head: number): boolean {
  if (level.descents.at(x, z, r + 4) || !level.dry(x, z, 0.2)) return false;
  const g = level.groundAt(x, z), round = Array.from({ length: 8 }, (_, a) => [x + Math.cos(a * 0.785) * r, z + Math.sin(a * 0.785) * r] as const);
  return openFloor(level, round, g, 0.8, head * 0.5, Math.min(1.5, head * 0.3)) && level.sdf(x, g + head, z) > 1;
}

/** Grandma's circles round the lair at (lx, lz): seeded spots out from it with room for a circle. */
function circlesRound(level: Level, lx: number, lz: number): SaltCircle[] {
  const out: SaltCircle[] = [];
  for (let k = 0; k < LAIR.circles * 6 && out.length < LAIR.circles; k++) {
    const a = hash3f(level.seed, lx | 0, k, 2) * Math.PI * 2, d = LAIR.inner + (LAIR.outer - LAIR.inner) * hash3f(level.seed, lz | 0, k, 3);
    const x = lx + Math.cos(a) * d, z = lz + Math.sin(a) * d;
    if (!open(level, x, z, LAIR.radius + 0.6, 2.5) || out.some((c) => Math.hypot(c.x - x, c.z - z) < 12)) continue;
    out.push({ x, y: level.groundAt(x, z), z, r: LAIR.radius });
  }
  return out;
}

/** The circle (x, z) is in (within its radius, less `margin`), if any. */
export function inCircle(circles: readonly SaltCircle[], x: number, z: number, margin = 0): SaltCircle | null {
  for (const c of circles) if (Math.hypot(x - c.x, z - c.z) < c.r - margin) return c;
  return null;
}
