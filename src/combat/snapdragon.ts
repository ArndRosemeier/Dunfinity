/**
 * Grandma's Snapdragons (src/loot/recipes.ts, The Garden): a seed tossed from the hand (src/combat/
 * thrown.ts) comes up where it lands in a second or two, a stalk with a head of jaws, and bites the
 * nearest living thing in its reach, the nobody too, until it wilts. A bite is a blow through
 * combat's reach() and damage(), struck from the plant's foot the way its head looks.
 *
 * The head turns at a fixed rate and keeps its target until it is well out of reach, so it never
 * dithers between two. Pure: plants are plain data, stepped against everyone who can be bitten.
 */
import { angleDiff, type Rng } from '@futuremagic/core';
import { blowFrom, damage, type Fighter, reach } from './combat';

export const SNAP = {
  /** Seconds from the seed landing to the plant standing up, ready to bite; seconds it takes to wilt away once its time is up. */
  grow: 1.6,
  wilt: 1.4,
  /** A bite: seconds it takes, when the jaws shut (it lands then), its sweep and heights over the plant's foot, metres, and its knockback, m/s. */
  bite: { dur: 0.6, hit: 0.32, arc: 0.7, low: -0.8, high: 2.4, knock: 3 },
  /** How fast the head turns, radians per second, and how far off it may still be when a bite begins. */
  turn: 5,
  aim: 0.35,
  /** A target is let go once it is this far beyond the reach, metres (it picks the nearest anew then). */
  keep: 0.6,
} as const;

/** What a plant does, at the card's rank: seconds it stands (from the seed landing), how far it bites, metres, its damage, and the seconds between bites. */
export interface Sowing {
  readonly lasts: number;
  readonly reach: number;
  readonly damage: readonly [number, number];
  readonly every: number;
}

export interface Plant {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly sowing: Sowing;
  /** Seconds since it came up. */
  t: number;
  /** Which way its head looks (forward is (-sin yaw, -cos yaw)). */
  yaw: number;
  /** Whom it bites at (null: nobody in reach). */
  target: Fighter | null;
  /** Seconds into the bite (-1: not biting), and whether this bite has struck yet. */
  biting: number;
  struck: boolean;
  /** Seconds until it may bite again. */
  wait: number;
}

/** Whether `p` is up and not yet wilting (it bites only then). */
export function awake(p: Plant): boolean {
  return p.t >= SNAP.grow && p.t < p.sowing.lasts;
}

/** How far `t` is from the plant's foot over the floor, to its surface, and whether it is at a height the plant can bite. */
function biteable(p: Plant, t: Fighter, r: number): boolean {
  return !t.dead && Math.hypot(t.x - p.x, t.z - p.z) - t.radius <= r && t.y + t.height >= p.y + SNAP.bite.low && t.y <= p.y + SNAP.bite.high;
}

export class Snapdragons {
  readonly plants: Plant[] = [];

  /** A seed come down at (x, y, z) (on the floor), its head first looking along `yaw`. */
  sow(x: number, y: number, z: number, yaw: number, sowing: Sowing): Plant {
    const p: Plant = { x, y, z, sowing, t: 0, yaw, target: null, biting: -1, struck: false, wait: 0 };
    this.plants.push(p);
    return p;
  }

  /** Step every plant by dt against everyone who can be bitten (the nobody among them); `rng` rolls the damage. Returns those bitten. */
  step(dt: number, fighters: readonly Fighter[], rng: Rng): Fighter[] {
    const bitten: Fighter[] = [];
    for (let i = this.plants.length - 1; i >= 0; i--) {
      const p = this.plants[i], s = p.sowing;
      p.t += dt;
      if (p.t > s.lasts + SNAP.wilt) { this.plants.splice(i, 1); continue; }
      p.wait = Math.max(0, p.wait - dt);
      // Kept while biting and while still near; else the nearest in reach.
      if (p.target && p.biting < 0 && !biteable(p, p.target, s.reach + SNAP.keep)) p.target = null;
      if (!awake(p)) { if (p.biting < 0) p.target = null; } else if (!p.target) {
        let best = Infinity;
        for (const f of fighters) {
          if (!biteable(p, f, s.reach)) continue;
          const d = Math.hypot(f.x - p.x, f.z - p.z);
          if (d < best) { best = d; p.target = f; }
        }
      }
      const t = p.target;
      if (t) {
        // Turned at a fixed rate, never past where it looks.
        const want = Math.atan2(-(t.x - p.x), -(t.z - p.z)), off = angleDiff(p.yaw, want), step = SNAP.turn * dt;
        p.yaw += Math.abs(off) <= step ? off : Math.sign(off) * step;
        if (p.biting < 0 && p.wait <= 0 && awake(p) && Math.abs(angleDiff(p.yaw, want)) < SNAP.aim) { p.biting = 0; p.struck = false; }
      }
      if (p.biting < 0) continue;
      p.biting += dt;
      if (!p.struck && p.biting >= SNAP.bite.hit) {
        p.struck = true;
        const b = blowFrom(p, p.yaw, { range: s.reach, arc: SNAP.bite.arc, low: SNAP.bite.low, high: SNAP.bite.high });
        if (t && reach(b, t)) {
          damage(t, rng.range(s.damage[0], s.damage[1]), p.x, p.z, SNAP.bite.knock, 'snapdragon');
          bitten.push(t);
        }
      }
      if (p.biting >= SNAP.bite.dur) { p.biting = -1; p.wait = Math.max(0, s.every - SNAP.bite.dur); }
    }
    return bitten;
  }
}
