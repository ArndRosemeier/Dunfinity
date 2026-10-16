/**
 * Grandma's Flour Bag and Matchstick (src/loot/recipes.ts, Baking). A bag thrown like a knife
 * (src/combat/thrown.ts) bursts into a cloud of flour where it hits; while the cloud hangs,
 * whatever is in it is blind: it loses the nobody (`Walker.blind`: it stumbles about, src/creatures/
 * steer.ts) and its blows find no one (`blinds`, asked by the nobody's guard), until a while after
 * it gets out. A match flicked into a cloud sets it off: the dust in the air goes up all at once, a
 * blast through combat's damage() to everything in it, the nobody too.
 *
 * Pure: the clouds are plain data, stepped against the fighters they hold.
 */
import { angleDiff, type Rng } from '@futuremagic/core';
import { damage, type Fighter } from './combat';

export const FLOUR = {
  /** The heights a cloud covers over where it burst, metres (it settles on the floor and rises). */
  low: -1, high: 2.6,
  /** Seconds a cloud takes to spread to its full size, and the share of its life it thins out over at the end. */
  spread: 0.5, thin: 0.25,
} as const;

/** What a bag does (a rank of the card: `Cooked.flour`): the cloud's radius, seconds it hangs, seconds what was in it stays blind after. */
export interface Dusting {
  readonly r: number;
  readonly hangs: number;
  readonly blind: number;
}

export interface Cloud {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly r: number;
  readonly hangs: number;
  readonly blind: number;
  /** Seconds since it burst. */
  t: number;
}

/** Someone a cloud can blind: seconds left blind (see `Walker.blind`). */
export type Blindable = Fighter & { blind?: number };

export class Flour {
  readonly clouds: Cloud[] = [];

  /** A bag bursting at (x, y, z). */
  burst(x: number, y: number, z: number, d: Dusting): Cloud {
    const c: Cloud = { x, y, z, r: d.r, hangs: d.hangs, blind: d.blind, t: 0 };
    this.clouds.push(c);
    return c;
  }

  /** How far the cloud reaches now (it spreads out first). */
  static reach(c: Cloud): number {
    return c.r * Math.min(1, 0.35 + c.t / FLOUR.spread);
  }

  /** Whether (x, y, z) is in cloud `c`. */
  static holds(c: Cloud, x: number, y: number, z: number): boolean {
    return y >= c.y + FLOUR.low && y <= c.y + FLOUR.high && Math.hypot(x - c.x, z - c.z) <= Flour.reach(c);
  }

  /** The cloud (x, y, z) is in, if any. */
  cloudAt(x: number, y: number, z: number): Cloud | null {
    return this.clouds.find((c) => Flour.holds(c, x, y, z)) ?? null;
  }

  /** The cloud nearest (x, z) within `range` metres and `arc` radians of `yaw` (forward is (-sin yaw, -cos yaw)), if any: where a match is flicked. */
  ahead(x: number, z: number, yaw: number, range: number, arc: number): Cloud | null {
    let best: Cloud | null = null, bd = range;
    for (const c of this.clouds) {
      const dx = c.x - x, dz = c.z - z, d = Math.hypot(dx, dz);
      if (d < bd && (d < c.r || Math.abs(angleDiff(Math.atan2(-dx, -dz), yaw)) < arc)) { bd = d; best = c; }
    }
    return best;
  }

  /** Whether a blow struck from (x, z) is struck blind: from inside a cloud, or by someone standing there who is blind. */
  blinds(x: number, y: number, z: number, fighters: Iterable<Blindable>): boolean {
    if (this.cloudAt(x, y + 0.5, z)) return true;
    for (const f of fighters) if (!f.dead && (f.blind ?? 0) > 0 && Math.hypot(f.x - x, f.z - z) <= f.radius + 0.05) return true;
    return false;
  }

  /** Step by dt: the clouds hang and thin away; whoever is in one is blind (and stays so a while after); blindness wears off. */
  linger(dt: number, fighters: Iterable<Blindable>): void {
    for (let i = this.clouds.length - 1; i >= 0; i--) if ((this.clouds[i].t += dt) > this.clouds[i].hangs) this.clouds.splice(i, 1);
    for (const f of fighters) {
      if (f.blind !== undefined && f.blind > 0) f.blind = Math.max(0, f.blind - dt);
      if (f.dead) continue;
      for (const c of this.clouds) if (Flour.holds(c, f.x, f.y + f.height * 0.5, f.z)) f.blind = Math.max(f.blind ?? 0, c.blind);
    }
  }

  /**
   * Cloud `c` goes up, and with it every cloud it touches (and those they touch): gone, and
   * everyone in one (or touching it) takes `dmg` once, from the middle of the nearest, and is shoved
   * out at `knock` m/s. Returns the clouds that went up and those they caught.
   */
  goUp(c: Cloud, fighters: Iterable<Fighter>, dmg: readonly [number, number], knock: number, rng: Rng): { clouds: Cloud[]; hit: Fighter[] } {
    const up = [c];
    for (let k = 0; k < up.length; k++) {
      for (const o of this.clouds) if (!up.includes(o) && Math.hypot(o.x - up[k].x, o.z - up[k].z) < Flour.reach(o) + Flour.reach(up[k])) up.push(o);
    }
    for (const u of up) { const i = this.clouds.indexOf(u); if (i >= 0) this.clouds.splice(i, 1); }
    const hit: Fighter[] = [];
    for (const f of fighters) {
      if (f.dead) continue;
      let from: Cloud | null = null, bd = Infinity;
      for (const u of up) {
        const d = Math.hypot(f.x - u.x, f.z - u.z);
        if (f.y + f.height < u.y + FLOUR.low || f.y > u.y + FLOUR.high || d - f.radius > Flour.reach(u) || d >= bd) continue;
        from = u; bd = d;
      }
      if (!from) continue;
      damage(f, rng.range(dmg[0], dmg[1]), from.x, from.z, knock, 'flour');
      hit.push(f);
    }
    return { clouds: up, hit };
  }
}
