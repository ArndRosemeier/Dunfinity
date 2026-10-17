/**
 * Feral dogs (docs/design/town-and-first-strata.md §5: levels 6–8, "packs in the bunker, flank"):
 * gaunt dogs gone wild in the dark, in packs of three to five lying up in dry corners of the
 * Cisterns. Once they have seen you the pack does not rush you: it flanks (a fighting style any
 * animal may have, src/creatures/temper.ts): it spreads out on a ring round you and circles, and
 * one at a time the dog furthest behind your back crouches (the tell), lunges in, bites and springs
 * back to its place. Turn to face them and they circle on round you.
 *
 * The town above has dogs too (Arnd 2026-10-17): ordinary village dogs (`new Dogs(level, true)`),
 * two or three to a farmyard or a corner of the lanes, lying about and trotting round, curious
 * about you. They let you be. Hit one and its lot turns on you, until it has calmed down; a badly
 * hurt one runs from you instead. They drop no salt (src/loot/tin.ts).
 *
 * How they act is the one mind every animal lives by (src/creatures/animals.ts): between it all
 * they drink, feed and lie down with their pack (src/creatures/life.ts).
 *
 * Pure: floor walking with src/creatures/steer.ts, bites through src/combat. Packs are fixed by the
 * seed; the dead stay dead on this visit.
 */
import type { Level } from '../gen/level';
import type { Den } from './population';
import { Animal, Animals, type Nature } from './animals';
import type { Temper } from './temper';
import { rockDistance } from '../gen/quarry';
import { VILLAGE, nearestHouse, townGround } from '../gen/town';

export const DOG = {
  /** Body radius and height at size 1, metres; health and a bite's damage at size 1. */
  radius: 0.3,
  height: 0.75,
  health: 20,
  bite: 6.5,
  /** Speeds, m/s: trotting about the den, and running (you walk 4.2 and sprint 7). */
  trot: 1.6,
  run: 6.2,
  /** Dens: cell size, chance per cell (band.dogs), none this close to the arrival, dogs per pack, how far they wander. */
  cell: 60,
  quiet: 30,
  count: [3, 5] as const,
  roam: 4,
  wake: 60,
  sleep: 85,
} as const;

/** The town's village dogs: places per cell (on open ground at least `clear` metres from the houses), dogs to a place; gentler bites than the feral ones. */
export const TOWN_DOG = { ...DOG, cell: 50, chance: 0.4, quiet: 20, count: [1, 3] as const, roam: 6, clear: 2.5, bite: 4.5, wake: 55, sleep: 75 } as const;

/** A feral dog as the animal mind sees it: it comes for you, as a pack that flanks you; it drinks at the water. */
const DOG_TEMPER: Temper = { pace: 'steady', flock: 'cluster', curious: -0.1, alarm: 'bunch', nerve: 0.7, bluff: false, habit: 'none', lamp: 'none', strategy: 'flank', diet: 'water' };
export const DOG_NATURE: Nature = {
  aggression: 0.85, peaceful: false, temper: DOG_TEMPER, role: 'hunter', mass: 22, totalLength: 1.1, walkSpeed: DOG.trot, runSpeed: DOG.run,
  strike: 'bite', habit: '', cause: 'dog', power: (size) => ({ health: DOG.health * size, blow: DOG.bite * size }),
};
/** A village dog: the same animal, curious about you, fighting back when hit (and only then). */
export const TOWN_DOG_NATURE: Nature = {
  ...DOG_NATURE, aggression: 0.4, peaceful: true, temper: { ...DOG_TEMPER, curious: 0.5 }, role: 'grazer', cause: 'village dog',
  power: (size) => ({ health: DOG.health * size, blow: TOWN_DOG.bite * size }),
};

export interface Pack extends Den {
  readonly y: number;
  readonly count: number;
}

export class Dog extends Animal<Pack> {
  constructor(id: number, pack: Pack, x: number, y: number, z: number, yaw: number, size: number, nature: Nature) {
    super(id, pack, nature, x, y, z, yaw, size, DOG.radius * size, DOG.height * size);
  }

  get pack(): Pack { return this.den; }
}

export class Dogs extends Animals<Pack, Dog> {
  /** `town`: the town's village dogs (only on level 0), not the feral packs of the deep. */
  constructor(level: Level, readonly town = false) {
    super(level, town ? 'town-dogs' : 'dogs', town ? TOWN_DOG : DOG, { arrive: 0.5, still: 0.08, step: 0.6, drop: 1.4, accel: 12, turn: 9, face: 10 });
    this.apart = 1.1;
  }

  protected denIn(key: number, i: number, j: number): Pack | null {
    if (this.town) return this.yardIn(key, i, j);
    for (const [x, z] of this.sites(i, j, this.level.band.dogs)) {
      const col = this.level.columnAt(x, z);
      if (rockDistance(col) < 1.5 || rockDistance(col) > 6 || col.collapse > 0) continue;
      const y = this.floorFor(x, z, 1.2, 0.8);
      if (y !== null) return { key, x, z, y, count: this.countIn(i, j, DOG.count) };
    }
    return null;
  }

  /** A village dogs' place in cell (i, j), if any: open ground in the village, clear of the houses. */
  private yardIn(key: number, i: number, j: number): Pack | null {
    if (this.level.depth) return null;
    const V = VILLAGE.spec;
    for (const [x, z] of this.sites(i, j, TOWN_DOG.chance)) {
      if (Math.hypot(x - V.x, z - V.z) > V.r) continue;
      const y = townGround(x, z).y;
      if (nearestHouse(x, y + 0.5, z).d < TOWN_DOG.clear || this.level.sdf(x, y + 1.2, z) < 0.8) continue;
      return { key, x, z, y, count: this.countIn(i, j, TOWN_DOG.count) };
    }
    return null;
  }

  protected hatch(p: Pack, killed: (id: number) => boolean): Dog[] {
    return this.brood(p, 'pack', 8, 0.6, 2.5, killed, (id, x, y, z, rng) => {
      const size = rng.range(0.85, 1.15), yaw = rng.range(0, Math.PI * 2), d = new Dog(id, p, x, y, z, yaw, size, this.natureIn(p));
      d.t = rng.range(1, 6);
      return d;
    });
  }

  protected natureIn(_p: Pack): Nature {
    return this.town ? TOWN_DOG_NATURE : DOG_NATURE;
  }
}
