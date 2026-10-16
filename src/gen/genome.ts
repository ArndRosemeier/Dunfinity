/**
 * The stratum genome (docs/design/dunfinity-plan.md §4.4, docs/design/level-styles.md): below level 10,
 * a run of levels is a stratum, and each world (seed) draws its own make-up for it. Which styles,
 * from the stratum's palette, and how much of each. Every level of a stratum shares its genome and
 * so reads as one place; each level then leans its own way (`mixOf`, src/gen/bands.ts). From level
 * 61 on the strata are ten levels each and every style can turn up, so the world never runs out.
 *
 * Pure: a function of (seed, depth).
 */
import { Rng, deriveSeed } from '@futuremagic/core';
import type { Mix } from './regions';
import type { StyleId } from './style';

/** A stratum: its first level, its name, the styles it may be made of (how likely each is drawn, and how much of it there is then), how many it draws, and the old workings' weight (where one arrives, and every way down). */
export interface Stratum {
  readonly from: number;
  readonly name: string;
  readonly palette: readonly (readonly [StyleId, number])[];
  readonly picks: readonly [number, number];
  readonly workings: number;
}

/** Every style below the first strata can be made of (the excavation and the cellar aside). */
const ALL: readonly StyleId[] = ['karst', 'rift', 'collapse', 'catacombs', 'dungeon', 'roots', 'fungal', 'lava', 'geode', 'basalt', 'flooded', 'dwarven', 'elven', 'goblin', 'bones'];

export const STRATA: readonly Stratum[] = [
  {
    from: 11, name: 'The Ossuaries', picks: [3, 4], workings: 0.25,
    palette: [['catacombs', 3], ['dungeon', 1.5], ['collapse', 1.5], ['karst', 1.2], ['rift', 0.8], ['roots', 0.6], ['flooded', 1]],
  },
  {
    from: 21, name: 'The Old Halls', picks: [3, 5], workings: 0.2,
    palette: [['dungeon', 1.5], ['rift', 1.5], ['karst', 1.2], ['catacombs', 1], ['collapse', 1], ['lava', 0.7], ['geode', 0.5], ['fungal', 0.5], ['basalt', 0.6], ['flooded', 0.6], ['dwarven', 1.5], ['elven', 1.2], ['goblin', 0.8]],
  },
  {
    from: 41, name: 'Before People', picks: [3, 5], workings: 0.15,
    palette: [['fungal', 2], ['geode', 1.8], ['lava', 1.8], ['roots', 1.5], ['karst', 1.5], ['rift', 1], ['collapse', 0.6], ['basalt', 1.5], ['flooded', 0.8], ['bones', 1.2]],
  },
];

/** From here on, a stratum every ten levels, of any styles. */
const DEEP = { from: 61, every: 10, picks: [3, 5] as const, workings: 0.12 };

/** The most of a level the dungeon rooms may be (Arnd: a sprinkle, never the main thing), as a share of the other styles together. */
const DUNGEON_MOST = 0.25;

/** The stratum of `depth` (below level 10), or null above it. */
export function stratumOf(depth: number): Stratum | null {
  if (depth < STRATA[0].from) return null;
  if (depth < DEEP.from) return [...STRATA].reverse().find((s) => depth >= s.from)!;
  const k = Math.floor((depth - DEEP.from) / DEEP.every);
  return deep(DEEP.from + k * DEEP.every);
}

/** A world's make-up of the stratum `s`: the excavation first (its home ground), then the styles it drew, with their weights. */
export function genome(seed: number, s: Stratum): Mix {
  const rng = new Rng(deriveSeed(seed, 'stratum', s.from));
  const left = [...s.palette], drawn: [StyleId, number][] = [];
  for (let n = Math.min(left.length, rng.int(s.picks[0], s.picks[1])); n > 0; n--) {
    // Drawn by affinity, without putting back.
    let u = rng.float() * left.reduce((a, [, w]) => a + w, 0), i = 0;
    while (i < left.length - 1 && (u -= left[i][1]) > 0) i++;
    const [id, affinity] = left.splice(i, 1)[0];
    drawn.push([id, affinity * rng.range(0.5, 1.5)]);
  }
  const rest = drawn.reduce((a, [, w]) => a + w, 0);
  const others = drawn.map(([id, w]) => [id, id === 'dungeon' ? Math.min(w, DUNGEON_MOST * (rest - w)) : w] as const);
  const total = others.reduce((a, [, w]) => a + w, 0);
  // The excavation's weight is a share of the whole.
  return [['excavation', (s.workings * total) / (1 - s.workings)], ...others];
}

const deeps = new Map<number, Stratum>();

/** The stratum from level `from` on (61 and deeper): every style may be in it, each as likely. One object per stratum. */
function deep(from: number): Stratum {
  let s = deeps.get(from);
  if (!s) deeps.set(from, (s = { from, name: 'The Deep', picks: DEEP.picks, workings: DEEP.workings, palette: ALL.map((id) => [id, 1] as const) }));
  return s;
}

/**
 * How far a level is from our world (docs/design/generative-depth.md §2): every world is a copy of
 * the one beneath it (docs/design/lore.md), and strangeness is how many copies away from ours a level
 * is. It is not difficulty (that is depth): a generator reads both and never one for the other.
 * - `trend`: rises fast at first and slowly for ever, log2(1 + (depth + 4) / 8): 0.7 at level 1 (already a
 *   little off, Arnd 2026-10-16), 1 at level 4, 2.6 at 40, 6 at 500.
 * - `swing`: each stratum's own lean, ×0.6–1.4 (1 above level 11): some deep worlds are faithful copies.
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

/** The first level of the run that shares its strangeness, laws and genes: its stratum's first, or the level itself above level 11. */
export function strangeFrom(depth: number): number {
  return stratumOf(depth)?.from ?? depth;
}

export function strangeness(seed: number, depth: number): Strangeness {
  if (depth <= 0) return { trend: 0, swing: 1, s: 0, amplitude: 0, laws: 0 };
  const trend = Math.log2(1 + (depth + LEAD) / 8), stratum = stratumOf(depth);
  const swing = stratum ? 1 + SWING * new Rng(deriveSeed(seed, 'strangeness', stratum.from)).range(-1, 1) : 1;
  const s = trend * swing;
  return { trend, swing, s, amplitude: Math.min(s, STRANGE_CAP), laws: stratum ? 1 + Math.floor(s) : 1 };
}

/** Strangeness in a few words, for the Lab's HUD and the depth strip (`tools/shot/strip.mjs`). */
export function strangeLabel(seed: number, depth: number): string {
  const k = strangeness(seed, depth);
  return `strangeness ${k.s.toFixed(2)}${k.swing !== 1 ? ` (lean ×${k.swing.toFixed(2)})` : ''}${k.laws ? `, ${k.laws} law${k.laws > 1 ? 's' : ''}` : ''}`;
}
