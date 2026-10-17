/**
 * The village's people on screen (src/world/villagers.ts): Scale's humans in their 1966 clothes,
 * young and old, walking the streets, stopping to look about, turned friendly to whoever stands in
 * their way. A `HumanPool` (built before the warm-up: its `figures` go to `view.start`) draws the
 * nearest of them.
 */
import { randomAppearance, type HumanoidAppearance } from '@futuremagic/humanoid';
import { HumanPool, humans } from '../creatures/humanPool';
import { VILLAGERS, townsfolkSeed, type Villager } from '../../world/villagers';
import { townsfolksClothes } from './wardrobe';

/** How far off they are drawn, metres (the nearest `VILLAGERS.looks` of them). */
const SHOWN = 70;

/** The townsfolk's looks, the same every game: their ages and which are women. */
const AGES = [0.4, 0.7, 0.3, 0.85, 0.5, 0.6];
const WOMEN = [false, false, true, true, true, false];

function townsfolk(k: number): HumanoidAppearance {
  return randomAppearance('human', townsfolkSeed(k, 'look'), { age: AGES[k % AGES.length], gender: WOMEN[k % WOMEN.length] ? 0.12 : 0.88 });
}

/** The pool that draws the village's people: one human of each look, walking or standing about. */
export async function townsfolkPool(): Promise<HumanPool<Villager>> {
  const dressed = await humans(VILLAGERS.looks, townsfolk, (k) => townsfolksClothes(townsfolkSeed(k, 'clothes'), k));
  return new HumanPool<Villager>(dressed, SHOWN, (v) => ({
    anim: { move: v.walking ? 'walk' : 'idle', mood: v.waiting ? 'happy' : 'neutral' },
    combat: false,
  }));
}
