/**
 * Blows (docs/ARCHITECTURE.md, "Gameplay"): whether one reaches someone (`reach`), and what it does
 * to them (`damage`). The one way health goes down in a fight: nothing else writes it.
 *
 * Pure: the game, the creatures and tests use it.
 */

/** Someone a blow can land on. */
export interface Fighter {
  x: number;
  y: number;
  z: number;
  /** Horizontal velocity, pushed by a blow's knockback. */
  vx: number;
  vz: number;
  /** Body radius and height (the target of a blow is the cylinder they span). */
  readonly radius: number;
  readonly height: number;
  readonly dead: boolean;
  /** Out of the way of blows just now (the nobody mid-roll): a blow misses, and pushes nothing. */
  readonly evading?: boolean;
  /** Take `amount` of health; `cause` says what for (the death screen tells it). */
  hurt(amount: number, cause: string): void;
}

/** A blow from (x, y, z) (the attacker's feet) facing `yaw` (forward is (-sin yaw, -cos yaw)). */
export interface Blow {
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** How far it reaches beyond the attacker's centre to the target's surface, metres. */
  range: number;
  /** Half the angle it sweeps, radians. */
  arc: number;
  /** The heights it covers over the attacker's feet, metres. */
  low: number;
  high: number;
}

/** How far a blow reaches: range, arc and heights (as in Blow). */
export type Swing = Pick<Blow, 'range' | 'arc' | 'low' | 'high'>;

/** The blow `s` struck by someone standing at `at` facing `yaw`. */
export function blowFrom(at: { readonly x: number; readonly y: number; readonly z: number }, yaw: number, s: Swing): Blow {
  return { x: at.x, y: at.y, z: at.z, yaw, range: s.range, arc: s.arc, low: s.low, high: s.high };
}

/** Whether `b` reaches `t`: within range of its surface, inside the arc, at a height the blow covers. */
export function reach(b: Blow, t: Fighter): boolean {
  if (t.dead) return false;
  const dx = t.x - b.x, dz = t.z - b.z, d = Math.hypot(dx, dz);
  if (d - t.radius > b.range) return false;
  if (t.y + t.height < b.y + b.low || t.y > b.y + b.high) return false;
  if (d < t.radius) return true; // (touching: any direction)
  const fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw);
  const cos = (dx * fx + dz * fz) / d;
  // The arc widens by the target's size: its edge counts.
  return Math.acos(Math.max(-1, Math.min(1, cos))) <= b.arc + Math.asin(Math.min(1, t.radius / d));
}

/** The nearest target `b` reaches, or null. */
export function nearestReached<T extends Fighter>(b: Blow, targets: Iterable<T>): T | null {
  let best: T | null = null, bd = Infinity;
  for (const t of targets) {
    if (!reach(b, t)) continue;
    const d = Math.hypot(t.x - b.x, t.z - b.z);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

/** `amount` of damage to `t` from a blow struck at (fromX, fromZ), knocking it back at `knock` m/s. */
export function damage(t: Fighter, amount: number, fromX: number, fromZ: number, knock: number, cause: string): void {
  if (t.dead || amount <= 0 || t.evading) return;
  t.hurt(amount, cause);
  const dx = t.x - fromX, dz = t.z - fromZ, d = Math.hypot(dx, dz) || 1;
  t.vx += (dx / d) * knock;
  t.vz += (dz / d) * knock;
}
