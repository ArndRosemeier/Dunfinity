/**
 * The laws of a stratum (docs/design/generative-depth.md §2.3, §3): deviations from our world a
 * player can name in one sentence ("the light is green down here"), each holding all over the
 * stratum. How many hold is the stratum's strangeness (`Strangeness.laws`), but never more than half
 * of the laws it has reached; which ones is drawn from the catalogue below. Levels 1–10 have none (their oddities
 * are placed by hand). The catalogue grows with the game: a law is an id here and the code that reads it.
 *
 * Pure: a function of (seed, depth).
 */
import { Rng, deriveSeed } from '@futuremagic/core';
import { strangeness, stratumOf } from './genome';

/**
 * - `tinted`: the light is another colour (the air, the fog, the headlamp; src/gen/air.ts).
 * - `haze`: the air is thick: the fog closes in and the dust hangs heavy (src/gen/air.ts).
 * - `glow`: the rock glows in its seams, as the infused salt does in the Salt Works (src/gen/air.ts).
 */
export type LawId = 'tinted' | 'haze' | 'glow';

/** Each law: the strangeness it needs, and how likely it is drawn. */
export const LAWS: readonly { readonly id: LawId; readonly from: number; readonly weight: number }[] = [
  { id: 'tinted', from: 1, weight: 1.5 },
  { id: 'haze', from: 1, weight: 1 },
  { id: 'glow', from: 1.5, weight: 1 },
];

/** The laws that hold on level `depth` of world `seed` (the same on all levels of a stratum). */
export function lawsOf(seed: number, depth: number): readonly LawId[] {
  const stratum = stratumOf(depth);
  if (!stratum) return [];
  const k = strangeness(seed, stratum.from);
  const rng = new Rng(deriveSeed(seed, 'laws', stratum.from));
  const left = LAWS.filter((l) => l.from <= k.s), out: LawId[] = [];
  // Never every law there is: strata must differ from each other, so at most half the laws reached hold.
  for (let n = Math.min(k.laws, Math.ceil(left.length / 2)); n > 0; n--) {
    let u = rng.float() * left.reduce((a, l) => a + l.weight, 0), i = 0;
    while (i < left.length - 1 && (u -= left[i].weight) > 0) i++;
    out.push(left.splice(i, 1)[0].id);
  }
  return out;
}
