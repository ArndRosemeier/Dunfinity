/**
 * Salt blooms: here and there on the floor, mostly where the rock is salt, a bloom of salt crystals
 * spreads out from a point while one watches, each little hopper cube glowing the veins' blue as it
 * forms and crackling; it stands glittering a while, then crumbles to nothing; after a rest it
 * blooms again. Never in the way of anything: there for wonder.
 *
 * Where they are (`Blooms`) and how one looks at a moment (`bloomLook`) are pure, so the view
 * (src/render/props/bloomView.ts) and the sounds read the same cycle.
 */
import { Rng, deriveSeed, smoothstep } from '@futuremagic/core';
import type { Level } from './level';
import { SiteField } from './cellMemo';

export const BLOOM = {
  /** One at most per cell this wide (m); the chance a cell has one, in salt and elsewhere. */
  cell: 30,
  saltChance: 0.5,
  chance: 0.1,
  /** A band with at least this share of salt rock counts as salt. */
  salt: 0.15,
  /** Tries at a spot in a cell. */
  tries: 10,
  /** The cycle (s): growing, standing, crumbling, resting (nothing there). */
  grow: 45,
  stand: 40,
  crumble: 7,
  rest: 50,
  /** Its radius when grown (m), min and max. */
  radius: [0.8, 1.4] as const,
  /** Crackles heard while it grows: about one every this many seconds. */
  crackle: 2.2,
  /** Heard this far (m); seen this far (m). */
  heard: 16,
  seen: 40,
} as const;

/** The cycle's length (s). */
export const BLOOM_CYCLE = BLOOM.grow + BLOOM.stand + BLOOM.crumble + BLOOM.rest;

export interface BloomSite {
  /** Stable over runs. */
  readonly id: number;
  /** Its middle on the floor. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly r: number;
  /** Where in its cycle it is at time 0 (s). */
  readonly offset: number;
}

/** How a site looks at a moment: grown (0–1, the share of its crystals there), crumbled (0–1), the time in its cycle (s). */
export interface BloomLook {
  grown: number;
  crumbled: number;
  t: number;
}

/** The time (s) in `site`'s cycle at `time`. */
const cycleAt = (site: BloomSite, time: number) => (((time + site.offset) % BLOOM_CYCLE) + BLOOM_CYCLE) % BLOOM_CYCLE;

/** How `site` looks at `time` (s; any clock). */
export function bloomLook(site: BloomSite, time: number, out: BloomLook = { grown: 0, crumbled: 0, t: 0 }): BloomLook {
  const t = cycleAt(site, time), B = BLOOM, crumbleAt = B.grow + B.stand, goneAt = crumbleAt + B.crumble;
  out.t = t;
  // Fast at first, slower as it reaches out: an ease out.
  out.grown = t < goneAt ? 1 - (1 - Math.min(1, t / B.grow)) ** 1.5 : 0;
  out.crumbled = t < crumbleAt ? 0 : t < goneAt ? smoothstep(0, 1, (t - crumbleAt) / B.crumble) : 0;
  return out;
}

/** Crackles heard from `site` between times t0 and t1 (s, t0 < t1): growing, one every `BLOOM.crackle` s or so (seeded); -1 when it starts to crumble then. */
export function crackles(site: BloomSite, t0: number, t1: number): number {
  const c0 = cycleAt(site, t0), c1 = c0 + (t1 - t0), crumbleAt = BLOOM.grow + BLOOM.stand;
  if (c0 < crumbleAt && c1 >= crumbleAt) return -1;
  if (c1 > BLOOM.grow) return 0;
  // Crackle k falls at k·crackle plus a seeded nudge: count those in [c0, c1).
  let n = 0;
  for (let k = Math.floor(c0 / BLOOM.crackle) - 1; k <= Math.ceil(c1 / BLOOM.crackle); k++) {
    const at = (k + 0.2 + 0.6 * new Rng(deriveSeed(site.id, k)).float()) * BLOOM.crackle;
    if (at >= c0 && at < c1) n++;
  }
  return n;
}

export class Blooms extends SiteField<BloomSite> {
  constructor(private readonly level: Level) {
    super(BLOOM.cell, deriveSeed(level.seed, 'blooms', level.depth));
  }

  /** The bloom of cell (i, j), if it has one: a flat dry spot of open floor. */
  protected cellSite(i: number, j: number, rng: Rng): BloomSite | null {
    const l = this.level;
    if (l.depth === 0) return null; // not in grandma's cellar or the town
    if (!rng.chance((l.band.rocks.salt ?? 0) >= BLOOM.salt ? BLOOM.saltChance : BLOOM.chance)) return null;
    for (let k = 0; k < BLOOM.tries; k++) {
      const x = (i + rng.range(0.1, 0.9)) * BLOOM.cell, z = (j + rng.range(0.1, 0.9)) * BLOOM.cell, r = rng.range(BLOOM.radius[0], BLOOM.radius[1]);
      const y = l.groundAt(x, z);
      if (Math.abs(y - l.floorAt(x, z)) > 0.6 || !l.dry(x, z, 0.08) || l.sheds.holding(x, z, y, -0.5) || l.descents.at(x, z, 4)) continue;
      // Flat under all of it (it lies on the floor), with room over it.
      let flat = true;
      for (let a = 0; a < 8 && flat; a++) flat = Math.abs(l.groundAt(x + Math.cos(a * 0.785) * r, z + Math.sin(a * 0.785) * r) - y) < 0.1;
      if (!flat || l.sdf(x, y + 0.8, z) < 0.7) continue;
      return { id: Math.round(x * 16) * 100003 + Math.round(z * 16), x, y: y - 0.01, z, r, offset: rng.range(0, BLOOM_CYCLE) };
    }
    return null;
  }
}
