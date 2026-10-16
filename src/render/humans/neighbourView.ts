/**
 * The town's people one calls on, on screen: Frau Weber (src/world/neighbour.ts), one of Scale's
 * humans, old, in her cardigan, on her doorstep; and the stranger at Ilse's (src/world/stranger.ts),
 * one of the game's peoples of the deep (src/creatures/folk.ts) in a dark travelling coat. They turn
 * to whoever comes near and talk with their hands. Each is drawn with a HumanPool of one (built
 * before the warm-up: its `people.figures` go to `view.start`).
 */
import { randomAppearance } from '@futuremagic/humanoid';
import { deriveSeed } from '@futuremagic/core';
import { HumanPool, humans } from '../creatures/humanPool';
import type { Townsperson } from '../../world/townsperson';
import { WEBER } from '../../world/neighbour';
import { STRANGER } from '../../world/stranger';
import { deepFolk } from '../../creatures/folk';
import { cardigan, travellersClothes } from './wardrobe';

/** How far off they are drawn, metres. */
const SHOWN = 45;

export class NeighbourView {
  readonly people: HumanPool<Townsperson>;

  static async create(): Promise<NeighbourView> {
    // The same old woman for every seed: she has lived across the street for sixty years.
    const seed = deriveSeed(1931, 'weber');
    return new NeighbourView(await humans(1, () => randomAppearance('human', seed, { age: 0.97, gender: 0.1 }), () => cardigan(seed)), WEBER.talk);
  }

  /** The stranger at Ilse's: the first of this game's peoples of the deep. */
  static async stranger(seed: number): Promise<NeighbourView> {
    const s = deriveSeed(seed, 'stranger');
    return new NeighbourView(await humans(1, () => randomAppearance(deepFolk(seed)[0], s, { age: 0.55 }), () => travellersClothes(s)), STRANGER.talk);
  }

  private constructor(h: Awaited<ReturnType<typeof humans>>, talk: number) {
    this.people = new HumanPool(h, SHOWN, (n, time) => ({
      anim: { move: 'idle', action: n.talking(time) ? { id: 'talk', t0: n.talkAt, dur: talk } : undefined, mood: n.talking(time) ? 'happy' : 'neutral' },
      combat: false,
    }));
  }
}
