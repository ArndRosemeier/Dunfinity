/**
 * The two shopkeepers behind their counters (town-and-first-strata.md §3): Kemal in his hardware
 * store, who recommends the wrong thing with total confidence, and Ilse in her pawn shop, who asks
 * no questions and slowly becomes a collector of the strange. Each stands at `shopKeeper` (src/gen/town.ts),
 * turns to whoever comes in, and talks when called on (E at the counter) or when a deal is made. Pure.
 */
import { shopKeeper, type Shop } from '../gen/town';
import { Talker } from './townsperson';

/** Their blockers' keys. */
export const KEEPER_KEY: Readonly<Record<Shop, string>> = { hardware: 'kemal', pawn: 'ilse' };

export const KEEPER = {
  /** How near one must stand to deal: anywhere at the front of the counter. */
  reach: 2.3,
  /** How near one must come (in at the door) for them to look up, and how fast they turn. */
  notice: 5.5,
  turn: 2.5,
  /** Seconds they go on talking. */
  talk: 4,
} as const;

/** What each says when called on, in turn. */
const LINES: Readonly<Record<Shop, readonly string[]>> = {
  hardware: [
    '"You want the pick. Everybody wants the pick. Trust me, the pick." Kemal taps the counter.',
    '"Gloves first, always gloves. My uncle lost two fingers. Or was it a bet."',
    '"Salt? I don\'t do salt. Farm shop. Why does everyone in your family ask me for salt?"',
    '"Torch batteries last forty hours. Thirty. Twenty, down there, the cold eats them."',
    '"A crowbar opens everything. Doors, crates, arguments." He nods, very sure.',
  ],
  pawn: [
    'Ilse looks at you over her glasses. "I don\'t ask where things come from. It\'s restful."',
    '"Your grandmother sold me a stone once that was warm in winter. I still have it. Not for sale."',
    '"Old coins, rings, odd little things. Bring them up, I\'ll be fair. Fairly fair."',
    '"Things from down there tick, sometimes. Like the clocks. I put them in the back with the clocks."',
    'Ilse winds one of the clocks and does not look up. "Mind the stairs. Hers, I mean."',
  ],
};

export class Shopkeeper extends Talker {
  constructor(readonly shop: Shop) {
    const k = shopKeeper(shop);
    super(k.x, k.z, k.yaw, KEEPER, LINES[shop]);
  }

  /** A deal made at `now`: they talk with their hands while it is said. */
  deal(now: number): void {
    this.talkAt = now;
  }
}
