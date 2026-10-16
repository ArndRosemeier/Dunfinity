/**
 * The goblins on screen (src/creatures/goblins.ts): Norgo's goblin race on Scale's bodies (small,
 * big-headed, long-armed, green to ochre skin, ears out to the side, yellow and red eyes faintly
 * glowing), in stolen clothes cut down, each with a stolen kitchen knife. They squat in the den,
 * jump up and throw their arms up when they shriek, run at you, jab, flinch when stabbed and fall
 * when they die.
 *
 * A `HumanPool`: the nearest goblins are drawn with it.
 */
import { randomAppearance, type HumanoidAppearance } from '@futuremagic/humanoid';
import type { Humanoid, ActionAnim } from '@futuremagic/humanoid/three';
import { deriveSeed } from '@futuremagic/core';
import { groundSpeed } from '../../creatures/creature';
import { GOBLIN_FOLK, type Goblin } from '../../creatures/goblins';
import { goblinsClothes } from '../humans/wardrobe';
import { HumanPool, humans } from './humanPool';

/** How many can be drawn at once, and how far off they are drawn, metres. */
const POOL = 4;
const SHOWN = 45;

/** A goblin's look, from the race's own table. */
export function goblinLook(seed: number, k: number): HumanoidAppearance {
  return randomAppearance('goblin', deriveSeed(seed, 'goblin', k), { age: 0.45 + 0.08 * k, gender: k === 3 ? 0.1 : 0.9 });
}

export class GoblinView extends HumanPool<Goblin> {
  static async create(seed: number): Promise<GoblinView> {
    return new GoblinView(await humans(POOL, (k) => goblinLook(seed, k), (k) => goblinsClothes(deriveSeed(seed, 'goblin', 'clothes', k), k)));
  }

  private constructor(humans: Humanoid[]) {
    super(humans, SHOWN, (g, time) => {
      let action: ActionAnim | undefined;
      if (g.mode === 'jab') action = { id: 'stab', t0: time - g.swingT, dur: GOBLIN_FOLK.swing.dur };
      else if (g.mode === 'shriek') action = { id: 'cheer', t0: time - g.t, dur: GOBLIN_FOLK.shriek };
      const moving = groundSpeed(g) > 0.15;
      const move = g.dead ? 'dead' : moving ? (g.mode === 'home' ? 'walk' : 'run') : g.mode === 'squat' ? 'crouch' : 'idle';
      const mood = g.mode === 'flee' ? (g.loot !== null ? 'happy' : 'afraid') : g.hostile ? 'angry' : 'neutral';
      return { anim: { move, action, mood }, combat: g.hostile && g.mode !== 'flee' };
    }, 1);
  }
}
