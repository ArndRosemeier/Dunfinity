/**
 * A pulse in the veins: now and then a ring of brighter light runs out through the glowing veins of
 * infused salt, from a little behind the viewer, past them and on, towards the nearest way down, as if
 * the rock drew a breath. Only where the rock has veins (the shader multiplies it by them).
 *
 * When one runs (`pulseAt`: one at a seeded moment in each window) and where it comes from
 * (`pulseFrom`) are pure; the view latches the place when one starts.
 */
import { Rng, deriveSeed, smoothstep } from '@futuremagic/core';
import type { Level } from './level';

export const PULSE = {
  /** One pulse in each window this long (s), at a seeded moment in it. */
  window: 95,
  /** How long one runs (s), how fast its ring spreads (m/s), how wide the ring is (m). */
  life: 10,
  speed: 7,
  width: 2.5,
  /** It starts this far behind the viewer (m), on the far side from the way down. */
  behind: 12,
  /** A way down further off than this (m) does not steer it: it runs the way the viewer looks. */
  seen: 300,
} as const;

/** The start (s) of the pulse running at `time` on (seed, depth), or null when none runs. */
export function pulseAt(seed: number, depth: number, time: number): number | null {
  const k = Math.floor(time / PULSE.window);
  const start = k * PULSE.window + new Rng(deriveSeed(seed, 'veinPulse', depth, k)).range(0, PULSE.window - PULSE.life);
  return time >= start && time < start + PULSE.life ? start : null;
}

/** Where a pulse seen from (x, z), looking along (fx, fz), starts: behind the viewer, so it runs past them towards the nearest way down. */
export function pulseFrom(level: Level, x: number, z: number, fx: number, fz: number): [number, number] {
  const down = level.descents.nearest(x, z, PULSE.seen);
  let dx = down && !down.up ? down.x - x : fx, dz = down && !down.up ? down.z - z : fz;
  const len = Math.hypot(dx, dz) || 1;
  dx /= len; dz /= len;
  return [x - dx * PULSE.behind, z - dz * PULSE.behind];
}

/** A running pulse's ring at `age` (s): its radius (m) and its strength (0–1, up as it starts, fading as it spreads). */
export function pulseRing(age: number): [number, number] {
  return [age * PULSE.speed, smoothstep(0, 1, age) * (1 - smoothstep(PULSE.life - 4, PULSE.life, age))];
}
