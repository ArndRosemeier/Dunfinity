/**
 * Doors that open and shut (grandma's house; src/gen/doorways.ts says where): E at a door swings it,
 * it stops rather than swing through whoever stands in its way, and while shut it blocks like a
 * prop (its box goes into the Blockers under `DOORS_KEY`). The cellar door is strange: it shuts
 * itself once nobody is near it, and it has things to say. Pure.
 */
import type { DoorSpec } from '../gen/doorways';
import { BLOCKER_STRIDE, Blockers } from './blockers';

export const DOOR = {
  /** How near (to the middle of its doorway) one must be to use a door, metres. */
  reach: 1.3,
  /** How fast it swings: the whole way in this many seconds. */
  swing: 0.6,
  /** The panel's half thickness, metres. */
  half: 0.04,
  /** The cellar door: seconds it stands open with nobody within `alone` metres before it shuts itself. */
  wait: 4,
  alone: 2.2,
} as const;

/** The key its boxes go under in the Blockers. */
export const DOORS_KEY = 'doors';

/** What the cellar door does to whoever opens it (in turn). */
const CELLAR_LINES = [
  'The cellar door is colder than the cellar.',
  'Seven locks on it, and not one of them locked.',
  'Her salt signs on the door are still damp, as if she drew them this morning.',
  'Something on the far side lets go of the handle as you take it.',
  'The door opens before you have quite pushed it.',
];

export class Door {
  /** How open: 0 shut … 1 wide open; and which way it is going. */
  open = 0;
  want = 0;
  /** When it last came to stand open. */
  openedAt = 0;
  constructor(readonly spec: DoorSpec) {}

  /** The panel's yaw now. */
  get yaw(): number {
    const t = this.open;
    return this.spec.shut + this.spec.swing * t * t * (3 - 2 * t);
  }

  /** The middle of its doorway (where one reaches for it). */
  get middle(): [number, number] {
    const s = this.spec, w = s.width / 2;
    return [s.x + Math.cos(s.shut) * w, s.z - Math.sin(s.shut) * w];
  }

  /** Its box as a blocker (`BLOCKER_STRIDE` numbers) at `open`, into `out` at `k`. */
  box(out: Float32Array, k: number, open = this.open): void {
    const s = this.spec, t = open, yaw = s.shut + s.swing * t * t * (3 - 2 * t), c = Math.cos(yaw), n = Math.sin(yaw), w = s.width / 2;
    out[k] = s.x + c * w; out[k + 1] = s.z - n * w;
    out[k + 2] = w; out[k + 3] = DOOR.half;
    out[k + 4] = c; out[k + 5] = n;
    out[k + 6] = s.y; out[k + 7] = s.y + s.height;
  }
}

export class Doors {
  readonly list: Door[];
  private readonly boxes: Float32Array;
  private readonly probe = new Blockers();
  private readonly one = new Float32Array(BLOCKER_STRIDE);
  private said = 0;

  constructor(specs: readonly DoorSpec[]) {
    this.list = specs.map((s) => new Door(s));
    this.boxes = new Float32Array(this.list.length * BLOCKER_STRIDE);
  }

  /** The door within reach of someone standing at (x, y, z), nearest first. */
  near(x: number, y: number, z: number): Door | null {
    let best: Door | null = null, d: number = DOOR.reach;
    for (const door of this.list) {
      if (Math.abs(door.spec.y - y) > 1.2) continue;
      const [mx, mz] = door.middle, e = Math.hypot(mx - x, mz - z);
      if (e < d) { d = e; best = door; }
    }
    return best;
  }

  /** Open it, or shut it; what (if anything) there is to say about it. */
  toggle(door: Door, now: number): string {
    door.want = door.want > 0.5 ? 0 : 1;
    if (door.want) door.openedAt = now;
    return door.spec.kind === 'cellar' && door.want ? CELLAR_LINES[this.said++ % CELLAR_LINES.length] : '';
  }

  /**
   * Swing the doors on by `dt`; one that would swing into a body at (x, z) of radius r (from y0 to
   * y1) stops. Returns whether any moved (then `blockers` has their new boxes under `DOORS_KEY`).
   */
  step(dt: number, now: number, x: number, y0: number, y1: number, z: number, r: number, blockers: Blockers): boolean {
    let moved = false;
    for (const door of this.list) {
      if (door.spec.kind === 'cellar' && door.want === 1 && door.open === 1 && now - door.openedAt > DOOR.wait) {
        const [mx, mz] = door.middle;
        if (Math.hypot(mx - x, mz - z) > DOOR.alone) door.want = 0; // it shuts itself
      }
      if (door.open === door.want) continue;
      const next = door.want > door.open ? Math.min(door.want, door.open + dt / DOOR.swing) : Math.max(door.want, door.open - dt / DOOR.swing);
      door.box(this.one, 0, next);
      this.probe.set('door', this.one);
      if (this.probe.hits(x, z, r, y0, y1)) continue; // not through anyone
      door.open = next;
      if (next === 1) door.openedAt = now;
      moved = true;
    }
    if (moved) this.into(blockers);
    return moved;
  }

  /** Put the doors' boxes, as they stand, into `blockers`. */
  into(blockers: Blockers): void {
    this.list.forEach((d, i) => d.box(this.boxes, i * BLOCKER_STRIDE));
    blockers.set(DOORS_KEY, this.boxes);
  }
}
