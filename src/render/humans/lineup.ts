/**
 * Every race side by side, for looking them over (the Lab's `?lab&races`): Norgo's ten races on
 * Scale's bodies, a man of each in front and a woman behind, standing idle in a row across the view,
 * all in the same plain clothes. A `HumanPool` with one human per place.
 */
import { RACE_IDS, randomAppearance, type RaceId } from '@futuremagic/humanoid';
import { deriveSeed } from '@futuremagic/core';
import { HumanPool, humans, type Drawn } from '../creatures/humanPool';
import { travellersClothes } from './wardrobe';

/** Metres between them along the row, and between the rows. */
const GAP = 1.15;
const ROWS = 1.6;

export class Lineup {
  readonly pool: HumanPool<Drawn>;
  /** Where each stands (fixed once by `stand`). */
  readonly places: Drawn[] = [];

  /** `only`: just that race, a man and a woman side by side (for a close look). */
  static async create(seed: number, only?: RaceId): Promise<Lineup> {
    const races = only ? [only] : RACE_IDS, n = races.length;
    const look = (k: number) => randomAppearance(races[k % n], deriveSeed(seed, 'lineup', k), { age: 0.5, gender: k < n ? 0.95 : 0.05 });
    return new Lineup(await humans(n * 2, look, (k) => travellersClothes(deriveSeed(seed, 'lineup', 'clothes', k))), races);
  }

  /** The tallest of them, metres (the Lab looks one race in the eye). */
  readonly tallest: number;

  private constructor(h: Awaited<ReturnType<typeof humans>>, readonly races: readonly RaceId[]) {
    this.tallest = Math.max(...h.map((x) => x.height));
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
