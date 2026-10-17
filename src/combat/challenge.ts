/**
 * How tough a foe is for you, now (grandma's Salt Sight): a fight between the two as things stand, how
 * long you take to bring it down against how long it takes to bring you down. Measured against
 * you, not the depth, so a ten-metre grazer reads deadly on level 1 and a young giant fair.
 *
 * What you know of a kind comes with fighting it: one never killed shows only a rough read in three
 * bands (harmless, dangerous, deadly: never nothing, as a first try at a deadly one may be the last
 * in a permadeath game), the first few killed show the tier as a guess, after that it is sure.
 *
 * Pure.
 */

/** A fighter's measure: full health, a mean blow (its damage) and seconds between blows. */
export interface Might {
  readonly health: number;
  readonly blow: number;
  readonly every: number;
}

export const CHALLENGE = {
  /** Its time to kill you over yours to kill it: below each bound the tier is that one (easy, fair, risky, run); beyond, deadly. */
  bounds: [0.2, 0.5, 1, 2.5] as const,
  /** What each tier is called under the target. */
  words: ['easy', 'a fair fight', 'risky', 'run', 'deadly'] as const,
  /** An untested kind's rough read: the band each tier falls in (0 harmless, 1 dangerous, 2 deadly) and what each band is called. */
  bandOf: [0, 0, 1, 2, 2] as const,
  bands: ['looks harmless', 'looks dangerous', 'looks deadly'] as const,
  /** Kills of a kind (by anyone of the family) after which its measure is sure; below, a guess; none: untested. */
  sure: 3,
} as const;

/** 0 easy … 4 deadly. */
export type Tier = 0 | 1 | 2 | 3 | 4;

/** An untested kind's rough read: 0 harmless, 1 dangerous, 2 deadly. */
export type Band = 0 | 1 | 2;

/** How sure the measure is: never fought (a rough read), a guess, or known. */
export type Knowledge = 'untested' | 'guess' | 'known';

/** The tier of a fight of `you` against `it` (armour: the share of a blow that gets through to you). */
export function tierOf(it: Might, you: Might, armour = 1): Tier {
  const toKillIt = Math.ceil(it.health / Math.max(0.01, you.blow)) * you.every;
  const toKillYou = Math.ceil(you.health / Math.max(0.01, it.blow * armour)) * it.every;
  const r = toKillIt / Math.max(0.01, toKillYou);
  const i = CHALLENGE.bounds.findIndex((b) => r < b);
  return (i < 0 ? 4 : i) as Tier;
}

/** How much the family knows a kind it has killed `kills` of. */
export function knowledgeOf(kills: number): Knowledge {
  return kills <= 0 ? 'untested' : kills < CHALLENGE.sure ? 'guess' : 'known';
}

/** The rough band a tier reads as before the kind is fought. */
export function bandOf(tier: Tier): Band {
  return CHALLENGE.bandOf[tier];
}

/** What the target's mark says of it. */
export function wordOf(tier: Tier, k: Knowledge): string {
  return k === 'untested' ? CHALLENGE.bands[bandOf(tier)] : k === 'guess' ? `${CHALLENGE.words[tier]}?` : CHALLENGE.words[tier];
}
