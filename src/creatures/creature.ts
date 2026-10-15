/**
 * What every creature is (rats, the Salt-Touched): somewhere on the floor (a `Walker`, moved by
 * src/creatures/steer.ts), hittable (a `Fighter`, src/combat/combat.ts), with health, a mode and the
 * clocks of being hurt and of death. Its sim reacts to a blow on its next step (`provoked`).
 */
import type { Fighter } from '../combat/combat';
import type { Walker } from './steer';

export abstract class Creature<Mode extends string> implements Fighter, Walker {
  vx = 0;
  vz = 0;
  /** Which way it last went round something in its way (+1 / -1): it keeps to it, not dithering. */
  side = 1;
  health: number;
  /** Seconds since it was last hurt, and since it died. */
  hurtT = 9;
  deadT = 0;
  /** Hurt since its sim last looked: the sim reacts (alarm, anger, bolting) and clears it. What hurt it last ('knife', 'murk', ...). */
  provoked = false;
  cause = '';

  /** At (x, y, z) facing `yaw` (forward is (-sin yaw, -cos yaw)). */
  constructor(public x: number, public y: number, public z: number, public yaw: number, readonly radius: number, readonly height: number, health: number, public mode: Mode) {
    this.health = health;
  }

  get dead(): boolean { return this.health <= 0; }

  hurt(amount: number, cause: string): void {
    this.health = Math.max(0, this.health - amount);
    this.hurtT = 0;
    this.provoked = true;
    this.cause = cause;
    if (this.dead) { this.mode = 'dead' as Mode; this.deadT = 0; }
  }
}

/** How fast something moves over the floor, metres per second. */
export function groundSpeed(v: { readonly vx: number; readonly vz: number }): number {
  return Math.hypot(v.vx, v.vz);
}
