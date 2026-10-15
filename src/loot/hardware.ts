/**
 * Kemal's hardware store (town-and-first-strata.md §3): ordinary things for euros from grandma's
 * purse, each a small, plain help down there. Bought by a grandchild and lost with them, like their
 * pack; the purse stays with the family. Kemal recommends the wrong thing with total confidence.
 *
 * Pure: what he sells, what it does, the sale.
 */
export type GearKind = 'gloves' | 'whetstone' | 'helmet';

export interface GearDef {
  readonly name: string;
  readonly price: number;
  /** What it does, in a few words for his shelf. */
  readonly what: string;
  /** What Kemal says as he wraps it. */
  readonly says: string;
}

export const GEAR: Record<GearKind, GearDef> = {
  gloves: { name: 'work gloves', price: 20, what: 'climbing tires you less', says: '"Gloves. Good. But what you really want is a nice garden hose."' },
  whetstone: { name: 'a whetstone', price: 35, what: 'the knife bites deeper', says: '"For the knife? For cellars, I always say: a dehumidifier."' },
  helmet: { name: "a miner's helmet", price: 45, what: 'blows hurt you less', says: '"An old one from the mine. My father\'s. Take it, take it. Mind the dent."' },
};

/** Their order on his counter (keys 1, 2, 3). */
export const GEAR_ORDER: readonly GearKind[] = ['gloves', 'whetstone', 'helmet'];

/** How much each helps: climbing stamina, knife damage, damage taken from blows. */
export const GEAR_EFFECT = { climb: 0.75, edge: 1.25, armour: 0.8 } as const;

export class Gear {
  readonly owned = new Set<GearKind>();

  constructor(kinds: readonly string[] = []) {
    for (const k of kinds) if (k in GEAR) this.owned.add(k as GearKind);
  }

  /** Multipliers for what the gear helps with. */
  get climb(): number { return this.owned.has('gloves') ? GEAR_EFFECT.climb : 1; }
  get edge(): number { return this.owned.has('whetstone') ? GEAR_EFFECT.edge : 1; }
  get armour(): number { return this.owned.has('helmet') ? GEAR_EFFECT.armour : 1; }

  get data(): GearKind[] { return [...this.owned]; }

  /** Buy `kind` with `euros` in the purse: the euros left and what is said, or why not. */
  buy(kind: GearKind, euros: number): { euros: number; line: string } {
    const g = GEAR[kind];
    if (this.owned.has(kind)) return { euros, line: `You have ${g.name} already.` };
    if (euros < g.price) return { euros, line: `Kemal shakes his head. "€${g.price}. Grandma's purse has €${euros}."` };
    this.owned.add(kind);
    return { euros: euros - g.price, line: `You buy ${g.name} for €${g.price}: ${g.what}.\n${g.says}` };
  }
}
