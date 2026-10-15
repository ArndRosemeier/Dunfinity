/**
 * The Tall One (docs/design/town-and-first-strata.md §5: the boss of level 10, guarding the
 * Threshold): gaunt, four metres tall, quiet. It stands in its cavern with its back to the way you
 * come. Once it has seen you it walks after you, never hurrying, and it does not give up. From
 * afar it stares: it opens its arms (the tell) and the cold of it goes through you. Close, it
 * reaches over with its long arm.
 *
 * It will not cross infused salt. Grandma laid circles of it round its cavern in 1966 (src/gen/lair.ts):
 * it walks round them, and in one you are safe from its reach and its stare. It waits at the edge.
 *
 * Pure, like the other kinds: one per level 10, fixed by the seed; dead, it stays dead on this visit.
 */
import { angleDiff } from '@futuremagic/core';
import type { Level } from '../gen/level';
import { inCircle, type Lair, type SaltCircle } from '../gen/lair';
import { damage, type Fighter, noticed } from '../combat/combat';
import { closeIn, pickSwing } from './pick';
import { Population, type Den } from './population';
import { Creature } from './creature';

export const TALL = {
  radius: 0.5,
  height: 4,
  health: 280,
  /** Speeds, m/s: walking back, and after you (you walk 4.2: it never hurries). */
  walk: 1.2,
  stalk: 1.9,
  /** It sees you this close; it goes home only this far from its lair (`leash`), or if it cannot see you this far off. */
  notice: 24,
  forget: 60,
  leash: 120,
  /** The reach: its long arm over and down (see pick.ts). */
  reach: { dur: 2.0, hit: 1.25, start: 1.8, range: 3.4, arc: 0.9, low: 0, high: 4, damage: [28, 38] as const, knock: 7, rest: 0.8 },
  aim: 2,
  /** The stare: from `near`–`far` metres, every `every` seconds; the arms open for `windup` seconds (the tell), then the cold lands; damage. */
  stare: { near: 6, far: 22, every: 7, windup: 1.6, dur: 2.4, damage: [12, 18] as const },
  /** It keeps this far outside a salt circle's edge, metres. */
  shy: 0.4,
  cell: 64,
  quiet: 100,
  wake: 90,
  sleep: 130,
} as const;

export type TallMode = 'stand' | 'stalk' | 'reach' | 'stare' | 'balk' | 'home' | 'dead';

export class TallOne extends Creature<TallMode> {
  readonly id = 0;
  /** Seconds since the reach began, and since the stare began. */
  swingT = 9;
  stareT = 9;
  /** The stare landed (this one). */
  stared = false;
  /** It has seen you: it is after you. */
  hunting = false;
  /** The circle it is going round, and which way (+1 / -1): kept while it is in the way, so it cannot dither. */
  around: SaltCircle | null = null;
  aroundSide = 1;

  constructor(readonly lair: Lair) {
    super(lair.x, lair.y, lair.z, lair.yaw, TALL.radius, TALL.height, TALL.health, 'stand');
  }
}

/** Its lair, as a den. */
interface Haunt extends Den {
  readonly lair: Lair;
}

export class TallOnes extends Population<Haunt, TallOne> {
  /** Times its stare has landed (the game says so each time). */
  stares = 0;

  constructor(level: Level) {
    super(level, 'tall-one', TALL, { arrive: 0.8, still: 0.1, step: 0.7, drop: 1.2, accel: 3, turn: 2.5, face: 3 });
  }

  /** Its lair, if this level has one. */
  get lair(): Lair | null {
    return this.level.lair;
  }

  protected denIn(key: number, i: number, j: number): Haunt | null {
    const l = this.level.lair;
    if (!l || Math.floor(l.x / TALL.cell) !== i || Math.floor(l.z / TALL.cell) !== j) return null;
    return { key, x: l.x, z: l.z, lair: l };
  }

  protected hatch(h: Haunt, killed: (id: number) => boolean): TallOne[] {
    return killed(0) ? [] : [new TallOne(h.lair)];
  }

  /** Its step. Returns 1 if its reach or its stare landed. */
  protected act(t: TallOne, prey: Fighter, _ctx: null, dt: number): number {
    const T = TALL, R = T.reach, W = T.stare, L = t.lair;
    t.swingT += dt;
    t.stareT += dt;
    if (t.provoked) { t.provoked = false; t.hunting = true; }
    if (t.dead) return this.lieDead(t, dt, 4);
    const dx = prey.x - t.x, dz = prey.z - t.z, d = Math.hypot(dx, dz), toYou = Math.atan2(-dx, -dz);
    const level = !prey.dead && Math.abs(prey.y - t.y) < 5;
    if (level && noticed(prey, d, T.notice)) t.hunting = true;
    if (t.hunting && (prey.dead || d > T.forget || Math.hypot(t.x - L.x, t.z - L.z) > T.leash)) t.hunting = false;
    const safe = inCircle(L.circles, prey.x, prey.z, -prey.radius * 0.5);
    if (!t.hunting && (t.mode === 'stalk' || t.mode === 'balk')) t.mode = 'home';
    if (t.hunting && (t.mode === 'stand' || t.mode === 'home')) t.mode = 'stalk';

    let hit = 0;
    switch (t.mode) {
      case 'stand':
        this.steer.move(t, L.x, L.z, T.walk, dt, L.yaw);
        break;
      case 'home': {
        const left = Math.hypot(L.x - t.x, L.z - t.z);
        this.goRound(t, L.x, L.z, T.walk, dt, left < 1 ? L.yaw : null);
        if (left < 0.3 && Math.abs(angleDiff(t.yaw, L.yaw)) < 0.3) t.mode = 'stand';
        break;
      }
      case 'stalk':
        if (safe) { t.mode = 'balk'; break; }
        if (d > W.near && d < W.far && t.stareT > W.every + W.dur) { t.mode = 'stare'; t.stareT = 0; t.stared = false; break; }
        if (this.blocking(t, prey.x, prey.z)) this.goRound(t, prey.x, prey.z, T.stalk, dt, null);
        else if (closeIn(t, t.swingT, prey, R, T.stalk, this.steer, dt, 2)) { t.mode = 'reach'; t.swingT = 0; }
        break;
      case 'reach':
        hit = pickSwing(t, t.swingT, R, prey, T.aim, this.steer, this.rng, 'tall-one', dt);
        if (t.swingT >= R.dur) t.mode = 'stalk';
        break;
      case 'stare':
        // Arms open, facing you; then the cold, if you are still in its sight and out of the salt.
        this.steer.move(t, t.x, t.z, 0, dt, toYou);
        if (!t.stared && t.stareT >= W.windup) {
          t.stared = true;
          if (level && !safe && d < W.far + 4) {
            damage(prey, this.rng.range(W.damage[0], W.damage[1]), t.x, t.z, 0, 'tall-one');
            this.stares++;
            hit = 1;
          }
        }
        if (t.stareT >= W.dur) t.mode = 'stalk';
        break;
      case 'balk': {
        // You are in the salt: it comes to the edge of the circle and waits there, watching you.
        if (!safe) { t.mode = 'stalk'; break; }
        const edge = safe.r + t.radius + T.shy + 0.6, fromC = Math.hypot(t.x - safe.x, t.z - safe.z);
        if (fromC > edge + 1.5) this.goRound(t, safe.x + ((t.x - safe.x) / fromC) * edge, safe.z + ((t.z - safe.z) / fromC) * edge, T.stalk, dt, fromC < edge + 8 ? toYou : null);
        else this.steer.move(t, t.x, t.z, 0, dt, toYou);
        break;
      }
    }
    this.keepOut(t);
    return hit;
  }

  /** The circle in its way to (gx, gz), if any (it will not walk through one). */
  private blocking(t: TallOne, gx: number, gz: number): SaltCircle | null {
    const ex = gx - t.x, ez = gz - t.z, len = Math.hypot(ex, ez) || 1;
    let best: SaltCircle | null = null, bestS = Infinity;
    for (const c of t.lair.circles) {
      const s = ((c.x - t.x) * ex + (c.z - t.z) * ez) / len;
      if (s < 0 || s > len) continue;
      const off = Math.abs((c.x - t.x) * ez - (c.z - t.z) * ex) / len;
      if (off < c.r + t.radius + TALL.shy && s < bestS) { best = c; bestS = s; }
    }
    return best;
  }

  /**
   * Walk towards (gx, gz) round any salt circle in the way: along the circle's rim, on the side it
   * first chose for that circle, until the way is clear.
   */
  private goRound(t: TallOne, gx: number, gz: number, speed: number, dt: number, face: number | null): void {
    const c = this.blocking(t, gx, gz);
    if (!c) {
      t.around = null;
      this.steer.move(t, gx, gz, speed, dt, face);
      return;
    }
    if (t.around !== c) {
      t.around = c;
      t.aroundSide = (c.x - t.x) * (gz - t.z) - (c.z - t.z) * (gx - t.x) >= 0 ? 1 : -1;
    }
    const rim = c.r + t.radius + TALL.shy + 0.8, a = Math.atan2(t.z - c.z, t.x - c.x) + t.aroundSide * 0.7;
    this.steer.move(t, c.x + Math.cos(a) * rim, c.z + Math.sin(a) * rim, speed, dt, null);
  }

  /** It never stands in the salt: out to the edge if a step took it in. */
  private keepOut(t: TallOne): void {
    for (const c of t.lair.circles) {
      const dx = t.x - c.x, dz = t.z - c.z, d = Math.hypot(dx, dz), min = c.r + t.radius + TALL.shy * 0.5;
      if (d < min && d > 1e-6) { t.x = c.x + (dx / d) * min; t.z = c.z + (dz / d) * min; }
    }
  }
}
