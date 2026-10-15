/**
 * Frau Weber on screen (src/world/neighbour.ts): one of Scale's humans, old, in her cardigan, on
 * her doorstep; she turns to whoever comes near and talks with her hands. Drawn with a HumanPool of
 * one (built before the warm-up: its `people.figures` go to `view.start`).
 */
import { randomAppearance } from '@futuremagic/humanoid';
import { deriveSeed } from '@futuremagic/core';
import { HumanPool, humans } from '../creatures/humanPool';
import type { Neighbour } from '../../world/neighbour';
import { WEBER } from '../../world/neighbour';
import { cardigan } from './wardrobe';

/** How far off she is drawn, metres. */
const SHOWN = 45;

export class NeighbourView {
  readonly people: HumanPool<Neighbour>;

  static async create(): Promise<NeighbourView> {
    // The same old woman for every seed: she has lived across the street for sixty years.
    const seed = deriveSeed(1931, 'weber');
    return new NeighbourView(await humans(1, () => randomAppearance('human', seed, { age: 0.97, gender: 0.1 }), () => cardigan(seed)));
  }

  private constructor(h: Awaited<ReturnType<typeof humans>>) {
    this.people = new HumanPool(h, SHOWN, (n, time) => ({
      anim: { move: 'idle', action: n.talking(time) ? { id: 'talk', t0: n.talkAt, dur: WEBER.talk } : undefined, mood: n.talking(time) ? 'happy' : 'neutral' },
      combat: false,
    }));
  }
}
