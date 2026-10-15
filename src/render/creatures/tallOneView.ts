/**
 * The Tall One on screen (src/creatures/tallOne.ts): one of Scale's humans made four metres tall
 * and starved thin, long in the arm and the neck, hairless, its skin the grey of the cave and veined
 * darker, its eyes white and glowing, in a long dark shroud. It walks, never runs; it opens its arms
 * to stare (the tell), brings its long arm down to reach, flinches when stabbed and falls when it
 * dies.
 *
 * A `HumanPool` of one, built before the warm-up (draw it with `draw(list, x, z, dt, time)`).
 */
import { randomAppearance, type HumanoidAppearance } from '@futuremagic/humanoid';
import type { ActionAnim, Humanoid } from '@futuremagic/humanoid/three';
import { deriveSeed } from '@futuremagic/core';
import { TALL, type TallOne } from '../../creatures/tallOne';
import { groundSpeed } from '../../creatures/creature';
import { shroud } from '../humans/wardrobe';
import { HumanPool, humans } from './humanPool';

/** Gaunt and too long everywhere. */
function tallLook(seed: number): HumanoidAppearance {
  const a = randomAppearance('human', deriveSeed(seed, 'tall-one'), { age: 0.5, gender: 0.6 });
  return {
    ...a,
    faceDetail: 0.3, muscle: 0.05, weight: 0, scale: TALL.height / 1.78,
    face: { ...a.face, cheekFullness: -1, cheekbones: 1, jaw: 0.6, chin: 0.7, eyeSize: -0.4, mouthWidth: -0.6, lipFullness: -1, headRound: -0.6, faceWidth: -0.8, smile: -0.4 },
    body: { ...a.body, armLength: 1, legLength: 1, neck: 1, shoulders: -0.6, chest: -1, waist: -1, hips: -0.8, hands: 1, feet: 0.6, belly: -1 },
    skinTone: [0.5, 0.52, 0.54], skinAccent: [0.28, 0.3, 0.34], skinPattern: 'veins', patternStrength: 0.6,
    eyeColor: [0.95, 0.97, 1], eyeGlow: 1, pupil: 'none',
    hairStyle: 'bald', beardStyle: 'none', browStyle: 'none',
  };
}

/** Its human; `level` is the floor its feet find. */
export class TallOneView extends HumanPool<TallOne> {
  static async create(seed: number): Promise<TallOneView> {
    return new TallOneView(await humans(1, () => tallLook(seed), () => shroud(deriveSeed(seed, 'tall-one', 'shroud'))));
  }

  private constructor(h: Humanoid[]) {
    super(h, Infinity, (t, time) => {
      let action: ActionAnim | undefined;
      if (t.mode === 'reach') action = { id: 'slam', t0: time - t.swingT, dur: TALL.reach.dur };
      else if (t.mode === 'stare') action = { id: 'cast_forward', t0: time - t.stareT, dur: TALL.stare.dur };
      return { anim: { move: t.dead ? 'dead' : groundSpeed(t) > 0.12 ? 'walk' : 'idle', action, mood: t.hunting ? 'focused' : 'neutral' }, combat: false };
    }, 0.3);
  }
}
