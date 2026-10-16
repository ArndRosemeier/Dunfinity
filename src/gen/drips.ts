/**
 * Living stalagmites: here and there, under a little stalactite, water starts to drip, and a
 * stalagmite grows under it while one watches. When the dripping stops it stands a while, then sinks
 * slowly back into the floor; after a rest the dripping starts again. Never in the way of anything:
 * there for wonder.
 *
 * Where they are (`Drips`: a few per level, on flat floor under a roof, more near water and in salt)
 * and how one looks at a moment (`dripLook`) are pure, so the view (src/render/props/dripView.ts)
 * and the sounds read the same cycle.
 */
import { Rng, deriveSeed, smoothstep } from '@futuremagic/core';
import type { Level } from './level';
import { CellMemo } from './cellMemo';

export const DRIP = {
  /** One site at most per cell this wide (m); the chance a cell has one, on dry rock and near water or salt. */
  cell: 36,
  chance: 0.15,
  wetChance: 0.45,
  /** Tries at a spot in a cell. */
  tries: 10,
  /** The cycle (s): dripping and growing, then standing, then sinking, then resting (only the stalactite). */
  grow: 70,
  stand: 22,
  sink: 55,
  rest: 30,
  /** Seconds the dripping takes to start and to stop; seconds the rock stays wet after it stops. */
  ramp: 4,
  dryOff: 25,
  /** Its full height and base radius (m), min and max. */
  height: [0.7, 1.35] as const,
  radius: [0.17, 0.28] as const,
  /** The stalactite it drips from: length and radius (m). */
  hang: [0.22, 0.45] as const,
  hangRadius: [0.06, 0.1] as const,
  /** The roof over it (m above the floor), min and max. */
  roof: [2.4, 40] as const,
  /** Drops: how many fall in turn, seconds between two, seconds one swells at the stalactite's tip before it falls; gravity (m/s²). */
  drops: 3,
  gap: 1.5,
  swell: 0.9,
  gravity: 9.81,
  /** How far below the floor it sinks at the end (in its full heights). */
  under: 1.08,
  /** Seen this far (m). */
  seen: 45,
} as const;

/** The cycle's length (s). */
export const DRIP_CYCLE = DRIP.grow + DRIP.stand + DRIP.sink + DRIP.rest;

export interface DripSite {
  /** Stable over runs. */
  readonly id: number;
  /** Its base on the floor. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** The roof over it (y), where the stalactite hangs. */
  readonly roof: number;
  readonly height: number;
  readonly radius: number;
  readonly hang: number;
  readonly hangRadius: number;
  /** Where in its cycle it is at time 0 (s). */
  readonly offset: number;
}

/** How a site looks at a moment: everything relative to its base (m), dripping and wetness 0–1. */
export interface DripLook {
  /** The stalagmite's height above its base now (its tip, before sinking), and its radius. */
  height: number;
  radius: number;
  /** How far it has sunk into the floor (m): its tip is at `height - sunk`. */
  sunk: number;
  /** How strongly it drips (0 none, 1 full), how wet the stone is. */
  drip: number;
  wet: number;
  /** The time in its cycle (s). */
  t: number;
}

/** The tip of the stalagmite above its base now (m; below 0 once sunk away). */
export const tipOf = (l: DripLook) => l.height - l.sunk;

/** How `site` looks at time `time` (s; any clock). */
export function dripLook(site: DripSite, time: number, out: DripLook = { height: 0, radius: 0, sunk: 0, drip: 0, wet: 0, t: 0 }): DripLook {
  const t = mod(time + site.offset, DRIP_CYCLE);
  const D = DRIP, standAt = D.grow, sinkAt = standAt + D.stand, restAt = sinkAt + D.sink;
  // Growing fast at first and slower as it rises, as a drip's lime builds up: an ease out.
  const g = 1 - (1 - Math.min(1, t / D.grow)) ** 1.6;
  const s = t < sinkAt ? 0 : t < restAt ? smoothstep(0, 1, (t - sinkAt) / D.sink) : 1;
  out.t = t;
  out.height = site.height * g;
  out.radius = site.radius * (0.3 + 0.7 * Math.sqrt(g)) * (1 - 0.15 * s);
  out.sunk = site.height * D.under * s;
  out.drip = t < D.grow ? Math.min(1, t / D.ramp, (D.grow - t) / D.ramp) : 0;
  out.wet = t < D.grow ? 1 : t < restAt ? Math.max(0, 1 - (t - D.grow) / D.dryOff) : 0;
  return out;
}

/** How far a drop falls at `site` now (m): from the stalactite's tip to the stalagmite's (or the floor's). */
export function fallOf(site: DripSite, look: DripLook): number {
  return Math.max(0.05, site.roof - site.hang - site.y - Math.max(0, tipOf(look)));
}

/** Drops landing at `site` between cycle times t0 and t1 (s, t0 < t1; at most one cycle apart). */
export function landed(site: DripSite, look: DripLook, t0: number, t1: number): number {
  const fall = Math.sqrt((2 * fallOf(site, look)) / DRIP.gravity), period = DRIP.drops * DRIP.gap;
  // Drop k lands at (k·gap - swell - fall) mod period... counted as crossings of that instant.
  const lands = DRIP.swell + fall;
  let n = 0;
  for (let k = 0; k < DRIP.drops; k++) {
    const a = Math.floor((t0 + k * DRIP.gap - lands) / period), b = Math.floor((t1 + k * DRIP.gap - lands) / period);
    n += b - a;
  }
  return n;
}

/** Drops one hears land at `site` between times `t0` and `t1` (s, the same clock as `dripLook`; `look` is left at t1). */
export function heard(site: DripSite, t0: number, t1: number, look: DripLook): number {
  dripLook(site, t1, look);
  const c0 = look.t - (t1 - t0);
  if (c0 < 0 || t1 - t0 > DRIP.gap) return 0; // a new cycle, or a long gap: nothing to catch up
  return look.drip > 0 ? landed(site, look, c0, look.t) : 0;
}

export class Drips {
  private readonly cells: CellMemo<DripSite | null>;
  private readonly seed: number;

  constructor(private readonly level: Level) {
    this.seed = deriveSeed(level.seed, 'drips', level.depth);
    this.cells = new CellMemo((i, j, key) => this.cellSite(i, j, key));
  }

  /** The sites within `r` of (x, z), into `out`. */
  near(x: number, z: number, r: number, out: DripSite[] = []): DripSite[] {
    out.length = 0;
    const c = DRIP.cell;
    for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++) {
      const s = this.cells.at(i, j);
      if (s && (s.x - x) ** 2 + (s.z - z) ** 2 <= r * r) out.push(s);
    }
    return out;
  }

  /** The site nearest (x, z) within `far` m, or null. */
  nearest(x: number, z: number, far = 300): DripSite | null {
    let best: DripSite | null = null, bd = Infinity;
    for (let r = DRIP.cell; r <= far + DRIP.cell && !best; r += DRIP.cell) {
      for (const s of this.near(x, z, Math.min(r, far))) {
        const d = (s.x - x) ** 2 + (s.z - z) ** 2;
        if (d < bd) { bd = d; best = s; }
      }
    }
    return best;
  }

  /** The site of cell (i, j), if it has one: a flat spot of open floor under a roof, not in the water. */
  private cellSite(i: number, j: number, key: number): DripSite | null {
    const l = this.level;
    if (l.depth === 0) return null; // not in grandma's cellar or the town
    const rng = new Rng(deriveSeed(this.seed, key));
    const wetBand = (l.band.rocks.salt ?? 0) > 0 || l.band.water[1] > 0 || l.band.finish.wet > 0;
    const roll = rng.float();
    if (roll > DRIP.wetChance) return null;
    const c = DRIP.cell;
    for (let k = 0; k < DRIP.tries; k++) {
      const x = (i + rng.range(0.1, 0.9)) * c, z = (j + rng.range(0.1, 0.9)) * c;
      const site = this.siteAt(x, z, rng);
      if (!site) continue;
      // More of them by water and in the salt: elsewhere, only the lower share of rolls.
      if (roll > DRIP.chance && !wetBand && !this.byWater(x, z)) return null;
      return site;
    }
    return null;
  }

  /** A site at (x, z) if the floor there will do. */
  private siteAt(x: number, z: number, rng: Rng): DripSite | null {
    const l = this.level, y = l.groundAt(x, z);
    if (Math.abs(y - l.floorAt(x, z)) > 0.6 || !l.dry(x, z, 0.08) || l.sheds.holding(x, z, y, -0.5) || l.descents.at(x, z, 5)) return null;
    // Flat round it (it sinks into the floor: no edge of it may show), and room all round it.
    for (const [dx, dz] of [[0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4], [0.3, 0.3], [-0.3, -0.3]]) {
      if (Math.abs(l.groundAt(x + dx, z + dz) - y) > 0.15) return null;
    }
    if (l.sdf(x, y + 1, z) < 0.9) return null;
    const up = l.trace(x, y + 0.5, z, 0, 1, 0, DRIP.roof[1] + 1, 0.02) + 0.5;
    if (up < DRIP.roof[0] || up > DRIP.roof[1]) return null;
    const height = Math.min(rng.range(DRIP.height[0], DRIP.height[1]), up - 1.2);
    return {
      id: Math.round(x * 16) * 100003 + Math.round(z * 16), x, y: y - 0.02, z, roof: y + up,
      height, radius: rng.range(DRIP.radius[0], DRIP.radius[1]),
      hang: rng.range(DRIP.hang[0], DRIP.hang[1]), hangRadius: rng.range(DRIP.hangRadius[0], DRIP.hangRadius[1]),
      offset: rng.range(0, DRIP_CYCLE),
    };
  }

  /** Is there standing water within a few metres of (x, z)? */
  private byWater(x: number, z: number): boolean {
    const l = this.level;
    for (let a = 0; a < 8; a++) {
      const px = x + Math.cos(a * 0.785) * 5, pz = z + Math.sin(a * 0.785) * 5;
      if (l.waterAt(px, pz) > l.groundAt(px, pz)) return true;
    }
    return false;
  }
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}
