/**
 * The Salt-Touched on screen (src/creatures/touched.ts): the lost miners' skeletons, Actors people
 * with only their bones left (src/render/actors/bones.ts) (old bone crusted with salt crystals, a pale glow deep in the eye
 * sockets), in the hard hat and the rotten work trousers they went down in, with a miner's pick.
 * They work the rock with it, turn to you, trudge after you and bring it down over their heads; a
 * stab makes them flinch, and they fall when they die.
 *
 * A `HumanPool`: the nearest Salt-Touched are drawn with it.
 */
import { groundSpeed } from '../../creatures/creature';
import type { CharacterPatch } from '@actors/generator';
import type { ActionAnim } from '../actors/figure';
import type { Bones } from '../actors/bones';
import { dressOf, folkLook } from '../actors/looks';
import { deriveSeed } from '@futuremagic/core';
import { TOUCHED, type Touched } from '../../creatures/touched';
import { HumanPool, figures, type PoolFigure, type Remains } from './humanPool';

/** How many can be drawn at once, and how far off they are drawn, metres. */
const POOL = 3;
const SHOWN = 55;

/** What a Salt-Touched's bones still wear from the day it went down: the salt-crusted work trousers rotting off them (and the hard hat, `MINER`). */
const RAGS = dressOf([['wool-pants', [0.14, 0.13, 0.13]]]);

/** A lost miner's frame (the bones are his): a man (mostly), lean from the work. */
export function touchedLook(seed: number, k: number): Promise<CharacterPatch> {
  return folkLook('human', deriveSeed(seed, 'touched', k), { age: 0.5 + 0.1 * k, female: k === 2 }, RAGS);
}

/** A lost miner's bones: old bone, the salt grown over them, a pale blue glow in the sockets; `crust` 0..1. */
export const minersBones = (crust: number): Bones => ({ tint: [0.74, 0.7, 0.6], crust, crustTint: [0.84, 0.92, 1], eyes: [0.6, 0.85, 1] });

/** A lost miner as drawn: his bones (`crust` 0..1) in his hard hat. */
export const miner = (crust: number): Remains => ({ bones: minersBones(crust), hat: true });

/** The Salt-Touched's humans; `level` is the floor their feet find. */
export class TouchedView extends HumanPool<Touched> {
  static async create(seed: number): Promise<TouchedView> {
    return new TouchedView(await figures(POOL, (k) => touchedLook(seed, k), () => 'pick', miner(0.6)));
  }

  private constructor(humans: PoolFigure[]) {
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
