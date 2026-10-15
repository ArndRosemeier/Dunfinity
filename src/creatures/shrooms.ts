/**
 * The mushroom monsters of the fungal grotto (src/gen/fungal.ts), standing among its mushrooms and
 * looking just like them:
 *
 * - Toadstools: giant fly agarics. One stands still as any mushroom until you come close (or stab
 *   it); then it shivers, pulls its roots out of the ground and stands up on them (the tell), and
 *   comes for you on its roots, rearing back and slamming its cap down on you. Lose it and it walks
 *   back to its spot and roots itself again.
 * - Puffcaps: tall pale cave mushrooms with faintly glowing gills, rooted for good. One that sees
 *   you turns to you, draws its cap in (the tell) and puffs a ball of spores at you
 *   (src/creatures/spores.ts).
 *
 * Pure: floor walking with src/creatures/steer.ts, blows through src/combat. Where they grow is
 * fixed by the seed; the dead stay dead on this visit.
 */
import { angleDiff } from '@futuremagic/core';
import type { Level } from '../gen/level';
import { damage, noticed, type Fighter } from '../combat/combat';
import { Creature } from './creature';
import { Population, type Den } from './population';
import { brake } from './steer';
import { Spores } from './spores';

export const TOADSTOOL = {
  /** Radius (its cap's) and height at size 1, metres; health. */
  radius: 0.45,
  height: 1.15,
  health: 30,
  /** It wakes when you come this close (or when hurt); it gives up beyond `forget`. */
  notice: 5,
  forget: 18,
  /** Speeds, m/s: walking back to its spot, coming for you (you walk 4.2). */
  walk: 0.9,
  run: 2.2,
  /** Seconds to get up (the Wake clip: a shiver, then up on its roots), and to root itself again (Settle). */
  wake: 40 / 30,
  settle: 1,
  /** The slam (the Slam clip, `dur` s): reared back by `rear` (the tell), down at `hit`; its reach beyond touching and half its arc; damage, knock, rest between slams. */
  dur: 1,
  rear: 0.45,
  hit: 0.6,
  reach: 0.55,
  arc: 0.8,
  damage: [9, 14] as const,
  knock: 2.5,
  every: 1.6,
} as const;

export const PUFFCAP = {
  /** Radius (its stalk's, at size 1) and height; health. */
  radius: 0.25,
  height: 2.1,
  health: 22,
  /** It sees you this close (and clear of rock), and turns to you this fast (radians per second). */
  notice: 15,
  turn: 1.6,
  /** The puff (the Puff clip, `dur` s): drawn in (the tell), the spores let go at `release`; seconds between puffs. */
  dur: 1.5,
  release: 0.62 * 1.5,
  every: 3.4,
  /** The cap's middle, metres up at size 1: where the spores leave. */
  mouth: 1.85,
} as const;

/** Where they grow: cell size, the chance per cell of the grotto's ground, how many, how far apart; no nearer the arrival, wake and sleep. */
const PATCH = {
  cell: 24,
  chance: 0.6,
  toadstools: [1, 2] as const,
  puffcaps: [0, 2] as const,
  spread: 5,
  quiet: 20,
  wake: 50,
  sleep: 70,
} as const;

export type ToadstoolMode = 'hide' | 'wake' | 'chase' | 'slam' | 'home' | 'settle' | 'dead';
export type PuffcapMode = 'rest' | 'puff' | 'dead';

export class Toadstool extends Creature<ToadstoolMode> {
  /** Seconds in the mode; seconds since its last slam began. */
  t = 0;
  slamT = 9;
  /** It slammed in this slam. */
  struck = false;
  /** Its spot, where it roots itself. */
  readonly hx: number;
  readonly hz: number;
  /** How far it has walked (metres): the phase of its walk. */
  walked = 0;

  constructor(readonly id: number, x: number, y: number, z: number, yaw: number, readonly size: number) {
    super(x, y, z, yaw, TOADSTOOL.radius * size, TOADSTOOL.height * size, TOADSTOOL.health * size, 'hide');
    this.hx = x; this.hz = z;
  }

  /** Up on its roots (not a mushroom just now). */
  get up(): boolean { return this.mode !== 'hide' && this.mode !== 'dead'; }
}

export class Puffcap extends Creature<PuffcapMode> {
  /** Seconds since its last puff began; it let this puff's spores go. */
  t = 9;
  loosed = false;

  constructor(readonly id: number, x: number, y: number, z: number, yaw: number, readonly size: number) {
    super(x, y, z, yaw, PUFFCAP.radius * size, PUFFCAP.height * size, PUFFCAP.health * size, 'rest');
  }
}

export interface Patch extends Den {
  readonly y: number;
  readonly count: number;
}

/**
 * Mushroom monsters of one kind, in patches of the grotto's own ground: per cell the first of its
 * seeded spots that is the grotto's and has `head` metres of room, `count` of them round it.
 */
abstract class Patches<C extends Toadstool | Puffcap> extends Population<Patch, C> {
  protected abstract readonly count: readonly [number, number];
  protected abstract readonly head: number;
  /** One born at (x, y, z), turned `yaw`, of `size`. */
  protected abstract born(id: number, x: number, y: number, z: number, yaw: number, size: number): C;

  protected denIn(key: number, i: number, j: number): Patch | null {
    const count = this.countIn(i, j, this.count), f = this.level.field;
    if (count === 0) return null;
    for (const [x, z] of this.sites(i, j, PATCH.chance)) {
      if (f.styles[f.regions.styleAt(x, z)].id !== 'fungal') continue;
      const y = this.floorFor(x, z, this.head, 0.6);
      if (y !== null) return { key, x, z, y, count };
    }
    return null;
  }

  protected hatch(p: Patch, killed: (id: number) => boolean): C[] {
    return this.brood(p, this.name, 4, 0.5, PATCH.spread, killed, (id, x, y, z, rng) => this.born(id, x, y, z, rng.range(0, Math.PI * 2), rng.range(0.85, 1.15)));
  }
}

export class Toadstools extends Patches<Toadstool> {
  protected readonly count = PATCH.toadstools;
  protected readonly head = 1.4;

  constructor(level: Level) {
    super(level, 'toadstools', PATCH, { arrive: 0.6, still: 0.08, step: 0.4, drop: 1, accel: 5, turn: 4, face: 5, probe: 0.5 });
    this.apart = 1;
  }


  protected born(id: number, x: number, y: number, z: number, yaw: number, size: number): Toadstool {
    return new Toadstool(id, x, y, z, yaw, size);
  }

  /** One toadstool's step. Returns 1 if it slammed you. */
  protected act(s: Toadstool, prey: Fighter, _: null, dt: number): number {
    const C = TOADSTOOL;
    s.t += dt;
    s.slamT += dt;
    if (s.dead) return this.lieDead(s, dt, 8);
    const dx = prey.x - s.x, dz = prey.z - s.z, d = Math.hypot(dx, dz), level = Math.abs(prey.y - s.y) < 2;
    const sees = !prey.dead && level && noticed(prey, d, C.notice);
    const hit = s.provoked;
    s.provoked = false;
    const face = (rate: number) => { s.yaw += angleDiff(s.yaw, Math.atan2(-dx, -dz)) * Math.min(1, dt * rate); };
    const x0 = s.x, z0 = s.z;
    let hurt = 0;
    switch (s.mode) {
      case 'hide':
        brake(s, 20, dt);
        if (sees || hit) { s.mode = 'wake'; s.t = 0; }
        break;
      case 'wake':
        brake(s, 20, dt);
        if (s.t > C.wake * 0.35) face(3);
        if (s.t >= C.wake) { s.mode = 'chase'; s.t = 0; }
        break;
      case 'chase':
        if (prey.dead || !level || d > C.forget) { s.mode = 'home'; s.t = 0; break; }
        this.steer.close(s, prey, prey.radius + s.radius + 0.1, C.run * Math.sqrt(s.size), dt, 1.5);
        if (d - prey.radius - s.radius < C.reach && s.slamT > C.every) { s.mode = 'slam'; s.t = 0; s.slamT = 0; s.struck = false; }
        break;
      case 'slam': {
        brake(s, 12, dt);
        if (s.t < C.rear) face(5);
        this.steer.slide(s, dt);
        const fwd = Math.abs(angleDiff(s.yaw, Math.atan2(-dx, -dz)));
        if (!s.struck && s.t >= C.hit) {
          s.struck = true;
          if (level && d - prey.radius - s.radius < C.reach + 0.35 * s.size && fwd < C.arc) {
            damage(prey, this.rng.range(C.damage[0], C.damage[1]) * s.size, s.x, s.z, C.knock, 'toadstool');
            hurt = 1;
          }
        }
        if (s.t >= C.dur) { s.mode = 'chase'; s.t = 0; }
        break;
      }
      case 'home':
        if (sees || hit) { s.mode = 'chase'; s.t = 0; break; }
        this.steer.move(s, s.hx, s.hz, C.walk, dt, null);
        if (Math.hypot(s.hx - s.x, s.hz - s.z) < 0.4 || s.t > 30) { s.mode = 'settle'; s.t = 0; }
        break;
      case 'settle':
        brake(s, 20, dt);
        this.steer.slide(s, dt);
        if (sees || hit) { s.mode = 'wake'; s.t = C.wake * 0.5; break; }
        if (s.t >= C.settle) { s.mode = 'hide'; s.t = 0; }
        break;
    }
    s.walked += Math.hypot(s.x - x0, s.z - z0);
    return hurt;
  }
}

export class Puffcaps extends Patches<Puffcap> {
  protected readonly count = PATCH.puffcaps;
  protected readonly head = 2.4;

  /** Their spores in the air and hanging over the floor. */
  readonly spores: Spores;

  constructor(level: Level) {
    super(level, 'puffcaps', PATCH, { arrive: 0.5, still: 0.05, step: 0.4, drop: 1, accel: 1, turn: 1, face: 1, probe: 0.5 });
    this.spores = new Spores(level, this.rng);
  }


  protected born(id: number, x: number, y: number, z: number, yaw: number, size: number): Puffcap {
    return new Puffcap(id, x, y, z, yaw, size);
  }

  /** Advance by dt: each puffcap, then its spores. Returns 1 if anything hurt you. */
  override advance(dt: number, prey: Fighter): number {
    return super.advance(dt, prey) + (this.spores.advance(dt, prey) ? 1 : 0);
  }

  /** One puffcap's step (rooted: it only turns and puffs). */
  protected act(p: Puffcap, prey: Fighter, _: null, dt: number): number {
    const C = PUFFCAP;
    p.t += dt;
    p.vx = p.vz = 0;
    p.provoked = false;
    if (p.dead) return 0;
    const dx = prey.x - p.x, dz = prey.z - p.z, d = Math.hypot(dx, dz);
    const mouth = p.y + C.mouth * p.size;
    const sees = !prey.dead && noticed(prey, d, C.notice) && this.clear(p.x, mouth, p.z, prey.x, prey.y + 1, prey.z);
    if (sees || p.mode === 'puff') p.yaw += angleDiff(p.yaw, Math.atan2(-dx, -dz)) * Math.min(1, dt * C.turn);
    if (p.mode === 'rest' && sees && p.t > C.every) { p.mode = 'puff'; p.t = 0; p.loosed = false; }
    if (p.mode === 'puff') {
      if (!p.loosed && p.t >= C.release) {
        p.loosed = true;
        if (!prey.dead) this.spores.lob(p.x - Math.sin(p.yaw) * 0.3 * p.size, mouth, p.z - Math.cos(p.yaw) * 0.3 * p.size, prey);
      }
      if (p.t >= C.dur) p.mode = 'rest';
    }
    return 0;
  }

  /** Nothing but air on the line from a to b (sampled every half metre). */
  private clear(ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay, bz - az) / 0.5);
    for (let k = 1; k < n; k++) {
      const t = k / n;
      if (this.level.sdf(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t) < 0.1) return false;
    }
    return true;
  }
}
