/**
 * Every race side by side, for looking them over (the Lab's `?lab&races`): Actors' ten peoples, a
 * man of each in front and a woman behind, standing idle in a row across the view, all in the same
 * plain travelling clothes (`?lab&races=bones`, `?lab&races=<race>-bones`: as the Salt-Touched's
 * skeletons, in a miner's hat and trousers; `?lab&races=ghosts`, `?lab&races=<race>-ghost`: as ghosts). A `HumanPool` with one figure per place.
 */
import { RACE_IDS, type RaceId } from '@actors/human';
import { deriveSeed } from '@futuremagic/core';
import { HumanPool, figures, type Drawn, type PoolFigure } from '../creatures/humanPool';
import { dressOf, folkLook } from '../actors/looks';
import { miner } from '../creatures/touchedView';
import type { GhostLook } from '../actors/ghost';

/** The same plain travelling clothes on everyone. */
const PLAIN = dressOf([['briefs', [0.6, 0.6, 0.6]], ['longsleeve', [0.3, 0.27, 0.22]], ['wool-pants', [0.18, 0.17, 0.15]], ['cloth-shoes', [0.2, 0.15, 0.1]]]);

/** What the skeletons wear: a miner's work trousers (and his hard hat). */
const RAGS = dressOf([['wool-pants', [0.14, 0.13, 0.13]]]);

/** The ghosts' tint (the elves' silver-blue). */
const GHOST: GhostLook = { tint: [0.7, 0.85, 1], opacity: 0.4 };

/** Metres between them along the row, and between the rows. */
const GAP = 1.15;
const ROWS = 1.6;

export class Lineup {
  readonly pool: HumanPool<Drawn>;
  /** Where each stands (fixed once by `stand`). */
  readonly places: Drawn[] = [];

  /** `only`: just that race, a man and a woman side by side (for a close look); `as`: as skeletons or ghosts. */
  static async create(seed: number, only?: RaceId, as: 'bones' | 'ghost' | null = null): Promise<Lineup> {
    const bones = as === 'bones';
    const races = only ? [only] : RACE_IDS, n = races.length;
    const all = await figures(n * 2, (k) => folkLook(races[k % n], deriveSeed(seed, 'lineup', k), { age: 0.3, female: k >= n }, bones ? RAGS : PLAIN), () => null, bones ? miner(0.6) : as === 'ghost' ? { ghost: GHOST } : {});
    return new Lineup(all, Math.max(...all.map((x) => x.height)), races);
  }

  /** `tallest`: the tallest of them, metres (the Lab looks one race in the eye). */
  private constructor(h: PoolFigure[], readonly tallest: number, readonly races: readonly RaceId[]) {
    this.pool = new HumanPool(h, 200, () => ({ anim: { move: 'idle', mood: 'neutral' }, combat: false }));
  }

  /** Stand them `ahead` metres before (x, z), looking along `yaw` (forward (-sin, -cos)), facing back the other way; `floor(x, z)` is the ground there. One race: the man and the woman side by side. */
  stand(x: number, z: number, yaw: number, ahead: number, floor: (x: number, z: number) => number): void {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = -fz, rz = fx, n = this.races.length;
    this.places.length = 0;
    for (let k = 0; k < 2 * n; k++) {
      const along = n === 1 ? (k - 0.5) * 0.75 : ((k % n) - (n - 1) / 2) * GAP, back = ahead + (n === 1 || k < n ? 0 : ROWS);
      const px = x + fx * back + rx * along, pz = z + fz * back + rz * along;
      this.places.push({ x: px, y: floor(px, pz), z: pz, vx: 0, vz: 0, yaw: yaw + Math.PI, health: 1, dead: false, look: k });
    }
  }
}
