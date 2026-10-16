/**
 * Kin (docs/design/generative-depth.md §6.1): every world is a copy of the one beneath it
 * (docs/design/lore.md), so the deep strata have drafts of our animals, copied a little wrong. A
 * stratum's dogs are all the same kind of wrong: longer, or big-headed, a darker coat, striped.
 *
 * `kinOf(seed, depth, species)` is one species' look in the stratum of `depth`: coat hue, saturation,
 * lightness and a pattern (stripes or spots), its body's proportions (long, tall), and the size of
 * its head, tail and ears. Each knob is a gene (src/gen/genes.ts) of its species, so a stratum strays
 * coherently: a little within the safe ranges, and the genes it pushes out into their strange ranges
 * as far as its strangeness allows. From level 11 on (the first stratum); above it every creature is
 * ours (`OURS`): levels 1–10 keep the animals we made.
 *
 * Looks only: what the sims do is untouched (the clips stay valid; a long body strides longer:
 * src/render/creatures/rigged.ts). Pure.
 */
import { deriveSeed, Rng } from '@futuremagic/core';
import { stratumOf } from '../gen/genome';
import { express, gene, type Gene } from '../gen/genes';

export interface Kin {
  /** Coat: hue turn (radians), saturation (×), lightness (×), pattern strength (0 none .. 1), stripes (1) or spots (0), its size (per metre). */
  readonly hue: number;
  readonly sat: number;
  readonly val: number;
  readonly pattern: number;
  readonly stripes: number;
  readonly grain: number;
  /** The body stretched along its length and its height (×; its feet stay on the ground). */
  readonly long: number;
  readonly tall: number;
  /** Head, tail and ears (or feelers) scaled (×). */
  readonly head: number;
  readonly tail: number;
  readonly ears: number;
}

/** Our world's: every creature as it is. */
export const OURS: Kin = { hue: 0, sat: 1, val: 1, pattern: 0, stripes: 0, grain: 5, long: 1, tall: 1, head: 1, tail: 1, ears: 1 };

type KnobName = 'hue' | 'sat' | 'val' | 'pattern' | 'long' | 'tall' | 'head' | 'tail' | 'ears';

/** Each knob: our world's value, its safe range and its strange range (`gene`). */
const KNOBS: Readonly<Record<KnobName, readonly [number, readonly [number, number], readonly [number, number]]>> = {
  hue: [0, [-0.12, 0.12], [-Math.PI, Math.PI]],
  sat: [1, [0.88, 1.12], [0.2, 2.2]],
  val: [1, [0.92, 1.08], [0.45, 1.6]],
  pattern: [0, [0, 0], [0, 0.9]],
  long: [1, [0.96, 1.04], [0.78, 1.4]],
  tall: [1, [0.96, 1.04], [0.8, 1.3]],
  head: [1, [0.95, 1.05], [0.7, 1.6]],
  tail: [1, [0.9, 1.1], [0.4, 2]],
  ears: [1, [0.9, 1.1], [0.5, 2.2]],
};

/** Which knobs a species has (the eel's body is laid on its chain by the sim, so it keeps its proportions; a slime has no head, tail or ears). */
const SPECIES: Readonly<Record<string, readonly KnobName[]>> = {
  feral_dog: ['hue', 'sat', 'val', 'pattern', 'long', 'tall', 'head', 'tail', 'ears'],
  quarry_rat: ['hue', 'sat', 'val', 'pattern', 'long', 'tall', 'head', 'tail', 'ears'],
  cave_cricket: ['hue', 'sat', 'val', 'pattern', 'long', 'tall', 'head', 'ears'],
  lumen_slime: ['hue', 'sat', 'val', 'pattern', 'long', 'tall'],
  murk_slime: ['hue', 'sat', 'val', 'pattern', 'long', 'tall'],
  brine_eel: ['hue', 'sat', 'val', 'pattern', 'head'],
};

/** Every species' genes, named `kin.<species>.<knob>`. */
const GENES: Readonly<Record<string, readonly (readonly [KnobName, Gene])[]>> = Object.fromEntries(
  Object.entries(SPECIES).map(([s, knobs]) => [s, knobs.map((k) => [k, gene(`kin.${s}.${k}`, ...KNOBS[k])] as const)]),
);

/** The look of `species` (its glb's name) in the stratum of `depth` (ours above level 11, and for a species without kin). */
export function kinOf(seed: number, depth: number, species: string): Kin {
  const genes = GENES[species], stratum = stratumOf(depth);
  if (!genes || !stratum) return OURS;
  const out: Record<string, number> = { ...OURS };
  for (const [k, g] of genes) out[k] = express(g, seed, depth);
  // Which pattern it is, once it shows (no deviation in itself).
  const rng = new Rng(deriveSeed(seed, 'kin', species, stratum.from));
  out.stripes = rng.chance(0.5) ? 1 : 0;
  out.grain = rng.range(3, 9);
  return out as unknown as Kin;
}
