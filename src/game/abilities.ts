/**
 * The ability bar (src/app/abilityBar.ts): which of grandma's cards are used by a key, in the bar's
 * order, and the key each answers to. Cooked cards with no key work by themselves (passives). The
 * bar's slots also answer to 1–9, 0, - and =, and a click.
 *
 * Pure: data and the order the bar shows for what a grandchild has cooked.
 */
import { CARDS, type CardId, type Cooked } from '../loot/recipes';

export interface Ability {
  readonly card: CardId;
  /** The key it is used by (a KeyboardEvent.code, or 'Mouse2'), and how the bar names it. */
  readonly key: string;
  readonly label: string;
  /** Held down while it lasts (the lid, tiptoeing): a click on the bar holds it until the next. */
  readonly hold?: true;
  /** A word or two on the slot. */
  readonly short: string;
}

export const ABILITIES: readonly Ability[] = [
  { card: 'tenderising', key: 'KeyV', label: 'V', short: 'Pound' },
  { card: 'helpings', key: 'Mouse2', label: 'RMB', short: 'Throw knife' },
  { card: 'duck', key: 'KeyQ', label: 'Q', short: 'Roll' },
  { card: 'spring', key: 'Space', label: 'Space', short: 'Spring' },
  { card: 'pot-lid', key: 'KeyX', label: 'X', hold: true, short: 'Pot lid' },
  { card: 'tiptoe', key: 'KeyZ', label: 'Z', hold: true, short: 'Tiptoe' },
  { card: 'stove-flame', key: 'KeyR', label: 'R', short: 'Stove flame' },
  { card: 'cold-larder', key: 'KeyK', label: 'K', short: 'Cold larder' },
  { card: 'rolling-pin', key: 'KeyP', label: 'P', short: 'Rolling pin' },
  { card: 'candle', key: 'KeyG', label: 'G', short: 'Candle' },
  { card: 'salt-line', key: 'KeyL', label: 'L', short: 'Salt line' },
  { card: 'way-home', key: 'KeyH', label: 'H', short: 'Way home' },
];

/** The slots' number keys, and what the bar calls them. */
export const SLOT_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'] as const;
export const SLOT_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='] as const;

/** The abilities a grandchild has cooked, in the bar's order (slot i answers to SLOT_KEYS[i]). */
export function barOf(cooked: Cooked): Ability[] {
  return ABILITIES.filter((a) => cooked.rank(a.card) > 0);
}

/** The cards cooked that need no key (they work by themselves). */
export function passivesOf(cooked: Cooked): CardId[] {
  return CARDS.filter((c) => cooked.rank(c.id) > 0 && !ABILITIES.some((a) => a.card === c.id)).map((c) => c.id);
}
