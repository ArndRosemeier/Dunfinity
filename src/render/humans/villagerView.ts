/**
 * The village's people on screen (src/world/villagers.ts): Actors figures in today's clothes,
 * young and old, walking the streets, stopping to look about, turned friendly to whoever stands in
 * their way. A `HumanPool` (built before the warm-up: its `figures` go to `view.start`) draws the
 * nearest of them.
 */
import { HumanPool } from '../creatures/humanPool';
import { Figure } from '../actors/figure';
import { personOfToday } from '../actors/looks';
import { VILLAGERS, townsfolkSeed, type Villager } from '../../world/villagers';

/** How far off they are drawn, metres (the nearest `VILLAGERS.looks` of them). */
const SHOWN = 70;

/** The townsfolk's looks, the same every game: their ages and which are women. */
const AGES = [0.4, 0.7, 0.3, 0.85, 0.5, 0.6];
const WOMEN = [false, false, true, true, true, false];

/** The pool that draws the village's people: one figure of each look, walking or standing about. */
export async function townsfolkPool(): Promise<HumanPool<Villager>> {
  const figures: Figure[] = [];
  for (let k = 0; k < VILLAGERS.looks; k++) {
    figures.push(await Figure.load(await personOfToday(townsfolkSeed(k, 'look'), { age: AGES[k % AGES.length], female: WOMEN[k % WOMEN.length] })));
  }
  return new HumanPool<Villager>(figures, SHOWN, (v) => ({
    anim: { move: v.walking ? 'walk' : 'idle', mood: v.waiting ? 'happy' : 'neutral' },
    combat: false,
  }));
}
