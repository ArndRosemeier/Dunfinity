/**
 * Brine eels (docs/design/town-and-first-strata.md §5: levels 5–8, "eels and worse in the flooded
 * halls"): long, pale eels in the brine lakes of the Salt Works and the flooded halls of the
 * Cisterns. They lie deep and turn slow circles. Wade into their water, or stand at its edge, and
 * one comes for you, a wake in the black water; it rears its head out (the tell), strikes, and sinks
 * back to come again. They never leave the water.
 *
 * Pure: they swim by their own rule (turning at a fixed rate, never into water too shallow for
 * them), and each keeps the chain of its body for the view. Bites through src/combat.
 */
import { angleDiff } from '@futuremagic/core';
import type { Level } from '../gen/level';
import { damage, type Fighter } from '../combat/combat';
import { Creature } from './creature';
import { Population, type Den } from './population';

export const EEL = {
  /** As a target: radius and height of the head end, metres; health. */
  radius: 0.16,
  height: 0.35,
  health: 30,
  /** The body: segments and their spacing, metres. */
  segments: 10,
  link: 0.3,
  /** Speeds, m/s: cruising, and coming for you; how fast it turns, radians per second. */
  cruise: 0.9,
  swim: 3.2,
  turn: 2.4,
  /** It notices you in (or at) its water this close; gives up beyond `forget`. */
  notice: 12,
  forget: 20,
  /** It strikes from this far (head to your surface); the rise before (the tell), the strike, sinking back after, s; damage. */
  reach: 1.2,
  rise: 0.55,
  strike: 0.22,
  sink: 1.1,
  damage: [8, 12] as const,
  /** How deep it lies cruising; coming for you, its back breaks the surface (the wake you see); how far its head comes out when it rears, metres. */
  under: 0.3,
  surface: 0.04,
  out: 0.45,
  /** Water it needs: to lie in (its den), and to swim at all, metres deep. */
  deep: 1.0,
  wet: 0.3,
  /** Dens: cell size, chance per cell (band.eels), none this close to the arrival, eels per den, how far they roam. */
  cell: 40,
  quiet: 20,
  count: [1, 3] as const,
  roam: 8,
  wake: 50,
  sleep: 70,
} as const;

export type EelMode = 'cruise' | 'hunt' | 'rise' | 'strike' | 'sink' | 'dead';

export class Eel extends Creature<EelMode> {
  /** Seconds in the mode (rise, strike, sink), or left of it (cruise). */
  t = 0;
  /** Its speed along its heading, m/s. */
  speed = 0;
  /** Which way it turns when the water ahead is too shallow (+1 / -1): it keeps to it. */
  turnSide = 1;
  /** Where it cruises to. */
  tx: number;
  tz: number;
  /** It bit in this strike. */
  bit = false;
  /** How far under the surface its back lies now, metres. */
  under: number = EEL.under;
  /** The body: x, y, z of each segment from the head back (the head is segment 0). */
  readonly chain: Float32Array;

  constructor(readonly id: number, readonly pool: Pool, x: number, y: number, z: number, yaw: number) {
    super(x, y, z, yaw, EEL.radius, EEL.height, EEL.health, 'cruise');
    this.tx = x; this.tz = z;
    this.chain = new Float32Array(EEL.segments * 3);
    // Laid out straight behind the head.
    for (let k = 0; k < EEL.segments; k++) {
      this.chain[k * 3] = x + Math.sin(yaw) * EEL.link * k;
      this.chain[k * 3 + 1] = y;
      this.chain[k * 3 + 2] = z + Math.cos(yaw) * EEL.link * k;
    }
  }
}

export interface Pool extends Den {
  readonly y: number;
  readonly count: number;
}

export class Eels extends Population<Pool, Eel> {
  constructor(level: Level) {
    super(level, 'eels', EEL, { arrive: 0.5, still: 0.1, step: 0, drop: 0, accel: 4, turn: EEL.turn, face: EEL.turn });
    this.apart = 1.5;
  }

  /** How deep the water is at (x, z), metres (negative: dry). */
  private depthAt(x: number, z: number): number {
    return this.level.waterAt(x, z) - this.level.groundAt(x, z);
  }

  protected denIn(key: number, i: number, j: number): Pool | null {
    if (this.level.depth < 5) return null;
    for (const [x, z] of this.sites(i, j, this.level.band.eels, 6)) {
      if (this.depthAt(x, z) < EEL.deep || this.level.sdf(x, this.level.waterAt(x, z) + 0.5, z) < 0.6) continue;
      return { key, x, z, y: this.level.waterAt(x, z) - EEL.under, count: this.countIn(i, j, EEL.count) };
    }
    return null;
  }

  protected hatch(p: Pool, killed: (id: number) => boolean): Eel[] {
    return this.brood(p, 'pool', 4, 0, 1.5, killed, (id, x, _y, z, rng) => {
      const e = new Eel(id, p, x, this.level.waterAt(x, z) - EEL.under, z, rng.range(0, Math.PI * 2));
      e.t = rng.range(1, 5);
      return e;
    });
  }

  /** One eel's step. Returns 1 if it bit you. */
  protected act(e: Eel, prey: Fighter, _ctx: null, dt: number): number {
    const E = EEL;
    e.hurtT += dt;
    e.t += e.mode === 'cruise' ? -dt : dt;
    const water = this.level.waterAt(e.x, e.z);
    if (e.provoked) { e.provoked = false; if (e.mode === 'cruise') e.mode = 'hunt'; }
    if (e.dead) {
      // Belly up at the surface, drifting.
      e.deadT += dt;
      this.swimStep(e, e.yaw, 0, dt);
      e.y += (water - 0.05 - e.y) * Math.min(1, dt * 2);
      this.drawOut(e);
      return 0;
    }
    const dx = prey.x - e.x, dz = prey.z - e.z, d = Math.hypot(dx, dz), toYou = Math.atan2(-dx, -dz);
    // It can get at you if you are in water it can swim, or at the edge of it.
    const sx = prey.x - (dx / (d || 1)) * (E.reach * 0.7), sz = prey.z - (dz / (d || 1)) * (E.reach * 0.7);
    const reachable = !prey.dead && Math.abs(prey.y - water) < 1.6 && this.depthAt(sx, sz) >= E.wet;
    if (e.mode === 'cruise' && reachable && d < E.notice) e.mode = 'hunt';
    if ((e.mode === 'hunt') && (!reachable || d > E.forget)) { e.mode = 'cruise'; e.t = 0; }

    let bit = 0, rise = 0;
    switch (e.mode) {
      case 'cruise':
        if (e.t <= 0 || Math.hypot(e.tx - e.x, e.tz - e.z) < 1) {
          [e.tx, e.tz] = this.roamFrom(e.pool, E.roam);
          e.t = 8;
        }
        this.swimStep(e, Math.atan2(-(e.tx - e.x), -(e.tz - e.z)), E.cruise, dt);
        break;
      case 'hunt': {
        // To just short of you, then rear up.
        const gap = d - prey.radius - e.radius;
        this.swimStep(e, toYou, gap < E.reach + 0.6 ? E.cruise * 0.5 : E.swim, dt);
        if (gap < E.reach && Math.abs(angleDiff(e.yaw, toYou)) < 0.4) { e.mode = 'rise'; e.t = 0; }
        break;
      }
      case 'rise':
        // Head up out of the water, swaying, eyes on you: the tell.
        this.swimStep(e, toYou, 0, dt);
        rise = Math.min(1, e.t / 0.25);
        if (e.t >= E.rise) { e.mode = 'strike'; e.t = 0; e.bit = false; }
        break;
      case 'strike':
        this.swimStep(e, e.yaw, E.swim * 1.4, dt, true);
        rise = 1;
        if (!e.bit && d - prey.radius - e.radius < E.reach * 0.6 + 0.3) {
          damage(prey, this.rng.range(E.damage[0], E.damage[1]), e.x, e.z, 1.5, 'eel');
          e.bit = true;
          bit = 1;
        }
        if (e.t >= E.strike) { e.mode = 'sink'; e.t = 0; }
        break;
      case 'sink':
        // Back under and away, then round again.
        this.swimStep(e, e.yaw + angleDiff(e.yaw, toYou + Math.PI) * 0.5, E.cruise, dt);
        rise = Math.max(0, 1 - e.t / 0.4);
        if (e.t >= E.sink) e.mode = reachable ? 'hunt' : 'cruise';
        break;
    }
    e.under += ((e.mode === 'cruise' ? E.under : E.surface) - e.under) * Math.min(1, dt * 2);
    const target = water - e.under + rise * (e.under + E.out);
    e.y += (target - e.y) * Math.min(1, dt * 8);
    this.drawOut(e);
    return bit;
  }

  /**
   * Swim along `heading` at up to `speed`: it turns at its own rate (never more), eases its speed,
   * and never goes into water too shallow for it; if the water ahead is, it turns away, always to
   * the same side until it is clear (so it cannot dither). `lunge`: no turning, full speed at once.
   */
  private swimStep(e: Eel, heading: number, speed: number, dt: number, lunge = false): void {
    const E = EEL;
    if (!lunge) e.yaw += Math.max(-E.turn * dt, Math.min(E.turn * dt, angleDiff(e.yaw, heading)));
    e.speed = lunge ? speed : e.speed + (speed - e.speed) * Math.min(1, dt * 3);
    const ahead = 0.6 + e.speed * 0.3;
    if (this.depthAt(e.x - Math.sin(e.yaw) * ahead, e.z - Math.cos(e.yaw) * ahead) < E.wet) {
      e.yaw += e.turnSide * E.turn * dt;
      e.speed *= Math.max(0, 1 - dt * 4);
    } else if (Math.abs(angleDiff(e.yaw, heading)) < 0.3) e.turnSide = angleDiff(e.yaw, heading) >= 0 ? 1 : -1;
    const nx = e.x - Math.sin(e.yaw) * e.speed * dt, nz = e.z - Math.cos(e.yaw) * e.speed * dt;
    if (this.depthAt(nx, nz) >= E.wet * 0.8) { e.x = nx; e.z = nz; } else e.speed = 0;
    e.vx = -Math.sin(e.yaw) * e.speed;
    e.vz = -Math.cos(e.yaw) * e.speed;
  }

  /** The body follows the head: each segment keeps its link's length to the one before it. */
  private drawOut(e: Eel): void {
    const c = e.chain, L = EEL.link, water = this.level.waterAt(e.x, e.z);
    c[0] = e.x; c[1] = e.y; c[2] = e.z;
    for (let k = 1; k < EEL.segments; k++) {
      const i = k * 3, dx = c[i] - c[i - 3], dz = c[i + 2] - c[i - 1];
      // The body stays under the surface even when the head is out.
      const ty = Math.min(c[i - 2], water - e.under - (EEL.under - e.under) * (k < 3 ? k / 3 : 1) * 0.3), dy = c[i + 1] - ty;
      const l = Math.hypot(dx, dy, dz) || 1;
      c[i] = c[i - 3] + (dx / l) * L;
      c[i + 1] = ty + (dy / l) * L * 0.3;
      c[i + 2] = c[i - 1] + (dz / l) * L;
    }
  }
}
