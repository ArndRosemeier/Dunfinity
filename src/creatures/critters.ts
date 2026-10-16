/**
 * The level's own animals (docs/design/procedural-creatures.md §6): procedural species from the
 * level's bestiary (src/creatures/bestiary.ts), living in herds, broods and drifts. These are the
 * peaceful ones: they graze, wander, watch you from a distance, drift in the air, and keep out of
 * your way. None comes after you; but every one of them fights back when hurt, or flees if the fight
 * is hopeless (Arnd, 2026-10-16), and its power is its size: a colossus that ten metres long kills
 * whoever attacks it.
 *
 * Levels 1 to 10 have them rarely (the hand-made foes rule there); deeper, more often.
 *
 * Pure: floor walking with src/creatures/steer.ts, blows through src/combat. Herds are fixed by the
 * seed; the dead stay dead on this visit.
 */
import { angleDiff, clamp, hash3f } from '@futuremagic/core';
import type { Level } from '../gen/level';
import { damage, type Fighter } from '../combat/combat';
import { Creature } from './creature';
import { Population, type Den } from './population';
import { brake } from './steer';
import { bestiaryOf, type Species } from './bestiary';

export const HERD = {
  /** Herds: cell size, chance per cell on levels 1–10 and deeper, none this close to the arrival. */
  cell: 70,
  chance: 0.16,
  deeper: 0.3,
  quiet: 35,
  wake: 70,
  sleep: 95,
  /** How far they wander from their herd's place, in their own lengths (and at least `roam` metres). */
  roam: 4,
  roamMin: 3,
  /** Health and a blow's damage from mass (kg): k·mass^p. You have 100 health and a knife does 6–10. */
  health: [6, 0.55] as const,
  blow: [2.2, 0.45] as const,
  /** Fights back when hurt if it weighs this much (else nips once and runs) and has more than this share of its health left. */
  bold: 12,
  hopeless: 0.3,
  /** How long it stays angry after a blow, s (bigger ones longer). */
  anger: 7,
  /** A blow: the wind-up (the tell) and the whole action, s; its reach beyond touching, in its own lengths. */
  windup: 0.35,
  strike: 0.9,
  reach: 0.3,
  /** How long it runs when frightened, s. */
  flee: 5,
} as const;

export type CritterMode = 'graze' | 'wander' | 'watch' | 'flee' | 'fight' | 'dead';

export class Critter extends Creature<CritterMode> {
  /** Seconds left in the mode (graze, wander, flee, fight). */
  t = 0;
  /** Where it goes. */
  tx: number;
  tz: number;
  /** The action it is in ('bite', 'slam', ...; '' none) and how far (0..1); the rig plays it. */
  action = '';
  actionT = 0;
  /** It struck in this action. */
  struck = false;
  /** Running (the rig's faster gait). */
  running = false;
  /** Watching you (the rig turns its head to you). */
  watching = false;
  readonly maxHealth: number;

  constructor(readonly id: number, readonly herd: Herd, x: number, y: number, z: number, yaw: number, readonly size: number) {
    const sp = herd.species;
    super(x, y, z, yaw, sp.radius * size, Math.max(0.1, (sp.hipHeight + sp.length * sp.girth * sp.bodyHeight) * size), powerOf(sp, size).health, 'graze');
    this.maxHealth = this.health;
    this.tx = x; this.tz = z;
  }

  get species(): Species { return this.herd.species; }
}

export interface Herd extends Den {
  readonly y: number;
  readonly count: number;
  /** Which of the level's peaceful species lives here (an index into `Critters.species`). */
  readonly kind: number;
  readonly species: Species;
}

/** A species' health and blow at a size (its mass grows with the cube of the size). */
export function powerOf(sp: Species, size = 1): { health: number; blow: number } {
  const m = sp.mass * size ** 3;
  return { health: Math.max(2, HERD.health[0] * m ** HERD.health[1]), blow: Math.max(1, HERD.blow[0] * m ** HERD.blow[1]) };
}

/** What a species does when it strikes (the rig's action). */
export function strikeOf(sp: Species): string {
  if (sp.tail.tip === 'sting') return 'sting';
  if (sp.plan === 'crab') return 'pinch';
  if (sp.mass > 400) return 'slam';
  if (sp.plan === 'floater') return 'flinch';
  return 'bite';
}

export class Critters extends Population<Herd, Critter> {
  /** The level's peaceful species (one per herd kind). */
  readonly species: readonly Species[];
  private readonly chance: number;

  constructor(level: Level) {
    super(level, 'critters', HERD, { arrive: 0.6, still: 0.08, step: 0.5, drop: 1.2, accel: 6, turn: 4, face: 5 });
    this.species = level.depth ? bestiaryOf(level.seed, level.depth).filter((s) => s.peaceful) : [];
    this.chance = level.depth ? (level.depth <= 10 ? HERD.chance : HERD.deeper) : 0;
    this.apart = 1;
  }

  protected denIn(key: number, i: number, j: number): Herd | null {
    if (!this.species.length) return null;
    for (const [x, z] of this.sites(i, j, this.chance)) {
      const kind = Math.floor(hash3f(this.seed, i, j, 30) * this.species.length);
      const sp = this.species[kind];
      const y = this.floorFor(x, z, Math.max(1, sp.hipHeight * 2 + sp.altitude), Math.max(0.5, sp.radius * 1.5));
      if (y !== null) return { key, x, z, y, kind, species: sp, count: this.countIn(i, j, sp.group) };
    }
    return null;
  }

  protected hatch(h: Herd, killed: (id: number) => boolean): Critter[] {
    const sp = h.species, spread = Math.max(1.5, sp.totalLength * 2);
    return this.brood(h, 'herd', 16, sp.totalLength * 0.6, spread, killed, (id, x, y, z, rng) => {
      const c = new Critter(id, h, x, y, z, rng.range(0, Math.PI * 2), rng.range(0.85, 1.15));
      c.t = rng.range(0.5, 6);
      return c;
    });
  }

  /** One animal's step. Returns 1 if it struck you. */
  protected act(c: Critter, prey: Fighter, _ctx: null, dt: number): number {
    const sp = c.species, H = HERD;
    c.t -= dt;
    if (c.action) c.actionT = Math.min(1, c.actionT + dt / H.strike);
    if (c.dead) { c.action = ''; c.running = false; c.watching = false; return this.lieDead(c, dt, 4); }
    const dx = prey.x - c.x, dz = prey.z - c.z, d = Math.hypot(dx, dz), toYou = Math.atan2(-dx, -dz);
    const len = Math.max(0.2, sp.totalLength * c.size), near = Math.abs(prey.y - c.y) < 2 + c.height;

    if (c.provoked) {
      c.provoked = false;
      // Fight back, or run if the fight is hopeless (a small thing nips first if you are in reach).
      const bold = sp.mass * c.size ** 3 >= H.bold && c.health > c.maxHealth * H.hopeless;
      if (bold && c.cause === 'knife') { c.mode = 'fight'; c.t = H.anger * (1 + Math.log10(1 + sp.mass) * 0.5); }
      else if (c.cause === 'knife' && d < len * (0.5 + H.reach) + prey.radius && !c.action) this.attack(c);
      else this.frighten(c, H.flee);
      // The rest of its herd hears it.
      for (const o of this.list) if (o !== c && o.herd === c.herd && !o.dead && (o.mode === 'graze' || o.mode === 'wander' || o.mode === 'watch')) {
        if (sp.mass * o.size ** 3 >= H.bold && bold) { o.mode = 'fight'; o.t = c.t * 0.7; } else this.frighten(o, H.flee * 0.8);
      }
    }
    // Shy ones keep their distance (a giant minds nobody).
    const shy = sp.role === 'giant' ? 0 : sp.role === 'scuttler' ? 2.5 + len : sp.role === 'watcher' ? 3.5 + len : 4 + len * 1.5;
    if (!prey.dead && near && d < shy && (c.mode === 'graze' || c.mode === 'wander')) {
      if (sp.role === 'watcher') { c.mode = 'watch'; c.t = 3; } else this.frighten(c, 2 + H.flee * 0.4);
    }
    if (c.mode === 'fight' && (prey.dead || c.t <= 0 || d > 25 || !near)) { c.mode = 'wander'; c.t = 0; }

    c.watching = c.mode === 'watch' || c.mode === 'fight' || (d < shy * 2.5 && sp.role !== 'giant' && !prey.dead);
    let struck = 0;
    if (c.action) {
      // The blow lands at the end of the wind-up, if you are still in reach in front of it.
      c.yaw += angleDiff(c.yaw, toYou) * Math.min(1, dt * 3);
      brake(c, 6, dt);
      this.steer.slide(c, dt);
      if (!c.struck && c.actionT * H.strike >= H.windup) {
        c.struck = true;
        const ahead = Math.abs(angleDiff(c.yaw, toYou)) < 1.1;
        if (ahead && near && d - prey.radius - c.radius < len * H.reach + 0.2) {
          const { blow } = powerOf(sp, c.size);
          damage(prey, this.rng.range(0.8, 1.2) * blow, c.x, c.z, clamp(1 + blow * 0.08, 1, 9), sp.mass > 400 ? 'colossus' : 'critter');
          struck = 1;
        }
      }
      if (c.actionT >= 1) {
        c.action = ''; c.actionT = 0;
        // A small thing that nipped now runs.
        if (c.mode !== 'fight') this.frighten(c, H.flee);
      }
      return struck;
    }

    switch (c.mode) {
      case 'graze':
        c.running = false;
        brake(c, 4, dt);
        this.steer.slide(c, dt);
        if (c.t <= 0) {
          [c.tx, c.tz] = this.roamFrom(c.herd, Math.max(H.roamMin, len * H.roam));
          c.mode = 'wander'; c.t = 4 + len * 2;
        }
        break;
      case 'wander':
        c.running = false;
        this.steer.move(c, c.tx, c.tz, sp.walkSpeed * c.size * 0.6, dt, null);
        if (c.t <= 0 || Math.hypot(c.tx - c.x, c.tz - c.z) < Math.max(0.3, len * 0.3)) { c.mode = 'graze'; c.t = this.rng.range(2, 8); }
        break;
      case 'watch':
        // Stands its ground, eyes on you; backs off if you come closer still.
        c.running = false;
        if (d < shy * 0.6) this.steer.move(c, c.x - (dx / (d || 1)) * 2, c.z - (dz / (d || 1)) * 2, sp.walkSpeed * c.size, dt, toYou);
        else this.steer.move(c, c.x, c.z, 0, dt, toYou);
        if (c.t <= 0 && d > shy) { c.mode = 'graze'; c.t = this.rng.range(1, 4); }
        break;
      case 'flee':
        c.running = true;
        this.steer.move(c, c.x - (dx / (d || 1)) * 6, c.z - (dz / (d || 1)) * 6, sp.runSpeed * c.size, dt, null);
        if (c.t <= 0) { [c.tx, c.tz] = this.roamFrom(c.herd, Math.max(H.roamMin, len * H.roam)); c.mode = 'wander'; c.t = 6; }
        break;
      case 'fight': {
        c.running = d > len * 2;
        const stand = c.radius + prey.radius + len * H.reach * 0.5;
        this.steer.close(c, prey, stand, sp.runSpeed * c.size * 0.8, dt, len * 2);
        if (d - stand < len * H.reach && Math.abs(angleDiff(c.yaw, toYou)) < 0.5) this.attack(c);
        break;
      }
    }
    return 0;
  }

  private attack(c: Critter): void {
    c.action = strikeOf(c.species);
    c.actionT = 0;
    c.struck = false;
  }

  private frighten(c: Critter, t: number): void {
    c.mode = 'flee';
    c.t = t;
  }
}
