/**
 * The main bar (src/app/abilityBar.ts): eight slots, answering to 1–8 (the player may move them),
 * each holding one of grandma's cards that is used, not one that works by itself. Cooking such a
 * card puts it in the first free slot; at the fire, with the tin open, 1–8 puts the card chosen
 * there into that slot (the card that was there goes back in the tin, still cooked). A card is used
 * through its slot only: no card has a key of its own. The cards that work by themselves (passives)
 * and the ones that make a move better (Spring: Space jumps higher; Tiptoe: Z sneaks) take no slot.
 *
 * Pure: data, and the slots a grandchild has (`MainBar`, kept in the save).
 */
import { CARDS, card, type CardId, type Cooked } from '../loot/recipes';

export interface Ability {
  readonly card: CardId;
  /** The action it is used by (never a key: the game asks `Controls` for it, and a slot's key stands for it). */
  readonly key: string;
  /** Held down while it lasts (the lid): a click on the bar holds it until the next. */
  readonly hold?: true;
  /** A word or two on the slot. */
  readonly short: string;
}

/** The action of card `id` (what its slot's key counts as). */
export const useOf = (id: CardId): string => `card:${id}`;

const ability = (id: CardId, short: string, hold?: true): Ability => ({ card: id, key: useOf(id), short, ...(hold ? { hold } : {}) });

/** Every card that can go on the bar, in the order the bar fills when a save has none. */
export const ABILITIES: readonly Ability[] = [
  ability('tenderising', 'Pound'),
  ability('helpings', 'Throw knife'),
  ability('duck', 'Roll'),
  ability('pot-lid', 'Pot lid', true),
  ability('stove-flame', 'Stove flame'),
  ability('cold-larder', 'Cold larder'),
  ability('rolling-pin', 'Rolling pin'),
  ability('candle', 'Candle'),
  ability('snapdragon', 'Snapdragon'),
  ability('horseradish', 'Horseradish'),
  ability('flour-bag', 'Flour bag'),
  ability('matchstick', 'Match'),
  ability('salt-pet', 'Salt pet'),
  ability('salt-line', 'Salt line'),
  ability('way-home', 'Way home'),
  ability('salt-sight', 'Salt sight'),
];

/** The cards that make a move better: no slot, the move's own key (Space jumps, Z sneaks). */
export const MOVES: readonly CardId[] = ['spring', 'tiptoe'];

/** How many slots the bar has, the keys they answer to by default (each an action the player may move), and what the bar calls them. */
export const BAR = 8;
export const SLOT_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8'] as const;
export const SLOT_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

export const abilityOf = (id: CardId): Ability | null => ABILITIES.find((a) => a.card === id) ?? null;

/** A grandchild's main bar: which card is in each slot (null: empty). */
export class MainBar {
  readonly slots: (CardId | null)[] = new Array<CardId | null>(BAR).fill(null);

  /** Put `id` (a card used through the bar) in the first free slot, unless it is on the bar already. Returns its slot, or -1 (full, or not a bar card). */
  slotIn(id: CardId): number {
    if (!abilityOf(id)) return -1;
    const at = this.slots.indexOf(id);
    if (at >= 0) return at;
    const free = this.slots.indexOf(null);
    if (free >= 0) this.slots[free] = id;
    return free;
  }

  /** Put `id` in slot `i`: moved there from the slot it was in, the card that was in `i` taking that slot (swapped), or going back in the tin if `id` was not on the bar. False if `id` is not a bar card. */
  set(i: number, id: CardId): boolean {
    if (!abilityOf(id) || i < 0 || i >= BAR) return false;
    const was = this.slots.indexOf(id);
    if (was >= 0) this.slots[was] = this.slots[i];
    this.slots[i] = id;
    return true;
  }

  /** Take the card in slot `i` off the bar (back in the tin). */
  clear(i: number): void {
    if (i >= 0 && i < BAR) this.slots[i] = null;
  }

  /** The slot `id` is in, or -1. */
  slotOf(id: CardId): number { return this.slots.indexOf(id); }

  /** The slots, to keep. */
  get data(): (string | null)[] { return [...this.slots]; }

  /** The bar kept (`data`), for what `cooked` holds: unknown or uncooked cards dropped; with none kept (an older save), the cooked bar cards in `ABILITIES` order. */
  static from(data: readonly (string | null)[] | undefined, cooked: Cooked): MainBar {
    const b = new MainBar();
    if (data) data.slice(0, BAR).forEach((id, i) => {
      const a = id === null ? null : ABILITIES.find((x) => x.card === id);
      if (a && cooked.rank(a.card) > 0 && b.slotOf(a.card) < 0) b.slots[i] = a.card;
    });
    else for (const a of ABILITIES) if (cooked.rank(a.card) > 0) b.slotIn(a.card);
    return b;
  }
}

/** An action the player can put on another key (settings), named by its own key, and what it does. */
export interface KeyAction {
  readonly key: string;
  readonly name: string;
  readonly group: 'Moving' | 'Fighting' | 'Looking';
}

/** Every action that answers to a key, in the order the settings list them (the cards' own from `ABILITIES`). */
export const KEY_ACTIONS: readonly KeyAction[] = (() => {
  const moving: KeyAction[] = [
    { key: 'KeyW', name: 'Forward', group: 'Moving' },
    { key: 'KeyS', name: 'Back', group: 'Moving' },
    { key: 'KeyA', name: 'Left', group: 'Moving' },
    { key: 'KeyD', name: 'Right', group: 'Moving' },
    { key: 'ShiftLeft', name: 'Run', group: 'Moving' },
    { key: 'Space', name: `Jump (higher with ${card('spring').title})`, group: 'Moving' },
    { key: 'KeyZ', name: `Sneak (${card('tiptoe').title})`, group: 'Moving' },
    { key: 'KeyE', name: 'Climb a ladder, pick up, read', group: 'Moving' },
    { key: 'KeyC', name: 'Light a fire', group: 'Moving' },
    { key: 'KeyT', name: "Grandma's tin (by the fire)", group: 'Moving' },
  ];
  const fighting: KeyAction[] = [
    { key: 'Mouse0', name: 'Stab', group: 'Fighting' },
    { key: 'Tab', name: 'Pick a target', group: 'Fighting' },
    { key: 'KeyG', name: 'Salt Sight: how tough they are (on and off)', group: 'Fighting' },
    ...SLOT_KEYS.map((k, i): KeyAction => ({ key: k, name: `Bar slot ${SLOT_LABELS[i]}`, group: 'Fighting' })),
  ];
  const looking: KeyAction[] = [
    { key: 'KeyF', name: 'Headlamp', group: 'Looking' },
    { key: 'KeyL', name: 'Flashlight (Kemal sells one)', group: 'Looking' },
    { key: 'KeyM', name: 'Map', group: 'Looking' },
    { key: 'KeyJ', name: "Grandma's diary", group: 'Looking' },
    { key: 'KeyI', name: 'Your pack', group: 'Looking' },
    { key: 'KeyN', name: 'Sound on and off', group: 'Looking' },
    { key: 'KeyB', name: 'Music on and off', group: 'Looking' },
    { key: 'KeyO', name: 'Settings', group: 'Looking' },
  ];
  return [...moving, ...fighting, ...looking];
})();

/** Keys no action may be moved onto: Escape (lets the mouse go, closes things), the debug menu's. */
export const FIXED_KEYS: readonly string[] = ['Escape', 'Backquote'];

/** The bar's slots as abilities (null: empty). */
export function barOf(bar: MainBar): (Ability | null)[] {
  return bar.slots.map((id) => (id ? abilityOf(id) : null));
}

/** The cards cooked that take no slot (they work by themselves, or make a move better). */
export function passivesOf(cooked: Cooked): CardId[] {
  return CARDS.filter((c) => cooked.rank(c.id) > 0 && !abilityOf(c.id)).map((c) => c.id);
}
