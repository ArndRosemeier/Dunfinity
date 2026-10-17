/**
 * Items a grandchild wears and holds (docs/design/items.md): what each kind is, which
 * slot it goes in, how good this one is, and what all of it together does (armour off a blow, the
 * knife's bite, the cost of climbing). Lost with the grandchild, like the pack (D11).
 *
 * Pure. Items turn up only where they make sense (plan F2): for now Kemal's store; later humanoids,
 * sheds, a slime's belly, a lair.
 */
import type { Move } from '../combat/combat';
import { FINDS, PACK, type Find, type Pack } from './finds';
import { SKILLS, type Skill } from './practice';

/** Where an item is worn or held. */
export type Slot = 'head' | 'body' | 'hands' | 'legs' | 'feet' | 'main' | 'off' | 'trinket' | 'back';

/** The slots in the order the pack lists them. */
export const SLOTS: readonly Slot[] = ['head', 'body', 'hands', 'legs', 'feet', 'main', 'off', 'trinket', 'back'];

/** What the pack calls a slot. */
export const SLOT_NAME: Readonly<Record<Slot, string>> = {
  head: 'Head', body: 'Body', hands: 'Hands', legs: 'Legs', feet: 'Feet', main: 'Main hand', off: 'Off hand', trinket: 'Trinket', back: 'Back',
};

export type Quality = 'worn' | 'sound' | 'fine' | 'master';

/** How good a piece is: what it is called, and how much of its help it gives (sound: all of it). */
export const QUALITY: Readonly<Record<Quality, { readonly name: string; readonly factor: number }>> = {
  worn: { name: 'worn', factor: 0.8 },
  sound: { name: 'sound', factor: 1 },
  fine: { name: 'fine', factor: 1.25 },
  master: { name: 'master', factor: 1.5 },
};

export type ItemKind = 'kitchen-knife' | 'work-gloves' | 'miners-helmet' | 'hatchet' | 'pick' | 'crowbar' | 'flashlight' | 'rucksack' | 'army-rucksack' | 'salt-satchel' | 'umbrella' | 'owl-cloak' | 'salt-feather'
  | 'hobnail-boots' | 'rope-soles' | 'knee-pads' | 'moleskins' | 'leather-apron' | 'sling' | 'snuff-tin' | 'barbara-medal';

/**
 * A gift: one number the game already has, moved by what is worn (the plan's "gifts on gear": no
 * strength or agility under them). Health and stamina: more of it; wind: stamina back that much
 * faster (0.25: a quarter); pace and leap: a run and a jump that much quicker; a practice skill
 * (src/loot/practice.ts): that many levels up while worn (whole levels only).
 */
export type Gift = 'health' | 'stamina' | 'wind' | 'pace' | 'leap' | Skill;

export interface GiftDef {
  /** What a piece gives of it, sound, as a property (`Item.of`, below the surface: "... of the hare"). */
  readonly step: number;
  readonly of: string;
  /** How the pack says an amount. */
  readonly say: (v: number) => string;
  /** Counts in whole steps only (a skill's levels). */
  readonly whole?: true;
}

/** Levels of a skill a sound property gives. */
const SKILL_STEP = 3;

/** Each gift (a skill's from its `SKILLS` line). */
export const GIFTS: Readonly<Record<Gift, GiftDef>> = {
  health: { step: 12, of: 'of good bread', say: (v) => `+${Math.round(v)} health` },
  stamina: { step: 3, of: 'of the long shift', say: (v) => `+${Math.round(v)} stamina` },
  wind: { step: 0.25, of: 'of deep breaths', say: (v) => `stamina back ${Math.round(v * 100)}% faster` },
  pace: { step: 0.07, of: 'of the quick', say: (v) => `${Math.round(v * 100)}% quicker on your feet` },
  leap: { step: 0.1, of: 'of the hare', say: (v) => `jumps ${Math.round(v * 100)}% higher` },
  ...(Object.fromEntries((Object.keys(SKILLS) as Skill[]).map((k) => [k, { step: SKILL_STEP, of: SKILLS[k].of, say: (v: number) => `${SKILLS[k].name} +${Math.floor(v)}`, whole: true }])) as Record<Skill, GiftDef>),
};

export interface ItemDef {
  readonly name: string;
  readonly slot: Slot;
  /** The share it takes off a blow, sound (0.2: a fifth). */
  readonly armour?: number;
  /** A weapon: how it is swung (src/combat/combat.ts MOVES; its quality scales the damage). */
  readonly move?: Move;
  /** A rucksack: how many things the pack holds with it on the back, sound (its quality scales it). */
  readonly room?: number;
  /** Lets one float down: the fastest one falls with it on, m/s, sound (under 14 no landing hurts; its quality slows it more). */
  readonly featherfall?: number;
  /** What climbing costs with it on (0.75: a quarter less). */
  readonly climb?: number;
  /** Its gifts, sound (its quality scales them; a skill's levels only by whole steps). */
  readonly gifts?: Partial<Record<Gift, number>>;
  /** What Ilse pays for it, sound, if Kemal does not sell it new (then: half his price). */
  readonly worth?: number;
  /** What it does, in a few words for the pack. */
  readonly what: string;
}

export const ITEMS: Readonly<Record<ItemKind, ItemDef>> = {
  'kitchen-knife': { name: "grandma's kitchen knife", slot: 'main', move: 'stab', what: 'stabs, quick and light' },
  'work-gloves': { name: 'work gloves', slot: 'hands', climb: 0.75, what: 'climbing tires you less' },
  'miners-helmet': { name: "a miner's helmet", slot: 'head', armour: 0.2, what: 'blows hurt you less' },
  hatchet: { name: 'a hatchet', slot: 'main', move: 'chop', what: 'chops, slower and harder' },
  pick: { name: "a miner's pick", slot: 'main', move: 'mine', what: 'comes down two-handed, slow and very hard' },
  crowbar: { name: 'a crowbar', slot: 'main', move: 'swat', what: 'swats wide, knocks them back' },
  flashlight: { name: 'a flashlight', slot: 'off', what: 'a long bright beam, on and off with L' },
  rucksack: { name: 'a canvas rucksack', slot: 'back', room: PACK.room, what: `holds ${PACK.room} things` },
  'army-rucksack': { name: 'an army rucksack', slot: 'back', room: 14, what: 'holds 14 things' },
  'salt-satchel': { name: 'a salt-woven satchel', slot: 'back', room: 40, what: 'holds far more than it is big (40 things); it hums' },
  umbrella: { name: 'a big black umbrella', slot: 'off', featherfall: 9, what: 'snaps open when you fall: you land unhurt' },
  'owl-cloak': { name: 'an owl-down cloak', slot: 'body', featherfall: 4, what: 'you sink like a feather from any height' },
  'salt-feather': { name: 'a salt feather', slot: 'trinket', featherfall: 11, what: 'a feather grown in salt: falls are slowed to a safe landing' },
  // What the miners left (the sheds, the Quarry floor) and, deeper, what others did.
  'hobnail-boots': { name: 'hobnail boots', slot: 'feet', gifts: { pace: 0.07 }, worth: 14, what: 'iron-studded soles' },
  'rope-soles': { name: 'rope-soled shoes', slot: 'feet', gifts: { leap: 0.12 }, worth: 12, what: 'light and springy' },
  'knee-pads': { name: "a miner's knee pads", slot: 'legs', gifts: { footwork: 3 }, worth: 10, what: 'leather and felt: rolling comes easier' },
  moleskins: { name: 'moleskin trousers', slot: 'legs', gifts: { stamina: 3 }, worth: 12, what: 'thick and warm' },
  'leather-apron': { name: 'a leather apron', slot: 'body', armour: 0.08, gifts: { knife: 3 }, worth: 15, what: "a butcher's, a little armour" },
  sling: { name: 'a sling', slot: 'off', gifts: { throwing: 3 }, worth: 8, what: 'a boy\'s leather sling: your throws fly truer' },
  'snuff-tin': { name: 'a tin of snuff', slot: 'trinket', gifts: { wind: 0.25 }, worth: 9, what: 'one pinch and your head clears' },
  'barbara-medal': { name: "a St Barbara's medal", slot: 'trinket', gifts: { health: 12 }, worth: 20, what: "the miners' saint, worn thin" },
};

/** Grandma's knife: never in the pack, never lost from the belt. */
const KNIFE: ItemKind = 'kitchen-knife';
/** What every grandchild comes with on their back. */
const RUCKSACK: Item = { kind: 'rucksack', quality: 'sound' };

export interface Item {
  readonly kind: ItemKind;
  readonly quality: Quality;
  /** Its one property, if it has one (found below): a gift more, `GIFTS[of].step` of it. */
  readonly of?: Gift;
}

/** Whether `x` (from a save) is an item this build knows. */
export function isItem(x: { kind: string; quality: string; of?: string }): x is Item {
  return x.kind in ITEMS && x.quality in QUALITY && (x.of === undefined || x.of in GIFTS);
}

/** `item` as the pack says it: 'work gloves', "grandma's kitchen knife (fine)", 'hobnail boots of the hare (worn)'. */
export function itemName(item: Item): string {
  const n = item.of ? `${ITEMS[item.kind].name} ${GIFTS[item.of].of}` : ITEMS[item.kind].name;
  return item.quality === 'sound' ? n : `${n} (${QUALITY[item.quality].name})`;
}

/** The gifts of `item`, its quality and property counted: how much of each. */
export function giftsOf(item: Item): Partial<Record<Gift, number>> {
  const f = QUALITY[item.quality].factor, out: Partial<Record<Gift, number>> = {};
  for (const [g, v] of Object.entries(ITEMS[item.kind].gifts ?? {}) as [Gift, number][]) out[g] = v * f;
  if (item.of) out[item.of] = (out[item.of] ?? 0) + GIFTS[item.of].step * f;
  return out;
}

/** What `item` does, for the pack: its line, and its gifts as numbers. */
export function itemWhat(item: Item): string {
  const gifts = Object.entries(giftsOf(item)) as [Gift, number][];
  return gifts.length ? `${ITEMS[item.kind].what} (${gifts.map(([g, v]) => GIFTS[g].say(v)).join(', ')})` : ITEMS[item.kind].what;
}

/** What a find is called: its own name, or the item's if it is one. */
export function findName(f: Find): string {
  return f.item ? itemName(f.item) : FINDS[f.kind].name;
}

/**
 * What a grandchild wears and holds, slot by slot, and grandma's knife: in the hand while no other
 * weapon is (`worn.main` empty), else in the belt.
 */
export class Kit {
  readonly worn: Partial<Record<Slot, Item>> = {};
  knife: Item = { kind: KNIFE, quality: 'sound' };

  constructor(items: readonly Item[] = []) {
    for (const i of items) if (isItem(i)) this.put(i.of ? { kind: i.kind, quality: i.quality, of: i.of } : { kind: i.kind, quality: i.quality });
  }

  /** Put `item` on (in its slot; grandma's knife: in place of the one in the belt): what it takes the place of, or null. */
  put(item: Item): Item | null {
    if (item.kind === KNIFE) { this.knife = item; return null; }
    const slot = ITEMS[item.kind].slot, was = this.worn[slot] ?? null;
    this.worn[slot] = item;
    return was;
  }

  /** Take off what is in `slot`, or null (the knife stays). */
  off(slot: Slot): Item | null {
    const was = this.worn[slot] ?? null;
    delete this.worn[slot];
    return was;
  }

  /** Whether a `kind` is worn or held. */
  has(kind: ItemKind): boolean {
    return kind === KNIFE || this.items.some((i) => i.kind === kind);
  }

  /** What is in the main hand: a weapon, or grandma's knife. */
  get hand(): Item {
    return this.worn.main ?? this.knife;
  }

  /** How the weapon in hand is swung. */
  get move(): Move {
    return ITEMS[this.hand.kind].move ?? 'stab';
  }

  /** What is worn and held, slot by slot (the knife in the hand, or after the rest when in the belt). */
  get items(): Item[] {
    const on = SLOTS.flatMap((s) => (s === 'main' ? [this.hand] : this.worn[s] ? [this.worn[s]!] : []));
    return this.worn.main ? [...on, this.knife] : on;
  }

  /** What is left of a blow after the armour (1: nothing off). */
  get armour(): number {
    let left = 1;
    for (const i of this.items) left *= 1 - Math.min(0.9, (ITEMS[i.kind].armour ?? 0) * QUALITY[i.quality].factor);
    return left;
  }

  /** How much of its move's damage the weapon in hand does (its quality: sound, all of it). */
  get edge(): number {
    return QUALITY[this.hand.quality].factor;
  }

  /** How many things the pack holds: what the rucksack on the back holds, or only the pockets. */
  get room(): number {
    const bag = this.worn.back;
    return bag ? roomWith(bag) : PACK.pockets;
  }

  /** The fastest one falls with what is worn (the slowest of their featherfalls), m/s, or null when nothing worn slows a fall. */
  get featherfall(): number | null {
    let f: number | null = null;
    for (const i of this.items) {
      const v = ITEMS[i.kind].featherfall;
      if (v !== undefined) f = Math.min(f ?? Infinity, v / QUALITY[i.quality].factor);
    }
    return f;
  }

  /** What climbing costs. */
  get climb(): number {
    let c = 1;
    for (const i of this.items) c *= ITEMS[i.kind].climb ?? 1;
    return c;
  }

  /** How much of `g` all that is worn gives (a skill: whole levels only). */
  gift(g: Gift): number {
    let v = 0;
    for (const i of this.items) v += giftsOf(i)[g] ?? 0;
    return GIFTS[g].whole ? Math.floor(v + 1e-9) : v;
  }

  get data(): Item[] {
    return this.items;
  }
}

/** A new grandchild's kit: the knife in the hand, their own rucksack on the back. */
export function freshKit(): Kit {
  return new Kit([RUCKSACK]);
}

/** `kit` from a save made before rucksacks: the plain one put on (unless one is worn or packed). */
export function withRucksack(kit: Kit, pack: Pack): Kit {
  if (!kit.worn.back && !pack.spare.some((i) => ITEMS[i.kind].slot === 'back')) kit.put(RUCKSACK);
  return kit;
}

/** A line of the open pack: a slot of the kit, a find, a spare item. */
export type PackRow = { readonly what: 'slot'; readonly slot: Slot } | { readonly what: 'find'; readonly i: number } | { readonly what: 'spare'; readonly i: number };

/** The open pack's lines, top to bottom: the kit's slots, then the finds, then the spare items. */
export function packRows(pack: Pack): PackRow[] {
  return [...SLOTS.map((slot): PackRow => ({ what: 'slot', slot })), ...pack.items.map((_, i): PackRow => ({ what: 'find', i })), ...pack.spare.map((_, i): PackRow => ({ what: 'spare', i }))];
}

/** What E does on `row`, in a few words ('' when nothing). */
export function rowUse(row: PackRow, kit: Kit): string {
  if (row.what === 'find') return 'leave it here';
  if (row.what === 'spare') return 'put it on';
  return kit.worn[row.slot] ? (row.slot === 'main' ? 'put it away, take the knife' : 'take it off') : '';
}

/**
 * Do what E does on `row`: a find is left on the floor (`left`, for the caller to lay down), a spare
 * item put on (what it replaces goes into the pack), a worn one taken off into the pack. Grandma's
 * knife stays: a weapon taken off leaves it in the hand. What is said.
 */
export function rummage(row: PackRow, pack: Pack, kit: Kit): { line: string; left: Find | null } {
  if (row.what === 'find') {
    const f = pack.takeOut(row.i);
    return { line: f ? `You leave ${FINDS[f.kind].name} on the floor.` : '', left: f };
  }
  if (row.what === 'spare') {
    const it = pack.spare[row.i];
    if (!it) return { line: '', left: null };
    const slot = ITEMS[it.kind].slot, now = kit.worn[slot];
    if (slot === 'back' && pack.count - 1 + (now ? 1 : 0) > roomWith(it)) return { line: `You carry more than ${itemName(it)} holds (${roomWith(it)}). Leave something first.`, left: null };
    pack.unstow(row.i);
    const was = kit.put(it);
    if (was) pack.stow(was);
    return { line: `You put on ${itemName(it)}${was ? `, and pack ${itemName(was)}` : ''}.`, left: null };
  }
  const it = kit.worn[row.slot];
  if (!it) return { line: row.slot === 'main' ? "Grandma's knife stays with you, in the hand or the belt." : '', left: null };
  if (row.slot === 'back' && pack.count + 1 > PACK.pockets) return { line: `Everything in it would have to go in your pockets. Leave things first (your pockets hold ${PACK.pockets}).`, left: null };
  if (pack.full) return { line: 'No room in the pack for it.', left: null };
  kit.off(row.slot);
  pack.stow(it);
  return { line: row.slot === 'main' ? `You pack ${itemName(it)} and take grandma's knife from your belt.` : `You take off ${itemName(it)} and pack it.`, left: null };
}

/** How many things the pack would hold with `bag` on the back. */
function roomWith(bag: Item): number {
  return Math.round((ITEMS[bag.kind].room ?? 0) * QUALITY[bag.quality].factor);
}
