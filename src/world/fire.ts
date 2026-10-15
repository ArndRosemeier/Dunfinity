/**
 * A fire to rest by (docs/design/recipe-box.md §5): the nobody kneels and lights a small fire
 * anywhere dry when nothing is after it, and while it sits still by the fire, with nothing after
 * it, its wounds close much faster and it gets its breath back. The fire burns down after a while.
 *
 * Pure: the nobody is anything with a place, health and stamina; whether something is after it is
 * the caller's to say.
 */
import type { Level } from '../gen/level';

export const FIRE = {
  /** Kneeling to light it, seconds; then it burns this long. */
  kindle: 2.4,
  burn: 120,
  /** It is lit this far in front of the nobody, metres; one rests by it within `reach`. */
  ahead: 0.9,
  reach: 2.4,
  /** Resting: health and stamina back per second. */
  heal: 5,
  breath: 6,
} as const;

/** The nobody, as far as the fire cares. */
export interface Rester {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly vx: number;
  readonly vz: number;
  health: number;
  stamina: number;
}

/** A fire: where, and when it was lit (it burns from `at + FIRE.kindle`). */
export interface Fire {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly at: number;
}

export class Campfire {
  /** The fire there is (lit, or being lit), if any. */
  fire: Fire | null = null;
  /** Resting by it this step. */
  resting = false;
  /** How much faster wounds close here than FIRE.heal (grandma's Chicken Soup card). */
  soup = 1;

  constructor(private readonly level: Level, private readonly maxHealth: number, private readonly maxStamina: number) {}

  /** Why a fire cannot be lit by `r` facing `yaw` now, or '' if it can. */
  whyNot(r: Rester, yaw: number, hunted: boolean, now: number): string {
    if (hunted) return 'Not with something after you.';
    if (this.burning(now) && this.by(r)) return '';
    const [x, z] = this.spot(r, yaw);
    if (!this.level.dry(x, z, 0.1) || !this.level.dry(r.x, r.z, 0.05)) return 'Too wet here for a fire.';
    if (this.level.sdf(x, this.level.groundAt(x, z) + 0.6, z) < 0.35) return 'No room for a fire here.';
    return '';
  }

  /** Kneel and light a fire in front of `r` (call when `whyNot` says ''). Does nothing by a burning fire. */
  light(r: Rester, yaw: number, now: number): void {
    if (this.burning(now) && this.by(r)) return;
    const [x, z] = this.spot(r, yaw);
    this.fire = { x, y: this.level.groundAt(x, z), z, at: now };
  }

  /** Seconds into lighting the fire, while it is being lit; else -1. */
  kindling(now: number): number {
    const f = this.fire;
    return f && now - f.at < FIRE.kindle ? now - f.at : -1;
  }

  /** Whether the fire is burning (lit, not burnt down). */
  burning(now: number): boolean {
    const f = this.fire;
    return !!f && now - f.at >= FIRE.kindle && now - f.at < FIRE.kindle + FIRE.burn;
  }

  /** How much of it is left, 1 … 0. */
  left(now: number): number {
    const f = this.fire;
    return f ? Math.max(0, Math.min(1, 1 - (now - f.at - FIRE.kindle) / FIRE.burn)) : 0;
  }

  /** One step: `r` rests (and heals) if it stands still by the burning fire with nothing after it. */
  step(r: Rester, hunted: boolean, now: number, dt: number): void {
    if (this.fire && now - this.fire.at > FIRE.kindle + FIRE.burn) this.fire = null;
    this.resting = this.burning(now) && !hunted && r.health > 0 && this.by(r) && Math.hypot(r.vx, r.vz) < 0.3;
    if (!this.resting) return;
    r.health = Math.min(this.maxHealth, r.health + FIRE.heal * this.soup * dt);
    r.stamina = Math.min(this.maxStamina, r.stamina + FIRE.breath * dt);
  }

  private by(r: Rester): boolean {
    const f = this.fire;
    return !!f && Math.hypot(r.x - f.x, r.z - f.z) < FIRE.reach && Math.abs(r.y - f.y) < 1.2;
  }

  private spot(r: Rester, yaw: number): [number, number] {
    return [r.x - Math.sin(yaw) * FIRE.ahead, r.z - Math.cos(yaw) * FIRE.ahead];
  }
}
