/**
 * Kin (docs/design/generative-depth.md §6.1): every world is a copy of the one beneath it
 * (docs/design/lore.md), so the deep strata have drafts of our animals, copied a little wrong. A
 * stratum's dogs are all the same kind of wrong: longer, or big-headed, a darker coat, striped.
 *
 * `kinOf(seed, depth, species)` draws one species' look for the stratum of `depth`: coat hue,
 * saturation, lightness and a pattern (stripes or spots), its body's proportions (long, tall), and the
 * size of its head, tail and ears. From level 11 on (the first stratum the genome draws); above it,
 * every creature is ours (`OURS`). How far the knobs go is the stratum's strangeness amplitude
 * (src/gen/genome.ts): a few knobs per stratum are pushed into their strange range, the rest only vary
 * a little within their safe range, so a strange stratum's kin are wrong in one or two ways, not in
 * every way at once.
 *
 * Looks only: what the sims do is untouched (the clips stay valid; a long body strides longer:
 * src/render/creatures/rigged.ts). Pure.
 */
import { deriveSeed, Rng } from '@futuremagic/core';
import { STRANGE_CAP, stratumOf, strangeness } from '../gen/genome';

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

/** A knob: our world's value, how far it varies in a faithful copy (either way), the strange range a stratum may push it into, and how near our value a pushed one may come. */
interface Knob {
  readonly standard: number;
  readonly safe: number;
  readonly strange: readonly [number, number];
  readonly gap: number;
}

const KNOBS: Readonly<Record<'hue' | 'sat' | 'val' | 'pattern' | 'long' | 'tall' | 'head' | 'tail' | 'ears', Knob>> = {
  hue: { standard: 0, safe: 0.12, strange: [-Math.PI, Math.PI], gap: 0.8 },
  sat: { standard: 1, safe: 0.12, strange: [0.2, 2.2], gap: 0.35 },
  val: { standard: 1, safe: 0.08, strange: [0.45, 1.6], gap: 0.2 },
  pattern: { standard: 0, safe: 0, strange: [0.35, 0.9], gap: 0.35 },
  long: { standard: 1, safe: 0.04, strange: [0.78, 1.4], gap: 0.12 },
  tall: { standard: 1, safe: 0.04, strange: [0.8, 1.3], gap: 0.1 },
  head: { standard: 1, safe: 0.05, strange: [0.7, 1.6], gap: 0.15 },
  tail: { standard: 1, safe: 0.1, strange: [0.4, 2], gap: 0.3 },
  ears: { standard: 1, safe: 0.1, strange: [0.5, 2.2], gap: 0.35 },
};

type KnobName = keyof typeof KNOBS;

/** Which knobs a species has (the eel's body is laid on its chain by the sim, so it keeps its proportions; a slime has no head, tail or ears). */
const SPECIES: Readonly<Record<string, readonly KnobName[]>> = {
  feral_dog: ['hue', 'sat', 'val', 'pattern', 'long', 'tall', 'head', 'tail', 'ears'],
  quarry_rat: ['hue', 'sat', 'val', 'pattern', 'long', 'tall', 'head', 'tail', 'ears'],
  cave_cricket: ['hue', 'sat', 'val', 'pattern', 'long', 'tall', 'head', 'ears'],
  lumen_slime: ['hue', 'sat', 'val', 'pattern', 'long', 'tall'],
  murk_slime: ['hue', 'sat', 'val', 'pattern', 'long', 'tall'],
  brine_eel: ['hue', 'sat', 'val', 'pattern', 'head'],
};

/** Clearly off our world's value (at least its `gap` away), to one side or the other, as far as the amplitude `a` (0..1) goes. */
function strange(k: Knob, rng: Rng, a: number): number {
  const [lo, hi] = k.strange, gap = k.gap;
  const below = k.standard - gap > lo, above = k.standard + gap < hi;
  const up = above && (!below || rng.chance(0.5));
  const far = up ? hi - k.standard : k.standard - lo, off = gap + (far - gap) * rng.float() * (0.4 + 0.6 * a);
  return k.standard + (up ? off : -off);
}

/** How many of a species' knobs a stratum pushes into the strange range, at full amplitude (fewer below). */
const PUSHED = 3;

/** The look of `species` (its glb's name) in the stratum of `depth` (ours above level 11, and for a species without kin). */
export function kinOf(seed: number, depth: number, species: string): Kin {
  const knobs = SPECIES[species], stratum = stratumOf(depth);
  if (!knobs || !stratum) return OURS;
  // The stratum's strangeness where it begins, so all its levels share one look.
  const a = Math.min(1, strangeness(seed, stratum.from).amplitude / STRANGE_CAP);
  const rng = new Rng(deriveSeed(seed, 'kin', species, stratum.from));
  // Which knobs go strange: a shuffled pick, as many as the amplitude allows (at least one).
  const order = [...knobs];
  for (let i = order.length - 1; i > 0; i--) { const j = rng.int(0, i); [order[i], order[j]] = [order[j], order[i]]; }
  const pushed = new Set(order.slice(0, Math.max(1, Math.round(PUSHED * a))));
  const out: Record<string, number> = { ...OURS };
  for (const name of knobs) {
    const k = KNOBS[name], safe = k.standard + rng.range(-1, 1) * k.safe;
    out[name] = pushed.has(name) ? strange(k, rng, a) : safe;
  }
  out.stripes = rng.chance(0.5) ? 1 : 0;
  out.grain = rng.range(3, 9);
  return out as unknown as Kin;
}
