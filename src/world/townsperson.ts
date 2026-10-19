/**
 * Someone standing in the town one can call on (Frau Weber, the stranger at Ilse's, Kemal and Ilse behind their counters): where they
 * stand, turning to whoever comes near and back to the street, whether one is near enough to talk,
 * whether they are talking, and their blocker so one does not walk through them. Pure.
 */
import { TOWN } from '../gen/town';
import { BLOCKER_STRIDE } from './blockers';
import { turnTowards } from '../creatures/creature';

/** How near one must stand to talk; how near one must come for them to turn to you, and how fast they turn (radians a second); seconds they go on talking. */
export interface Manner {
  readonly reach: number;
  readonly notice: number;
  readonly turn: number;
  readonly talk: number;
}

/** What hearing and talking ask of a person: where they are, how near they hear, how long they talk, and when they last did. */
export interface Person {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly manner: { readonly reach: number; readonly talk: number };
  talkAt: number;
}

/** Whether one standing at (x, y, z) is near enough to call on `person`: on their floor and within their reach. */
export function canHear(person: Person, x: number, y: number, z: number): boolean {
  return Math.abs(y - person.y) < 1.2 && Math.hypot(x - person.x, z - person.z) < person.manner.reach;
}

/** Whether `person` is talking at `now` (their hands go, and they stand still for it). */
export function talking(person: Person, now: number): boolean {
  return now - person.talkAt < person.manner.talk;
}

export class Townsperson {
  readonly y: number = TOWN.ground;
  readonly vx = 0;
  readonly vz = 0;
  readonly health = 1;
  readonly dead = false;
  /** Which way they face; when they began talking. */
  yaw: number;
  talkAt = -Infinity;

  /** At (x, z), looking out at the street along `street` (a yaw), with their own reach and manner. */
  constructor(readonly x: number, readonly z: number, private readonly street: number, readonly manner: Manner) {
    this.yaw = street;
  }

  /** Their blocker box (src/world/blockers.ts), put under their key at depth 0. */
  get blocker(): Float32Array {
    const b = new Float32Array(BLOCKER_STRIDE);
    b.set([this.x, this.z, 0.25, 0.25, 1, 0, this.y, this.y + 1.6]);
    return b;
  }

  /** Turn by `dt` towards someone at (x, z) if they are near, else back to the street. */
  turn(x: number, z: number, dt: number): void {
    const M = this.manner, want = Math.hypot(x - this.x, z - this.z) < M.notice ? Math.atan2(-(x - this.x), -(z - this.z)) : this.street;
    this.yaw = turnTowards(this.yaw, want, M.turn * dt);
  }
}

/** A Townsperson with a few lines they say in turn when called on (the stranger at Ilse's, the shopkeepers). */
export class Talker extends Townsperson {
  private calls = 0;

  constructor(x: number, z: number, street: number, manner: Manner, private readonly lines: readonly string[]) {
    super(x, z, street, manner);
  }

  /** Call on them at `now`: what they say. */
  talk(now: number): string {
    this.talkAt = now;
    return this.lines[this.calls++ % this.lines.length];
  }
}
