/**
 * Every race side by side, for looking them over (the Lab's `?lab&races`): Actors' ten peoples, a
 * man of each in front and a woman behind, standing idle in a row across the view, all in the same
 * plain travelling clothes (`?lab&races=bones`, `?lab&races=<race>-bones`: as the Salt-Touched's
 * skeletons on Scale's bodies, in a miner's hat and trousers). A `HumanPool` with one figure per place.
 */
import { RACE_IDS, randomAppearance, type RaceId } from '@futuremagic/humanoid';
import { deriveSeed } from '@futuremagic/core';
import { HumanPool, figures, humans, type Drawn, type PoolFigure } from '../creatures/humanPool';
import { minersClothes } from './wardrobe';
import { dressOf, folkLook } from '../actors/looks';
import { minersBones } from '../creatures/touchedView';

/** The same plain travelling clothes on everyone. */
const PLAIN = dressOf([['briefs', [0.6, 0.6, 0.6]], ['longsleeve', [0.3, 0.27, 0.22]], ['wool-pants', [0.18, 0.17, 0.15]], ['cloth-shoes', [0.2, 0.15, 0.1]]]);

/** Metres between them along the row, and between the rows. */
const GAP = 1.15;
const ROWS = 1.6;

export class Lineup {
  readonly pool: HumanPool<Drawn>;
  /** Where each stands (fixed once by `stand`). */
  readonly places: Drawn[] = [];

  /** `only`: just that race, a man and a woman side by side (for a close look); `bones`: as skeletons. */
  static async create(seed: number, only?: RaceId, bones = false): Promise<Lineup> {
    const races = only ? [only] : RACE_IDS, n = races.length;
    if (bones) {
      const look = (k: number) => randomAppearance(races[k % n], deriveSeed(seed, 'lineup', k), { age: 0.5, gender: k < n ? 0.95 : 0.05 });
      const old = await humans(n * 2, look, (k) => minersClothes(deriveSeed(seed, 'lineup', 'clothes', k)), { bones: minersBones(0.6) });
      return new Lineup(old, Math.max(...old.map((x) => x.height)), races);
    }
    const all = await figures(n * 2, (k) => folkLook(races[k % n], deriveSeed(seed, 'lineup', k), { age: 0.3, female: k >= n }, PLAIN));
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
