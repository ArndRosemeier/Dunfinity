/**
 * The puffcaps' spores (src/creatures/shrooms.ts): a ball of them lobbed on a slow arc at where you
 * will be, bursting where it comes down (or on you) into a cloud that hangs over the floor a while;
 * standing in it burns.
 *
 * Pure: what flies is plain data, stepped against the level and you.
 */
import type { Level } from '../gen/level';
import { damage, type Fighter } from '../combat/combat';
import type { Rng } from '@futuremagic/core';

export const SPORES = {
  /** The pull down on a ball, m/s² (floaty); how long a flight to you takes: this much per metre, plus. */
  gravity: 6,
  perMetre: 0.11,
  flight: 0.35,
  /** A ball that hits you: damage. A cloud: radius and height, seconds it hangs, seconds per burn and its damage. */
  hit: [3, 5] as const,
  radius: 1.7,
  high: 1.8,
  hangs: 3.2,
  tick: 0.5,
  burn: 2,
  /** Seconds a ball flies at most. */
  flies: 4,
} as const;

export interface SporeBall {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  t: number;
}

export interface SporeCloud {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Seconds since it burst; seconds to its next burn. */
  t: number;
  next: number;
}

export class Spores {
  readonly balls: SporeBall[] = [];
  readonly clouds: SporeCloud[] = [];

  constructor(private readonly level: Level, private readonly rng: Rng) {}

  /** Lob a ball from (x, y, z) to come down on `at` (where `at` will be, led by its speed). */
  lob(x: number, y: number, z: number, at: Fighter): void {
    const d0 = Math.hypot(at.x - x, at.z - z), T = SPORES.flight + SPORES.perMetre * d0;
    const tx = at.x + at.vx * T * 0.6, tz = at.z + at.vz * T * 0.6, ty = at.y + 0.6;
    this.balls.push({ x, y, z, vx: (tx - x) / T, vy: (ty - y + 0.5 * SPORES.gravity * T * T) / T, vz: (tz - z) / T, t: 0 });
  }

  /** Step by dt: balls fly and burst, clouds burn whoever stands in them. Returns whether `prey` was hurt. */
  advance(dt: number, prey: Fighter): boolean {
    let hurt = false;
    const l = this.level;
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.t += dt;
      b.vy -= SPORES.gravity * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      const ground = l.groundAt(b.x, b.z);
      const onYou = Math.hypot(prey.x - b.x, prey.z - b.z) < prey.radius + 0.15 && b.y > prey.y && b.y < prey.y + prey.height;
      if (onYou && !prey.dead) {
        damage(prey, this.rng.range(SPORES.hit[0], SPORES.hit[1]), b.x, b.z, 0.4, 'spores');
        hurt = true;
      }
      if (onYou || b.y <= ground || l.sdf(b.x, b.y, b.z) < 0.05 || b.t > SPORES.flies) {
        this.balls.splice(i, 1);
        this.clouds.push({ x: b.x, y: onYou ? prey.y : Math.min(b.y, ground + 0.3), z: b.z, t: 0, next: 0 });
      }
    }
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const c = this.clouds[i];
      c.t += dt;
      if (c.t > SPORES.hangs) { this.clouds.splice(i, 1); continue; }
      c.next -= dt;
      const inside = Math.hypot(prey.x - c.x, prey.z - c.z) < SPORES.radius + prey.radius && prey.y > c.y - 1 && prey.y < c.y + SPORES.high;
      if (inside && c.next <= 0 && !prey.dead) {
        c.next = SPORES.tick;
        damage(prey, SPORES.burn, c.x, c.z, 0, 'spores');
        hurt = true;
      }
    }
    return hurt;
  }
}
