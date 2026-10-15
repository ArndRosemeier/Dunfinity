/**
 * Passages on a grid of cells that join every cell (the dungeon's corridors, the geodes' cracks):
 * every cell joins one neighbour behind it, west or south, which makes a tree reaching every
 * cell; some more join besides, for loops.
 *
 * Pure.
 */
import { hash2i, hashToFloat } from '@futuremagic/core';

/** Whether cell (i, j) is joined to the next cell along x (axis 0) or z (axis 1), on the grid seeded `cells`, with `extra` the chance of a join besides the tree's. */
export function joined(cells: number, i: number, j: number, axis: number, extra: number): boolean {
  const [ni, nj] = axis ? [i, j + 1] : [i + 1, j];
  if ((hashToFloat(hash2i(cells ^ 0x7ee, ni, nj)) < 0.5 ? 0 : 1) === axis) return true;
  return hashToFloat(hash2i(cells ^ 0x10b, i * 2 + axis, j)) < extra;
}
