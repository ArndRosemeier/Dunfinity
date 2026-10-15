/**
 * The Salt-Touched on screen (src/creatures/touched.ts): Scale's humans, old miners grown through
 * with salt (grey skin under a crust of crystals, eyes gone pale and faintly glowing), in salt-crusted
 * work clothes, with a miner's pick. They work the rock with it, turn to you, trudge after you and
 * bring it down over their heads; a stab makes them flinch, and they fall when they die.
 *
 * A `HumanPool`: the nearest Salt-Touched are drawn with it.
 */
import { groundSpeed } from '../../creatures/creature';
import { randomAppearance, type HumanoidAppearance } from '@futuremagic/humanoid';
import type { Humanoid, ActionAnim } from '@futuremagic/humanoid/three';
import { deriveSeed } from '@futuremagic/core';
import { TOUCHED, type Touched } from '../../creatures/touched';
import { minersClothes } from '../humans/wardrobe';
import { HumanPool, humans } from './humanPool';

/** How many can be drawn at once, and how far off they are drawn, metres. */
const POOL = 3;
const SHOWN = 55;

/** A lost miner's look: an older man (mostly), the salt grown into him. */
export function touchedLook(seed: number, k: number): HumanoidAppearance {
  const a = randomAppearance('human', deriveSeed(seed, 'touched', k), { age: 0.62 + 0.1 * k, gender: k === 2 ? 0.3 : 0.95 });
  return {
    ...a,
    skinTone: [0.56, 0.58, 0.62], skinAccent: [0.62, 0.82, 1.0], skinPattern: 'crystals', patternStrength: 0.85,
    eyeColor: [0.75, 0.88, 1.0], eyeGlow: 0.7, hairColor: [0.72, 0.73, 0.75],
  };
}

/** The Salt-Touched's humans; `level` is the floor their feet find. */
export class TouchedView extends HumanPool<Touched> {
  static async create(seed: number): Promise<TouchedView> {
    return new TouchedView(await humans(POOL, (k) => touchedLook(seed, k), (k) => minersClothes(deriveSeed(seed, 'touched', 'clothes', k))));
  }

  private constructor(humans: Humanoid[]) {
    super(humans, SHOWN, (t, time) => {
      const S = TOUCHED.swing;
      let action: ActionAnim | undefined;
      if (t.mode === 'swing') action = { id: 'slam', t0: time - t.swingT, dur: S.dur };
      else if (t.mode === 'work' && t.strokeT < TOUCHED.stroke) action = { id: 'mine', t0: time - t.strokeT, dur: TOUCHED.stroke };
      const moving = groundSpeed(t) > 0.15;
      return { anim: { move: t.dead ? 'dead' : moving ? 'walk' : 'idle', action, mood: t.angry ? 'angry' : 'neutral' }, combat: t.angry && !t.dead };
    });
  }
}
