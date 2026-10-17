/**
 * The peoples of the deep (docs/design/lore.md §3: the worlds are stacked like strata, so each
 * buried world had its own people): two of Norgo's races per game, seeded, so a new game meets
 * others. None of them live in the dark the grandchildren walk (Arnd 2026-10-17: no other people
 * down there; the camps are goblins', src/creatures/scavengers.ts). One has come up: the stranger at
 * Ilse's (src/world/stranger.ts). Dwarves and elves are not among them (only their ghosts are
 * left, src/creatures/ghosts.ts), nor goblins or giantkin.
 *
 * Pure.
 */
import { deriveSeed, Rng } from '@futuremagic/core';
import type { RaceId } from '@futuremagic/humanoid';

/** The peoples a buried world may have. */
export const DEEP_FOLK: readonly RaceId[] = ['orc', 'halfling', 'sylvan', 'drakeborn', 'umbral'];

/** This game's two peoples of the deep, different from each other. */
export function deepFolk(seed: number): readonly [RaceId, RaceId] {
  const rng = new Rng(deriveSeed(seed, 'folk'));
  const a = rng.int(0, DEEP_FOLK.length - 1), b = (a + rng.int(1, DEEP_FOLK.length - 1)) % DEEP_FOLK.length;
  return [DEEP_FOLK[a], DEEP_FOLK[b]];
}

