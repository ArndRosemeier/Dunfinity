/**
 * The Foreman (docs/design/town-and-first-strata.md §5: the boss of level 5): a huge Salt-Touched,
 * three metres tall, waiting in a salt cathedral beside the old mine bell. Rouse him and he rings
 * it, and every Salt-Touched within earshot comes for you, however far away you are. Then he comes
 * himself, slowly, and brings his pick down with a long wind-up and a terrible blow.
 *
 * His front is crusted with salt: a knife from in front mostly skids off it. From behind he is
 * soft. Badly hurt, he goes back to the bell and rings it once more (his back to you while he does).
 *
 * Pure, like the other kinds: one hall per level 5, fixed by the seed (the nearest cathedral out
 * from the arrival); dead, he stays dead on this visit.
 */
import { angleDiff, hash3f } from '@futuremagic/core';
import type { Level } from '../gen/level';
import type { Fighter } from '../combat/combat';
import { pickSwing } from './pick';
import { Population, type Den } from './population';
import { brake } from './steer';
import { rockDistance } from '../gen/quarry';
import { Creature } from './creature';
import type { SaltTouched } from './touched';

export const FOREMAN = {
  /** The one level he is on. */
  depth: 5,
  radius: 0.55,
  height: 3.1,
  health: 360,
  /** Speeds, m/s: walking back to his bell, and coming for you (you walk 4.2). */
  walk: 1.2,
  chase: 1.7,
  /** He sees you this close; gives up beyond `forget`, or this far from his bell (`leash`). */
  notice: 16,
  forget: 35,
  leash: 45,
  /** The bell: how long a ringing takes, when the call goes out, how far it carries; he rings again below this share of his health. */
  ring: { dur: 2.6, at: 0.9, call: 70, again: 0.5 },
  /** The pick blow (see TOUCHED.swing): longer and heavier. */
  swing: { dur: 2.1, hit: 1.25, start: 1.4, range: 2.3, arc: 0.75, low: 0, high: 3.2, damage: [38, 48] as const, knock: 8, rest: 0.9 },
  aim: 2,
  /** His salt crust: a blow from within `guard` radians of where he faces does `front` of its damage; from elsewhere, `back`. */
  guard: 1.2,
  front: 0.25,
  back: 1.5,
  /** Where his hall is: cell size, none this close to the arrival, how many rings of cells out it is looked for, how tall a cathedral is. */
  cell: 64,
  quiet: 50,
  rings: 5,
  cathedral: 45,
  /** The Salt-Touched of his crew work the rock this far round his hall at most. */
  crew: 45,
  /** The bell stands this far beside him. */
  bell: 1.7,
  wake: 75,
  sleep: 100,
} as const;

export type ForemanMode = 'wait' | 'home' | 'ring' | 'chase' | 'swing' | 'dead';

export class Boss extends Creature<ForemanMode> {
  readonly id = 0;
  /** Seconds since the swing began, and the ringing. */
  swingT = 9;
  ringT = 9;
  /** Times he has rung the bell. */
  rung = 0;
  /** He saw you, or was hurt: he is after you. */
  angry = false;
  /** What share of a blow gets through, from where you stand now (his crust); the share of the last one that landed. */
  guard = 1;
  took = 1;

  constructor(readonly hall: Hall) {
    super(hall.x, hall.y, hall.z, hall.yaw, FOREMAN.radius, FOREMAN.height, FOREMAN.health, 'wait');
  }

  hurt(amount: number, cause: string): void {
    this.took = this.guard;
    super.hurt(amount * this.guard, cause);
  }

  /** Which way the bell is from him. */
  get toBell(): number {
    return Math.atan2(-(this.hall.bx - this.hall.x), -(this.hall.bz - this.hall.z));
  }
}

/** His hall: where he waits (facing out over it), and the bell beside him. */
export interface Hall extends Den {
  readonly y: number;
  readonly yaw: number;
  readonly bx: number;
  readonly bz: number;
}

export class Foreman extends Population<Hall, Boss, SaltTouched> {
  /** The cell of his hall, if this level has one. */
  private readonly at: readonly [number, number] | null;

  constructor(level: Level) {
    super(level, 'foreman', FOREMAN, { arrive: 0.8, still: 0.1, step: 0.7, drop: 1.2, accel: 4, turn: 3, face: 4 });
    this.at = this.find();
  }

  /** His hall, if this level has one. */
  get hall(): Hall | null {
    return this.at && this.denAt(this.at[0], this.at[1]);
  }

  /** The cell of the first cathedral out from the arrival with room for him and the bell. */
  private find(): [number, number] | null {
    const l = this.level, F = FOREMAN;
    if (l.depth !== F.depth) return null;
    const ci = Math.floor(l.arrival[0] / F.cell), cj = Math.floor(l.arrival[2] / F.cell);
    for (let r = 1; r <= F.rings; r++) {
      for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) === r && this.spot(i, j)) return [i, j];
      }
    }
    return null;
  }

  /** Where in cell (i, j) his hall can be: open floor in a cathedral, the bell's spot open too. */
  private spot(i: number, j: number): [number, number, number, number, number, number] | null {
    const l = this.level, F = FOREMAN;
    for (const [x, z] of this.sites(i, j, 1, 8)) {
      const col = l.columnAt(x, z);
      if (col.working.height < F.cathedral || rockDistance(col) < 5 || col.rubble > 0.05 || col.collapse > 0) continue;
      const y = this.floorFor(x, z, 3.5, 2);
      if (y === null) continue;
      const yaw = hash3f(this.seed, i, j, 40) * Math.PI * 2, bx = x + Math.cos(yaw) * F.bell, bz = z - Math.sin(yaw) * F.bell;
      if (this.floorFor(bx, bz, 2.5, 1) === null) continue;
      return [x, y, z, yaw, bx, bz];
    }
    return null;
  }

  protected denIn(key: number, i: number, j: number): Hall | null {
    if (!this.at || this.at[0] !== i || this.at[1] !== j) return null;
    const [x, y, z, yaw, bx, bz] = this.spot(i, j)!;
    return { key, x, y, z, yaw, bx, bz };
  }

  protected hatch(hall: Hall, killed: (id: number) => boolean): Boss[] {
    return killed(0) ? [] : [new Boss(hall)];
  }

  /** His step; `touched`: the Salt-Touched his bell calls. Returns 1 if his blow landed. */
  protected act(f: Boss, prey: Fighter, touched: SaltTouched, dt: number): number {
    const F = FOREMAN, S = F.swing, h = f.hall;
    f.swingT += dt;
    f.ringT += dt;
    f.hurtT += dt;
    const dx = prey.x - f.x, dz = prey.z - f.z, d = Math.hypot(dx, dz), toYou = Math.atan2(-dx, -dz);
    f.guard = Math.abs(angleDiff(f.yaw, toYou)) < F.guard ? F.front : F.back;
    if (f.provoked) { f.provoked = false; f.angry = true; }
    if (f.dead) {
      f.deadT += dt;
      brake(f, 5, dt);
      this.steer.slide(f, dt);
      return 0;
    }
    const near = !prey.dead && Math.abs(prey.y - f.y) < 4;
    if (near && d < F.notice) f.angry = true;
    if (f.angry && (prey.dead || d > F.forget || Math.hypot(f.x - h.x, f.z - h.z) > F.leash || Math.abs(prey.y - f.y) > 6)) f.angry = false;
    // He rings when first roused, and once more when badly hurt.
    const rings = !f.angry ? f.rung : f.health < F.health * F.ring.again ? 2 : 1;
    const toRing = f.rung < rings;
    if ((f.mode === 'wait' && f.angry) || (f.mode === 'chase' && (toRing || !f.angry))) f.mode = 'home';

    let hit = 0;
    switch (f.mode) {
      case 'wait':
        this.steer.move(f, h.x, h.z, F.walk, dt, h.yaw);
        break;
      case 'home': {
        const left = Math.hypot(h.x - f.x, h.z - f.z);
        this.steer.move(f, h.x, h.z, F.walk, dt, left < 1 ? (toRing ? f.toBell : h.yaw) : null);
        if (left < 0.25) {
          if (toRing && Math.abs(angleDiff(f.yaw, f.toBell)) < 0.3) { f.mode = 'ring'; f.ringT = 0; }
          else if (!toRing) f.mode = f.angry ? 'chase' : 'wait';
        }
        break;
      }
      case 'ring':
        this.steer.move(f, f.x, f.z, 0, dt, f.toBell);
        if (f.ringT >= F.ring.at && f.ringT - dt < F.ring.at) { touched.call(h.bx, h.bz, F.ring.call); f.rung++; }
        if (f.ringT >= F.ring.dur) f.mode = f.angry ? 'chase' : 'wait';
        break;
      case 'chase':
        this.steer.close(f, prey, prey.radius + f.radius + S.start * 0.5, F.chase, dt, 1);
        if (d - prey.radius - f.radius < S.start && f.swingT > S.dur + S.rest) { f.mode = 'swing'; f.swingT = 0; }
        break;
      case 'swing':
        hit = pickSwing(f, f.swingT, S, prey, F.aim, this.steer, this.rng, 'foreman', dt);
        if (f.swingT >= S.dur) f.mode = f.angry ? 'chase' : 'home';
        break;
    }
    return hit;
  }
}
