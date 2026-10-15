/**
 * Knives thrown (grandma's Second Helpings card): they fly on an arc, hit the first creature in
 * their way (a blow through combat's damage(), so a kill is the knife's and counts), and land: one
 * that hit drops at the creature's feet, one that missed sticks where it struck the rock. There are
 * always more knives in the block, so a landed one just fades after a while.
 *
 * Pure: the knives are plain data, stepped against the level and the creatures.
 */
import type { Level } from '../gen/level';
import { damage, type Fighter } from './combat';
import type { Rng } from '@futuremagic/core';

export const THROW = {
  /** m/s out of the hand, and the pull down on it, m/s². */
  speed: 17,
  gravity: 9.8,
  /** It homes in on a creature this close and within `arc` of where one looks, metres and radians. */
  aim: 16,
  arc: 0.5,
  damage: [9, 13] as const,
  knock: 1.2,
  /** Seconds a landed knife lies before it is gone; seconds a knife flies at most. */
  lies: 4,
  flies: 3,
  /** A knife is checked every this many metres of its flight (so none passes through a rat). */
  sub: 0.1,
} as const;

export interface Knife {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  /** Seconds since thrown, and since it landed (-1: still flying). */
  t: number;
  landed: number;
  /** It hit something (it can hit nothing more). */
  spent: boolean;
}

export class Thrown {
  readonly knives: Knife[] = [];

  /**
   * Throw a knife from (x, y, z): at the creature nearest where `yaw` looks (within THROW.aim and
   * THROW.arc), on an arc that reaches it, else straight along `yaw`, a little upwards.
   */
  throw(x: number, y: number, z: number, yaw: number, foes: readonly Fighter[]): Knife {
    let target: Fighter | null = null, best: number = THROW.aim;
    for (const f of foes) {
      if (f.dead) continue;
      const dx = f.x - x, dz = f.z - z, d = Math.hypot(dx, dz), a = Math.atan2(-dx, -dz);
      const off = Math.abs(Math.atan2(Math.sin(a - yaw), Math.cos(a - yaw)));
      if (d < best && off < THROW.arc) { best = d; target = f; }
    }
    const k: Knife = { x, y, z, vx: 0, vy: 0, vz: 0, t: 0, landed: -1, spent: false };
    if (target) {
      const dx = target.x - x, dz = target.z - z, d = Math.hypot(dx, dz) || 1, dy = target.y + target.height * 0.5 - y;
      const t = d / THROW.speed;
      k.vx = (dx / d) * THROW.speed; k.vz = (dz / d) * THROW.speed;
      k.vy = (dy + 0.5 * THROW.gravity * t * t) / t;
    } else {
      k.vx = -Math.sin(yaw) * THROW.speed; k.vz = -Math.cos(yaw) * THROW.speed; k.vy = 2;
    }
    this.knives.push(k);
    return k;
  }

  /** Step every knife by dt; `rng` rolls the damage. Returns the creatures hit. */
  fly(level: Level, foes: readonly Fighter[], rng: Rng, dt: number): Fighter[] {
    const hits: Fighter[] = [];
    for (let i = this.knives.length - 1; i >= 0; i--) {
      const k = this.knives[i];
      k.t += dt;
      if (k.landed >= 0) {
        k.landed += dt;
        if (k.landed > THROW.lies) this.knives.splice(i, 1);
        continue;
      }
      if (k.t > THROW.flies) { this.knives.splice(i, 1); continue; }
      k.vy -= THROW.gravity * dt;
      const n = Math.max(1, Math.ceil((Math.hypot(k.vx, k.vy, k.vz) * dt) / THROW.sub)), h = dt / n;
      for (let s = 0; s < n && k.landed < 0; s++) {
        k.x += k.vx * h; k.y += k.vy * h; k.z += k.vz * h;
        if (!k.spent) {
          for (const f of foes) {
            if (f.dead || Math.hypot(f.x - k.x, f.z - k.z) > f.radius + 0.08 || k.y < f.y - 0.05 || k.y > f.y + f.height) continue;
            damage(f, rng.range(THROW.damage[0], THROW.damage[1]), k.x - k.vx, k.z - k.vz, THROW.knock, 'knife');
            hits.push(f);
            k.spent = true;
            // It drops off the creature.
            k.vx *= -0.1; k.vz *= -0.1; k.vy = 1;
            break;
          }
        }
        if (level.sdf(k.x, k.y, k.z) < 0.02) k.landed = 0;
      }
    }
    return hits;
  }
}
