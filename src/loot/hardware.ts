/**
 * Kemal's hardware store (town-and-first-strata.md §3): ordinary things for euros from grandma's
 * purse, each a small, plain help down there; and the one strange thing Ilse sells (a satchel the
 * stranger from below brought her). Bought by a grandchild and lost with them, like their
 * pack; the purse stays with the family. Kemal recommends the wrong thing with total confidence.
 *
 * Pure: what he sells, what it does, the sale (into the grandchild's `Kit`, src/loot/items.ts).
 */
import { ITEMS, Kit, itemName, type ItemKind } from './items';

export type GearKind = 'gloves' | 'whetstone' | 'helmet' | 'hatchet' | 'crowbar' | 'pick' | 'flashlight' | 'rucksack' | 'satchel';

export interface GearDef {
  readonly name: string;
  readonly price: number;
  /** What it does, in a few words for his shelf. */
  readonly what: string;
  /** What Kemal says as he wraps it. */
  readonly says: string;
  /** The item it is (src/loot/items.ts), put on at once; none: the whetstone, which hones the knife to fine. */
  readonly item?: ItemKind;
  /** Who sells it: Kemal (unless said), or Ilse at her counter (`ILSE_ORDER`). */
  readonly seller?: 'Ilse';
}

export const GEAR: Record<GearKind, GearDef> = {
  gloves: { name: 'work gloves', price: 20, what: 'climbing tires you less', item: 'work-gloves', says: '"Gloves. Good. But what you really want is a nice garden hose."' },
  whetstone: { name: 'a whetstone', price: 35, what: 'the knife bites deeper', says: '"For the knife? For cellars, I always say: a dehumidifier."' },
  helmet: { name: "a miner's helmet", price: 45, what: 'blows hurt you less', item: 'miners-helmet', says: '"An old one from the mine. My father\'s. Take it, take it. Mind the dent."' },
  hatchet: { name: 'a hatchet', price: 30, what: 'chops, slower and harder than the knife', item: 'hatchet', says: '"For kindling. Down there? Well. Kindling is kindling."' },
  crowbar: { name: 'a crowbar', price: 25, what: 'swats wide and knocks them back', item: 'crowbar', says: '"Every house needs one. Every cellar needs two."' },
  flashlight: { name: 'a flashlight', price: 15, what: 'a long bright beam in the off hand (L)', item: 'flashlight', says: '"Batteries included. Well. One battery. The other one is in the clock."' },
  pick: { name: "a miner's pick", price: 60, what: 'two hands, slow, and very hard', item: 'pick', says: '"Heavy, eh? My father swung one for thirty years. His back, oh, his back."' },
  rucksack: { name: 'an army rucksack', price: 40, what: 'the pack holds 14 things', item: 'army-rucksack', says: '"Army surplus. Swiss. Or Austrian. Neutral, anyway." He takes your old one for the bin.' },
  satchel: { name: 'a salt-woven satchel', price: 150, what: 'the pack holds 40 things', item: 'salt-satchel', seller: 'Ilse', says: 'Ilse lifts it from under the counter with both hands, though it weighs nothing. "The one from below sold it me. It holds more than it should. I stopped counting." She takes your old one in part payment, and does not say for what.' },
};

/** Their order on his counter (keys 1 to 8). */
export const GEAR_ORDER: readonly GearKind[] = ['gloves', 'whetstone', 'helmet', 'hatchet', 'crowbar', 'pick', 'flashlight', 'rucksack'];

/** What Ilse sells across her counter (key 1), once the stranger from below is in town (src/world/stranger.ts `Stranger.here`). */
export const ILSE_ORDER: readonly GearKind[] = ['satchel'];

/** Whether the grandchild in `kit` has what Kemal sells as `kind` (worn, or the knife honed). */
export function hasGear(kit: Kit, kind: GearKind): boolean {
  const g = GEAR[kind];
  return g.item ? kit.has(g.item) : kit.knife.quality !== 'worn' && kit.knife.quality !== 'sound';
}

/** Buy `kind` with `euros` in the purse, put on (or the knife honed) in `kit`: the euros left and what is said, or why not. */
export function buyGear(kit: Kit, kind: GearKind, euros: number): { euros: number; line: string } {
  const g = GEAR[kind];
  if (hasGear(kit, kind)) return { euros, line: `You have ${g.name} already.` };
  const held = kit.worn.main;
  if (g.item && held && ITEMS[g.item].slot === 'main') return { euros, line: `Your hand is full with ${itemName(held)}. Kemal waits while you think about it (the pack, I).` };
  if (euros < g.price) return { euros, line: `${g.seller ?? 'Kemal'} shakes ${g.seller ? 'her' : 'his'} head. "€${g.price}. Grandma's purse has €${euros}."` };
  if (g.item) kit.put({ kind: g.item, quality: 'sound' });
  else kit.put({ kind: 'kitchen-knife', quality: 'fine' });
  return { euros: euros - g.price, line: `You buy ${g.name} for €${g.price}: ${g.what}.\n${g.says}` };
}

/** A grandchild's kit from what an older save says they bought (`gear`: Kemal's kinds). */
export function kitFromGear(gear: readonly string[]): Kit {
  const kit = new Kit();
  for (const k of gear) if (k in GEAR) buyGear(kit, k as GearKind, Infinity);
  return kit;
}
