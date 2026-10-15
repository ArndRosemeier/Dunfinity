/**
 * Walking the floor, for creatures (rats, the Salt-Touched): steer to a goal round what is in the
 * way, arrive without overshooting, keep out of the legs of whoever they are after, and settle on
 * the ground. Built to never jitter (Arnd's rule): a walker eases off near its goal and stands still
 * on it, and it keeps to the side it went round something last instead of trying left, right, left.
 *
 * Pure: the level's floor and the props' boxes.
 */
import { angleDiff } from '@futuremagic/core';
import type { Blockers } from '../world/blockers';
import type { Level } from '../gen/level';
import type { Fighter } from '../combat/combat';

/** Someone walking the floor. */
export interface Walker {
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  /** Facing (forward is (-sin yaw, -cos yaw)). */
  yaw: number;
  /** Which way it last went round something in its way (+1 / -1). */
  side: number;
  readonly radius: number;
  readonly height: number;
  readonly dead: boolean;
}

/** How a kind of walker walks. */
export interface Gait {
  /** Slow down within `arrive` metres of the goal, and stop within `still`. */
  arrive: number;
  still: number;
  /** The highest step up it takes, and the deepest drop it will take, metres. */
  step: number;
  drop: number;
  /** How fast it gets up to speed, turns to where it goes, and turns to face something (per second). */
  accel: number;
  turn: number;
  face: number;
}

export class Steer {
  /** The props in the way (src/world/blockers.ts). */
  blockers: Blockers | null = null;
  /** Whom the walkers are after: they stop at their legs instead of pushing into them. */
  keepOff: Fighter | null = null;

  constructor(private readonly level: Level, private readonly gait: Gait) {}

  /** Steer w towards (gx, gz) at `speed` over the floor, round what is in the way; face `face` if given. Returns the distance moved. */
  move(w: Walker, gx: number, gz: number, speed: number, dt: number, face: number | null): number {
    const G = this.gait;
    let ddx = gx - w.x, ddz = gz - w.z;
    const dist = Math.hypot(ddx, ddz);
    // Arrive: ease off near the goal and stand still on it, so it never overshoots and comes back.
    speed = Math.min(speed, (speed * Math.max(0, dist - G.still)) / G.arrive);
    if (speed > 0.02) {
      ddx /= dist; ddz /= dist;
      let want = Math.atan2(-ddx, -ddz);
      // Round obstacles: the direct way, else ever wider to the side it went round last, and only
      // when that side is shut, the other.
      const step = Math.max(0.05, speed * dt);
      let found = false;
      for (const off of [0, 0.6, 1.2, 1.9, -0.6, -1.2, -1.9]) {
        const a = want + off * w.side;
        if (!this.walkable(w, w.x - Math.sin(a) * step, w.z - Math.cos(a) * step)) continue;
        if (off < 0) w.side = -w.side;
        want = a;
        found = true;
        break;
      }
      if (!found) speed = 0; // boxed in
      if (face === null) w.yaw += angleDiff(w.yaw, want) * Math.min(1, dt * G.turn);
      const fx = -Math.sin(want) * speed, fz = -Math.cos(want) * speed;
      w.vx += (fx - w.vx) * Math.min(1, dt * G.accel);
      w.vz += (fz - w.vz) * Math.min(1, dt * G.accel);
    } else {
      brake(w, G.accel, dt);
    }
    if (face !== null) w.yaw += angleDiff(w.yaw, face) * Math.min(1, dt * G.face);
    return this.slide(w, dt);
  }

  /** Move w by its velocity where the floor allows (not into the legs of `keepOff`: a lunge stops there), settle on the ground. Returns the distance moved. */
  slide(w: Walker, dt: number): number {
    const p = this.keepOff;
    if (p && !w.dead && Math.abs(p.y - w.y) < 1) {
      const ox = w.x - p.x, oz = w.z - p.z, od = Math.hypot(ox, oz);
      const inward = od > 1e-4 ? (w.vx * ox + w.vz * oz) / od : 0;
      if (inward < 0 && Math.hypot(ox + w.vx * dt, oz + w.vz * dt) < p.radius + w.radius * 0.5) { w.vx -= (inward * ox) / od; w.vz -= (inward * oz) / od; }
    }
    const nx = w.x + w.vx * dt, nz = w.z + w.vz * dt;
    let moved = 0;
    if (this.walkable(w, nx, nz)) {
      moved = Math.hypot(nx - w.x, nz - w.z);
      w.x = nx; w.z = nz;
    } else { w.vx *= 0.3; w.vz *= 0.3; }
    const g = this.level.groundAt(w.x, w.z);
    if (Math.abs(g - w.y) < 1.2) w.y += (g - w.y) * Math.min(1, dt * 15);
    return moved;
  }

  /** Can w stand at (x, z), coming from where it is: no wall, no prop, no step it cannot take, no drop, no deep water. */
  walkable(w: Walker, x: number, z: number): boolean {
    const l = this.level;
    if (l.sdf(x, w.y + w.height * 0.5625, z) < w.radius * 0.8) return false;
    if (this.blockers?.hits(x, z, w.radius * 0.8, w.y + 0.05, w.y + 0.3)) return false;
    const g = l.groundAt(x, z);
    if (g - w.y > this.gait.step || w.y - g > this.gait.drop) return false;
    return l.waterAt(x, z) < g + 0.2;
  }
}

/** Slow w down at `rate` (per second) over dt. */
export function brake(w: { vx: number; vz: number }, rate: number, dt: number): void {
  const k = Math.max(0, 1 - dt * rate);
  w.vx *= k;
  w.vz *= k;
}
