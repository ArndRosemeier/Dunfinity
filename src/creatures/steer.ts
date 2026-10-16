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
import type { SaltCircle } from '../gen/lair';
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
  /**
   * Getting nowhere (see `Steer.move`): its goal, the nearest it has come to it, for how long not
   * nearer (seconds), how long it still stands, and for how long it has tried and got nowhere,
   * whatever the goal (`thwarted`).
   */
  aim?: { x: number; z: number; best: number; since: number; wait: number; stuck: number };
  /** Chilled (grandma's Cold Larder): seconds left, and the share of its pace it keeps meanwhile. */
  chill?: { left: number; by: number };
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
  /** Where it checks for rock in the way, as a share of its height over its feet (default 0.5625; wide, low walkers need it higher, or the floor itself is in the way). */
  probe?: number;
}

/**
 * A walker getting no nearer its goal by `share` of what its pace covers in `after` seconds (or in
 * the time it takes to get up to speed, if longer) stands for `wait` seconds; one slowed to `slow`
 * of its pace (arriving) is not trying. A goal moved by `moved` metres is a fresh start.
 */
const GIVE_UP = { share: 0.17, after: 0.12, slow: 0.06, wait: 0.6, moved: 0.6, thwarted: 2.5 } as const;

/**
 * Whether w has tried to get somewhere for a while and got nowhere (its goal up a ledge it cannot
 * take, behind rock): whoever it is after is out of its reach for now.
 */
export function thwarted(w: Walker): boolean {
  return (w.aim?.stuck ?? 0) > GIVE_UP.thwarted;
}

export class Steer {
  /** The props in the way (src/world/blockers.ts). */
  blockers: Blockers | null = null;
  /** Circles of infused salt the walkers will not cross (src/world/saltLine.ts): none step further in. */
  salt: readonly SaltCircle[] = [];
  /** Whom the walkers are after: they stop at their legs instead of pushing into them. */
  keepOff: Fighter | null = null;

  constructor(private readonly level: Level, private readonly gait: Gait) {}

  /** Steer w towards (gx, gz) at `speed` over the floor, round what is in the way; face `face` if given. Returns the distance moved. */
  move(w: Walker, gx: number, gz: number, speed: number, dt: number, face: number | null): number {
    const G = this.gait;
    // A goal over a salt line it is outside of: as near as it may come, on its side of the line (it stands there, not pressing at it).
    for (const c of this.salt) {
      const min = c.r + w.radius + 0.05, ox = w.x - c.x, oz = w.z - c.z, od = Math.hypot(ox, oz);
      if (od >= min - 0.05 && Math.hypot(gx - c.x, gz - c.z) < min && od > 1e-4) { gx = c.x + (ox / od) * min; gz = c.z + (oz / od) * min; }
    }
    let ddx = gx - w.x, ddz = gz - w.z;
    const dist = Math.hypot(ddx, ddz);
    // Arrive: ease off near the goal and stand still on it, so it never overshoots and comes back.
    const pace = speed, after = Math.max(GIVE_UP.after, 1 / G.accel);
    speed = Math.min(speed, (speed * Math.max(0, dist - G.still)) / G.arrive);
    // Getting nowhere (shoved back by its fellows, its goal behind rock or up a ledge, boxed in among
    // fallen blocks): it stands a moment instead of trying this way and that on the spot, and then
    // tries again. A goal that moves on is a fresh start.
    const aim = (w.aim ??= { x: gx, z: gz, best: dist, since: 0, wait: 0, stuck: 0 });
    if (Math.hypot(gx - aim.x, gz - aim.z) > GIVE_UP.moved) { aim.x = gx; aim.z = gz; aim.best = dist; aim.since = 0; aim.wait = 0; }
    if (aim.wait > 0) {
      speed = 0;
      aim.stuck += dt;
      if ((aim.wait -= dt) <= 0) { aim.best = dist; aim.since = 0; }
    } else if (speed > GIVE_UP.slow * pace) {
      if (dist < aim.best - GIVE_UP.share * pace * after) { aim.best = dist; aim.since = 0; aim.stuck = 0; }
      else { aim.stuck += dt; if ((aim.since += dt) > after) aim.wait = GIVE_UP.wait; }
    } else aim.since = aim.stuck = 0;
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

  /**
   * Close in on `f` at `speed`: to just short of it, `stand` metres from its centre, on the line from
   * it to w (a goal that does not swing round as w goes, or w is led round and round). w turns to
   * face it within `face` metres of there. Returns how far w is from f, centre to centre.
   */
  close(w: Walker, f: { readonly x: number; readonly z: number }, stand: number, speed: number, dt: number, face: number): number {
    const dx = f.x - w.x, dz = f.z - w.z, d = Math.hypot(dx, dz);
    this.move(w, f.x - (dx / (d || 1)) * stand, f.z - (dz / (d || 1)) * stand, speed, dt, d - stand < face ? Math.atan2(-dx, -dz) : null);
    return d;
  }

  /** Move w by its velocity (less, chilled) where the floor allows (not into the legs of `keepOff`: a lunge stops there), settle on the ground. Returns the distance moved. */
  slide(w: Walker, dt: number): number {
    const p = this.keepOff;
    if (p && !w.dead && Math.abs(p.y - w.y) < 1) {
      const ox = w.x - p.x, oz = w.z - p.z, od = Math.hypot(ox, oz);
      const inward = od > 1e-4 ? (w.vx * ox + w.vz * oz) / od : 0;
      if (inward < 0 && Math.hypot(ox + w.vx * dt, oz + w.vz * dt) < p.radius + w.radius * 0.5) { w.vx -= (inward * ox) / od; w.vz -= (inward * oz) / od; }
    }
    // Chilled (grandma's Cold Larder): everything it does goes slow, walking, lunging and being knocked back alike.
    const by = w.chill && w.chill.left > 0 ? w.chill.by : 1;
    const nx = w.x + w.vx * dt * by, nz = w.z + w.vz * dt * by;
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
    if (l.sdf(x, w.y + w.height * (this.gait.probe ?? 0.5625), z) < w.radius * 0.8) return false;
    if (this.blockers?.hits(x, z, w.radius * 0.8, w.y + 0.05, w.y + 0.3)) return false;
    for (const c of this.salt) {
      const d = Math.hypot(x - c.x, z - c.z);
      if (d < c.r + w.radius && d < Math.hypot(w.x - c.x, w.z - c.z)) return false;
    }
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
