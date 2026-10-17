/**
 * The stratum genome (docs/design/dunfinity-plan.md §4.4, docs/design/level-styles.md): every ten
 * levels from level 1 are a stratum (a region), and each world (seed) draws its own make-up for it:
 * which workings it is cut as (the Quarry, the Salt Works, the Cisterns, the Threshold), which styles,
 * and how much of each. Nothing is gated by depth (Arnd, 2026-10-17): every style and every kind of
 * workings can turn up on every level; depth only shifts the odds (`AFFINITY`), so lava is rare on
 * level 2 and common at 60. Every level of a stratum shares its genome and so reads as one place;
 * each level then leans its own way (`mixOf`, src/gen/bands.ts).
 *
 * Pure: a function of (seed, depth).
 */
import { Rng, deriveSeed, lerp } from '@futuremagic/core';
import type { Mix } from './regions';
import type { StyleId } from './style';

/** The kinds of workings a stratum is cut as (src/gen/bands.ts: a `Band` each). */
export type Workings = 'quarry' | 'salt' | 'cistern' | 'threshold';

/** A stratum: its first level, the styles it may be made of (how likely each is drawn, and how much of it there is then), how many it draws, the old workings' weight (where one arrives, and every way down), and how likely each kind of workings is. */
export interface Stratum {
  readonly from: number;
  readonly palette: readonly (readonly [StyleId, number])[];
  readonly picks: readonly [number, number];
  readonly workings: number;
  readonly cuts: readonly (readonly [Workings, number])[];
}

/** How many levels a stratum spans. */
export const STRATUM_LEVELS = 10;

/** Levels 1 to this go level by level in strangeness, laws and genes (src/gen/genes.ts); deeper, a stratum strays as one. */
export const SHALLOW = 10;

/**
 * Every style a stratum can be made of (the excavation and the cellar aside), and how likely it is
 * drawn near the top and from level 61 down; between, the odds slide with depth. None is ever 0.
 */
const AFFINITY: Readonly<Partial<Record<StyleId, readonly [number, number]>>> = {
  karst: [1.4, 1.5], collapse: [1.4, 0.7], rift: [0.8, 1.2], flooded: [1, 0.8], catacombs: [0.8, 1], dungeon: [0.8, 1],
  roots: [0.8, 1.2], fungal: [0.5, 1.5], lava: [0.25, 1.5], geode: [0.35, 1.5], basalt: [0.3, 1.2],
  dwarven: [0.45, 1], elven: [0.35, 1], goblin: [0.45, 0.8], bones: [0.25, 1],
  organic: [0.12, 1], glyph: [0.12, 1], floating: [0.12, 1],
};

/** How likely each kind of workings is, near the top and from level 61 down. */
const CUTS: readonly (readonly [Workings, number, number])[] = [['quarry', 1.5, 0.6], ['salt', 1, 0.8], ['cistern', 1, 0.6], ['threshold', 0.8, 1.2]];

/** How far down the odds have slid: 0 at level 1, 1 from level 61 on (a log curve, so the first strata move fastest). */
function oddsDepth(depth: number): number {
  return Math.min(1, Math.log2(1 + Math.max(0, depth - 1) / 10) / Math.log2(7));
}

/** A weight that slides with depth from `near` (level 1) to `deep` (level 61 on): how depth shifts the odds of anything, never a gate (Arnd, 2026-10-17). */
export function oddsAt(depth: number, [near, deep]: readonly [number, number]): number {
  return lerp(near, deep, oddsDepth(depth));
}

/** The most of a level the dungeon rooms may be (Arnd: a sprinkle, never the main thing), as a share of the other styles together. */
const DUNGEON_MOST = 0.25;

const strata = new Map<number, Stratum>();

/** The stratum of `depth` (from level 1), or null in the town and the cellar. One object per stratum. */
export function stratumOf(depth: number): Stratum | null {
  if (depth < 1) return null;
  const from = 1 + STRATUM_LEVELS * Math.floor((depth - 1) / STRATUM_LEVELS);
  let s = strata.get(from);
  if (!s) {
    strata.set(from, (s = {
      from,
      palette: Object.entries(AFFINITY).map(([id, w]) => [id as StyleId, oddsAt(from, w)] as const),
      picks: from === 1 ? [2, 4] : [3, 5],
      workings: oddsAt(from, [0.4, 0.12]),
      cuts: CUTS.map(([id, a, b]) => [id, oddsAt(from, [a, b])] as const),
    }));
  }
  return s;
}

/** The workings world `seed` cuts the stratum `s` as. */
export function workingsOf(seed: number, s: Stratum): Workings {
  return new Rng(deriveSeed(seed, 'workings', s.from)).weighted(s.cuts, ([, w]) => w)[0];
}

/** A world's make-up of the stratum `s`: the excavation first (its home ground), then the styles it drew, with their weights. */
export function genome(seed: number, s: Stratum): Mix {
  const rng = new Rng(deriveSeed(seed, 'stratum', s.from));
  const left = [...s.palette], drawn: [StyleId, number][] = [];
  for (let n = Math.min(left.length, rng.int(s.picks[0], s.picks[1])); n > 0; n--) {
    // Drawn by affinity, without putting back.
    const [id, affinity] = left.splice(left.indexOf(rng.weighted(left, ([, w]) => w)), 1)[0];
    drawn.push([id, affinity * rng.range(0.5, 1.5)]);
  }
  const rest = drawn.reduce((a, [, w]) => a + w, 0);
  const others = drawn.map(([id, w]) => [id, id === 'dungeon' ? Math.min(w, DUNGEON_MOST * (rest - w)) : w] as const);
  const total = others.reduce((a, [, w]) => a + w, 0);
  // The excavation's weight is a share of the whole.
  return [['excavation', (s.workings * total) / (1 - s.workings)], ...others];
}

/**
 * How far a level is from our world (docs/design/generative-depth.md §2): every world is a copy of
 * the one beneath it (docs/design/lore.md), and strangeness is how many copies away from ours a level
 * is. It is not difficulty (that is depth): a generator reads both and never one for the other.
 * - `trend`: rises fast at first and slowly for ever, log2(1 + (depth + 4) / 8): 0.7 at level 1 (already a
 *   little off, Arnd 2026-10-16), 1 at level 4, 2.6 at 40, 6 at 500.
 * - `swing`: each stratum's own lean, ×0.6–1.4 (1 on levels 1–10): some deep worlds are faithful copies.
 * - `s`: the strangeness, trend × swing; 0 in the town and the cellar.
 * - `amplitude`: how far a deviation may go, capped at STRANGE_CAP (past it, worlds get more laws, not wilder ones).
 * - `laws`: how many of the deviation catalogue's laws hold all over the stratum, 1 + floor(s); one on
 *   each of levels 1–10, its own (there are no strata up there).
 * Pure: a function of (seed, depth), the same on every level of a stratum but for the trend.
 */
export interface Strangeness {
  readonly trend: number;
  readonly swing: number;
  readonly s: number;
  readonly amplitude: number;
  readonly laws: number;
}

/** Strangeness past which a deviation grows no further. */
export const STRANGE_CAP = 3;

/** How far a stratum's strangeness strays from the trend, either way (a share of it). */
const SWING = 0.4;

/** How many levels ahead of its depth the trend starts: level 1 is already a little strange. */
const LEAD = 4;

/** The first level of the run that shares its strangeness, laws and genes: its stratum's first, or the level itself on levels 1–10 (and in the town). */
export function strangeFrom(depth: number): number {
  return depth <= SHALLOW ? depth : stratumOf(depth)!.from;
}

export function strangeness(seed: number, depth: number): Strangeness {
  if (depth <= 0) return { trend: 0, swing: 1, s: 0, amplitude: 0, laws: 0 };
  const trend = Math.log2(1 + (depth + LEAD) / 8), deep = depth > SHALLOW;
  const swing = deep ? 1 + SWING * new Rng(deriveSeed(seed, 'strangeness', strangeFrom(depth))).range(-1, 1) : 1;
  const s = trend * swing;
  return { trend, swing, s, amplitude: Math.min(s, STRANGE_CAP), laws: deep ? 1 + Math.floor(s) : 1 };
}

/** Strangeness in a few words, for the Lab's HUD and the depth strip (`tools/shot/strip.mjs`). */
export function strangeLabel(seed: number, depth: number): string {
  const k = strangeness(seed, depth);
  return `strangeness ${k.s.toFixed(2)}${k.swing !== 1 ? ` (lean ×${k.swing.toFixed(2)})` : ''}${k.laws ? `, ${k.laws} law${k.laws > 1 ? 's' : ''}` : ''}`;
}
