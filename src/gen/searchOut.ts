/**
 * Finding a landmark's place on a level (grandma's camp, the Tall One's lair): out from the arrival
 * in rings, at seeded bearings, natural caverns first, the first spot that suits it; and the check
 * that the floor round a spot is open, dry and level.
 *
 * Pure.
 */
import type { Level } from './level';

/**
 * Out from the arrival in rings `near`–`far` metres (`step` apart, 24 bearings each, starting at
 * `turn` radians), first in caverns only, then anywhere, skipping collapse and rubble: the first
 * spot `found(x, z, bearing)` accepts.
 */
export function searchOut<T>(level: Level, turn: number, near: number, far: number, step: number, found: (x: number, z: number, bearing: number) => T | null): T | null {
  const [ax, , az] = level.arrival;
  for (const caveOnly of [true, false]) {
    for (let r = near; r < far; r += step) {
      for (let a = 0; a < 24; a++) {
        const t = turn + (a / 24) * Math.PI * 2, x = ax + Math.cos(t) * r, z = az + Math.sin(t) * r;
        const col = level.columnAt(x, z);
        if ((caveOnly && col.cavern < 0.9) || col.collapse > 0 || col.rubble > 0.02) continue;
        const f = found(x, z, t);
        if (f) return f;
      }
    }
  }
  return null;
}

/** Whether the floor at each of `points` is dry, within `slope` metres of `g`, and clear `room` metres at `head` metres above it. */
export function openFloor(level: Level, points: Iterable<readonly [number, number]>, g: number, slope: number, head: number, room: number): boolean {
  for (const [x, z] of points) {
    if (!level.dry(x, z, 0.2)) return false;
    const y = level.groundAt(x, z);
    if (Math.abs(y - g) > slope || level.sdf(x, y + head, z) < room) return false;
  }
  return true;
}
