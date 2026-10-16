/**
 * The ability bar (src/app/abilityBar.ts): which of grandma's cards are used by a key, in the bar's
 * order, and the key each answers to. Cooked cards with no key work by themselves (passives). The
 * bar's slots also answer to 1–9, 0, - and =, and a click.
 *
 * Pure: data and the order the bar shows for what a grandchild has cooked.
 */
import { CARDS, card, type CardId, type Cooked } from '../loot/recipes';

export interface Ability {
  readonly card: CardId;
  /** The key it is used by by default (a KeyboardEvent.code, or 'Mouse2'): the action's name in `Bindings`. */
  readonly key: string;
  /** Held down while it lasts (the lid, tiptoeing): a click on the bar holds it until the next. */
  readonly hold?: true;
  /** A word or two on the slot. */
  readonly short: string;
}

export const ABILITIES: readonly Ability[] = [
  { card: 'tenderising', key: 'KeyV', short: 'Pound' },
  { card: 'helpings', key: 'Mouse2', short: 'Throw knife' },
  { card: 'duck', key: 'KeyQ', short: 'Roll' },
  { card: 'spring', key: 'Space', short: 'Spring' },
  { card: 'pot-lid', key: 'KeyX', hold: true, short: 'Pot lid' },
  { card: 'tiptoe', key: 'KeyZ', hold: true, short: 'Tiptoe' },
  { card: 'stove-flame', key: 'KeyR', short: 'Stove flame' },
  { card: 'cold-larder', key: 'KeyK', short: 'Cold larder' },
  { card: 'rolling-pin', key: 'KeyP', short: 'Rolling pin' },
  { card: 'candle', key: 'KeyG', short: 'Candle' },
  { card: 'salt-line', key: 'KeyL', short: 'Salt line' },
  { card: 'way-home', key: 'KeyH', short: 'Way home' },
];

/** The slots' number keys, and what the bar calls them. */
export const SLOT_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'] as const;
export const SLOT_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='] as const;

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
    { key: 'Space', name: `Jump (${card('spring').title})`, group: 'Moving' },
    { key: 'KeyZ', name: `Sneak (${card('tiptoe').title})`, group: 'Moving' },
    { key: 'KeyE', name: 'Climb a ladder, pick up, read', group: 'Moving' },
    { key: 'KeyC', name: 'Light a fire', group: 'Moving' },
    { key: 'KeyT', name: "Grandma's tin (by the fire)", group: 'Moving' },
  ];
  const fighting: KeyAction[] = [
    { key: 'Mouse0', name: 'Stab', group: 'Fighting' },
    { key: 'Tab', name: 'Pick a target', group: 'Fighting' },
    ...ABILITIES.filter((a) => !moving.some((m) => m.key === a.key)).map((a): KeyAction => ({ key: a.key, name: card(a.card).title, group: 'Fighting' })),
  ];
  const looking: KeyAction[] = [
    { key: 'KeyF', name: 'Headlamp', group: 'Looking' },
    { key: 'KeyM', name: 'Map', group: 'Looking' },
    { key: 'KeyJ', name: "Grandma's diary", group: 'Looking' },
    { key: 'KeyI', name: 'Your pack', group: 'Looking' },
    { key: 'KeyN', name: 'Sound on and off', group: 'Looking' },
    { key: 'KeyB', name: 'Music on and off', group: 'Looking' },
    { key: 'KeyO', name: 'Settings', group: 'Looking' },
  ];
  return [...moving, ...fighting, ...looking];
})();

/** Keys no action may be moved onto: Escape (lets the mouse go, closes things), the debug menu's, the bar's numbers. */
export const FIXED_KEYS: readonly string[] = ['Escape', 'Backquote', ...SLOT_KEYS];

/** The abilities a grandchild has cooked, in the bar's order (slot i answers to SLOT_KEYS[i]). */
export function barOf(cooked: Cooked): Ability[] {
  return ABILITIES.filter((a) => cooked.rank(a.card) > 0);
}

/** The cards cooked that need no key (they work by themselves). */
export function passivesOf(cooked: Cooked): CardId[] {
  return CARDS.filter((c) => cooked.rank(c.id) > 0 && !ABILITIES.some((a) => a.card === c.id)).map((c) => c.id);
}
