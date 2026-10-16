/**
 * What a level style puts on its own ground (ferns and moss in the root hollows, mushrooms in the
 * grotto, bones in the catacombs, crystals in the geodes): the one way a style other than the
 * excavation dresses its floor. The prop pass (src/gen/quarryProps.ts) hands each style with a
 * `props` a `Dress` for every tile; the style scatters its things with `scatter`, which offers only
 * points of the tile that are the style's own ground (E5), on the ground, with room over them.
 *
 * Pure data like the rest of the props: a tile places only what lies in it, and every decision is a
 * hash of the level, the style and the spot, so tiles agree and a seed always gives the same things.
 */
import { hash3i, hashToFloat } from '@futuremagic/core';
import type { Level } from './level';
import type { Inscription } from './inscriptions';
import type { PropBuilder, Rgb } from './propMesh';

/** What the tile builder lends a style to dress its ground with. */
export interface Dress {
  readonly solid: PropBuilder;
  readonly glow: PropBuilder;
  readonly level: Level;
  /** The tile: its corner and size, metres. */
  readonly x0: number;
  readonly z0: number;
  readonly size: number;
  /** This level's and this style's seed. */
  readonly seed: number;
  /** Whether (x, z) is in the tile and the style's own ground. */
  mine(x: number, z: number): boolean;
  /** Something in the way: an upright box (as `TileBuilder.block`). */
  block(x: number, z: number, yaw: number, hx: number, hz: number, y0: number, y1: number): void;
  /** A burning light at (x, y, z) (a fire, a lit brazier): one of the lamps that light the level near the viewer. */
  light(x: number, y: number, z: number): void;
  /** Counts a thing placed. */
  placed(): void;
  /** Writing in an old script (src/gen/inscriptions.ts): laid as strokes `width` metres wide standing `depth` proud, and listed for the game to read. */
  write(ins: Inscription, width: number, depth: number, colour: Rgb): void;
}

/**
 * One try per `cell` metres square of the tile's floor, at a seeded spot in the cell: where it is
 * the style's own dry ground with `room` metres of air over it, `place` is called with the spot,
 * the ground's height and `r`, a fresh number in [0, 1) for each k (k = 0, 1, 2 are taken).
 */
export function scatter(d: Dress, cell: number, salt: number, room: number, place: (x: number, z: number, ground: number, r: (k: number) => number) => void): void {
  const n = Math.round(d.size / cell), ci = Math.round(d.x0 / cell), cj = Math.round(d.z0 / cell), s = d.seed ^ salt;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const r = (k: number) => hashToFloat(hash3i(s, ci + i, cj + j, k));
    const x = d.x0 + (i + r(0)) * cell, z = d.z0 + (j + r(1)) * cell;
    if (!d.mine(x, z)) continue;
    const g = d.level.groundAt(x, z);
    if (!Number.isFinite(g) || g < d.level.waterAt(x, z) + 0.02 || d.level.descents.at(x, z, 1) || d.level.sdf(x, g + room, z) < 0.2) continue;
    place(x, z, g, r);
  }
}

/** How a cluster of glowing blobs looks (`glowCluster`): how many, how far they stray, their size (min, extra) and shape (times the size each way), how much of its size each sits up, and its colour. */
export interface GlowCluster {
  n: number;
  spread: number;
  size: readonly [number, number];
  shape: readonly [number, number, number];
  sit: number;
  colour: Rgb;
}

/**
 * A cluster of glowing blobs (pustules, lichen) round (x, z) on ground g, from a `scatter` spot's
 * numbers `r` (it takes r(5) on, 3·n of them); the first lights the rock round it when `lit`.
 */
export function glowCluster(d: Dress, x: number, z: number, g: number, r: (k: number) => number, c: GlowCluster, lit: boolean): void {
  for (let t = 0; t < c.n; t++) {
    const px = x + (r(5 + t) - 0.5) * c.spread, pz = z + (r(5 + c.n + t) - 0.5) * c.spread, s = c.size[0] + c.size[1] * r(5 + 2 * c.n + t);
    d.glow.ellipsoid(px, g + s * c.sit, pz, s * c.shape[0], s * c.shape[1], s * c.shape[2], c.colour, 6);
    if (lit && t === 0) d.light(px, g + 0.8, pz);
  }
  d.placed();
}

/** The roof over (x, y, z), marching up to `far` metres (Infinity: none that near). */
export function roofOver(level: Level, x: number, y: number, z: number, far: number): number {
  let t = y;
  while (t < y + far) {
    const d = level.sdf(x, t, z);
    if (d < 0.05) return t;
    t += Math.max(0.05, d * 0.8);
  }
  return Infinity;
}
