/**
 * Standards and how far a world strays from them (docs/design/generative-depth.md §2.3). A generator
 * that may deviate names each of its knobs as a `Gene`: the value our world has, a safe range (variety,
 * still ours) and a strange range (a copy gone wrong). `express` draws a gene's value for a level:
 * near the standard at the top, across the safe range as strangeness reaches 1, and for the genes a
 * stratum (level 11 on) pushes, out into the strange range as far as its amplitude allows. A stratum pushes the same
 * genes the same way on all its levels, so a world deviates coherently, never per object.
 *
 * Pure: a function of (seed, depth, the gene's name).
 */
import { Rng, deriveSeed, lerp } from '@futuremagic/core';
import { STRANGE_CAP, strangeness, stratumOf } from './genome';

export interface Gene {
  /** The gene's name, unique in the game ('karst.domeHeight'): its own random stream. */
  readonly name: string;
  readonly standard: number;
  readonly safe: readonly [number, number];
  readonly strange: readonly [number, number];
}

/** A gene, its ranges checked (standard inside safe, safe inside strange). */
export function gene(name: string, standard: number, safe: readonly [number, number], strange: readonly [number, number]): Gene {
  if (!(strange[0] <= safe[0] && safe[0] <= standard && standard <= safe[1] && safe[1] <= strange[1])) throw new Error(`gene ${name}: ranges out of order`);
  return { name, standard, safe, strange };
}

/** How likely a stratum pushes one gene into its strange range: none below strangeness 1, then rising to PUSH_MOST. */
const PUSH_MOST = 0.6;
export function pushChance(s: number): number {
  return s < 1 ? 0 : Math.min(PUSH_MOST, 0.15 + (s - 1) * 0.15);
}

/** The value of `g` on level `depth` of world `seed`. */
export function express(g: Gene, seed: number, depth: number): number {
  // A stratum reads its first level's strangeness and one stream per gene, so its levels agree; levels
  // 1-10 go level by level and push nothing (their oddities are placed by hand).
  const stratum = stratumOf(depth), at = stratum?.from ?? depth;
  const k = strangeness(seed, at);
  if (k.s <= 0) return g.standard;
  const rng = new Rng(deriveSeed(seed, 'gene', g.name, at));
  const safe = lerp(g.standard, rng.range(g.safe[0], g.safe[1]), Math.min(1, k.s));
  if (!stratum || !rng.chance(pushChance(k.s))) return safe;
  // Pushed: towards one end of the strange range, as far as the amplitude allows.
  const end = rng.chance(0.5) ? g.strange[0] : g.strange[1];
  return lerp(safe, end, rng.range(0.4, 1) * (k.amplitude / STRANGE_CAP));
}
