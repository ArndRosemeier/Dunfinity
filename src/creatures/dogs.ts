/**
 * Feral dogs (docs/design/town-and-first-strata.md §5: levels 6–8, "packs in the bunker, flank"):
 * gaunt dogs gone wild in the dark, in packs of three to five lying up in dry corners of the
 * Cisterns. Once they have seen you the pack does not rush you: it spreads out on a ring round you
 * and circles, and one at a time the dog furthest behind your back crouches (the tell), lunges in,
 * bites and springs back to its place. Turn to face them and they circle on round you.
 *
 * Pure: floor walking with src/creatures/steer.ts, bites through src/combat. Packs are fixed by the
 * seed; the dead stay dead on this visit.
 */
import { angleDiff } from '@futuremagic/core';
import type { Level } from '../gen/level';
import { damage, type Fighter } from '../combat/combat';
import { Creature } from './creature';
import { Population, type Den } from './population';
import { brake } from './steer';
import { rockDistance } from '../gen/quarry';

export const DOG = {
  /** Body radius and height at size 1, metres; health. */
  radius: 0.3,
  height: 0.75,
  health: 26,
  /** Speeds, m/s: trotting about the den, and running (you walk 4.2 and sprint 7). */
  trot: 1.6,
  run: 6.2,
  /** They see you this close; give up beyond `forget`. */
  notice: 18,
  forget: 36,
  /** The ring they circle you on, metres from you; how fast it turns round you, radians per second. */
  ring: 4.2,
  drift: 0.3,
  /** A lunge: the crouch before it (the tell), the lunge's speed and longest time, the bite's reach beyond touching, damage, the spring back, and the pack's pause between lunges, s. */
  crouch: 0.45,
  lunge: 8,
  lungeT: 0.45,
  reach: 0.45,
  damage: [6, 10] as const,
  back: 0.6,
  every: 1.4,
  /** Dens: cell size, chance per cell (band.dogs), none this close to the arrival, dogs per pack, how far they wander. */
  cell: 60,
  quiet: 30,
  count: [3, 5] as const,
  roam: 4,
  wake: 60,
  sleep: 85,
} as const;

export type DogMode = 'rest' | 'trot' | 'circle' | 'crouch' | 'lunge' | 'back' | 'dead';

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
}

export class Dogs extends Population<Pack, Dog, number> {
  constructor(level: Level) {
    super(level, 'dogs', DOG, { arrive: 0.5, still: 0.08, step: 0.6, drop: 1.4, accel: 12, turn: 9, face: 10 });
    this.apart = 1.1;
  }

  protected denIn(key: number, i: number, j: number): Pack | null {
    for (const [x, z] of this.sites(i, j, this.level.band.dogs)) {
      const col = this.level.columnAt(x, z);
      if (rockDistance(col) < 1.5 || rockDistance(col) > 6 || col.collapse > 0) continue;
      const y = this.floorFor(x, z, 1.2, 0.8);
      if (y !== null) return { key, x, z, y, count: this.countIn(i, j, DOG.count), hunting: false, angle: 0, gap: 0, next: -1 };
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
    const D = DOG, p = g.pack;
    g.hurtT += dt;
    g.t += g.mode === 'rest' || g.mode === 'trot' ? -dt : dt;
    if (g.provoked) { g.provoked = false; p.hunting = true; }
    if (g.dead) {
      g.deadT += dt;
      brake(g, 6, dt);
      this.steer.slide(g, dt);
      return 0;
    }
    const dx = prey.x - g.x, dz = prey.z - g.z, d = Math.hypot(dx, dz), toYou = Math.atan2(-dx, -dz);
    if (!prey.dead && d < D.notice && Math.abs(prey.y - g.y) < 2.5) p.hunting = true;
    if (p.hunting && (prey.dead || d > D.forget || Math.abs(prey.y - g.y) > 4)) p.hunting = false;
    const pack = this.living(p), k = pack.indexOf(g);
    if (k === 0 && p.hunting) this.lead(p, pack, prey, facing, dt);
    if (p.hunting && (g.mode === 'rest' || g.mode === 'trot')) g.mode = 'circle';
    if (!p.hunting && g.mode !== 'rest' && g.mode !== 'trot') { g.mode = 'trot'; g.tx = p.x; g.tz = p.z; g.t = 8; }

    let bit = 0;
    switch (g.mode) {
      case 'rest':
        brake(g, 5, dt);
        this.steer.slide(g, dt);
        if (g.t <= 0) {
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
          damage(prey, this.rng.range(D.damage[0], D.damage[1]) * g.size, g.x, g.z, 1.5, 'dog');
          g.bit = true;
          bit = 1;
        }
        if (g.bit || g.t >= D.lungeT) { g.mode = 'back'; g.t = 0; g.vx = -(dx / (d || 1)) * D.run * 0.6; g.vz = -(dz / (d || 1)) * D.run * 0.6; }
        break;
      case 'back':
        // Springs back out of reach, still facing you, then back to its place.
        g.yaw += angleDiff(g.yaw, toYou) * Math.min(1, dt * 10);
        brake(g, 3, dt);
        g.gait += this.steer.slide(g, dt) / (0.16 * g.size);
        if (g.t >= D.back) { g.mode = 'circle'; p.gap = D.every; }
        break;
    }
    return bit;
  }
}
