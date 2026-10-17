/**
 * An animal's life between fights and frights (Arnd 2026-10-17: not just standing around, and the
 * same for every animal, the strange ones and the rats and dogs alike; people are the exception):
 * it walks off to feed at a spot of its den's pasture (src/creatures/pasture.ts: by its diet, the
 * floor, a wall's salt, the water's edge, a salt bloom), head down and chewing, facing what it eats;
 * and every den keeps its own hours, now and then all of it going to the sheltered nook by its home
 * to lie down together, one of a bigger lot staying up as a sentry. A sleeper minds you only when
 * you are close (`LIFE.doze`; an attacker notices you from `LIFE.wake` of its range).
 *
 * The state is the animal's own (`Creature.life`); the steps are `Population.live` and `toFood`,
 * which every kind of animal calls from its own idle moments. When its mind turns to something else
 * (a fright, a fight) and stops calling them, its life stops on its own.
 */
import type { Spot } from './pasture';

export const LIFE = {
  /** The share of the times it moves on that it goes to feed; how long it feeds there, s. */
  feed: 0.6,
  feedFor: [4, 12] as const,
  /** A den's hours: awake, then at rest, s (each den its own, seeded). */
  awake: [60, 140] as const,
  asleep: [25, 60] as const,
  /** A den this big keeps one awake (its sentry). */
  sentry: 3,
  /** A sleeper minds you only this share as far off; an attacker asleep notices you from this share of its range. */
  doze: 0.6,
  wake: 0.5,
} as const;

/** How the rig poses it: feeding (head down), lying at rest, or neither. */
export type Pose = '' | 'feed' | 'rest';

export class Life {
  /** On its way to food, feeding, resting (on its way to the nook, or lying there); '' none. */
  doing: '' | 'going' | 'feed' | 'rest' = '';
  /** Lying down in the nook. */
  down = false;
  /** The food spot it is going to or feeds at. */
  spot: Spot | null = null;
  /** Where it is going; seconds left (to get there, of feeding). */
  tx = 0;
  tz = 0;
  t = 0;
  /** How far it moved in its last step, m (a kind's gait follows it). */
  moved = 0;
  /** Its mind called on its life this step (else it stops). */
  seen = false;

  get pose(): Pose {
    return this.doing === 'feed' ? 'feed' : this.doing === 'rest' && this.down ? 'rest' : '';
  }

  stop(): void {
    this.doing = ''; this.down = false; this.spot = null;
  }
}
