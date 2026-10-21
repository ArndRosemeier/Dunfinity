/**
 * The ghosts of the old races on screen (src/creatures/ghosts.ts): Actors' dwarves and elves,
 * made ghosts (src/render/actors/ghost.ts) (seen through, glowing at the rim, no
 * shadow): the dwarves a pale gold, the elves a pale silver-blue. They walk their beat, stand and
 * turn to you, talk, and fade away. A slow flicker runs through them while they are there.
 *
 * Two `HumanPool`s (a ghost keeps its own race's body): the nearest of each are drawn.
 */
import type { CharacterPatch } from '@actors/generator';
import { deriveSeed } from '@futuremagic/core';
import type { Object3D } from 'three/webgpu';
import { groundSpeed } from '../../creatures/creature';
import { GHOST, type Ghost, type GhostRace } from '../../creatures/ghosts';
import { dressOf, folkLook, type Dress } from '../actors/looks';
import type { GhostLook } from '../actors/ghost';
import { HumanPool, figures, type PoolFigure } from './humanPool';

/** How many of each race can be drawn at once, and how far off, metres. */
const POOL = 2;
const SHOWN = 50;

const LOOK: Record<GhostRace, GhostLook> = {
  dwarf: { tint: [0.95, 0.8, 0.5], opacity: 0.4 },
  elf: { tint: [0.7, 0.85, 1], opacity: 0.4 },
};

/** What the ghosts wear (seen through, in their tint): a dwarf's work clothes and boots, an elf's pale tunic and trousers. */
const DRESS: Record<GhostRace, Dress> = {
  dwarf: dressOf([['briefs', [0.3, 0.3, 0.3]], ['tunic', [0.3, 0.26, 0.2]], ['wool-pants', [0.22, 0.2, 0.17]], ['work-boots', [0.2, 0.15, 0.1]]]),
  elf: dressOf([['briefs', [0.6, 0.6, 0.6]], ['tunic', [0.7, 0.72, 0.76]], ['wool-pants', [0.62, 0.64, 0.7]], ['cloth-shoes', [0.55, 0.57, 0.62]]]),
};

/** A ghost's look: one of its race, in its race's clothes. */
export function ghostLook(seed: number, race: GhostRace, k: number): Promise<CharacterPatch> {
  return folkLook(race, deriveSeed(seed, 'ghost', race, k), { age: race === 'dwarf' ? 0.7 : 0.5, female: k === 1 }, DRESS[race]);
}

class GhostPool extends HumanPool<Ghost> {
  constructor(humans: PoolFigure[]) {
    super(humans, SHOWN, (g, time) => {
      const moving = groundSpeed(g) > 0.1;
      const action = g.mode === 'speak' ? { id: 'talk', t0: time - g.t, dur: GHOST.speaking } : undefined;
      return { anim: { move: moving ? 'walk' : 'idle', action, mood: g.mode === 'speak' ? 'sad' : 'neutral', talking: g.mode === 'speak' }, combat: false };
    }, 0, (g, time) => g.shown * (0.85 + 0.15 * Math.sin(time * 1.7 + g.id)));
  }
}

export class GhostView {
  static async create(seed: number): Promise<GhostView> {
    const pool = async (race: GhostRace) => new GhostPool(await figures(POOL, (k) => ghostLook(seed, race, k), () => null, { ghost: LOOK[race] }));
    return new GhostView(await pool('dwarf'), await pool('elf'));
  }

  private constructor(readonly dwarves: GhostPool, readonly elves: GhostPool) {}

  /** What goes into the scene (`stage.add`). */
  get roots(): Object3D[] {
    return [this.dwarves.root, this.elves.root];
  }

  /** The humans, for the warm-up (`stage.warmUp(extra)`). */
  get figures(): Object3D[] {
    return [...this.dwarves.figures, ...this.elves.figures];
  }

  set level(l: HumanPool<Ghost>['level']) {
    this.dwarves.level = this.elves.level = l;
  }

  /** Draw the ghosts nearest (px, pz); the gone are not drawn. */
  draw(list: readonly Ghost[], px: number, pz: number, dt: number, time: number): void {
    const here = list.filter((g) => !g.dead);
    this.dwarves.draw(here.filter((g) => g.race === 'dwarf'), px, pz, dt, time);
    this.elves.draw(here.filter((g) => g.race === 'elf'), px, pz, dt, time);
  }
}
