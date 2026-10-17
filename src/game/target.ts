/**
 * Tab targeting (optional): Tab picks the foe you can see nearest to where the camera looks, and
 * each further Tab the next one you can see, round them all before the first again; blows, thrown
 * knives and the Pound then turn to it. A click on a foe picks it too, and something that hurts you
 * while you hold none becomes the target. Escape, or the target dying or getting far away, lets it go.
 *
 * Pure: the choice of target from where things are (what can be seen is the caller's `seen`).
 */
import type { Fighter } from '../combat/combat';

export const TARGET = {
  /** How far off a foe can be picked, and how far it may get before it is let go, metres. */
  pick: 22,
  keep: 30,
  /** How much a metre off the camera's line (as an angle, radians) counts against a foe, in metres of distance. */
  turn: 6,
  /** How far off the camera's line a stab with no target may pick the foe it goes at, radians. */
  stabPick: 0.35,
  /** How near a click (CSS pixels) must land to a foe on screen to pick it. */
  click: 48,
} as const;

/** The angle from a to b, wrapped to (-π, π]. */
function turnTo(a: number, b: number): number {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

/** How far `f` is off the line along `yaw` from (x, z), radians. */
export function offLine(f: Fighter, x: number, z: number, yaw: number): number {
  return Math.abs(turnTo(yaw, yawTo(f, x, z)));
}

/**
 * The foes Tab goes through, from (x, y, z) looking along `yaw`: alive, near enough, `seen` (on
 * screen and not behind rock), best first (near, and near the camera's line).
 */
export function candidates<T extends Fighter>(foes: readonly T[], x: number, y: number, z: number, yaw: number, seen: (f: T) => boolean = () => true): T[] {
  return foes
    .filter((f) => !f.dead && Math.hypot(f.x - x, f.z - z) < TARGET.pick && Math.abs(f.y - y) < 8 && seen(f))
    .map((f) => ({ f, cost: Math.hypot(f.x - x, f.z - z) + TARGET.turn * offLine(f, x, z, yaw) }))
    .sort((a, b) => a.cost - b.cost)
    .map((c) => c.f);
}

/**
 * The target after `current`: the best of those seen that Tab has not been round yet (`tried`,
 * which this fills, and empties once every one seen has had its turn); null if none is seen.
 */
export function nextTarget<T extends Fighter>(list: readonly T[], current: T | null, tried: Set<T>): T | null {
  if (!list.length) { tried.clear(); return null; }
  if (current) tried.add(current);
  let next = list.find((f) => !tried.has(f));
  if (!next) {
    tried.clear();
    next = list.find((f) => f !== current) ?? list[0];
  }
  tried.add(next);
  return next;
}

/** Whether `t` is still worth holding as the target from (x, z). */
export function keeps(t: Fighter, x: number, z: number): boolean {
  return !t.dead && Math.hypot(t.x - x, t.z - z) < TARGET.keep;
}

/** The yaw from (x, z) to `t` (forward is (-sin yaw, -cos yaw)). */
export function yawTo(t: Fighter, x: number, z: number): number {
  return Math.atan2(-(t.x - x), -(t.z - z));
}

/** Of `foes` drawn at screen points (`at`: null off screen), the one nearest the click (cx, cy), if within `TARGET.click` pixels. */
export function clicked<T extends Fighter>(foes: readonly T[], at: (f: T) => { x: number; y: number } | null, cx: number, cy: number): T | null {
  let best: T | null = null, bd: number = TARGET.click;
  for (const f of foes) {
    if (f.dead) continue;
    const p = at(f);
    if (!p) continue;
    const d = Math.hypot(p.x - cx, p.y - cy);
    if (d < bd) { bd = d; best = f; }
  }
  return best;
}
