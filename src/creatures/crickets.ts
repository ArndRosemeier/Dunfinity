/**
 * Cave crickets (docs/design/town-and-first-strata.md §5: levels 1–5): pale, dog-sized, with long
 * hind legs and longer feelers. They cling to the pillars and walls a few metres up, in little
 * groups. Come near in the dark and they leap down at you, land with a knock, bite, and leap again.
 * They hate light: one your headlamp is on scatters, leaping away into the dark, and waits there a
 * moment before it tries again. Keep your light on them, and they come at you from the side.
 *
 * Every move shows: a crouch before each leap (the tell), the arc through the air, a rear before the
 * bite. Pure: positions on the level's rock (perches found with the field), floor walking with
 * src/creatures/steer.ts, blows through src/combat. Groups are fixed by the seed; the ones you kill
 * stay dead on this visit.
 */
import { Rng, deriveSeed, hash3f, angleDiff } from '@futuremagic/core';
import type { Level } from '../gen/level';
import { damage, type Fighter, noticed } from '../combat/combat';
import { CANDLE } from '../combat/thrown';
import { Population, type Den } from './population';
import { brake } from './steer';
import { rockDistance } from '../gen/quarry';
import { Creature } from './creature';

export const CRICKET = {
  radius: 0.28,
  height: 0.42,
  health: 18,
  /** Hopping about on the floor, m/s. */
  hop: 3.2,
  /** They come for you within `notice` metres (from a perch: if you are below and near), and give up beyond `forget`. */
  notice: 11,
  forget: 28,
  /** Leaps: the crouch before (the tell), speed through the air (m/s), how high the arc rises per metre, the shortest and longest leap. */
  crouch: 0.4,
  speed: 7,
  arc: 0.28,
  near: 1.2,
  far: 12,
  /** Landing on you: within this of your surface, it knocks you (damage). */
  knock: 0.5,
  knockDamage: [3, 5] as const,
  /** A bite: reach beyond touching, damage, the wind-up (rear) before the snap, seconds between bites. */
  biteReach: 0.35,
  biteDamage: [3, 6] as const,
  windup: 0.3,
  biteEvery: 1.3,
  /** After so many bites (or this long on the floor), it leaps off to come again from elsewhere. */
  bites: 2,
  grounded: 5,
  /** The headlamp: a cricket inside its cone and nearer than `lit` metres scatters; then it keeps away this long. */
  lit: 16,
  skulk: [1.8, 3] as const,
  /** Groups: cell size, chance per cell (the band's `crickets`), none this close to the arrival, crickets per group, perch heights over the floor (min, extra). */
  cell: 40,
  quiet: 18,
  count: [2, 4] as const,
  perch: [2.2, 3] as const,
  /** Groups come alive within `wake` metres of you and go back to sleep beyond `sleep`. */
  wake: 50,
  sleep: 70,
} as const;

export type CricketMode = 'perch' | 'crouch' | 'leap' | 'ground' | 'bite' | 'skulk' | 'dead';

/** The headlamp, for the crickets: where it is, which way it shines (unit), the cosine of its half angle. */
export interface Lamp {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  cos: number;
}

export class Cricket extends Creature<CricketMode> {
  /** Seconds left in the mode (crouch, skulk), or into it (leap, bite, ground). */
  t = 0;
  /** The surface it clings to: its normal (up for the floor). */
  readonly up: [number, number, number] = [0, 1, 0];
  /** A leap: from, to, how long it takes, and what comes after it. */
  readonly from: [number, number, number] = [0, 0, 0];
  readonly to: [number, number, number] = [0, 0, 0];
  leapT = 0;
  /** Bites since it last landed, and seconds since its last bite started. */
  bitten = 0;
  biteT = 9;
  /** Gait phase, advanced by distance hopped. */
  gait = 0;
  /** Falling speed (dead, off the wall). */
  vy = 0;
  /** It was hurt, or noticed you: the group is after you. */
  angry = false;
  /** Leaping away from the light (no knock on landing). */
  fleeing = false;

  constructor(readonly id: number, x: number, y: number, z: number, yaw: number, readonly size: number) {
    super(x, y, z, yaw, CRICKET.radius * size, CRICKET.height * size, CRICKET.health, 'perch');
  }

  /** Off the floor: on a wall, or in the air. */
  get aloft(): boolean { return this.mode === 'perch' || this.mode === 'leap' || (this.mode === 'crouch' && this.up[1] < 0.7); }
}

/** A group: its perches (x, y, z and the rock's normal there, each). */
interface Group extends Den {
  readonly perches: number[][];
}

export class Crickets extends Population<Group, Cricket, Lamp | null> {
  private readonly n: [number, number, number] = [0, 0, 0];

  constructor(level: Level) {
    super(level, 'crickets', CRICKET, { arrive: 0.3, still: 0.05, step: 0.6, drop: 1.5, accel: 9, turn: 10, face: 12 });
  }

  protected hatch(g: Group, killed: (id: number) => boolean): Cricket[] {
    const rng = new Rng(deriveSeed(this.seed, 'group', g.key)), born: Cricket[] = [];
    g.perches.forEach((p, k) => {
      const id = g.key * 8 + k, yaw = rng.range(0, Math.PI * 2), size = rng.range(0.85, 1.2), wait = rng.range(0, 0.9);
      if (killed(id)) return;
      const c = new Cricket(id, p[0], p[1], p[2], yaw, size);
      c.up[0] = p[3]; c.up[1] = p[4]; c.up[2] = p[5];
      c.t = wait; // each takes its own moment to drop
      born.push(c);
    });
    return born;
  }

  /** The group of cell (i, j), if any: perches on the rock of a pillar or a wall, a few metres up. */
  protected denIn(key: number, i: number, j: number): Group | null {
    const C = CRICKET, s = this.seed, l = this.level;
    for (const [x, z] of this.sites(i, j, l.band.crickets, 6)) {
      const col = l.columnAt(x, z), d = rockDistance(col);
      if (d > 4 || col.collapse > 0) continue;
      const g = l.groundAt(x, z);
      if (!l.dry(x, z, 0.1)) continue;
      const count = this.countIn(i, j, C.count);
      const perches: number[][] = [];
      for (let p = 0; p < count * 3 && perches.length < count; p++) {
        const a = hash3f(s, i, j, 30 + p) * Math.PI * 2, r = hash3f(s, i, j, 60 + p) * 2.5;
        const h = C.perch[0] + C.perch[1] * hash3f(s, i, j, 90 + p);
        const perch = this.perchNear(x + Math.cos(a) * r, g + h, z + Math.sin(a) * r);
        // (Up the wall over its own foot too: on a slope the floor there may be higher than here.)
        if (perch && perch[1] - l.groundAt(perch[0], perch[2]) > C.perch[0] * 0.6 && perches.every((q) => Math.hypot(q[0] - perch[0], q[1] - perch[1], q[2] - perch[2]) > 0.8)) perches.push(perch);
      }
      if (perches.length) return { key, x, z, perches };
    }
    return null;
  }

  /** A spot on a steep rock face near (x, y, z): walk down the field to the surface. */
  private perchNear(x: number, y: number, z: number): number[] | null {
    const l = this.level;
    for (let k = 0; k < 16; k++) {
      const d = l.sdf(x, y, z);
      if (Math.abs(d) < 0.02) {
        l.normal(x, y, z, this.n);
        if (Math.abs(this.n[1]) > 0.5) return null; // not a floor, not a roof
        const c = 0.12, px = x + this.n[0] * c, py = y + this.n[1] * c, pz = z + this.n[2] * c;
        const off = l.sdf(px, py, pz);
        return off > 0.06 && off < 0.25 ? [px, py, pz, this.n[0], this.n[1], this.n[2]] : null;
      }
      if (d > 4) return null;
      l.normal(x, y, z, this.n);
      x -= this.n[0] * d; y -= this.n[1] * d; z -= this.n[2] * d;
    }
    return null;
  }

  // ------------------------------------------------------------------ behaviour

  /** Whether the lamp shines on c. */
  private lit(c: Cricket, lamp: Lamp | null): boolean {
    if (this.glaring(c, CANDLE.shun)) return true; // a Sunday candle's light is all round it
    if (!lamp) return false;
    const dx = c.x - lamp.x, dy = c.y + c.height / 2 - lamp.y, dz = c.z - lamp.z, d = Math.hypot(dx, dy, dz);
    return d < CRICKET.lit && d > 0.01 && (dx * lamp.dx + dy * lamp.dy + dz * lamp.dz) / d > lamp.cos;
  }

  /** One cricket's step (`lamp`: the headlamp, null when off); returns 1 if it hurt the prey. */
  protected act(c: Cricket, prey: Fighter, lamp: Lamp | null, dt: number): number {
    const C = CRICKET;
    c.biteT += dt;
    if (c.provoked) { c.provoked = false; c.angry = true; }
    if (c.dead) return this.fall(c, dt);
    const dx = prey.x - c.x, dz = prey.z - c.z, d = Math.hypot(dx, dz);
    if (!prey.dead && noticed(prey, d, C.notice) && prey.y < c.y + 1.5 && prey.y > c.y - 7) c.angry = true;
    if (c.angry && (prey.dead || d > C.forget)) c.angry = false;
    const lit = this.lit(c, lamp);
    let hurt = 0;
    switch (c.mode) {
      case 'perch':
        // Feelers twitch (the view); off the wall when the group is after you and the light is not on it.
        if (c.angry && !lit && d < C.far && (c.t -= dt) <= 0) {
          // Down beside you: on its side of you, or (right below it) out from its wall.
          const h = Math.hypot(c.up[0], c.up[2]) || 1, [ux, uz] = d > C.near ? [-dx / d, -dz / d] : [c.up[0] / h, c.up[2] / h];
          this.crouchFor(c, prey.x + ux * 0.7, prey.z + uz * 0.7, false);
        }
        break;
      case 'crouch':
        c.vx = c.vz = 0;
        if (c.up[1] > 0.7) c.yaw += angleDiff(c.yaw, Math.atan2(-(c.to[0] - c.x), -(c.to[2] - c.z))) * Math.min(1, dt * 12);
        if ((c.t -= dt) <= 0) { c.mode = 'leap'; c.leapT = 0; c.from[0] = c.x; c.from[1] = c.y; c.from[2] = c.z; }
        break;
      case 'leap': {
        c.leapT += dt;
        const len = Math.hypot(c.to[0] - c.from[0], c.to[2] - c.from[2]), T = Math.max(0.3, Math.hypot(len, c.to[1] - c.from[1]) / C.speed);
        const u = Math.min(1, c.leapT / T), rise = C.arc * Math.max(1.5, len) * 4 * u * (1 - u);
        c.vx = (c.to[0] - c.from[0]) / T; c.vz = (c.to[2] - c.from[2]) / T;
        c.x = c.from[0] + (c.to[0] - c.from[0]) * u;
        c.y = c.from[1] + (c.to[1] - c.from[1]) * u + rise;
        c.z = c.from[2] + (c.to[2] - c.from[2]) * u;
        c.yaw += angleDiff(c.yaw, Math.atan2(-(c.to[0] - c.from[0]), -(c.to[2] - c.from[2]))) * Math.min(1, dt * 20);
        c.up[0] = c.up[0] * (1 - u); c.up[1] = c.up[1] * (1 - u) + u; c.up[2] = c.up[2] * (1 - u);
        if (u >= 1) {
          c.up[0] = 0; c.up[1] = 1; c.up[2] = 0;
          c.vx *= 0.2; c.vz *= 0.2;
          c.bitten = 0;
          c.t = 0;
          if (c.fleeing) { c.fleeing = false; c.mode = 'skulk'; c.t = this.rng.range(C.skulk[0], C.skulk[1]); }
          else {
            c.mode = 'ground';
            const reach = Math.hypot(prey.x - c.x, prey.z - c.z) - prey.radius - c.radius;
            if (reach < C.knock && Math.abs(prey.y - c.y) < 1.2) {
              damage(prey, this.rng.range(C.knockDamage[0], C.knockDamage[1]), c.x, c.z, 1.5, 'cricket');
              hurt = 1;
            }
          }
        }
        break;
      }
      case 'ground': {
        c.t += dt;
        if (lit && c.hurtT > 0.3) { this.scatter(c, this.glaring(c, CANDLE.shun) ?? prey); break; } // away from the light
        if (!c.angry) { brake(c, 8, dt); this.steer.slide(c, dt); c.t = 0; break; }
        if (c.bitten >= C.bites || c.t > C.grounded) { this.leapOff(c, prey); break; }
        // Hop to just short of you, on the line from you to it (a goal that turns as it moves is chased round).
        const stand = prey.radius + c.radius + 0.1;
        // Nearer than that already (a lunge carried it in): it stays put, never backing off to come again.
        const gx = d < stand ? c.x : prey.x - (dx / (d || 1)) * stand, gz = d < stand ? c.z : prey.z - (dz / (d || 1)) * stand;
        c.gait += this.steer.move(c, gx, gz, C.hop, dt, d - stand < 0.4 ? Math.atan2(-dx, -dz) : null) / (0.12 * c.size);
        if (d - prey.radius - c.radius < C.biteReach && c.biteT > C.biteEvery) { c.mode = 'bite'; c.biteT = 0; }
        break;
      }
      case 'bite': {
        const ux = dx / (d || 1), uz = dz / (d || 1);
        if (c.biteT < C.windup) { c.vx = -ux * 0.5; c.vz = -uz * 0.5; } else if (c.biteT < C.windup + 0.12) { c.vx = ux * 2; c.vz = uz * 2; }
        c.yaw += angleDiff(c.yaw, Math.atan2(-dx, -dz)) * Math.min(1, dt * 15);
        if (c.biteT >= C.windup && c.biteT - dt < C.windup && d - prey.radius - c.radius < C.biteReach + 0.25 && Math.abs(prey.y - c.y) < 1.2) {
          damage(prey, this.rng.range(C.biteDamage[0], C.biteDamage[1]), c.x, c.z, 0.8, 'cricket');
          hurt = 1;
          c.bitten++;
        }
        this.steer.slide(c, dt);
        if (c.biteT > C.windup + 0.35) c.mode = 'ground';
        break;
      }
      case 'skulk':
        // Keeps still in the dark a moment, then comes again (or leaps off, if the light finds it).
        brake(c, 8, dt);
        this.steer.slide(c, dt);
        if (lit && c.t > 0.3) { this.scatter(c, prey); break; }
        if ((c.t -= dt) <= 0) { c.mode = 'ground'; c.t = 0; c.bitten = 0; }
        break;
    }
    return hurt;
  }

  /** Crouch, then leap to (x, z) on the floor (if it can get there). */
  private crouchFor(c: Cricket, x: number, z: number, fleeing: boolean): boolean {
    const y = this.level.groundAt(x, z);
    if (!this.level.dry(x, z, 0.1) || this.level.sdf(x, y + 0.6, z) < 0.3) return false;
    // The arc must be clear of the rock.
    const len = Math.hypot(x - c.x, z - c.z), rise = CRICKET.arc * Math.max(1.5, len);
    for (let k = 2; k < 8; k++) {
      const u = k / 8;
      if (this.level.sdf(c.x + (x - c.x) * u, c.y + (y - c.y) * u + rise * 4 * u * (1 - u) + 0.2, c.z + (z - c.z) * u) < 0.08) return false;
    }
    c.to[0] = x; c.to[1] = y; c.to[2] = z;
    c.mode = 'crouch';
    c.t = fleeing ? CRICKET.crouch * 0.5 : CRICKET.crouch;
    c.fleeing = fleeing;
    return true;
  }

  /** Lit: leap away from the light into the dark. */
  private scatter(c: Cricket, from: { readonly x: number; readonly z: number }): void {
    const away = Math.atan2(c.x - from.x, c.z - from.z);
    for (let k = 0; k < 6; k++) {
      const a = away + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.5, r = this.rng.range(5, 8);
      if (this.crouchFor(c, c.x + Math.sin(a) * r, c.z + Math.cos(a) * r, true)) return;
    }
    c.mode = 'skulk'; c.t = this.rng.range(CRICKET.skulk[0], CRICKET.skulk[1]); // nowhere to go: it cowers
  }

  /** Enough of this: leap off sideways, to come again from elsewhere. */
  private leapOff(c: Cricket, prey: Fighter): void {
    const round = Math.atan2(c.x - prey.x, c.z - prey.z) + this.rng.pick([-1, 1]) * this.rng.range(0.9, 1.6);
    for (let k = 0; k < 4; k++) {
      const r = this.rng.range(3, 6), a = round + k * 0.4;
      if (this.crouchFor(c, prey.x + Math.sin(a) * r, prey.z + Math.cos(a) * r, true)) return;
    }
    c.t = 0; c.bitten = 0; // nowhere: stays and fights
  }

  /** Dead: off the wall (or out of the air) to the floor. */
  private fall(c: Cricket, dt: number): number {
    const g = this.level.groundAt(c.x, c.z);
    if (c.y > g + 0.01) {
      c.vy -= 18 * dt;
      c.y = Math.max(g, c.y + c.vy * dt);
    } else this.steer.slide(c, dt);
    c.up[0] *= 0.9; c.up[1] += (1 - c.up[1]) * 0.1; c.up[2] *= 0.9;
    brake(c, 6, dt);
    return 0;
  }
}
