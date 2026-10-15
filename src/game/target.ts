/**
 * Tab targeting (optional): Tab picks the foe nearest to where the camera looks, and each further
 * Tab the next one round; blows, thrown knives and the Pound then turn to it. Escape, or the target
 * dying or getting far away, lets it go.
 *
 * Pure: the choice of target from where things are.
 */
import type { Fighter } from '../combat/combat';

export const TARGET = {
  /** How far off a foe can be picked, and how far it may get before it is let go, metres. */
  pick: 22,
  keep: 30,
  /** How much a metre off the camera's line (as an angle, radians) counts against a foe, in metres of distance. */
  turn: 6,
} as const;

/** The angle from a to b, wrapped to (-π, π]. */
function turnTo(a: number, b: number): number {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

/** The foes Tab goes through, from (x, y, z) looking along `yaw`: alive, near enough, best first (near, and near the camera's line). */
export function candidates<T extends Fighter>(foes: readonly T[], x: number, y: number, z: number, yaw: number): T[] {
  return foes
    .filter((f) => !f.dead && Math.hypot(f.x - x, f.z - z) < TARGET.pick && Math.abs(f.y - y) < 8)
    .map((f) => ({ f, cost: Math.hypot(f.x - x, f.z - z) + TARGET.turn * Math.abs(turnTo(yaw, Math.atan2(-(f.x - x), -(f.z - z)))) }))
    .sort((a, b) => a.cost - b.cost)
    .map((c) => c.f);
}

/** The target after `current` (the best one, if `current` is none or not among them; null if there are none). */
export function nextTarget<T extends Fighter>(foes: readonly T[], current: T | null, x: number, y: number, z: number, yaw: number): T | null {
  const list = candidates(foes, x, y, z, yaw);
  if (!list.length) return null;
  const at = current ? list.indexOf(current) : -1;
  return list[(at + 1) % list.length];
}

/** Whether `t` is still worth holding as the target from (x, z). */
export function keeps(t: Fighter, x: number, z: number): boolean {
  return !t.dead && Math.hypot(t.x - x, t.z - z) < TARGET.keep;
}

/** The yaw from (x, z) to `t` (forward is (-sin yaw, -cos yaw)). */
export function yawTo(t: Fighter, x: number, z: number): number {
  return Math.atan2(-(t.x - x), -(t.z - z));
}
