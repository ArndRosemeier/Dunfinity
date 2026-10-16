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
