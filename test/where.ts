/**
 * Where a test finds the place it needs, now that no band or style is kept for a depth (Arnd,
 * 2026-10-17): the first level, by seed then depth, that has it.
 */
import { bandOf, mixOf } from '../src/gen/bands';
import type { Band } from '../src/gen/bands';
import type { StyleId } from '../src/gen/style';

/** The `nth` (from 0) level of seeds 1–60, depths `from` on (to 60), that passes `ok`, as [seed, depth]. */
export function where(ok: (seed: number, depth: number) => boolean, nth = 0, from = 1): [number, number] {
  for (let seed = 1; seed <= 60; seed++) for (let depth = from; depth <= 60; depth++) if (ok(seed, depth) && nth-- === 0) return [seed, depth];
  throw new Error('no such level');
}

/** A level cut as `id`'s workings (the Quarry, the Salt Works, the Cisterns, the Threshold). */
export const withBand = (id: Band['id'], nth = 0, from = 1) => where((s, d) => bandOf(s, d).id === id, nth, from);

/** A level whose mix has `style`. */
export const withStyle = (style: StyleId, nth = 0, from = 1) => where((s, d) => mixOf(s, d).some(([id]) => id === style), nth, from);

/** A level whose mix has every one of `styles`, each covering at least `share` of it (the excavation is always there), in `band`'s workings if given. */
export const withStyles = (styles: readonly StyleId[], nth = 0, share = 0.12, band?: Band['id']) => where((s, d) => {
  const m = mixOf(s, d), all = m.reduce((a, [, w]) => a + w, 0);
  return (!band || bandOf(s, d).id === band) && styles.every((st) => m.some(([id, w]) => id === st && w / all >= share));
}, nth);
