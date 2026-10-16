/**
 * Kemal's hardware store (town-and-first-strata.md §3): ordinary things for euros from grandma's
 * purse, each a small, plain help down there. Bought by a grandchild and lost with them, like their
 * pack; the purse stays with the family. Kemal recommends the wrong thing with total confidence.
 *
 * Pure: what he sells, what it does, the sale (into the grandchild's `Kit`, src/loot/items.ts).
 */
import { Kit, type ItemKind } from './items';

export type GearKind = 'gloves' | 'whetstone' | 'helmet';

export interface GearDef {
  readonly name: string;
  readonly price: number;
  /** What it does, in a few words for his shelf. */
  readonly what: string;
  /** What Kemal says as he wraps it. */
  readonly says: string;
  /** The item it is (src/loot/items.ts), put on at once; none: the whetstone, which hones the knife to fine. */
  readonly item?: ItemKind;
}

export const GEAR: Record<GearKind, GearDef> = {
  gloves: { name: 'work gloves', price: 20, what: 'climbing tires you less', item: 'work-gloves', says: '"Gloves. Good. But what you really want is a nice garden hose."' },
  whetstone: { name: 'a whetstone', price: 35, what: 'the knife bites deeper', says: '"For the knife? For cellars, I always say: a dehumidifier."' },
  helmet: { name: "a miner's helmet", price: 45, what: 'blows hurt you less', item: 'miners-helmet', says: '"An old one from the mine. My father\'s. Take it, take it. Mind the dent."' },
};

/** Their order on his counter (keys 1, 2, 3). */
export const GEAR_ORDER: readonly GearKind[] = ['gloves', 'whetstone', 'helmet'];

/** Whether the grandchild in `kit` has what Kemal sells as `kind` (worn, or the knife honed). */
export function hasGear(kit: Kit, kind: GearKind): boolean {
  const g = GEAR[kind], knife = kit.worn.main;
  return g.item ? kit.has(g.item) : knife?.kind === 'kitchen-knife' && knife.quality !== 'worn' && knife.quality !== 'sound';
}

/** Buy `kind` with `euros` in the purse, put on (or the knife honed) in `kit`: the euros left and what is said, or why not. */
export function buyGear(kit: Kit, kind: GearKind, euros: number): { euros: number; line: string } {
  const g = GEAR[kind];
  if (hasGear(kit, kind)) return { euros, line: `You have ${g.name} already.` };
  if (!g.item && kit.worn.main?.kind !== 'kitchen-knife') return { euros, line: 'Kemal looks at your empty hand. "A whetstone. For what?"' };
  if (euros < g.price) return { euros, line: `Kemal shakes his head. "€${g.price}. Grandma's purse has €${euros}."` };
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
