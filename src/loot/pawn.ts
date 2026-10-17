/**
 * Ilse's pawn shop (town-and-first-strata.md §3): she buys what a grandchild brings up and pays in
 * euros, which go into grandma's purse and outlive the grandchild (like the salt in her tin). Euros
 * buy only mundane things up here; they never turn into salt, nor salt into euros.
 *
 * Pure: the sale, and what Ilse says.
 */
import { hash3f } from '@futuremagic/core';
import type { Pack } from './finds';

/** What she says, paying: asks no questions, and pays too little (the finds' values are her prices). */
const LINES: readonly ((paid: number, n: number) => string)[] = [
  (paid, n) => `Ilse turns ${n === 1 ? 'it' : 'each one'} over under her lamp and counts out €${paid}. "I don't ask where things come from."`,
  (paid) => `Ilse pays €${paid} without looking up. "Old things. Bring me more old things."`,
  (paid, n) => `"Hm." Ilse weighs ${n === 1 ? 'it' : 'them'} in her hand, and pays €${paid}. "Your grandmother sold me a spoon like this once."`,
];

/** What Ilse says paying €`paid` for `n` things on `visit`. */
export function ilsePays(paid: number, n: number, visit: number): string {
  return LINES[Math.floor(hash3f(1949, visit, n, paid) * LINES.length)](paid, n);
}

/** Sell every find in the pack: they are gone, and what Ilse pays and says comes back. */
export function sell(pack: Pack, visit: number): { paid: number; line: string } {
  const n = pack.items.length, paid = pack.worth;
  pack.items.length = 0;
  return { paid, line: ilsePays(paid, n, visit) };
}
