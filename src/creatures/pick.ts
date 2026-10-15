/**
 * The pick blow, brought down over the head (the Salt-Touched, the Foreman; the scavengers' crowbar): a long wind-up in
 * which it stands and turns to you (the tell), then it is committed and the pick comes down.
 *
 * Pure: blows through src/combat.
 */
import type { Rng } from '@futuremagic/core';
import { angleDiff } from '@futuremagic/core';
import { blowFrom, damage, reach, type Fighter, type Swing } from '../combat/combat';
import type { Steer, Walker } from './steer';

/** A pick swing's numbers: seconds it takes and when it lands, its reach, damage (min, max) and knockback; how far beyond touching it starts one, and the rest after one before the next. */
export interface PickSwing extends Swing {
  readonly dur: number;
  readonly hit: number;
  readonly damage: readonly [number, number];
  readonly knock: number;
  readonly start: number;
  readonly rest: number;
}

/**
 * One step of `w` closing in on `prey` (at `speed`, facing it by `face`) to swing `S`, `swingT`
 * seconds after its last swing began. True when it is close enough and rested: start the swing.
 */
export function closeIn(w: Walker, swingT: number, prey: Fighter, S: PickSwing, speed: number, steer: Steer, dt: number, face: number): boolean {
  steer.close(w, prey, prey.radius + w.radius + S.start * 0.5, speed, dt, face);
  return Math.hypot(prey.x - w.x, prey.z - w.z) - prey.radius - w.radius < S.start && swingT > S.dur + S.rest;
}

/** It stops turning to you this long before the pick lands (committed). */
const COMMIT = 0.25;

/**
 * One step of the swing `S` by `w`, `t` seconds in (after this step's dt): it stands; through the
 * wind-up it turns to `prey` at `aim` per second; when the pick lands it hurts `prey` if it reaches
 * (for `cause`). Returns 1 if it landed.
 */
export function pickSwing(w: Walker, t: number, S: PickSwing, prey: Fighter, aim: number, steer: Steer, rng: Rng, cause: string, dt: number): number {
  steer.move(w, w.x, w.z, 0, dt, null);
  if (t < S.hit - COMMIT) w.yaw += angleDiff(w.yaw, Math.atan2(-(prey.x - w.x), -(prey.z - w.z))) * Math.min(1, dt * aim);
  if (t < S.hit || t - dt >= S.hit || !reach(blowFrom(w, w.yaw, S), prey)) return 0;
  damage(prey, rng.range(S.damage[0], S.damage[1]), w.x, w.z, S.knock, cause);
  return 1;
}
