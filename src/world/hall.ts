/**
 * The hall between worlds: stepping through any window (a thin place, its way back, a gate, Way
 * Home's door) one does not land at once. One stands in a long hall of the world one goes to (its
 * stone, light and haze: a `Glimpse`), the window one came through glowing behind, a doorway
 * glowing at the far end, and walks down it. Meanwhile that world is built behind it (its rock
 * streams in): the doorway opens only once it is ready, and until then the hall goes on (it grows
 * longer ahead of one, the doorway always `more` metres off). Walk into the open doorway and one is
 * there; the hall fades.
 *
 * Pure: where one is in the hall (x across, z along: 0 at the window one came through, down the
 * hall towards -z), how long it is, whether its door is open. The view (src/render/hallView.ts)
 * draws it; the game (src/game/Game.ts) walks it and says when the world is ready.
 */
import type { Glimpse } from './thinPlaces';

export const HALL = {
  /** How long the hall is at first (m), and how far the doorway keeps ahead of one while that world is not ready. */
  length: 16,
  more: 7,
  /** Walking speed in it (m/s: an unhurried walk), and how far one may stray from its middle (m). */
  speed: 3.6,
  side: 3,
  /** Within this of the doorway (m), while it is open, one goes through. */
  door: 1.2,
  /** The window one came through, this far behind where one starts (m). */
  behind: 1.5,
  /** Seconds the hall takes to fade as one comes out. */
  fade: 0.6,
  /** Eye height over its floor (m). */
  eye: 1.6,
} as const;

export class Crossing {
  /** Where one stands in the hall (m). */
  x = 0;
  z = 0;
  /** How long the hall is now (m): its doorway at z = -length. */
  length: number = HALL.length;
  /** Whether that world is ready: the doorway is open (it is lit, and stops moving off). */
  open = false;
  /** Seconds since one came out (null: still in it). */
  out: number | null = null;
  /** Seconds in the hall. */
  age = 0;

  /** `yaw`: which way the hall runs (the way one faces in the world one goes to); `look`: that world's, for its colours; `up`: whether one goes up (towards home: the veins' green glows behind, else their blue). */
  constructor(readonly yaw: number, readonly look: Glimpse, readonly up: boolean) {}

  /**
   * One frame in the hall: walk (`forward`, `right` -1..1, looking `yaw`); `ready`: whether that
   * world is ready. Returns true the frame one walks out of the doorway.
   */
  walk(dt: number, forward: number, right: number, yaw: number, ready: boolean): boolean {
    if (this.out !== null) { this.out += dt; return false; }
    this.age += dt;
    this.open = ready;
    // Walking as one looks, turned into the hall's frame (yaw 0 runs down it).
    const a = yaw - this.yaw, n = Math.hypot(forward, right) || 1, f = forward / n, r = right / n, step = HALL.speed * dt * Math.min(1, Math.hypot(forward, right));
    this.x += (-Math.sin(a) * f + Math.cos(a) * r) * step;
    this.z += (-Math.cos(a) * f - Math.sin(a) * r) * step;
    this.x = Math.max(-HALL.side, Math.min(HALL.side, this.x));
    this.z = Math.min(HALL.behind - 0.5, this.z);
    // Not ready: the doorway keeps off. Ready: it stays where it is, and one walks through it.
    if (!ready) this.length = Math.max(this.length, -this.z + HALL.more);
    else if (-this.z >= this.length - HALL.door) { this.out = 0; return true; }
    this.z = Math.max(-this.length + 0.3, this.z);
    return false;
  }

  /** How much of the hall still shows (1 in it, fading to 0 coming out), and whether it is over. */
  get shown(): number {
    return this.out === null ? 1 : Math.max(0, 1 - this.out / HALL.fade);
  }
  get over(): boolean {
    return this.out !== null && this.out >= HALL.fade;
  }
}
