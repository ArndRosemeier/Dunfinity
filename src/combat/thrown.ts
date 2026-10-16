/**
 * Things thrown. Knives (grandma's Second Helpings card) fly on an arc, hit the first creature in
 * their way (a blow through combat's damage(), so a kill is the knife's and counts), and land: one
 * that hit drops at the creature's feet, one that missed sticks where it struck the rock. There are
 * always more knives in the block, so a landed one just fades after a while. Candles (her Sunday
 * Candle) are tossed ahead, land and burn: a light the things of the dark keep away from. A seed
 * (her Snapdragons) is tossed the same way; where it comes down it is handed on (`sown`) to come up.
 * A bag of flour (her Flour Bag) is thrown like a knife and bursts where it hits (handed on: `burst`);
 * a match (her Matchstick) is flicked like one at a point, and may be caught on the way (`fly`'s
 * `catches`: a flour cloud going up); one that is not does a little burning where it hits.
 *
 * Pure: what flies is plain data, stepped against the level and the creatures.
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

/** A match that hits someone, not caught by a flour cloud: its damage. */
export const MATCH = { damage: [2, 4] as const, knock: 0.3 } as const;

/** A Sunday candle: tossed (speed and lift, m/s), seconds it burns once down, and how near the creatures of the dark will come to it, metres. */
export const CANDLE = { speed: 8, lift: 3.5, burn: 40, shun: 6 } as const;

export interface Missile {
  readonly kind: 'knife' | 'candle' | 'seed' | 'flour' | 'match';
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  /** Seconds since thrown, and since it landed (-1: still flying). */
  t: number;
  landed: number;
  /** It hit something (it can hit nothing more). */
  spent: boolean;
}

export class Thrown {
  readonly missiles: Missile[] = [];

  /**
   * Throw a knife (or a bag of flour, or a match) from (x, y, z): at `at`, if given, else at the
   * creature nearest where `yaw` looks (within THROW.aim and THROW.arc), on an arc that reaches it,
   * else straight along `yaw`, a little upwards.
   */
  throw(x: number, y: number, z: number, yaw: number, foes: readonly Fighter[], kind: 'knife' | 'flour' | 'match' = 'knife', at?: { readonly x: number; readonly y: number; readonly z: number }): Missile {
    let target: { readonly x: number; readonly y: number; readonly z: number } | null = at ?? null, best: number = THROW.aim;
    if (!target) for (const f of foes) {
      if (f.dead) continue;
      const dx = f.x - x, dz = f.z - z, d = Math.hypot(dx, dz), a = Math.atan2(-dx, -dz);
      const off = Math.abs(Math.atan2(Math.sin(a - yaw), Math.cos(a - yaw)));
      if (d < best && off < THROW.arc) { best = d; target = { x: f.x, y: f.y + f.height * 0.5, z: f.z }; }
    }
    const k: Missile = { kind, x, y, z, vx: 0, vy: 0, vz: 0, t: 0, landed: -1, spent: false };
    if (target) {
      const dx = target.x - x, dz = target.z - z, d = Math.hypot(dx, dz) || 1, dy = target.y - y;
      const t = d / THROW.speed;
      k.vx = (dx / d) * THROW.speed; k.vz = (dz / d) * THROW.speed;
      k.vy = (dy + 0.5 * THROW.gravity * t * t) / t;
    } else {
      k.vx = -Math.sin(yaw) * THROW.speed; k.vz = -Math.cos(yaw) * THROW.speed; k.vy = 2;
    }
    this.missiles.push(k);
    return k;
  }

  /** Bags of flour that burst since last asked, where they burst (the game takes them: `burst.splice(0)`). */
  readonly burst: Missile[] = [];

  /** Seeds that came down since last asked, on the floor where they landed (the game takes them: `sown.splice(0)`). */
  readonly sown: Missile[] = [];

  /** Toss a candle (or a seed) from (x, y, z) along `yaw`: it lands a few metres ahead and burns (or comes up). */
  toss(x: number, y: number, z: number, yaw: number, kind: 'candle' | 'seed' = 'candle'): Missile {
    const c: Missile = { kind, x, y, z, vx: -Math.sin(yaw) * CANDLE.speed, vy: CANDLE.lift, vz: -Math.cos(yaw) * CANDLE.speed, t: 0, landed: -1, spent: true };
    this.missiles.push(c);
    return c;
  }

  /** The candles burning where they landed. */
  get candles(): Missile[] {
    return this.missiles.filter((m) => m.kind === 'candle' && m.landed >= 0);
  }

  /** Step everything thrown by dt; `rng` rolls the damage. Returns the creatures hit. */
  /** What a thrown knife's damage is multiplied by (the thrower's practice). */
  power = 1;

  /** `catches(m)`: whether a flying match is caught (and gone) where it is now (a flour cloud going up). */
  fly(level: Level, foes: readonly Fighter[], rng: Rng, dt: number, catches?: (m: Missile) => boolean): Fighter[] {
    const hits: Fighter[] = [];
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const k = this.missiles[i];
      k.t += dt;
      if (k.landed >= 0) {
        k.landed += dt;
        if (k.landed > (k.kind === 'candle' ? CANDLE.burn : THROW.lies)) this.missiles.splice(i, 1);
        continue;
      }
      if (k.t > THROW.flies) { if (k.kind === 'flour') this.burst.push(k); this.missiles.splice(i, 1); continue; }
      k.vy -= THROW.gravity * dt;
      const n = Math.max(1, Math.ceil((Math.hypot(k.vx, k.vy, k.vz) * dt) / THROW.sub)), h = dt / n;
      let gone = false;
      for (let s = 0; s < n && k.landed < 0 && !gone; s++) {
        k.x += k.vx * h; k.y += k.vy * h; k.z += k.vz * h;
        if (k.kind === 'match' && catches?.(k)) { gone = true; break; }
        if (!k.spent) {
          for (const f of foes) {
            if (f.dead || Math.hypot(f.x - k.x, f.z - k.z) > f.radius + 0.08 || k.y < f.y - 0.05 || k.y > f.y + f.height) continue;
            hits.push(f);
            k.spent = true;
            // A bag bursts on it; a knife or a match drops off it.
            if (k.kind === 'flour') { gone = true; break; }
            if (k.kind === 'match') damage(f, rng.range(MATCH.damage[0], MATCH.damage[1]), k.x - k.vx, k.z - k.vz, MATCH.knock, 'fire');
            else damage(f, rng.range(THROW.damage[0], THROW.damage[1]) * this.power, k.x - k.vx, k.z - k.vz, THROW.knock, 'knife');
            k.vx *= -0.1; k.vz *= -0.1; k.vy = 1;
            break;
          }
        }
        if (gone) break;
        if (level.sdf(k.x, k.y, k.z) < 0.02) {
          if (k.kind === 'flour') { gone = true; break; }
          k.landed = 0;
          // A candle stands up where it comes down (just above the floor, not in it); a seed goes in there.
          if (k.kind !== 'knife') k.y = level.groundAt(k.x, k.z);
          if (k.kind === 'seed') { this.sown.push(k); this.missiles.splice(i, 1); }
        }
      }
      if (gone) {
        if (k.kind === 'flour') this.burst.push(k);
        this.missiles.splice(i, 1);
      }
    }
    return hits;
  }
}
