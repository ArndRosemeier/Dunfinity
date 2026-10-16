/**
 * Grandma's Horseradish (src/loot/recipes.ts, The Garden): a root set in the floor at the nobody's
 * feet tunnels fast under the floor to the one it was set at, comes up under it, and bites (once, twice
 * or three times by the card's rank) before it shrivels. If the one it bites gets away between bites it
 * dives and tunnels after it again; if it dies, the root goes after the nearest other living thing,
 * and with none near (or after digging too long) it comes up and shrivels. A bite is a blow through
 * combat's damage(), struck from the root. It bites only foes, never the nobody.
 *
 * It digs straight at its quarry at a fixed speed, so it never dithers. Pure: roots are plain data,
 * stepped against the foes and the floor.
 */
import type { Rng } from '@futuremagic/core';
import { damage, type Fighter } from './combat';

export const RADISH = {
  /** How fast it tunnels, m/s, and how long it may tunnel in all before it gives up, seconds. */
  speed: 9,
  digs: 6,
  /** It comes up this near its quarry (from the quarry's edge), metres; it dives after it again once it is this much further. */
  near: 0.9,
  keep: 0.8,
  /** How far off it looks for something else to go after when its quarry dies, metres, and over what heights. */
  seek: 10,
  tall: 3,
  /** Seconds it takes to come up, to dive back under, and to shrivel away. */
  rise: 0.45,
  dive: 0.3,
  shrivel: 1.3,
  /** A bite: seconds it takes, when it lands, its knockback, m/s; seconds between bites. */
  bite: { dur: 0.55, hit: 0.3, knock: 4 },
  between: 0.35,
} as const;

/** What a root does, at the card's rank: how many times it bites, and each bite's damage. */
export interface Rooting {
  readonly bites: number;
  readonly damage: readonly [number, number];
}

export type RootPhase = 'dig' | 'rise' | 'up' | 'dive' | 'shrivel';

export interface Root {
  x: number;
  y: number;
  z: number;
  /** Which way it goes, or looks (forward is (-sin yaw, -cos yaw)). */
  yaw: number;
  readonly rooting: Rooting;
  /** What it goes after (null: nothing left). */
  quarry: Fighter | null;
  phase: RootPhase;
  /** Seconds into the phase; seconds tunnelled in all. */
  t: number;
  dug: number;
  /** Bites left; seconds into the bite (-1: not biting), and whether this one has struck yet. */
  bites: number;
  biting: number;
  struck: boolean;
}

/** Whether `f` is a quarry worth going after from the root: alive and at a height near the floor it tunnels. */
function worth(r: Root, f: Fighter): boolean {
  return !f.dead && Math.abs(f.y - r.y) < RADISH.tall;
}

/** How far `f` is from the root, to its edge, over the floor. */
function off(r: Root, f: Fighter): number {
  return Math.hypot(f.x - r.x, f.z - r.z) - f.radius;
}

export class Horseradish {
  readonly roots: Root[] = [];

  /** A root set in the floor at (x, y, z), going after `quarry`. */
  set(x: number, y: number, z: number, quarry: Fighter, rooting: Rooting): Root {
    const r: Root = { x, y, z, yaw: Math.atan2(-(quarry.x - x), -(quarry.z - z)), rooting, quarry, phase: 'dig', t: 0, dug: 0, bites: rooting.bites, biting: -1, struck: false };
    this.roots.push(r);
    return r;
  }

  /** Step every root by dt against the foes, under the floor `floor(x, z)`; `rng` rolls the damage. Returns those bitten, with the root that bit. */
  tunnel(dt: number, foes: readonly Fighter[], floor: (x: number, z: number) => number, rng: Rng): { root: Root; hit: Fighter }[] {
    const bitten: { root: Root; hit: Fighter }[] = [];
    for (let i = this.roots.length - 1; i >= 0; i--) {
      const r = this.roots[i];
      r.t += dt;
      // A dead quarry: the nearest other living thing, if any is near.
      if (r.quarry && !worth(r, r.quarry) && r.biting < 0) {
        r.quarry = null;
        let best: number = RADISH.seek;
        for (const f of foes) if (worth(r, f) && off(r, f) < best) { best = off(r, f); r.quarry = f; }
      }
      const q = r.quarry;
      switch (r.phase) {
        case 'dig': {
          r.dug += dt;
          if (!q || r.dug > RADISH.digs) { this.go(r, 'rise'); r.bites = 0; break; }
          const d = off(r, q);
          r.yaw = Math.atan2(-(q.x - r.x), -(q.z - r.z));
          if (d <= RADISH.near) { this.go(r, 'rise'); break; }
          const s = Math.min(RADISH.speed * dt, d - RADISH.near * 0.8), h = Math.hypot(q.x - r.x, q.z - r.z);
          r.x += ((q.x - r.x) / h) * s; r.z += ((q.z - r.z) / h) * s; r.y = floor(r.x, r.z);
          break;
        }
        case 'rise':
          if (r.t >= RADISH.rise) this.go(r, r.bites > 0 ? 'up' : 'shrivel');
          break;
        case 'dive':
          if (r.t >= RADISH.dive) this.go(r, 'dig');
          break;
        case 'up': {
          if (r.biting < 0) {
            if (r.bites <= 0) { this.go(r, 'shrivel'); break; }
            if (!q) { r.bites = 0; this.go(r, 'shrivel'); break; }
            if (off(r, q) > RADISH.near + RADISH.keep) { this.go(r, 'dive'); break; }
            r.yaw = Math.atan2(-(q.x - r.x), -(q.z - r.z));
            if (r.t >= RADISH.between) { r.biting = 0; r.struck = false; }
            break;
          }
          r.biting += dt;
          if (!r.struck && r.biting >= RADISH.bite.hit) {
            r.struck = true;
            r.bites--;
            if (q && !q.dead && off(r, q) <= RADISH.near + RADISH.keep && Math.abs(q.y - r.y) < RADISH.tall) {
              damage(q, rng.range(r.rooting.damage[0], r.rooting.damage[1]), r.x, r.z, RADISH.bite.knock, 'horseradish');
              bitten.push({ root: r, hit: q });
            }
          }
          if (r.biting >= RADISH.bite.dur) { r.biting = -1; r.t = 0; }
          break;
        }
        case 'shrivel':
          if (r.t >= RADISH.shrivel) this.roots.splice(i, 1);
          break;
      }
    }
    return bitten;
  }

  private go(r: Root, phase: RootPhase): void {
    r.phase = phase; r.t = 0; r.biting = -1;
  }
}
