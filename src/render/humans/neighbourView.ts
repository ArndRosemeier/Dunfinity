/**
 * The town's people one calls on, on screen: Frau Weber (src/world/neighbour.ts), one of Scale's
 * humans, old, in her cardigan, on her doorstep; and the stranger at Ilse's (src/world/stranger.ts),
 * one of the game's peoples of the deep (src/creatures/folk.ts) in a dark travelling coat; and
 * grandma's ghost in her round room (src/world/grandma.ts): Grete as she was at the end, old, in her
 * cardigan, made a ghost in the salt's own blue, rising, talking and fading with a slow flicker. They
 * turn to whoever comes near and talk with their hands. Each is drawn with a HumanPool of one (built
 * before the warm-up: its `people.figures` go to `view.start`).
 */
import { randomAppearance, type HumanoidAppearance } from '@futuremagic/humanoid';
import type { Ghost } from '@futuremagic/humanoid/three';
import { deriveSeed } from '@futuremagic/core';
import { HumanPool, humans } from '../creatures/humanPool';
import type { Townsperson } from '../../world/townsperson';
import { WEBER } from '../../world/neighbour';
import { STRANGER } from '../../world/stranger';
import { GRANDMA, type Grandma } from '../../world/grandma';
import { deepFolk } from '../../creatures/folk';
import { cardigan, travellersClothes } from './wardrobe';

/** How far off they are drawn, metres. */
const SHOWN = 45;

/** Grandma's ghost: the infused salt's glow, deeper than the elves' silver-blue. */
const GRETE: Ghost = { tint: [0.45, 0.75, 1], opacity: 0.45 };

/** An old woman of the town, the same for every seed (`seed` fixed), in her cardigan. */
const oldWoman = (seed: number): HumanoidAppearance => randomAppearance('human', seed, { age: 0.97, gender: 0.1 });

export class NeighbourView<T extends Townsperson = Townsperson> {
  readonly people: HumanPool<T>;

  static async create(): Promise<NeighbourView> {
    // She has lived across the street for sixty years.
    const seed = deriveSeed(1931, 'weber');
    return new NeighbourView(await humans(1, () => oldWoman(seed), () => cardigan(seed)), WEBER.talk, 'happy');
  }

  /** The stranger at Ilse's: the first of this game's peoples of the deep. */
  static async stranger(seed: number): Promise<NeighbourView> {
    const s = deriveSeed(seed, 'stranger');
    return new NeighbourView(await humans(1, () => randomAppearance(deepFolk(seed)[0], s, { age: 0.55 }), () => travellersClothes(s)), STRANGER.talk, 'happy');
  }

  /** Grandma's ghost: Grete, born 1940, the same for every seed, her hair up in the bun she wore for sixty years. */
  static async grandma(): Promise<NeighbourView<Grandma>> {
    const seed = deriveSeed(1940, 'grete');
    return new NeighbourView<Grandma>(await humans(1, () => ({ ...oldWoman(seed), hairStyle: 'bun' }), () => cardigan(seed), GRETE), GRANDMA.talk, 'sad', (g, time) => g.seen(time) * (0.88 + 0.12 * Math.sin(time * 1.3)));
  }

  private constructor(h: Awaited<ReturnType<typeof humans>>, talk: number, mood: 'happy' | 'sad', fade?: (n: T, time: number) => number) {
    this.people = new HumanPool<T>(h, SHOWN, (n, time) => ({
      anim: { move: 'idle', action: n.talking(time) ? { id: 'talk', t0: n.talkAt, dur: talk } : undefined, mood: n.talking(time) ? mood : 'neutral' },
      combat: false,
    }), 0.7, fade);
  }
}
