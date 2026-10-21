/**
 * The goblins on screen (src/creatures/goblins.ts): Actors' goblins (small, big-eared, long-nosed,
 * green to ochre skin), in stolen clothes cut down, each with a stolen kitchen knife. They squat in
 * the den, jump up and throw their arms up when they shriek, run at you, jab, flinch when stabbed
 * and fall when they die.
 *
 * A `HumanPool`: the nearest goblins are drawn with it.
 */
import { deriveSeed } from '@futuremagic/core';
import type { CharacterPatch } from '@actors/generator';
import { groundSpeed } from '../../creatures/creature';
import { GOBLIN_FOLK, type Goblin } from '../../creatures/goblins';
import type { ActionAnim, Figure } from '../actors/figure';
import { dressOf, folkLook, type Dress } from '../actors/looks';
import { HumanPool, figures } from './humanPool';

/** How many can be drawn at once, and how far off they are drawn, metres. */
const POOL = 4;
const SHOWN = 45;

/** What the goblins wear: stolen and cut down (a sack-cloth smock, a miner's jacket gone black, a dyed rag). */
const GOBLINS: readonly Dress[] = [
  dressOf([['tunic', [0.34, 0.29, 0.2]], ['wool-pants', [0.2, 0.16, 0.11]]]),
  dressOf([['viking-tunic', [0.12, 0.12, 0.13]], ['wool-pants', [0.16, 0.13, 0.1]]]),
  dressOf([['tunic', [0.4, 0.14, 0.1]], ['wool-pants', [0.22, 0.2, 0.14]], ['cloth-shoes', [0.2, 0.15, 0.1]]]),
];

/** Goblin `k` of the pool, in `dress`. */
export function goblinLook(seed: number, k: number, dress: Dress, what: string): Promise<CharacterPatch> {
  return folkLook('goblin', deriveSeed(seed, what, k), { age: 0.3 + 0.08 * k, female: k === 3 }, dress);
}

export class GoblinView extends HumanPool<Goblin> {
  static async create(seed: number): Promise<GoblinView> {
    return new GoblinView(await figures(POOL, (k) => goblinLook(seed, k, GOBLINS[k % GOBLINS.length], 'goblin'), () => 'knife'));
  }

  private constructor(figures: Figure[]) {
    super(figures, SHOWN, (g, time) => {
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
