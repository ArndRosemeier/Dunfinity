/**
 * The Tall One on screen (src/creatures/tallOne.ts): one of Actors' umbral (the pale people of the
 * underworld, veins shimmering, eyes glowing) made four metres tall and starved thin, hairless, in a
 * long dark shroud. It walks, never runs; it opens its arms to stare (the tell), brings its long arm
 * down to reach, flinches when stabbed and falls when it dies.
 *
 * A `HumanPool` of one, built before the warm-up (draw it with `draw(list, x, z, dt, time)`).
 */
import { deriveSeed } from '@futuremagic/core';
import { TALL, type TallOne } from '../../creatures/tallOne';
import { groundSpeed } from '../../creatures/creature';
import type { ActionAnim, Figure } from '../actors/figure';
import { dressOf, folkLook } from '../actors/looks';
import { HumanPool, figures } from './humanPool';

/** Its shroud: a long robe, dark and worn. */
const SHROUD = dressOf([['monk-robe', [0.06, 0.06, 0.07]]]);

/** Its human; `level` is the floor its feet find. */
export class TallOneView extends HumanPool<TallOne> {
  static async create(seed: number): Promise<TallOneView> {
    const [f] = await figures(1, async () => {
      const look = await folkLook('umbral', deriveSeed(seed, 'tall-one'), { age: 0.5, female: false, hair: null }, SHROUD);
      // Gaunt: no flesh on it, and long.
      return { ...look, beard: 'none', brows: null, body: { ...look.body!, muscle: 0.05, weight: 0, height: 1, proportions: 1 } };
    });
    f.object.scale.setScalar(TALL.height / f.height);
    return new TallOneView([f]);
  }

  private constructor(f: Figure[]) {
    super(f, Infinity, (t, time) => {
      let action: ActionAnim | undefined;
      if (t.mode === 'reach') action = { id: 'slam', t0: time - t.swingT, dur: TALL.reach.dur };
      else if (t.mode === 'stare') action = { id: 'cast_forward', t0: time - t.stareT, dur: TALL.stare.dur };
      return { anim: { move: t.dead ? 'dead' : groundSpeed(t) > 0.12 ? 'walk' : 'idle', action, mood: t.hunting ? 'focused' : 'neutral' }, combat: false };
    }, 0.3);
  }
}
