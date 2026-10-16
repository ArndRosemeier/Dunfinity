/**
 * Items a grandchild wears and holds (docs/design/items.md): what each kind is, which
 * slot it goes in, how good this one is, and what all of it together does (armour off a blow, the
 * knife's bite, the cost of climbing). Lost with the grandchild, like the pack (D11).
 *
 * Pure. Items turn up only where they make sense (plan F2): for now Kemal's store; later humanoids,
 * sheds, a slime's belly, a lair.
 */
import { FINDS, type Find, type Pack } from './finds';

/** Where an item is worn or held. */
export type Slot = 'head' | 'body' | 'hands' | 'legs' | 'feet' | 'main' | 'off' | 'trinket';

/** The slots in the order the pack lists them. */
export const SLOTS: readonly Slot[] = ['head', 'body', 'hands', 'legs', 'feet', 'main', 'off', 'trinket'];

/** What the pack calls a slot. */
export const SLOT_NAME: Readonly<Record<Slot, string>> = {
  head: 'Head', body: 'Body', hands: 'Hands', legs: 'Legs', feet: 'Feet', main: 'Main hand', off: 'Off hand', trinket: 'Trinket',
};

export type Quality = 'worn' | 'sound' | 'fine' | 'master';

/** How good a piece is: what it is called, and how much of its help it gives (sound: all of it). */
export const QUALITY: Readonly<Record<Quality, { readonly name: string; readonly factor: number }>> = {
  worn: { name: 'worn', factor: 0.8 },
  sound: { name: 'sound', factor: 1 },
  fine: { name: 'fine', factor: 1.25 },
  master: { name: 'master', factor: 1.5 },
};

export type ItemKind = 'kitchen-knife' | 'work-gloves' | 'miners-helmet';

export interface ItemDef {
  readonly name: string;
  readonly slot: Slot;
  /** The share it takes off a blow, sound (0.2: a fifth). */
  readonly armour?: number;
  /** A weapon's bite, sound (the kitchen knife: 1). */
  readonly edge?: number;
  /** What climbing costs with it on (0.75: a quarter less). */
  readonly climb?: number;
  /** What it does, in a few words for the pack. */
  readonly what: string;
}

export const ITEMS: Readonly<Record<ItemKind, ItemDef>> = {
  'kitchen-knife': { name: "grandma's kitchen knife", slot: 'main', edge: 1, what: 'stabs' },
  'work-gloves': { name: 'work gloves', slot: 'hands', climb: 0.75, what: 'climbing tires you less' },
  'miners-helmet': { name: "a miner's helmet", slot: 'head', armour: 0.2, what: 'blows hurt you less' },
};

export interface Item {
  readonly kind: ItemKind;
  readonly quality: Quality;
}

/** Whether `x` (from a save) is an item this build knows. */
export function isItem(x: { kind: string; quality: string }): x is Item {
  return x.kind in ITEMS && x.quality in QUALITY;
}

/** `item` as the pack says it: 'work gloves', "grandma's kitchen knife (fine)". */
export function itemName(item: Item): string {
  const n = ITEMS[item.kind].name;
  return item.quality === 'sound' ? n : `${n} (${QUALITY[item.quality].name})`;
}

/** What a grandchild wears and holds, slot by slot; it starts with grandma's knife in the hand. */
export class Kit {
  readonly worn: Partial<Record<Slot, Item>> = {};

  constructor(items: readonly Item[] = [{ kind: 'kitchen-knife', quality: 'sound' }]) {
    for (const i of items) if (isItem(i)) this.worn[ITEMS[i.kind].slot] = { kind: i.kind, quality: i.quality };
  }

  /** Put `item` on (in its slot): what it takes the place of, or null. */
  put(item: Item): Item | null {
    const slot = ITEMS[item.kind].slot, was = this.worn[slot] ?? null;
    this.worn[slot] = item;
    return was;
  }

  /** Take off what is in `slot`, or null. */
  off(slot: Slot): Item | null {
    const was = this.worn[slot] ?? null;
    delete this.worn[slot];
    return was;
  }

  /** Whether a `kind` is worn. */
  has(kind: ItemKind): boolean {
    return this.items.some((i) => i.kind === kind);
  }

  get items(): Item[] {
    return SLOTS.flatMap((s) => (this.worn[s] ? [this.worn[s]!] : []));
  }

  /** What is left of a blow after the armour (1: nothing off). */
  get armour(): number {
    let left = 1;
    for (const i of this.items) left *= 1 - Math.min(0.9, (ITEMS[i.kind].armour ?? 0) * QUALITY[i.quality].factor);
    return left;
  }

  /** The bite of what is in the main hand (bare hands: half the knife's). */
  get edge(): number {
    const m = this.worn.main;
    return m ? (ITEMS[m.kind].edge ?? 0.5) * QUALITY[m.quality].factor : 0.5;
  }

  /** What climbing costs. */
  get climb(): number {
    let c = 1;
    for (const i of this.items) c *= ITEMS[i.kind].climb ?? 1;
    return c;
  }

  get data(): Item[] {
    return this.items;
  }
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
  const it = kit.worn[row.slot];
  return it && it.kind !== 'kitchen-knife' ? 'take it off' : '';
}

/**
 * Do what E does on `row`: a find is left on the floor (`left`, for the caller to lay down), a spare
 * item put on (what it replaces goes into the pack), a worn one taken off into the pack. Grandma's
 * knife stays in the hand. What is said.
 */
export function rummage(row: PackRow, pack: Pack, kit: Kit): { line: string; left: Find | null } {
  if (row.what === 'find') {
    const f = pack.takeOut(row.i);
    return { line: f ? `You leave ${FINDS[f.kind].name} on the floor.` : '', left: f };
  }
  if (row.what === 'spare') {
    const it = pack.unstow(row.i);
    if (!it) return { line: '', left: null };
    const was = kit.put(it);
    if (was) pack.stow(was);
    return { line: `You put on ${itemName(it)}${was ? `, and pack ${itemName(was)}` : ''}.`, left: null };
  }
  const it = kit.worn[row.slot];
  if (!it) return { line: '', left: null };
  if (it.kind === 'kitchen-knife') return { line: "Grandma's knife stays in your hand.", left: null };
  if (pack.full) return { line: 'No room in the pack for it.', left: null };
  kit.off(row.slot);
  pack.stow(it);
  return { line: `You take off ${itemName(it)} and pack it.`, left: null };
}
