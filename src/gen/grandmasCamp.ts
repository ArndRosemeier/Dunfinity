/**
 * Grandma's first camp (docs/design/town-and-first-strata.md §4, the Threshold): where she camped in
 * 1963, the furthest she had come looking for her father. A tent, a cold fire, her thermos, and a
 * note on a stone. One on level 9, on dry, level floor a good walk from the arrival, in a cavern if
 * one will do.
 *
 * Pure: found from the level's seed; the props are built with the tile it falls in.
 */
import { hash3f } from '@futuremagic/core';
import type { Level } from './level';
import { local } from './propMesh';
import { openFloor, searchOut } from './searchOut';

export const CAMP = {
  depth: 9,
  /** How far from the arrival it is looked for, metres. */
  near: 90,
  far: 320,
  /** How far one can be from the note to read it, metres. */
  reach: 1.6,
} as const;

export interface GrandmasCamp {
  /** The tent's door, on the floor; the camp faces along `yaw` (out of the tent, towards the fire). */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  /** Where the note lies. */
  readonly note: readonly [number, number, number];
}

/** What she wrote. */
export const NOTE = [
  '14 March 1963. Third night at this camp.',
  'The halls stop here and the caves begin, and the caves were here first. I found steps cut for someone twice my height. Papa\'s lamp was on the bottom one. He came this far.',
  'I go on tomorrow. The tea is for the way back. Don\'t you dare.',
  'If you are reading this, I never came back for my thermos, and you should go home.',
];

/** Folded into the note: a pencil rubbing of runes from a stone, with the letters she was sure of written over them (src/lore/key.ts GRANDMA_KERF). */
export const RUBBING = 'Folded into it, a pencil rubbing of runes taken off a stone, her letters written over the ones she was sure of: T, H, TH, E, O, A, N, S, D. "The rest, ask Papa." You copy them into the key in her tin.';

/** The camp on `level`, or null (only on level 9, and only where the floor allows). */
export function grandmasCamp(level: Level): GrandmasCamp | null {
  if (level.depth !== CAMP.depth) return null;
  return searchOut(level, hash3f(level.seed, 9, 63, 1) * Math.PI * 2, CAMP.near, CAMP.far, 6, (x, z, t) =>
    level.columnAt(x, z).border < 6 ? null : campAt(level, x, z, t + Math.PI)); // the tent's back to the far side, facing the way she came
}

/** The camp at (x, z) facing `yaw`, if the floor is dry and level round it, with headroom and no way down near. */
function campAt(level: Level, x: number, z: number, yaw: number): GrandmasCamp | null {
  if (level.descents.at(x, z, 8) || !level.dry(x, z, 0.3)) return null;
  const g = level.groundAt(x, z), at = local(x, z, yaw);
  const round = ([[0, -1.2], [-1.2, -1.2], [1.2, -1.2], [-1.4, 1.2], [1.4, 1.2], [0, 2.8], [1.2, 2], [-1, 3.6]] as const).map(([sd, fw]) => at(sd, fw));
  if (!openFloor(level, round, g, 0.25, 2, 1.2)) return null;
  const [nx, nz] = at(1.2, 2);
  return { x, y: g, z, yaw, note: [nx, level.groundAt(nx, nz) + 0.24, nz] };
}
