/**
 * Chimney smoke (town-and-first-strata.md §3, the town alive): a slow plume from each of the town's
 * chimneys (src/gen/chimneys.ts), rising, drifting on the wind and fading with height. A puff is a
 * pure function of its chimney and its age; the drawing (src/render/townLife.ts) puts them into the
 * `SMOKE` kind's per-puff state. No allocation here: a caller passes the puff it fills.
 */
import { TAU, hash3f } from '@futuremagic/core';
import type { Chimney } from '../gen/chimneys';

export const SMOKE = {
  /** Puffs in a plume: one leaves the mouth as the one before it has risen a little. */
  puffs: 10,
  /** How long a puff lasts, s: its age runs from the mouth to the top of the plume. */
  life: 9,
  /** How fast it rises, m/s, and how far the wind takes it each second (x, z). */
  rise: 1.15,
  drift: [0.3, 0.12] as const,
  /** The little spread at the mouth, m, so puffs do not all leave from one point. */
  spread: 0.05,
  /** How far off a plume is still drawn, m. */
  seen: 220,
  /** Its softness as it starts to show, s, and the most opaque it gets. */
  fadeIn: 0.5,
  opacity: 0.62,
} as const;

/** One puff of smoke: its world position, its size in metres, and its opacity and shade. */
export interface Puff {
  x: number;
  y: number;
  z: number;
  size: number;
  alpha: number;
  /** 0.82–1: each puff a little lighter or darker than its neighbours. */
  shade: number;
}

/**
 * The `k`-th puff of `c`'s plume `t` seconds after it left the mouth, written into `out`. It starts
 * within a hand's width of the mouth, rises, wanders with the wind and fades out as it climbs.
 */
export function puffAt(c: Chimney, k: number, t: number, out: Puff): Puff {
  const S = SMOKE, phase = hash3f(c.house, k, 7, 11) * TAU, a = Math.max(0, t);
  const wander = S.spread + a * 0.035;
  out.x = c.x + Math.cos(phase) * S.spread + a * S.drift[0] + Math.sin(a * 0.75 + phase) * wander;
  out.z = c.z + Math.sin(phase) * S.spread + a * S.drift[1] + Math.cos(a * 0.6 + phase * 1.3) * wander * 0.8;
  out.y = c.mouth + a * S.rise;
  out.size = 0.14 + a * 0.16;
  // It thickens as it leaves the pot, then fades with height until it is gone (never quite at the top).
  const fade = Math.min(1, a / S.fadeIn) * Math.max(0, 1 - a / S.life) ** 1.15;
  out.alpha = S.opacity * fade;
  out.shade = 0.82 + 0.18 * hash3f(c.house, k, 13, 3);
  return out;
}

/** The ages of a plume's puffs at time `t`: one leaving the mouth each `life / puffs` seconds. */
export function puffAge(k: number, t: number): number {
  const S = SMOKE, age = (t + (k * S.life) / S.puffs) % S.life;
  return age < 0 ? age + S.life : age;
}
