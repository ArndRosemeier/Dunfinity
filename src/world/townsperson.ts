/**
 * Someone standing in the town one can call on (Frau Weber, the stranger at Ilse's): where they
 * stand, turning to whoever comes near and back to the street, whether one is near enough to talk,
 * whether they are talking, and their blocker so one does not walk through them. Pure.
 */
import { TOWN } from '../gen/town';
import { BLOCKER_STRIDE } from './blockers';

/** How near one must stand to talk; how near one must come for them to turn to you, and how fast they turn (radians a second); seconds they go on talking. */
export interface Manner {
  readonly reach: number;
  readonly notice: number;
  readonly turn: number;
  readonly talk: number;
}

export class Townsperson {
  readonly y = TOWN.ground;
  readonly vx = 0;
  readonly vz = 0;
  readonly health = 1;
  readonly dead = false;
  /** Which way they face; when they began talking. */
  yaw: number;
  talkAt = -Infinity;

  /** At (x, z), looking out at the street along `street` (a yaw). */
  constructor(readonly x: number, readonly z: number, private readonly street: number, private readonly manner: Manner) {
    this.yaw = street;
  }

  /** Their blocker box (src/world/blockers.ts), put under their key at depth 0. */
  get blocker(): Float32Array {
    const b = new Float32Array(BLOCKER_STRIDE);
    b.set([this.x, this.z, 0.25, 0.25, 1, 0, this.y, this.y + 1.6]);
    return b;
  }

  /** Whether one standing at (x, z) is near enough to talk to them. */
  canHear(x: number, y: number, z: number): boolean {
    return Math.abs(y - this.y) < 1.2 && Math.hypot(x - this.x, z - this.z) < this.manner.reach;
  }

  /** Whether they are talking at `now` (their hands go). */
  talking(now: number): boolean {
    return now - this.talkAt < this.manner.talk;
  }

  /** Turn by `dt` towards someone at (x, z) if they are near, else back to the street. */
  turn(x: number, z: number, dt: number): void {
    const M = this.manner, want = Math.hypot(x - this.x, z - this.z) < M.notice ? Math.atan2(-(x - this.x), -(z - this.z)) : this.street;
    const d = Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw));
    this.yaw += Math.max(-M.turn * dt, Math.min(M.turn * dt, d));
  }
}
