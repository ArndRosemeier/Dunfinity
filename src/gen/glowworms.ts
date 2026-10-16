/**
 * A sky of glow-worms: here and there the roof of a big cavern is covered with tiny lights, a faint
 * blue-green dust of them with brighter stars among them drawn into constellations that are not
 * ours. The stranger a level, the more the sky drifts from ours: its colour strays, and the light
 * turns slowly round the patch in arms like a galaxy. Never in the way of anything: there for wonder.
 *
 * Where a sky is (`Skies`: one at most per cell, under a roof high enough to look up at), its lights
 * (`skyLights`, built into the props tile of its middle) and a level's look (`skyOf`) are pure.
 */
import { Rng, deriveSeed, hsl2rgb, srgbToLinear } from '@futuremagic/core';
import type { Level } from './level';
import { SiteField } from './cellMemo';
import { strangeness } from './genome';
import type { PropMesh } from './propMesh';

export const SKY = {
  /** One sky at most per cell this wide (m), with this chance (none in the cellar or the town). */
  cell: 70,
  chance: 0.3,
  /** Tries at a spot in a cell. */
  tries: 8,
  /** The roof over it (m above the floor), min and max; the patch's radius (m), min and max. */
  roof: [5, 40] as const,
  radius: [7, 13] as const,
  /** The roof is sampled on a grid this fine (m) to lay the lights on. */
  grid: 1.2,
  /** Lights per square metre of roof, and the share of them that are stars. */
  density: 6,
  stars: 0.035,
  /** Constellations per sky (min, max), stars in one (min, max), how far apart its stars may be (m). */
  figures: [2, 5] as const,
  figureStars: [4, 8] as const,
  figureStep: [0.8, 2.2] as const,
  /** The most lights in one sky (the view's buffers hold this many). */
  most: 2500,
  /** Strangeness from which the light turns round the patch in arms. */
  arms: 1.2,
  /** Seen this far (m). */
  seen: 70,
} as const;

export interface SkySite {
  /** Stable over runs. */
  readonly id: number;
  /** The middle of the patch on the floor, and the patch's radius. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly r: number;
}

/** How the skies of a level look: their colour (linear rgb), and the arms: how many (0: none) and how fast they turn (rad/s). */
export interface SkyLook {
  readonly color: readonly [number, number, number];
  readonly arms: number;
  readonly spin: number;
}

/** The look of `level`'s skies: ours are blue-green and still; a strange sky's colour strays round the wheel, and its light turns in arms. */
export function skyOf(seed: number, depth: number): SkyLook {
  const rng = new Rng(deriveSeed(seed, 'skyLook', depth)), s = strangeness(seed, depth).s;
  const hue = 0.47 + (s > 0.8 ? rng.range(-1, 1) * Math.min(0.5, (s - 0.8) * 0.3) : 0);
  const color = hsl2rgb(hue, 0.75, 0.55).map(srgbToLinear) as [number, number, number];
  const arms = s >= SKY.arms ? rng.int(2, 4) : 0;
  return { color, arms, spin: arms ? rng.range(0.02, 0.05) * rng.sign() : 0 };
}

export class Skies extends SiteField<SkySite> {
  constructor(private readonly level: Level) {
    super(SKY.cell, deriveSeed(level.seed, 'skies', level.depth));
  }

  /** The sky of cell (i, j), if it has one: open floor under a high roof. */
  protected cellSite(i: number, j: number, rng: Rng): SkySite | null {
    const l = this.level;
    if (l.depth === 0) return null;
    if (!rng.chance(SKY.chance)) return null;
    for (let k = 0; k < SKY.tries; k++) {
      const x = (i + rng.range(0.15, 0.85)) * SKY.cell, z = (j + rng.range(0.15, 0.85)) * SKY.cell;
      const y = l.groundAt(x, z);
      if (Math.abs(y - l.floorAt(x, z)) > 0.6 || !l.dry(x, z, 0.05) || l.sdf(x, y + 1.6, z) < 1.2) continue;
      const up = l.trace(x, y + 1, z, 0, 1, 0, SKY.roof[1], 0.02) + 1;
      if (up < SKY.roof[0] || up >= SKY.roof[1]) continue;
      return { id: Math.round(x * 16) * 100003 + Math.round(z * 16), x, y, z, r: rng.range(SKY.radius[0], SKY.radius[1]) };
    }
    return null;
  }
}

/**
 * The lights of `site` as quads for the `GLOWWORM` kind (src/render/materials.ts), into `b`: the roof
 * over the patch sampled on a grid (straight up from the floor), each cell sown with faint lights a
 * little under the rock, and a few figures of brighter stars. Each light's four corners share its
 * place; `normal` is (corner x, corner y, size m), `color` (brightness, its angle round the patch,
 * its distance out in radii). Pure and seeded: the same sky every visit.
 */
export function skyLights(level: Level, site: SkySite, b: QuadSink): number {
  const rng = new Rng(deriveSeed(level.seed, 'sky', site.id));
  const g = SKY.grid, n = Math.ceil(site.r / g);
  let count = 0, roofY = 0;
  /** The roof's height over (x, z), or NaN where there is none near enough. */
  const roofAt = (x: number, z: number): number => {
    const y = level.groundAt(x, z), up = level.trace(x, y + 1, z, 0, 1, 0, SKY.roof[1] + 4, 0.02) + 1;
    return up < SKY.roof[1] + 3 ? y + up : NaN;
  };
  /** A light `hang` m under the roof over (x, z), whose height near there is `roofY`. */
  const light = (x: number, hangBy: number, z: number, size: number, bright: number) => {
    if (count >= SKY.most) return;
    // Settled onto the rock from the roof's height near it (a roof slopes).
    let y = roofY;
    for (let k = 0; k < 3; k++) y += level.sdf(x, y, z) - hangBy;
    if (level.sdf(x, y + 0.4, z) > 0.3) return; // no rock over it after all (an edge)
    const dx = x - site.x, dz = z - site.z;
    b.spot(x, y, z, size, bright, Math.atan2(dz, dx), Math.hypot(dx, dz) / site.r);
    count++;
  };
  const perCell = SKY.density * g * g;
  for (let a = -n; a <= n; a++) for (let c = -n; c <= n; c++) {
    const cx = site.x + a * g, cz = site.z + c * g, d = Math.hypot(a * g, c * g) / site.r;
    if (d > 1) continue;
    const roof = roofAt(cx, cz);
    if (Number.isNaN(roof)) continue;
    // Thinning out towards the edge, ragged.
    const k = Math.round(perCell * (1 - d * d) * rng.range(0.6, 1.4));
    roofY = roof;
    for (let q = 0; q < k; q++) {
      const star = rng.chance(SKY.stars);
      light(cx + rng.range(-g / 2, g / 2), rng.range(0.03, 0.15), cz + rng.range(-g / 2, g / 2),
        star ? rng.range(0.035, 0.06) : rng.range(0.012, 0.026), star ? rng.range(0.7, 1) : rng.range(0.15, 0.55));
    }
  }
  // Constellations: a few figures of bright stars, each a short wandering chain.
  const figures = rng.int(SKY.figures[0], SKY.figures[1]);
  for (let f = 0; f < figures; f++) {
    const t = rng.range(0, Math.PI * 2), r0 = rng.range(0, site.r * 0.6);
    let x = site.x + Math.cos(t) * r0, z = site.z + Math.sin(t) * r0, dir = rng.range(0, Math.PI * 2);
    const stars = rng.int(SKY.figureStars[0], SKY.figureStars[1]);
    for (let k = 0; k < stars; k++) {
      roofY = roofAt(x, z);
      if (!Number.isNaN(roofY)) light(x, 0.05, z, rng.range(0.06, 0.09), 1);
      dir += rng.range(-1.3, 1.3);
      const step = rng.range(SKY.figureStep[0], SKY.figureStep[1]);
      x += Math.cos(dir) * step; z += Math.sin(dir) * step;
    }
  }
  return count;
}

/** Where `skyLights` puts its lights. */
export interface QuadSink {
  spot(x: number, y: number, z: number, size: number, a: number, b: number, c: number): void;
}

/** Gathers the lights of a props tile's skies into one mesh of the `GLOWWORM` kind's layout. */
export class SkyBuilder implements QuadSink {
  private readonly p: number[] = [];
  private readonly n: number[] = [];
  private readonly c: number[] = [];
  private readonly i: number[] = [];

  spot(x: number, y: number, z: number, size: number, a: number, b: number, c: number): void {
    const v = this.p.length / 3;
    for (const [cx, cy] of CORNERS) { this.p.push(x, y, z); this.n.push(cx, cy, size); this.c.push(a, b, c); }
    this.i.push(v, v + 1, v + 2, v, v + 2, v + 3);
  }

  mesh(): PropMesh | null {
    if (!this.i.length) return null;
    return { positions: new Float32Array(this.p), normals: new Float32Array(this.n), colors: new Float32Array(this.c), indices: new Uint32Array(this.i) };
  }
}

const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const;
