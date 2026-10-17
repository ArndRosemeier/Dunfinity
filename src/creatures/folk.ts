/**
 * Who the living people of a level are (docs/design/lore.md §3: the worlds are stacked like strata,
 * so each buried world has its own people). Down to level 10 no people of ours live below the town
 * (only grandma ever went down and came back): the camps there are goblins', come up the rift to
 * pick over what the miners left. Below, each game's dark has two peoples of Norgo's races (seeded
 * per game, so a new game meets others), and each stratum belongs to one of the two. Dwarves and
 * elves are not among them (only their ghosts are left, src/creatures/ghosts.ts), nor giantkin (too
 * big for a camp).
 *
 * Pure.
 */
import { deriveSeed, Rng } from '@futuremagic/core';
import type { RaceId } from '@futuremagic/humanoid';
import { stratumOf } from '../gen/genome';

/** The peoples a buried world may have. */
export const DEEP_FOLK: readonly RaceId[] = ['orc', 'halfling', 'sylvan', 'drakeborn', 'umbral'];

/** This game's two peoples of the deep, different from each other. */
export function deepFolk(seed: number): readonly [RaceId, RaceId] {
  const rng = new Rng(deriveSeed(seed, 'folk'));
  const a = rng.int(0, DEEP_FOLK.length - 1), b = (a + rng.int(1, DEEP_FOLK.length - 1)) % DEEP_FOLK.length;
  return [DEEP_FOLK[a], DEEP_FOLK[b]];
}

/** Which of `deepFolk(seed)` lives at `depth` (0 or 1), or -1 above the buried worlds, where the camps are goblins'. */
export function folkAt(seed: number, depth: number): -1 | 0 | 1 {
  const s = stratumOf(depth);
  if (!s) return -1;
  return new Rng(deriveSeed(seed, 'folk', s.from)).chance(0.5) ? 0 : 1;
}
