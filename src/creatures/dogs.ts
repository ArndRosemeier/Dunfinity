/**
 * Feral dogs (docs/design/town-and-first-strata.md §5: levels 6–8, "packs in the bunker, flank"):
 * gaunt dogs gone wild in the dark, in packs of three to five lying up in dry corners of the
 * Cisterns. Once they have seen you the pack does not rush you: it spreads out on a ring round you
 * and circles, and one at a time the dog furthest behind your back crouches (the tell), lunges in,
 * bites and springs back to its place. Turn to face them and they circle on round you.
 *
 * The town above has dogs too (Arnd 2026-10-17): ordinary village dogs (`new Dogs(level, true)`),
 * two or three to a farmyard or a corner of the lanes, lying about and trotting round. They let
 * you be. Hit one and its lot turns on you as a pack does, until it has calmed down (`TOWN_DOG.calm`
 * after the last blow) or you are well off; a badly hurt one runs from you instead. They drop no
 * salt (src/loot/tin.ts).
 *
 * Pure: floor walking with src/creatures/steer.ts, bites through src/combat. Packs are fixed by the
 * seed; the dead stay dead on this visit.
 */
import { angleDiff } from '@futuremagic/core';
import type { Level } from '../gen/level';
import { damage, type Fighter, noticed } from '../combat/combat';
import { Creature } from './creature';
import { Population, type Den } from './population';
import { brake } from './steer';
import { rockDistance } from '../gen/quarry';
import { VILLAGE, nearestHouse, townGround } from '../gen/town';

export const DOG = {
  /** Body radius and height at size 1, metres; health. */
  radius: 0.3,
  height: 0.75,
  health: 20,
  /** Speeds, m/s: trotting about the den, and running (you walk 4.2 and sprint 7). */
  trot: 1.6,
  run: 6.2,
  /** They see you this close; give up beyond `forget`. */
  notice: 18,
  forget: 36,
  /** The ring they circle you on, metres from you; how fast it turns round you, radians per second. */
  ring: 4.2,
  drift: 0.3,
  /**
   * A lunge: the crouch before it (the tell), the lunge's speed and longest time, the bite's reach
   * beyond touching, damage, how long it hangs on after a bite (in reach of your knife), the spring
   * back, and the pack's pause between lunges, s.
   */
  crouch: 0.45,
  lunge: 8,
  lungeT: 0.45,
  reach: 0.45,
  damage: [5, 8] as const,
  hold: 0.5,
  back: 0.6,
  every: 2,
  /** Dens: cell size, chance per cell (band.dogs), none this close to the arrival, dogs per pack, how far they wander. */
  cell: 60,
  quiet: 30,
  count: [3, 5] as const,
  roam: 4,
  wake: 60,
  sleep: 85,
} as const;

/**
 * The town's village dogs: places per cell (on open ground at least `clear` metres from the houses),
 * dogs to a place; they calm down this long after the last blow, s, and run from you hurt below
 * this share of their health. Gentler bites than the feral ones.
 */
export const TOWN_DOG = { ...DOG, cell: 50, chance: 0.4, quiet: 20, count: [1, 3] as const, roam: 6, clear: 2.5, calm: 12, cowed: 0.35, damage: [3, 6] as const, wake: 55, sleep: 75 } as const;

export type DogMode = 'rest' | 'trot' | 'circle' | 'crouch' | 'lunge' | 'back' | 'flee' | 'dead';

export class Dog extends Creature<DogMode> {
  /** Seconds in the mode (crouch, lunge, back), or left of it (rest, trot). */
  t = 0;
  /** Gait phase (radians), advanced by distance travelled. */
  gait = 0;
  /** Where it trots to. */
  tx: number;
  tz: number;
  /** It bit in this lunge. */
  bit = false;

  constructor(readonly id: number, readonly pack: Pack, x: number, y: number, z: number, yaw: number, readonly size: number) {
    super(x, y, z, yaw, DOG.radius * size, DOG.height * size, DOG.health * size, 'rest');
    this.tx = x; this.tz = z;
  }

  /** It is after you. */
  get hunting(): boolean {
    return this.pack.hunting && !this.dead;
  }
}

export interface Pack extends Den {
  readonly y: number;
  readonly count: number;
  /** The pack has seen you (or one of them was hurt): it circles you. */
  hunting: boolean;
  /** Where on the ring the pack is (radians), turning slowly. */
  angle: number;
  /** Seconds until the next one may lunge; which one it is (its id; -1: none chosen). */
  gap: number;
  next: number;
  /** Village dogs: seconds until they have calmed down after the last blow. */
  calm?: number;
}

export class Dogs extends Population<Pack, Dog, number> {
  private readonly D: typeof DOG | typeof TOWN_DOG;

  /** `town`: the town's village dogs (only on level 0), not the feral packs of the deep. */
  constructor(level: Level, readonly town = false) {
    super(level, town ? 'town-dogs' : 'dogs', town ? TOWN_DOG : DOG, { arrive: 0.5, still: 0.08, step: 0.6, drop: 1.4, accel: 12, turn: 9, face: 10 });
    this.D = town ? TOWN_DOG : DOG;
    this.apart = 1.1;
  }

  protected denIn(key: number, i: number, j: number): Pack | null {
    if (this.town) return this.yardIn(key, i, j);
    for (const [x, z] of this.sites(i, j, this.level.band.dogs)) {
      const col = this.level.columnAt(x, z);
      if (rockDistance(col) < 1.5 || rockDistance(col) > 6 || col.collapse > 0) continue;
      const y = this.floorFor(x, z, 1.2, 0.8);
      if (y !== null) return { key, x, z, y, count: this.countIn(i, j, DOG.count), hunting: false, angle: 0, gap: 0, next: -1 };
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
      return { key, x, z, y, count: this.countIn(i, j, TOWN_DOG.count), hunting: false, angle: 0, gap: 0, next: -1, calm: 0 };
    }
    return null;
  }

  protected hatch(p: Pack, killed: (id: number) => boolean): Dog[] {
    return this.brood(p, 'pack', 8, 0.6, 2.5, killed, (id, x, y, z, rng) => {
      const size = rng.range(0.85, 1.15), yaw = rng.range(0, Math.PI * 2), d = new Dog(id, p, x, y, z, yaw, size);
      d.t = rng.range(1, 6);
      return d;
    });
  }


  /** Out of sight, the pack settles again. */
  protected sleep(p: Pack): void {
    p.hunting = false;
  }

  /** The pack's living, in a fixed order (their places on the ring). */
  private living(p: Pack): Dog[] {
    return this.list.filter((d) => d.pack === p && !d.dead);
  }

  /**
   * Once per step per pack (on its first living dog): turn the ring, count down the pause, and when
   * it is over choose who lunges next: the one furthest behind your back.
   */
  private lead(p: Pack, pack: Dog[], prey: Fighter, facing: number, dt: number): void {
    p.angle += DOG.drift * dt;
    p.gap -= dt;
    if (p.gap > 0 || pack.some((d) => d.mode === 'crouch' || d.mode === 'lunge' || d.mode === 'back')) return;
    let best = -1, worst = -1;
    for (const d of pack) {
      if (d.mode !== 'circle') continue;
      const behind = Math.abs(angleDiff(facing, Math.atan2(-(d.x - prey.x), -(d.z - prey.z))));
      if (behind > worst) { worst = behind; best = d.id; }
    }
    p.next = best;
  }

  /** One dog's step; `facing`: which way you face. Returns 1 if it bit you. */
  protected act(g: Dog, prey: Fighter, facing: number, dt: number): number {
    const D = this.D, p = g.pack;
    g.t += g.mode === 'rest' || g.mode === 'trot' ? -dt : dt;
    if (g.provoked) { g.provoked = false; p.hunting = true; if (this.town) p.calm = TOWN_DOG.calm; }
    if (g.dead) return this.lieDead(g, dt, 6);
    const dx = prey.x - g.x, dz = prey.z - g.z, d = Math.hypot(dx, dz), toYou = Math.atan2(-dx, -dz);
    // A village dog lets you be (until it is hit); a feral one comes for you once it has seen you.
    if (!this.town && !prey.dead && noticed(prey, d, D.notice * this.wakeful(g)) && Math.abs(prey.y - g.y) < 2.5) p.hunting = true;
    if (p.hunting && (prey.dead || d > D.forget || Math.abs(prey.y - g.y) > 4)) p.hunting = false;
    const pack = this.living(p), k = pack.indexOf(g);
    if (this.town && k === 0 && p.hunting && (p.calm = (p.calm ?? 0) - dt) <= 0) p.hunting = false;
    // Badly hurt, a village dog runs from you while its lot is still angry.
    const cowed = this.town && p.hunting && g.health < TOWN_DOG.cowed * DOG.health * g.size;
    if (cowed && g.mode !== 'flee') { g.mode = 'flee'; g.t = 0; }
    if (k === 0 && p.hunting) this.lead(p, pack, prey, facing, dt);
    if (p.hunting && (g.mode === 'rest' || g.mode === 'trot')) g.mode = 'circle';
    if (!p.hunting && g.mode !== 'rest' && g.mode !== 'trot') { g.mode = 'trot'; g.tx = p.x; g.tz = p.z; g.t = 8; }

    // Its life about the den: feeding, sleeping with its pack (src/creatures/life.ts).
    if (!p.hunting && (g.mode === 'rest' || g.mode === 'trot') && this.live(g, p, dt, D.trot, D.roam * 1.5)) { g.gait += g.life.moved / (0.16 * g.size); return 0; }
    let bit = 0;
    switch (g.mode) {
      case 'rest':
        brake(g, 5, dt);
        this.steer.slide(g, dt);
        if (g.t <= 0) {
          if (this.toFood(g, p, D.trot, D.roam * 1.5)) { g.t = this.rng.range(1, 3); break; }
          [g.tx, g.tz] = this.roamFrom(p, D.roam);
          g.mode = 'trot'; g.t = 6;
        }
        break;
      case 'trot':
        g.gait += this.steer.move(g, g.tx, g.tz, D.trot, dt, null) / (0.16 * g.size);
        if (g.t <= 0 || Math.hypot(g.tx - g.x, g.tz - g.z) < 0.3) { g.mode = 'rest'; g.t = this.rng.range(2, 7); }
        break;
      case 'circle': {
        // Its place on the ring round you (the ring hangs off the pack's angle, not off the dog).
        // Pulled in short of rock between you and it.
        const a = p.angle + (k / pack.length) * Math.PI * 2, ux = Math.sin(a), uz = Math.cos(a);
        const r = Math.max(prey.radius + g.radius + 0.3, Math.min(D.ring, this.level.trace(prey.x, prey.y + 0.5, prey.z, ux, 0, uz, D.ring + 1) - g.radius - 0.4));
        const sx = prey.x + ux * r, sz = prey.z + uz * r;
        const there = Math.hypot(sx - g.x, sz - g.z) < 1;
        g.gait += this.steer.move(g, sx, sz, D.run, dt, there ? toYou : null) / (0.16 * g.size);
        if (p.next === g.id && there) { g.mode = 'crouch'; g.t = 0; p.next = -1; }
        break;
      }
      case 'crouch':
        // Down on its haunches, eyes on you: the tell.
        this.steer.move(g, g.x, g.z, 0, dt, toYou);
        if (g.t >= D.crouch) { g.mode = 'lunge'; g.t = 0; g.bit = false; g.vx = (dx / (d || 1)) * D.lunge; g.vz = (dz / (d || 1)) * D.lunge; }
        break;
      case 'lunge':
        g.gait += this.steer.slide(g, dt) / (0.16 * g.size);
        if (!g.bit && d - prey.radius - g.radius < D.reach && Math.abs(prey.y - g.y) < 1.2) {
          damage(prey, this.rng.range(D.damage[0], D.damage[1]) * g.size, g.x, g.z, 1.5, this.town ? 'village dog' : 'dog');
          g.bit = true;
          bit = 1;
        }
        if (g.bit || g.t >= D.lungeT) { g.mode = 'back'; g.t = 0; g.vx = g.vz = 0; }
        break;
      case 'back':
        // Hangs on a moment (a bite: in reach of your knife), then springs back out of reach, still facing you, then back to its place.
        g.yaw += angleDiff(g.yaw, toYou) * Math.min(1, dt * 10);
        if (g.t < D.hold) g.vx = g.vz = 0;
        else if (g.t - dt < D.hold) { g.vx = -(dx / (d || 1)) * D.run * 0.6; g.vz = -(dz / (d || 1)) * D.run * 0.6; }
        brake(g, 3, dt);
        g.gait += this.steer.slide(g, dt) / (0.16 * g.size);
        if (g.t >= D.hold + D.back) { g.mode = 'circle'; p.gap = D.every; }
        break;
      case 'flee':
        // Away from you, tail down, until its lot has calmed (then it trots home).
        g.gait += this.steer.move(g, 2 * g.x - prey.x, 2 * g.z - prey.z, D.run * 0.8, dt, null) / (0.16 * g.size);
        break;
    }
    return bit;
  }
}
