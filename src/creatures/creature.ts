/**
 * What every creature is (rats, the Salt-Touched): somewhere on the floor (a `Walker`, moved by
 * src/creatures/steer.ts), hittable (a `Fighter`, src/combat/combat.ts), with health, a mode and the
 * clocks of being hurt and of death. Its sim reacts to a blow on its next step (`provoked`); one
 * bitten by a salt pet turns on it (`grudge`), as every creature fights back when attacked.
 */
import { angleDiff } from '@futuremagic/core';
import type { Fighter } from '../combat/combat';
import type { Walker } from './steer';
import { Life, type Pose } from './life';

/** The cause of a blow that leaves a grudge (a salt pet's bite): the one bitten turns on the biter, not on whoever its kind is after. */
export const GRUDGE = 'salt-pet';
/** How far off a grudge is held, metres: further, it lets it go. */
export const GRUDGE_HELD = 18;

export abstract class Creature<Mode extends string> implements Fighter, Walker {
  vx = 0;
  vz = 0;
  /** Which way it last went round something in its way (+1 / -1): it keeps to it, not dithering. */
  side = 1;
  /** Chilled (grandma's Cold Larder): seconds left, and the share of its pace it keeps (src/creatures/steer.ts). */
  chill?: { left: number; by: number };
  /** Blind (grandma's Flour Bag): seconds left, and the way it stumbles meanwhile (src/creatures/steer.ts). */
  blind?: number;
  stumble?: number;
  health: number;
  /** Seconds since it was last hurt, and since it died. */
  hurtT = 9;
  deadT = 0;
  /** Hurt since its sim last looked: the sim reacts (alarm, anger, bolting) and clears it. What hurt it last ('knife', 'murk', ...). */
  provoked = false;
  cause = '';
  /** Who it turned on, other than the one its kind is after (a salt pet that bit it: src/creatures/pets.ts); let go once anyone else hurts it. */
  grudge: Fighter | null = null;
  /** An animal's life between fights: feeding, resting (src/creatures/life.ts). */
  readonly life = new Life();

  /** At (x, y, z) facing `yaw` (forward is (-sin yaw, -cos yaw)). */
  constructor(public x: number, public y: number, public z: number, public yaw: number, readonly radius: number, readonly height: number, health: number, public mode: Mode) {
    this.health = health;
  }

  get dead(): boolean { return this.health <= 0; }

  /** Feeding, lying at rest, or neither (the rig poses it). */
  get pose(): Pose { return this.dead ? '' : this.life.pose; }

  hurt(amount: number, cause: string): void {
    this.health = Math.max(0, this.health - amount);
    this.hurtT = 0;
    this.provoked = true;
    this.cause = cause;
    if (cause !== GRUDGE) this.grudge = null;
    if (this.dead) { this.mode = 'dead' as Mode; this.deadT = 0; }
  }
}

/** A yaw turned towards `want` by at most `step` radians (the short way round). */
export function turnTowards(yaw: number, want: number, step: number): number {
  return yaw + Math.max(-step, Math.min(step, angleDiff(yaw, want)));
}

/** How fast something moves over the floor, metres per second. */
export function groundSpeed(v: { readonly vx: number; readonly vz: number }): number {
  return Math.hypot(v.vx, v.vz);
}
