/**
 * Blows (docs/ARCHITECTURE.md, "Gameplay"): whether one reaches someone (`reach`), and what it does
 * to them (`damage`). The one way health goes down in a fight: nothing else writes it.
 *
 * Pure: the game, the creatures and tests use it.
 */

/**
 * A stab with the kitchen knife: seconds it takes, when it lands, its reach (beyond the nobody's
 * centre), sweep and heights, damage and knockback; and how far it turns the nobody to a rat.
 */
export const STAB = { dur: 0.42, hit: 0.19, range: 0.95, arc: 0.85, low: -0.3, high: 1.3, damage: [6, 10] as const, knock: 3.5, aim: 2.4, aimArc: 1.2 };

/** How a weapon is swung (docs/design/items.md F4): the knife stabs, a hatchet chops, a pick comes down two-handed, a crowbar swats. */
export type Move = 'stab' | 'chop' | 'mine' | 'swat';

/**
 * Each move as STAB is: seconds, when it lands, reach, sweep, heights, damage and knockback; with
 * the humanoid action that shows it (`anim`) and the swing's sound (`sound`, played at `pitch`).
 */
export interface MoveDef extends Swing {
  readonly dur: number;
  readonly hit: number;
  readonly damage: readonly [number, number];
  readonly knock: number;
  readonly anim: string;
  readonly sound: string;
  readonly pitch: number;
}

export const MOVES: Readonly<Record<Move, MoveDef>> = {
  // Quick, short, light.
  stab: { ...STAB, anim: 'swing_1h', sound: 'knife_swing', pitch: 1 },
  // A hatchet: raised over the shoulder and brought down hard; slower, a narrower sweep.
  chop: { dur: 0.72, hit: 0.38, range: 1.05, arc: 0.6, low: -0.3, high: 1.5, damage: [11, 16], knock: 4.5, anim: 'swing_1h', sound: 'knife_swing', pitch: 0.7 },
  // A pick, two hands, high over the head: slowest and hardest, a narrow line and a long reach.
  mine: { dur: 1.05, hit: 0.56, range: 1.25, arc: 0.4, low: -0.4, high: 1.6, damage: [16, 24], knock: 5, anim: 'mine', sound: 'throw', pitch: 0.7 },
  // A crowbar swung side to side: wide, middling, and it knocks them well back.
  swat: { dur: 0.6, hit: 0.3, range: 1.15, arc: 1.05, low: -0.3, high: 1.4, damage: [7, 11], knock: 9, anim: 'swing_1h', sound: 'knife_swing', pitch: 0.8 },
};

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
  /** Not to be hurt at all (the debug menu's invulnerability): a blow does nothing, not even push. */
  readonly invulnerable?: boolean;
  /**
   * The share of a blow from (fromX, fromZ) that gets through its guard (1: no guard), called once
   * per blow (it may cost the guard something).
   */
  shield?(fromX: number, fromZ: number): number;
  /** How far off things notice it, a share of their usual (the nobody tiptoeing: grandma's Tiptoe card). */
  readonly hush?: number;
  /** Take `amount` of health; `cause` says what for (the death screen tells it). */
  hurt(amount: number, cause: string): void;
}

/** Whether something that notices prey `notice` metres off notices `prey`, `d` metres away (hushed if it tiptoes). */
export function noticed(prey: Fighter, d: number, notice: number): boolean {
  return d < notice * (prey.hush ?? 1);
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

/**
 * What the grandchild hurts things with: the knife (struck and thrown), grandma's cards (Flame,
 * Pin, the Matchstick's fire and the Flour Bag's burst, Snapdragons, Horseradish) and the salt
 * pet ('salt-pet', `GRUDGE`). A creature killed by one of these counts as the grandchild's kill
 * (the tally, its loot); one killed by another creature does not.
 */
const YOURS: ReadonlySet<string> = new Set(['knife', 'fire', 'force', 'flour', 'match', 'snapdragon', 'horseradish', 'salt-pet']);

/** Whether hurt of `cause` is the grandchild's doing. */
export function byYou(cause: string): boolean {
  return YOURS.has(cause);
}

/** `amount` of damage to `t` from a blow struck at (fromX, fromZ), knocking it back at `knock` m/s. */
export function damage(t: Fighter, amount: number, fromX: number, fromZ: number, knock: number, cause: string): void {
  if (t.dead || amount <= 0 || t.evading || t.invulnerable) return;
  const through = t.shield?.(fromX, fromZ) ?? 1;
  amount *= through; knock *= through;
  if (amount > 0) t.hurt(amount, cause);
  const dx = t.x - fromX, dz = t.z - fromZ, d = Math.hypot(dx, dz) || 1;
  t.vx += (dx / d) * knock;
  t.vz += (dz / d) * knock;
}
