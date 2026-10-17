/**
 * The laws of a stratum (docs/design/generative-depth.md §2.3, §3): deviations from our world a
 * player can name in one sentence ("the light is green down here"), each holding all over the
 * stratum. How many hold is the stratum's strangeness (`Strangeness.laws`), but never more than half
 * of the laws it has reached; which ones is drawn from the catalogue below. Levels 1–10 have one each, their own
 * (Arnd 2026-10-16: strange from the start), never one their band already shows (the Cisterns' water climbs anyway).
 * The catalogue grows with the game: a law is an id here and the code that reads it.
 *
 * Pure: a function of (seed, depth).
 */
import { Rng, deriveSeed } from '@futuremagic/core';
import { strangeFrom, strangeness } from './genome';
import { bandOf, type Band } from './bands';

/**
 * - `tinted`: the light is another colour (the air, the fog, the headlamp; src/gen/air.ts).
 * - `haze`: the air is thick: the fog closes in and the dust hangs heavy (src/gen/air.ts).
 * - `glow`: the rock glows in its seams, as the infused salt does in the Salt Works (src/gen/air.ts).
 * - `uphill`: water runs up the rock wherever it laps it, as in the Cisterns, but everywhere (`lawfulBand`).
 * - `older`: the old workings' pillars stand on drums of an older people's stone (`lawfulBand`).
 */
export type LawId = 'tinted' | 'haze' | 'glow' | 'uphill' | 'older';

/** Each law: the strangeness it needs, and how likely it is drawn. */
export const LAWS: readonly { readonly id: LawId; readonly from: number; readonly weight: number }[] = [
  { id: 'tinted', from: 1, weight: 1.5 },
  { id: 'haze', from: 1, weight: 1 },
  { id: 'glow', from: 1.5, weight: 1 },
  { id: 'uphill', from: 1.2, weight: 1 },
  { id: 'older', from: 1, weight: 0.8 },
];

/** How strongly `uphill` and `older` hold: the chance per spot of water climbing the rock, the share of pillars on older drums. */
const UPHILL = 0.5, OLDER = 0.45;

/** A level's band with its stratum's laws applied (`Level.band`): the band is the stratum's, the laws the world's. */
export function lawfulBand(band: Band, laws: readonly LawId[]): Band {
  if (!laws.includes('uphill') && !laws.includes('older')) return band;
  return {
    ...band,
    uphill: laws.includes('uphill') ? Math.max(band.uphill, UPHILL) : band.uphill,
    older: laws.includes('older') ? Math.max(band.older, OLDER) : band.older,
  };
}

/** Whether `band` already shows `law` as strongly as the law would (then the law would go unnoticed there). */
function shows(band: Band, law: LawId): boolean {
  return law === 'uphill' ? band.uphill >= UPHILL : law === 'older' ? band.older >= OLDER : law === 'glow' && band.veins >= 1;
}

/** The laws that hold on level `depth` of world `seed` (the same on all levels of a stratum). */
export function lawsOf(seed: number, depth: number): readonly LawId[] {
  if (depth <= 0) return [];
  const at = strangeFrom(depth), k = strangeness(seed, at), band = bandOf(seed, at);
  const rng = new Rng(deriveSeed(seed, 'laws', at));
  // Below strangeness 1 (the first levels) the mildest laws are within reach: a level's one oddity.
  const left = LAWS.filter((l) => l.from <= Math.max(1, k.s) && !shows(band, l.id)), out: LawId[] = [];
  // Never every law there is: strata must differ from each other, so at most half the laws reached hold.
  for (let n = Math.min(k.laws, Math.ceil(left.length / 2)); n > 0; n--) {
    let u = rng.float() * left.reduce((a, l) => a + l.weight, 0), i = 0;
    while (i < left.length - 1 && (u -= left[i].weight) > 0) i++;
    out.push(left.splice(i, 1)[0].id);
  }
  return out;
}
