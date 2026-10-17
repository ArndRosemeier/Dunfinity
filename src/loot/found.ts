/**
 * Gear found below (plan items.md, "Gifts on gear and finding it"): what the miners left in their
 * sheds and on the Quarry floor, now and then, in place of a find (src/loot/finds.ts `FIND.gear`).
 * Any of it on any level (content is never gated by depth); depth only moves the odds: deeper, the
 * better its quality, and the likelier a property (`Item.of`: one gift more).
 *
 * Pure and seeded: the item a find's own `Rng` draws at its depth.
 */
import type { Rng } from '@futuremagic/core';
import { oddsAt } from '../gen/genome';
import { GIFTS, ITEMS, type Gift, type Item, type ItemKind, type Quality } from './items';

/** What lies about to be found, and how often (relative). Kemal's mundane things too: the miners had them first. */
export const FOUND: Readonly<Partial<Record<ItemKind, number>>> = {
  'hobnail-boots': 3, 'rope-soles': 2, 'knee-pads': 3, moleskins: 3, 'leather-apron': 2, sling: 2, 'snuff-tin': 3, 'barbara-medal': 2,
  'work-gloves': 3, 'miners-helmet': 2, hatchet: 1, crowbar: 1, pick: 1,
};

export const FOUND_ODDS = {
  /** Quality weights near the surface and deep down (`oddsAt`: depth only moves them). */
  quality: { worn: [5, 1], sound: [4, 4], fine: [1, 3], master: [0.15, 1] } as Readonly<Record<Quality, readonly [number, number]>>,
  /** The chance of a property near the surface and deep down. */
  property: [0.04, 0.35] as const,
  /** How much likelier a body gift (health, stamina, wind, pace, leap) is as a property than any one skill. */
  body: 4,
};

/** The item `rng` draws, found `depth` levels down. */
export function foundGear(rng: Rng, depth: number): Item {
  const kind = rng.weighted(Object.keys(FOUND) as ItemKind[], (k) => FOUND[k]!);
  const quality = rng.weighted(Object.keys(FOUND_ODDS.quality) as Quality[], (q) => oddsAt(depth, FOUND_ODDS.quality[q]));
  if (!rng.chance(oddsAt(depth, FOUND_ODDS.property))) return { kind, quality };
  // A property: any gift but one it has already; the body's own gifts as likely, all told, as the many skills.
  const own = Object.keys(ITEMS[kind].gifts ?? {});
  return { kind, quality, of: rng.weighted((Object.keys(GIFTS) as Gift[]).filter((g) => !own.includes(g)), (g) => (GIFTS[g].whole ? 1 : FOUND_ODDS.body)) };
}
