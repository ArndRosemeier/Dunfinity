/**
 * Quarry rats (docs/design/town-and-first-strata.md §5: levels 1–4, "individually pathetic, together
 * not"): the first enemy. They live in nests scattered over the floor of the workings, a few to a
 * nest; near you they wake up, sniff about and scurry round their nest. Come too close, or hurt one,
 * and the whole nest comes for you: they run faster than you walk (but not than you sprint), spread
 * round you and bite. They cannot climb, so a ledge saves you. A badly hurt rat may bolt for a moment.
 *
 * Pure: positions on the level's floor, blows through src/combat. Nests are fixed by the seed; the
 * rats of a nest exist only while you are near it, and the ones you killed stay dead on this visit.
 */
import { angleDiff } from '@futuremagic/core';
import { Creature } from './creature';
import { Population, type Den } from './population';
import type { Level } from '../gen/level';
import { damage, type Fighter } from '../combat/combat';
import { CANDLE } from '../combat/thrown';

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

export type RatMode = 'sniff' | 'scurry' | 'alert' | 'chase' | 'bite' | 'flee' | 'dead';

export interface Nest extends Den {
  readonly y: number;
  readonly count: number;
  /** The nest is up in arms (one of them was hurt, or it saw you). */
  alarmed: boolean;
}

export class Rat extends Creature<RatMode> {
  /** Seconds left in the current mode (sniff, scurry, flee) or of the bite. */
  t = 0;
  /** Gait phase (radians), advanced by distance travelled. */
  gait = 0;
  /** What it flees from: a Sunday candle at (fx, fz), or (NaN) you. */
  fx = NaN;
  fz = NaN;
  /** Seconds since the last bite started (the snap is at RAT.windup). */
  biteT = 9;
  /** Where it is going (scurrying about). */
  tx: number;
  tz: number;

  constructor(readonly id: number, readonly nest: Nest, x: number, y: number, z: number, yaw: number, readonly size: number, readonly slot: number) {
    super(x, y, z, yaw, RAT.radius * size, RAT.height * size, RAT.health, 'sniff');
    this.tx = x; this.tz = z;
  }
}

export class Rats extends Population<Nest, Rat> {
  private readonly chance: number;

  constructor(level: Level) {
    super(level, 'rats', RAT, { arrive: RAT.arrive, still: RAT.still, step: RAT.step, drop: RAT.drop, accel: 10, turn: 12, face: 15 });
    this.chance = Math.min(0.8, RAT.chance + 0.08 * (level.depth - 1));
    this.apart = 1;
  }

  protected hatch(nest: Nest, killed: (id: number) => boolean): Rat[] {
    return this.brood(nest, 'nest', 16, 0.3, 2.5, killed, (id, x, y, z, rng, k) => {
      const size = rng.range(0.85, 1.25), yaw = rng.range(0, Math.PI * 2), r = new Rat(id, nest, x, y, z, yaw, size, k);
      r.t = rng.range(0.5, 3);
      return r;
    });
  }


  /** Gone back into their holes: calm again. */
  protected sleep(nest: Nest): void {
    nest.alarmed = false;
  }

  /** Where in cell (i, j) a nest is, if any: open, dry floor, away from the arrival and the shafts. */
  protected denIn(key: number, i: number, j: number): Nest | null {
    for (const [x, z] of this.sites(i, j, this.chance)) {
      const col = this.level.columnAt(x, z);
      if (col.pillarD < 2 || col.wall < 2) continue;
      const y = this.floorFor(x, z, 0.6, 0.4);
      if (y !== null) return { key, x, z, y, count: this.countIn(i, j, RAT.count), alarmed: false };
    }
    return null;
  }

  // ------------------------------------------------------------------ behaviour

  /** One rat's step; returns 1 if it bit. */
  protected act(r: Rat, prey: Fighter, _ctx: null, dt: number): number {
    r.biteT += dt;
    const provoked = r.provoked;
    r.provoked = false;
    if (provoked) r.nest.alarmed = true;
    if (r.dead) return this.lieDead(r, dt, 6);
    const dx = prey.x - r.x, dz = prey.z - r.z, d = Math.hypot(dx, dz);
    const sees = !prey.dead && d < RAT.notice && Math.abs(prey.y - r.y) < 2.5;
    if (sees && r.mode !== 'chase' && r.mode !== 'bite' && r.mode !== 'flee') r.nest.alarmed = true;
    const hunting = r.nest.alarmed && !prey.dead && d < RAT.forget && Math.abs(prey.y - r.y) < 4;
    if (!hunting && (r.mode === 'chase' || r.mode === 'bite')) { r.mode = 'scurry'; r.t = 0; r.nest.alarmed = r.nest.alarmed && !prey.dead && d < RAT.forget; }
    if (hunting && (r.mode === 'sniff' || r.mode === 'scurry')) { r.mode = 'alert'; r.t = RAT.alert + (r.slot % 3) * 0.12; }
    // Badly hurt: now and then it bolts for a moment.
    if (provoked && r.health < RAT.health * 0.4 && this.rng.chance(0.5)) { r.mode = 'flee'; r.t = this.rng.range(1.2, 2.2); r.fx = NaN; }
    // A Sunday candle: it runs from the light, whatever it was doing.
    const glare = r.mode === 'flee' ? null : this.glaring(r, CANDLE.shun);
    if (glare) { r.mode = 'flee'; r.t = this.rng.range(1.2, 1.8); r.fx = glare.x; r.fz = glare.z; }

    let speed = 0, gx = r.x, gz = r.z, bit = 0;
    switch (r.mode) {
      case 'sniff':
        if ((r.t -= dt) <= 0) {
          // Off somewhere near the nest.
          [r.tx, r.tz] = this.roamFrom(r.nest, RAT.roam);
          r.mode = 'scurry'; r.t = 4;
        }
        break;
      case 'scurry':
        gx = r.tx; gz = r.tz; speed = RAT.walk * (1 + 0.6 * Math.max(0, Math.sin(r.gait * 0.13)));
        if ((r.t -= dt) <= 0 || Math.hypot(r.tx - r.x, r.tz - r.z) < 0.3) { r.mode = 'sniff'; r.t = this.rng.range(0.8, 3.5); }
        break;
      case 'flee':
        if (Number.isNaN(r.fx)) { gx = r.x - dx; gz = r.z - dz; } else { gx = 2 * r.x - r.fx; gz = 2 * r.z - r.fz; }
        speed = RAT.run;
        if ((r.t -= dt) <= 0) r.mode = hunting ? 'chase' : 'sniff';
        break;
      case 'alert':
        // Up on the hind legs, nose to you; then the charge.
        if ((r.t -= dt) <= 0) r.mode = 'chase';
        break;
      case 'chase': {
        // Spread round the prey, each rat to its own place, far enough apart not to shove each other.
        // The places hang off the bearing of the nest (not of the rat itself: a goal that turns as
        // the rat moves is chased round and round).
        const ring = prey.radius + r.radius + 0.1;
        const a = Math.atan2(r.nest.z - prey.z, r.nest.x - prey.x) + (r.slot - (r.nest.count - 1) / 2) * ((2 * r.radius + 0.14) / ring);
        gx = prey.x + Math.cos(a) * ring; gz = prey.z + Math.sin(a) * ring;
        speed = RAT.run;
        if (d - prey.radius - r.radius < RAT.biteReach && r.biteT > RAT.biteEvery) { r.mode = 'bite'; r.biteT = 0; }
        break;
      }
      case 'bite': {
        // Rear back in the wind-up, then lunge in with the snap, and hang on a moment.
        const ux = dx / (d || 1), uz = dz / (d || 1);
        if (r.biteT < RAT.windup) { r.vx = -ux * RAT.rear; r.vz = -uz * RAT.rear; }
        else if (r.biteT < RAT.windup + RAT.lungeT) { r.vx = ux * RAT.lunge; r.vz = uz * RAT.lunge; }
        if (r.biteT >= RAT.windup && r.biteT - dt < RAT.windup && d - prey.radius - r.radius < RAT.biteReach + 0.25 && Math.abs(prey.y - r.y) < 1.2) {
          damage(prey, this.rng.range(RAT.biteDamage[0], RAT.biteDamage[1]), r.x, r.z, 0.6, 'rat');
          bit = 1;
        }
        if (r.biteT > RAT.windup + 0.35) r.mode = 'chase';
        break;
      }
    }
    const faceYou = r.mode === 'bite' || r.mode === 'alert' || (r.mode === 'chase' && Math.hypot(gx - r.x, gz - r.z) < RAT.arrive);
    if (r.mode === 'bite') {
      r.yaw += angleDiff(r.yaw, Math.atan2(-dx, -dz)) * Math.min(1, dt * 15);
      this.slide(r, dt);
    } else r.gait += this.steer.move(r, gx, gz, speed, dt, faceYou ? Math.atan2(-dx, -dz) : null) / (0.09 * r.size);
    return bit;
  }

  /** Move by the velocity where the floor allows; the gait follows the distance. */
  private slide(r: Rat, dt: number): void {
    r.gait += this.steer.slide(r, dt) / (0.09 * r.size);
  }
}
