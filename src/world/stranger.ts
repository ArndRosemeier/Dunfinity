/**
 * The stranger at Ilse's (town-and-first-strata.md §3: "later, the town reacts as you go deeper";
 * Ilse "slowly becomes a collector of the strange"): once the family has been below level 10, one
 * of the peoples of the deep (src/creatures/folk.ts) has come up and stands by the pawn
 * shop's door in a dark travelling coat, selling Ilse things from below. It turns to whoever comes near, and talks
 * when called on (E): a few words almost like ours. Pure.
 */
import { shopDoor } from '../gen/town';
import { Townsperson } from './townsperson';
import type { Known } from './neighbour';

/** Its blocker's key. */
export const STRANGER_KEY = 'stranger';

export const STRANGER = {
  reach: 2.0,
  notice: 7,
  turn: 3,
  talk: 4,
  /** It comes once the family has been this deep. */
  from: 11,
} as const;

/** What it says, in turn: words almost like ours (each world a copy of the one below, lore.md §3). */
const LINES: readonly string[] = [
  '"Ilse buys. I sell." It pats a sack that clinks.',
  '"You go down. We come up. Same stairs." It laughs, a dry sound.',
  '"Grand... mother. Salt woman. We know her." It touches its brow.',
  '"Up here the sky is far. Down there it is near. You will see."',
  '"Do not sell the humming things. Ilse keeps them. Ilse is wrong."',
];

export class Stranger extends Townsperson {
  private calls = 0;

  constructor() {
    const d = shopDoor('pawn');
    // Beside the shop's door, a step off its threshold, looking out at the street.
    super(d.x - d.nx * 0.2 + d.sx * 2.2, d.z - d.nz * 0.2 + d.sz * 2.2, Math.atan2(-d.nx, -d.nz), STRANGER);
  }

  /** Whether it is in the town at all. */
  static here(known: Known): boolean {
    return known.deepest >= STRANGER.from;
  }

  /** Call on it at `now`: what it says. */
  talk(now: number): string {
    this.talkAt = now;
    return LINES[this.calls++ % LINES.length];
  }
}
