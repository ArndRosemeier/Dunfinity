/**
 * The miners' decisions on a working's pillar grid, shared by everything that places their things
 * (src/gen/quarryProps.ts draws them in tiles, src/gen/sheds.ts says where the sheds stand for the
 * game too). Pure: every decision is a hash of the level's props seed, the working and its grid
 * position, so tiles and the game agree.
 */
import { deriveSeed, hash3i, hashToFloat } from '@futuremagic/core';
import type { Level } from './level';
import type { Working } from './quarry';

/** Tile size, metres. */
export const PROP_TILE = 64;

/** The seed every miners' decision on `level` hangs off. */
export function propSeed(level: Level): number {
  return deriveSeed(level.seed, 'props', level.depth);
}

/** A per-decision random number for working w. */
export function propRoll(seed: number, w: Working, a: number, b: number, c: number): number {
  return hashToFloat(hash3i(seed ^ w.id, a, b, c));
}

/** Whether aisle k (dir 0: u = k·s, running along v; dir 1: v = k·s, running along u) has a track. */
export function hasRail(seed: number, w: Working, dir: number, k: number): boolean {
  return propRoll(seed, w, dir, k, 0) < 0.14;
}

/** The workings that reach into the square of `size` metres at (x0, z0). */
export function workingsIn(level: Level, x0: number, z0: number, size: number): Working[] {
  const found = new Map<number, Working>();
  for (let j = 0; j <= 8; j++) for (let i = 0; i <= 8; i++) {
    const w = level.workingAt(x0 + (i * size) / 8, z0 + (j * size) / 8);
    found.set(w.id, w);
  }
  return [...found.values()];
}

/** That square's extent in w's grid coordinates: [umin, umax, vmin, vmax]. */
export function gridBounds(level: Level, w: Working, x0: number, z0: number, size: number): [number, number, number, number] {
  const b: [number, number, number, number] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const [x, z] of [[x0, z0], [x0 + size, z0], [x0, z0 + size], [x0 + size, z0 + size]]) {
    const [u, v] = level.field.excavation.toGrid(w, x, z);
    b[0] = Math.min(b[0], u); b[1] = Math.max(b[1], u); b[2] = Math.min(b[2], v); b[3] = Math.max(b[3], v);
  }
  return b;
}
