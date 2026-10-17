/**
 * How a blow feels (the core-loop pass, Arnd 2026-10-17): a blow that lands holds the world still for
 * a few hundredths of a second (the hit-stop), longer for a kill; it jolts the camera a little; a blow
 * you take jolts it harder and reddens the edges of sight. Everything here counts in real seconds, so
 * the hold itself does not slow its own end.
 *
 * Pure: the game feeds it what happened and asks it each frame for the time scale, the camera's jolt
 * and the red edge. `still` (reduced motion) keeps the hold and the red but never moves the camera.
 */

export const FEEL = {
  /** The hold for a blow that lands: base, plus this much times the share of the target's health it took; a kill's, s. */
  stop: 0.035,
  stopPerShare: 0.05,
  stopKill: 0.085,
  /** How slow the world runs during a hold (not quite stopped, so nothing looks frozen). */
  slow: 0.06,
  /** Camera jolt, radians: landing a blow, a kill, and per share of your health a blow takes (at most `hurtMax`). */
  kickHit: 0.012,
  kickKill: 0.02,
  kickHurt: 0.25,
  hurtMax: 0.05,
  /** How fast a jolt dies away, per s, and how fast it shakes, Hz. */
  decay: 9,
  hz: 23,
  /** The red edge: per share of your health a blow takes (at most 1), and how fast it fades, per s. */
  redPerShare: 4,
  redFade: 2.2,
} as const;

export class Feel {
  /** Real seconds of hold left. */
  private hold = 0;
  /** The jolt's size, radians, and its clock, s. */
  private kick = 0;
  private t = 0;
  /** The red edge, 0..1. */
  red = 0;

  /** `still`: reduced motion (the camera is never jolted). */
  constructor(public still = false) {}

  /** A blow of yours landed: `share` of the target's health it had, `killed` whether it died of it. */
  struck(share: number, killed: boolean): void {
    const s = Math.max(0, Math.min(1, share));
    this.hold = Math.max(this.hold, killed ? FEEL.stopKill : FEEL.stop + FEEL.stopPerShare * s);
    this.jolt(killed ? FEEL.kickKill : FEEL.kickHit * (0.5 + s));
  }

  /** You took a blow of `share` of your full health. */
  took(share: number): void {
    const s = Math.max(0, Math.min(1, share));
    this.jolt(Math.min(FEEL.hurtMax, FEEL.kickHurt * s));
    this.red = Math.min(1, Math.max(this.red, FEEL.redPerShare * s));
  }

  private jolt(k: number): void {
    if (k > this.kick) { this.kick = k; this.t = 0; }
  }

  /** Advance by `real` seconds of the wall clock; the time scale the world runs at this frame (1: normal). */
  frame(real: number): number {
    const holding = this.hold > 0;
    this.hold = Math.max(0, this.hold - real);
    this.t += real;
    this.kick *= Math.exp(-FEEL.decay * real);
    if (this.kick < 1e-4) this.kick = 0;
    this.red = Math.max(0, this.red - FEEL.redFade * real);
    return holding ? FEEL.slow : 1;
  }

  /** The camera's jolt this frame: yaw and pitch offsets, radians (none with reduced motion). */
  get yaw(): number {
    return this.still ? 0 : this.kick * Math.sin(this.t * FEEL.hz * 2 * Math.PI);
  }

  get pitch(): number {
    return this.still ? 0 : this.kick * 0.7 * Math.sin(this.t * FEEL.hz * 2 * Math.PI * 0.77 + 1.3);
  }
}
