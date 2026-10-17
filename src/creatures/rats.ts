/**
 * Quarry rats (docs/design/town-and-first-strata.md §5: levels 1–4, "individually pathetic, together
 * not"): the first enemy. They live in nests scattered over the floor of the workings, a few to a
 * nest; near you they wake up, sniff about and scurry round their nest. Come too close, or hurt one,
 * and the whole nest comes for you: they run faster than you walk (but not than you sprint), spread
 * round you and bite. They cannot climb, so a ledge saves you. A badly hurt rat may bolt for a moment.
 *
 * The town above has rats too (Arnd 2026-10-17): ordinary ones (`new Rats(level, true)`), a few to
 * a hole along the house walls of the village. They pay you no mind, scurry off when you come right
 * up to them, and bolt from a blow; they drop no salt (src/loot/tin.ts).
 *
 * How they act is the one mind every animal lives by (src/creatures/animals.ts): a quarry rat is
 * an aggressive little swarmer that rears up when it sees you, a town rat only ever flees; between
 * it all they feed and sleep (src/creatures/life.ts). They shun the Sunday candles.
 *
 * Pure: positions on the level's floor, blows through src/combat. Nests are fixed by the seed; the
 * rats of a nest exist only while you are near it, and the ones you killed stay dead on this visit.
 */
import type { Den } from './population';
import type { Level } from '../gen/level';
import { Animal, Animals, type Nature } from './animals';
import type { Temper } from './temper';
import { VILLAGE, nearestHouse, townGround } from '../gen/town';

export const RAT = {
  /** Body radius and height at size 1, metres. */
  radius: 0.2,
  height: 0.32,
  health: 14,
  /** Speeds, metres per second: pottering about, and running at you (you walk 4.2 and sprint 7). */
  walk: 1.2,
  run: 4.8,
  /** They notice you this close (closer when you sneak about in the dark later); give up beyond `forget`. */
  notice: 9,
  forget: 26,
  /** Seconds it leaves you be after giving up on getting at you (you stand up a ledge it cannot take). */
  balk: 8,
  /** A bite: reach beyond touching, damage, seconds between bites, and the wind-up before the snap. */
  biteReach: 0.35,
  biteDamage: [2, 4] as const,
  biteEvery: 1.6,
  windup: 0.3,
  /** The bite as motion: backing off in the wind-up and the lunge of the snap, m/s; how long the lunge lasts, s. */
  rear: 0.5,
  lunge: 2.2,
  lungeT: 0.12,
  /** On noticing you: up on the hind legs a moment before the charge, s (plus a stagger per rat). */
  alert: 0.45,
  /** Arriving: slow down within `arrive` metres of where it is going, and stop within `still`. */
  arrive: 0.35,
  still: 0.06,
  /** Nests: cell size, chance per cell (rising a little with depth), none this close to the arrival, rats per nest, how far they roam. */
  cell: 36,
  chance: 0.42,
  quiet: 16,
  count: [3, 6] as const,
  roam: 5,
  /** Nests come alive within `wake` metres of you and go back to sleep beyond `sleep`. */
  wake: 50,
  sleep: 70,
  /** A step up a rat can take (it scrambles up a knee-high ledge); a drop it will not take, metres. */
  step: 0.8,
  drop: 1.6,
} as const;

/** The town's ordinary rats: holes per cell along the house walls (within `wall` metres of one), how close you come before one scurries off, metres. */
export const TOWN_RAT = { ...RAT, cell: 30, chance: 0.35, quiet: 12, count: [2, 4] as const, roam: 3, wall: [0.3, 2.5] as const, shy: 2.6, wake: 45, sleep: 60 } as const;

/** A quarry rat as the animal mind sees it: aggressive, a swarmer, rears up before it comes; shy and quick. */
const RAT_TEMPER: Temper = { pace: 'dart', flock: 'scatter', curious: -0.3, alarm: 'bolt', nerve: 0.6, bluff: true, habit: 'none', lamp: 'none', strategy: 'swarm', diet: 'floor' };
export const RAT_NATURE: Nature = {
  aggression: 0.7, peaceful: false, temper: RAT_TEMPER, role: 'scuttler', mass: 0.4, totalLength: 0.45, walkSpeed: RAT.walk, runSpeed: RAT.run,
  strike: 'bite', habit: '', cause: 'rat', power: () => ({ health: RAT.health, blow: (RAT.biteDamage[0] + RAT.biteDamage[1]) / 2 }),
};
/** A town rat: the same animal, only ever fleeing. */
export const TOWN_RAT_NATURE: Nature = { ...RAT_NATURE, aggression: 0.1, peaceful: true, temper: { ...RAT_TEMPER, curious: -0.1, bluff: false } };

export interface Nest extends Den {
  readonly y: number;
  readonly count: number;
}

export class Rat extends Animal<Nest> {
  constructor(id: number, nest: Nest, x: number, y: number, z: number, yaw: number, size: number, readonly slot: number, nature: Nature) {
    super(id, nest, nature, x, y, z, yaw, size, RAT.radius * size, RAT.height * size);
  }

  get nest(): Nest { return this.den; }
}

export class Rats extends Animals<Nest, Rat> {
  private readonly chance: number;

  /** `town`: the town's ordinary rats (only on level 0), not the quarry's. */
  constructor(level: Level, readonly town = false) {
    super(level, town ? 'town-rats' : 'rats', town ? TOWN_RAT : RAT, { arrive: RAT.arrive, still: RAT.still, step: RAT.step, drop: RAT.drop, accel: 10, turn: 12, face: 15 });
    if (town) this.chance = level.depth ? 0 : TOWN_RAT.chance;
    else this.chance = level.depth ? Math.min(0.8, RAT.chance + 0.08 * (level.depth - 1)) : 0; // (none in grandma's cellar)
    this.apart = 1;
  }

  protected hatch(nest: Nest, killed: (id: number) => boolean): Rat[] {
    return this.brood(nest, 'nest', 16, 0.3, 2.5, killed, (id, x, y, z, rng, k) => {
      const size = rng.range(0.85, 1.25), yaw = rng.range(0, Math.PI * 2), r = new Rat(id, nest, x, y, z, yaw, size, k, this.natureIn(nest));
      r.t = rng.range(0.5, 3);
      return r;
    });
  }

  /** Where in cell (i, j) a nest is, if any: open, dry floor, away from the arrival and the shafts. */
  protected denIn(key: number, i: number, j: number): Nest | null {
    if (this.town) return this.holeIn(key, i, j);
    for (const [x, z] of this.sites(i, j, this.chance)) {
      const col = this.level.columnAt(x, z);
      if (col.pillarD < 2 || col.wall < 2) continue;
      const y = this.floorFor(x, z, 0.6, 0.4);
      if (y !== null) return { key, x, z, y, count: this.countIn(i, j, RAT.count) };
    }
    return null;
  }

  /** A town rats' hole in cell (i, j), if any: on the open ground of the village, close along a house wall. */
  private holeIn(key: number, i: number, j: number): Nest | null {
    const V = VILLAGE.spec, [near, far] = TOWN_RAT.wall;
    for (const [x, z] of this.sites(i, j, this.chance)) {
      if (Math.hypot(x - V.x, z - V.z) > V.r) continue;
      const y = townGround(x, z).y, d = nearestHouse(x, y + 0.3, z).d;
      if (d < near || d > far || this.level.sdf(x, y + 0.6, z) < 0.3) continue;
      return { key, x, z, y, count: this.countIn(i, j, TOWN_RAT.count) };
    }
    return null;
  }

  protected natureIn(_nest: Nest): Nature {
    return this.town ? TOWN_RAT_NATURE : RAT_NATURE;
  }
}
