/**
 * The level's own animals (docs/design/procedural-creatures.md §6): procedural species from the
 * level's bestiary (src/creatures/bestiary.ts), living in herds, broods, packs and drifts.
 *
 * The peaceful ones graze, wander, watch you from a distance, drift in the air, and keep out of your
 * way. None comes after you; but every one of them fights back when hurt, or flees if the fight is
 * hopeless (Arnd, 2026-10-16), and its power is its size: a colossus that ten metres long kills
 * whoever attacks it.
 *
 * The hunting ones (hunters, lurkers, swarmers, brutes) come after you, and are grown to the size
 * that makes them a fair fight for their level (`fitSize`: power is still size, so a level-1 hunter is
 * a small thing and a level-30 brute a big one). Each blow has its tell: the wind-up, then the lunge
 * or the slam; after it they spring back and come again. Badly hurt, they run.
 *
 * How each species lives comes from its temper (src/creatures/temper.ts), grown with its body: its
 * pace, its flock (a cluster, a procession in single file, a scatter, loners), how curious or shy
 * it is, what its herd does in alarm (bolt, scatter, freeze, bunch up), its nerve and its warning,
 * its habits while it grazes, and what it makes of your headlamp.
 *
 * Levels 1 to 10 have them rarely (the hand-made foes rule there); deeper, more often.
 *
 * Pure: floor walking with src/creatures/steer.ts, blows through src/combat. Herds are fixed by the
 * seed; the dead stay dead on this visit.
 */
import { angleDiff, clamp, hash3f } from '@futuremagic/core';
import type { Level } from '../gen/level';
import { damage, type Fighter, noticed } from '../combat/combat';
import { Creature } from './creature';
import { Population, type Den } from './population';
import { brake } from './steer';
import { AGGRESSION, bestiaryOf, type Species } from './bestiary';
import { habitAction, temperOf, type Flock, type Pace, type Strategy, type Temper } from './temper';
import type { Lamp } from './crickets';

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

/** The hunting kinds: how often a den is theirs, how they find you, and their fair power per level. */
export const HUNT = {
  /** Share of the dens that are hunters' on levels 1–10 and deeper. */
  share: 0.3,
  deeper: 0.45,
  /** An ambusher comes for you only from this share of its range; they all give up beyond `forget` (and beyond its range). */
  lurk: 0.35,
  forget: 32,
  /** One that comes for you: its fair health on level d, base + per·d, times its strategy's share (one charger is a pack's worth). */
  base: 12,
  per: 2.5,
  strategy: { pack: 1, swarm: 0.35, ambush: 1.4, charge: 3 } as Readonly<Record<Strategy, number>>,
  /** The wind-up before its blow, s (a charger's slam is slower and plainer), and the lunge's speed share of its run. */
  windup: { pack: 0.4, swarm: 0.3, ambush: 0.3, charge: 0.65 } as Readonly<Record<Strategy, number>>,
  lunge: 1.2,
  /** After a blow: how long it springs back, s; the least time between its blows; how far off it waits meanwhile, in lengths. */
  back: 0.6,
  every: 1.8,
  wait: 1.5,
  /** At most this many of a pack strike at once; the rest wait their turn round you. */
  together: 2,
  /** Sizes it may be grown to. */
  size: [0.25, 3] as const,
} as const;

export type CritterMode = 'graze' | 'wander' | 'watch' | 'approach' | 'freeze' | 'bunch' | 'drawn' | 'lurk' | 'flee' | 'fight' | 'stalk' | 'back' | 'dead';

/** Each pace (src/creatures/temper.ts): its wander speed (a share of the walk), how long it grazes, s, and how far it roams (a share). */
const PACE: Readonly<Record<Pace, { speed: number; graze: readonly [number, number]; roam: number }>> = {
  plod: { speed: 0.4, graze: [5, 12], roam: 0.7 },
  steady: { speed: 0.6, graze: [2, 8], roam: 1 },
  dart: { speed: 0.3, graze: [2, 6], roam: 1 },
  restless: { speed: 0.85, graze: [0.5, 2], roam: 1.4 },
};
/** How far each flock roams from its place (a share). */
const FLOCK: Readonly<Record<Flock, { roam: number }>> = { cluster: { roam: 0.45 }, file: { roam: 1.6 }, scatter: { roam: 1.6 }, loner: { roam: 2.4 } };
/** The headlamp draws or drives off the ones it shines on within this far, metres. */
const LIT = 16;

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
  /** Seconds until a hunter may strike again. */
  cool = 0;
  /** Its action is a habit or a warning (it never lands). */
  harmless = false;
  /** Seconds until its next habit; until it is curious (or drawn to the lamp) again; since its warning. */
  habitT = 3;
  bored = 0;
  warned = 0;
  /** On its way (a darter between dashes, one in a procession catching up). */
  going = false;
  /** Which way it runs off from straight away from you (scattering), radians. */
  veer = 0;
  readonly maxHealth: number;

  constructor(readonly id: number, readonly herd: Herd, x: number, y: number, z: number, yaw: number, readonly size: number) {
    const sp = herd.species, b = bodyOf(sp, size);
    super(x, y, z, yaw, b.radius, b.height, powerOf(sp, size).health, 'graze');
    this.maxHealth = this.health;
    this.tx = x; this.tz = z;
  }

  get species(): Species { return this.herd.species; }
}

export interface Herd extends Den {
  readonly y: number;
  readonly count: number;
  /** Which of the level's species lives here (an index into `Critters.species`). */
  readonly kind: number;
  readonly species: Species;
  /** The size its animals are grown to (1 for peaceful ones; a hunter's fair size for the level). */
  readonly scale: number;
}

/** The walker's body of a species at a size: its radius, and its height (at least 1.5 radii: the floor walker probes for rock at about half its height, and a low, wide body, a serpent, would find only floor). */
export function bodyOf(sp: Species, size = 1): { radius: number; height: number } {
  const radius = sp.radius * size;
  return { radius, height: Math.max(0.1, radius * 1.5, (sp.hipHeight + sp.length * sp.girth * sp.bodyHeight) * size) };
}

/** A species' health and blow at a size (its mass grows with the cube of the size). */
export function powerOf(sp: Species, size = 1): { health: number; blow: number } {
  const m = sp.mass * size ** 3;
  return { health: Math.max(2, HERD.health[0] * m ** HERD.health[1]), blow: Math.max(1, HERD.blow[0] * m ** HERD.blow[1]) };
}

/** The size that gives a hunting species its fair health on level `depth` (see HUNT). */
export function fitSize(sp: Species, depth: number): number {
  const want = (HUNT.base + HUNT.per * depth) * HUNT.strategy[temperOf(sp).strategy];
  const mass = (want / HERD.health[0]) ** (1 / HERD.health[1]);
  return clamp(Math.cbrt(mass / sp.mass), HUNT.size[0], HUNT.size[1]);
}

/** How far off one that attacks comes for you (its own length added; an ambusher only from close): none for one that leaves you be. */
export function rangeOf(sp: Species, len: number): number {
  if (sp.peaceful) return 0;
  const k = (sp.aggression - AGGRESSION.attack) / (1 - AGGRESSION.attack), r = len + AGGRESSION.near + k * (AGGRESSION.far - AGGRESSION.near);
  return temperOf(sp).strategy === 'ambush' ? len + AGGRESSION.near + (r - len - AGGRESSION.near) * HUNT.lurk : r;
}

/** What a species does when it strikes (the rig's action). */
export function strikeOf(sp: Species): string {
  if (sp.tail.tip === 'sting') return 'sting';
  if (sp.plan === 'crab') return 'pinch';
  if (sp.mass > 400) return 'slam';
  if (sp.plan === 'floater') return 'flinch';
  return 'bite';
}

export class Critters extends Population<Herd, Critter, Lamp | null> {
  /** The level's species (one per herd kind), peaceful and hunting. */
  readonly species: readonly Species[];
  private readonly chance: number;
  private readonly share: number;

  constructor(level: Level) {
    super(level, 'critters', HERD, { arrive: 0.6, still: 0.08, step: 0.5, drop: 1.2, accel: 6, turn: 4, face: 5 });
    this.species = level.depth ? bestiaryOf(level.seed, level.depth) : [];
    const shallow = level.depth <= 10;
    this.share = this.species.some((s) => !s.peaceful) ? (shallow ? HUNT.share : HUNT.deeper) : 0;
    // The hunters' dens come on top of the herds' (as many herds as before).
    this.chance = level.depth ? (shallow ? HERD.chance : HERD.deeper) / (1 - this.share) : 0;
    this.apart = 1;
  }

  protected denIn(key: number, i: number, j: number): Herd | null {
    if (!this.species.length) return null;
    for (const [x, z] of this.sites(i, j, this.chance)) {
      const hunting = hash3f(this.seed, i, j, 31) < this.share;
      const kinds = this.species.map((s, k) => [s, k] as const).filter(([s]) => s.peaceful !== hunting);
      const [sp, kind] = kinds[Math.floor(hash3f(this.seed, i, j, 30) * kinds.length)];
      const scale = sp.peaceful ? 1 : fitSize(sp, this.level.depth);
      // Room over its back, and room to walk where the walker feels for rock (see `bodyOf`).
      const b = bodyOf(sp, scale);
      const y = this.floorFor(x, z, Math.max(1, (sp.hipHeight * 2 + sp.altitude) * scale), Math.max(0.5, b.radius * 1.5));
      if (y !== null && this.floorFor(x, z, b.height * 0.5625, b.radius * 1.2) !== null) return { key, x, z, y, kind, species: sp, scale, count: this.countIn(i, j, sp.group) };
    }
    return null;
  }

  protected hatch(h: Herd, killed: (id: number) => boolean): Critter[] {
    const sp = h.species, body = bodyOf(sp, h.scale), len = sp.totalLength * h.scale, spread = Math.max(1.5, len * 2);
    return this.brood(h, 'herd', 16, len * 0.6, spread, killed, (id, x, y, z, rng) => {
      const c = new Critter(id, h, x, y, z, rng.range(0, Math.PI * 2), h.scale * rng.range(0.85, 1.15));
      c.t = rng.range(0.5, 6);
      c.habitT = rng.range(1, 12);
      if (!sp.peaceful && temperOf(sp).strategy === 'ambush') c.mode = 'lurk';
      return c;
    }, body.radius * 0.9 + 0.05, body.height * 0.5625);
  }

  /** One animal's step. Returns 1 if it struck you. */
  protected act(c: Critter, prey: Fighter, lamp: Lamp | null, dt: number): number {
    const sp = c.species, H = HERD;
    c.t -= dt;
    if (c.action) c.actionT = Math.min(1, c.actionT + dt / H.strike);
    if (c.dead) { c.action = ''; c.running = false; c.watching = false; return this.lieDead(c, dt, 4); }
    const dx = prey.x - c.x, dz = prey.z - c.z, d = Math.hypot(dx, dz), toYou = Math.atan2(-dx, -dz);
    const len = Math.max(0.2, sp.totalLength * c.size), near = Math.abs(prey.y - c.y) < 2 + c.height;
    // One that attacks comes for you once you are within its range (or it is hurt, or already at you); else it lives as the rest do.
    if (!sp.peaceful) {
      const range = rangeOf(sp, len), lurking = c.mode === 'lurk';
      const spots = (lurking || this.idle(c)) && !prey.dead && near && noticed(prey, d, range);
      if (spots) for (const o of this.herdOf(c)) if (o.mode !== 'flee' && o.mode !== 'stalk' && o.mode !== 'back') { o.mode = 'stalk'; o.action = o.harmless ? '' : o.action; o.harmless = false; }
      if (spots || lurking || c.mode === 'stalk' || c.mode === 'back' || (c.provoked && c.cause === 'knife')) return this.hunt(c, prey, dt, dx, dz, d, toYou, len, near, range);
    }

    const T = temperOf(sp), bold = this.bold(c, T);
    if (c.provoked) {
      c.provoked = false;
      // Fight back, or run if the fight is hopeless (a small thing nips first if you are in reach); the most passive only run.
      if (c.action && c.harmless) { c.action = ''; c.actionT = 0; }
      if (bold && c.cause === 'knife') this.anger(c);
      else if (c.cause === 'knife' && sp.aggression >= AGGRESSION.retaliate && d < len * (0.5 + H.reach) + prey.radius && !c.action) this.attack(c);
      else this.frighten(c, H.flee);
      // The rest of its herd hears it.
      for (const o of this.herdOf(c)) if (o !== c && this.idle(o)) {
        if (bold && this.bold(o, T)) { o.mode = 'fight'; o.t = c.t * 0.7; } else this.alarm(o, T, H.flee * 0.8);
      }
    }
    // Shy ones keep their distance (a giant minds nobody; a curious one lets you closer).
    const shy = this.shyOf(c, len, T);
    c.bored = Math.max(0, c.bored - dt);
    c.warned = Math.max(0, c.warned - dt);
    if (!prey.dead && near && d < shy && this.idle(c) && c.mode !== 'watch') {
      if (T.bluff && bold && !c.warned) { this.warn(c); }
      else if (sp.role === 'watcher' || T.curious > 0.35 || c.mode === 'approach') { c.mode = 'watch'; c.t = 3; }
      else {
        // It startles, and its herd with it.
        this.alarm(c, T, 2 + H.flee * 0.4);
        for (const o of this.herdOf(c)) if (o !== c && this.idle(o) && Math.hypot(o.x - c.x, o.z - c.z) < 12) this.alarm(o, T, 2 + H.flee * 0.4);
      }
    }
    // Pushed on after its warning: it goes for you.
    if (c.mode === 'watch' && T.bluff && bold && c.warned > 0 && d < shy * 0.55 && !c.action) this.anger(c, 0.5);
    if (c.mode === 'fight' && (prey.dead || c.t <= 0 || d > 25 || !near)) { c.mode = 'wander'; c.t = 0; }
    // A curious one comes over to look at you, now and then.
    if (T.curious > 0.35 && !prey.dead && near && !c.bored && (c.mode === 'graze' || c.mode === 'wander') && d < shy * 3 + 6 && d > shy * 1.3) {
      c.mode = 'approach'; c.t = this.rng.range(8, 18) * (0.5 + T.curious);
    }
    // The headlamp: drawn to it, or out of its beam.
    if (lamp && T.lamp !== 'none' && (c.mode === 'graze' || c.mode === 'wander' || c.mode === 'drawn')) this.lampFor(c, lamp, T, shy, len);

    c.watching = c.mode === 'watch' || c.mode === 'fight' || c.mode === 'approach' || c.mode === 'bunch' && bold || (d < shy * 2.5 && sp.role !== 'giant' && !prey.dead && c.mode !== 'freeze');
    let struck = 0;
    if (c.action) {
      // The blow lands at the end of the wind-up, if you are still in reach in front of it (a habit or a warning never lands).
      if (!c.harmless) c.yaw += angleDiff(c.yaw, toYou) * Math.min(1, dt * 3);
      brake(c, 6, dt);
      this.steer.slide(c, dt);
      if (!c.struck && c.actionT * H.strike >= H.windup) {
        c.struck = true;
        const ahead = Math.abs(angleDiff(c.yaw, toYou)) < 1.1;
        if (!c.harmless && ahead && near && d - prey.radius - c.radius < len * H.reach + 0.2) {
          const { blow } = powerOf(sp, c.size);
          damage(prey, this.rng.range(0.8, 1.2) * blow, c.x, c.z, clamp(1 + blow * 0.08, 1, 9), sp.mass * c.size ** 3 > 400 ? 'colossus' : 'critter');
          struck = 1;
        }
      }
      if (c.actionT >= 1) {
        const harmless = c.harmless;
        c.action = ''; c.actionT = 0; c.harmless = false;
        // A small thing that nipped now runs.
        if (!harmless && c.mode !== 'fight') this.frighten(c, H.flee);
      }
      return struck;
    }

    switch (c.mode) {
      case 'graze':
        c.running = false;
        brake(c, 4, dt);
        this.steer.slide(c, dt);
        // Now and then its habit (a peck, a look round, a show).
        if ((c.habitT -= dt) <= 0) {
          c.habitT = this.rng.range(4, 12);
          const a = habitAction(sp, T);
          if (a && d > shy) { c.action = a; c.actionT = 0; c.struck = false; c.harmless = true; }
        }
        if (c.t <= 0) this.onward(c, T, len);
        break;
      case 'wander':
        c.running = T.pace === 'dart';
        if (this.follows(c, T)) { this.procession(c, sp, len, dt); break; }
        this.steer.move(c, c.tx, c.tz, sp.walkSpeed * c.size * PACE[T.pace].speed + (T.pace === 'dart' ? sp.runSpeed * c.size * 0.4 : 0), dt, null);
        if (Math.hypot(c.tx - c.x, c.tz - c.z) < Math.max(0.3, len * 0.3)) { c.mode = 'graze'; c.t = this.rng.range(PACE[T.pace].graze[0], PACE[T.pace].graze[1]); c.going = false; }
        else if (c.t <= 0) {
          // A darter's dash ends in a freeze (then on to the same place); anyone else gives up on it.
          c.mode = 'graze'; c.going = T.pace === 'dart';
          c.t = T.pace === 'dart' ? this.rng.range(0.5, 1.8) : this.rng.range(PACE[T.pace].graze[0], PACE[T.pace].graze[1]);
        }
        break;
      case 'watch':
        // Stands its ground, eyes on you; backs off if you come closer still.
        c.running = false;
        if (d < shy * 0.6) this.steer.move(c, c.x - (dx / (d || 1)) * 2, c.z - (dz / (d || 1)) * 2, sp.walkSpeed * c.size, dt, toYou);
        else this.steer.move(c, c.x, c.z, 0, dt, toYou);
        if (c.t <= 0 && d > shy) { c.mode = 'graze'; c.t = this.rng.range(1, 4); }
        break;
      case 'approach':
        // Comes to look at you from a little way off, and trails after you a while.
        c.running = false;
        this.steer.close(c, prey, shy * 1.15, sp.walkSpeed * c.size * 0.8, dt, shy * 2);
        if (c.t <= 0 || d > shy * 4 + 10) { c.mode = 'graze'; c.t = this.rng.range(1, 3); c.bored = this.rng.range(25, 45); }
        break;
      case 'freeze':
        // Stock still, hoping not to be seen; it bolts if you come right up to it.
        c.running = false;
        brake(c, 10, dt);
        this.steer.slide(c, dt);
        if (!prey.dead && near && d < len + 1.2) this.frighten(c, H.flee);
        else if (c.t <= 0) { c.mode = 'graze'; c.t = this.rng.range(1, 3); }
        break;
      case 'bunch': {
        // Into the middle of the herd, the big ones facing you.
        c.running = false;
        const [mx, mz] = this.herdMiddle(c), there = Math.hypot(mx - c.x, mz - c.z) < len * 1.5 + 0.5;
        this.steer.move(c, mx, mz, there ? 0 : sp.walkSpeed * c.size, dt, there && bold ? toYou : null);
        if (c.t <= 0) { c.mode = 'graze'; c.t = this.rng.range(1, 3); }
        break;
      }
      case 'drawn':
        // Drawn to the headlamp's light: comes into the beam and mills there, eyes on it.
        c.running = false;
        this.steer.move(c, c.tx, c.tz, sp.walkSpeed * c.size * 0.7, dt, Math.hypot(c.tx - c.x, c.tz - c.z) < len + 0.6 ? toYou : null);
        if (c.t <= 0) { c.mode = 'graze'; c.t = this.rng.range(1, 3); c.bored = this.rng.range(10, 20); }
        break;
      case 'flee':
        c.running = true;
        this.steer.move(c, c.x - (Math.cos(c.veer) * dx - Math.sin(c.veer) * dz) / (d || 1) * 6, c.z - (Math.sin(c.veer) * dx + Math.cos(c.veer) * dz) / (d || 1) * 6, sp.runSpeed * c.size, dt, null);
        if (c.t <= 0) { this.onward(c, T, len); c.t = 6; c.veer = 0; }
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

  /** It is about its own business (not running, fighting, freezing or in an action). */
  private idle(c: Critter): boolean {
    return !c.dead && !c.action && (c.mode === 'graze' || c.mode === 'wander' || c.mode === 'watch' || c.mode === 'approach' || c.mode === 'drawn');
  }

  /** Heavy enough to fight back (by its nerve: a timid one needs more weight) and not too hurt. */
  private bold(c: Critter, T: Temper): boolean {
    const sp = c.species;
    if (sp.aggression < AGGRESSION.retaliate) return false;
    return sp.mass * c.size ** 3 >= HERD.bold * (2.2 - 1.8 * T.nerve) && c.health > c.maxHealth * HERD.hopeless * (1.4 - 0.8 * T.nerve);
  }

  /** How close you may come before it minds (a giant minds nobody; a curious one lets you nearer, a shy one less). */
  private shyOf(c: Critter, len: number, T: Temper): number {
    const r = c.species.role;
    const base = r === 'giant' ? 0 : r === 'scuttler' ? 2.5 + len : r === 'watcher' ? 3.5 + len : 4 + len * 1.5;
    return base * (1 - 0.45 * T.curious);
  }

  /** Angry: it comes for you this long (bigger ones longer; `k` of it). */
  private anger(c: Critter, k = 1): void {
    c.mode = 'fight';
    c.t = HERD.anger * (1 + Math.log10(1 + c.species.mass) * 0.5) * k;
  }

  /** A warning: it rears up at you (harmless), then watches; come closer still and it fights. */
  private warn(c: Critter): void {
    c.mode = 'watch'; c.t = 4; c.warned = 8;
    c.action = 'rear'; c.actionT = 0; c.struck = false; c.harmless = true;
  }

  /** Frightened: as its temper says, it bolts, scatters, freezes or bunches up (for about `t` seconds). */
  private alarm(c: Critter, T: Temper, t: number): void {
    switch (T.alarm) {
      case 'freeze': c.mode = 'freeze'; c.t = t * 1.2; break;
      case 'bunch': c.mode = 'bunch'; c.t = t * 1.2; break;
      case 'scatter': this.frighten(c, t); c.veer = ((c.id * 2654435761) % 1000 / 1000 - 0.5) * 2.2; break;
      default: this.frighten(c, t);
    }
  }

  /** Its herd's living. */
  private herdOf(c: Critter): Critter[] {
    return this.list.filter((o) => o.herd === c.herd && !o.dead);
  }

  /** The middle of its herd's living. */
  private herdMiddle(c: Critter): [number, number] {
    const h = this.herdOf(c);
    let x = 0, z = 0;
    for (const o of h) { x += o.x; z += o.z; }
    return h.length ? [x / h.length, z / h.length] : [c.herd.x, c.herd.z];
  }

  /** Done grazing: on somewhere new, as its pace and flock say (a darter dashes on to where it was going). */
  private onward(c: Critter, T: Temper, len: number): void {
    const P = PACE[T.pace], F = FLOCK[T.flock], roam = Math.max(HERD.roamMin, len * HERD.roam) * P.roam * F.roam;
    if (!c.going) {
      if (T.flock === 'cluster') {
        // The herd drifts together: round its middle, the middle drawn back towards home.
        const [mx, mz] = this.herdMiddle(c);
        [c.tx, c.tz] = this.roamFrom({ key: c.herd.key, x: mx * 0.7 + c.herd.x * 0.3, z: mz * 0.7 + c.herd.z * 0.3 }, roam);
      } else [c.tx, c.tz] = this.roamFrom(c.herd, roam);
    }
    c.mode = 'wander';
    c.t = T.pace === 'dart' ? this.rng.range(0.4, 0.9) : 4 + len * 2;
    c.going = false;
  }

  /** In a procession (single file) and not its head: it follows the one before it. */
  private follows(c: Critter, T: Temper): boolean {
    if (T.flock !== 'file') return false;
    const h = this.herdOf(c);
    return h.indexOf(c) > 0;
  }

  /** Follow the one before it in the file: moves when it has fallen behind, stops close up (never dithering between the two). */
  private procession(c: Critter, sp: Species, len: number, dt: number): void {
    const h = this.herdOf(c), ahead = h[h.indexOf(c) - 1], gap = c.radius + ahead.radius + len * 0.4;
    const d = Math.hypot(ahead.x - c.x, ahead.z - c.z);
    if (d > gap * 1.8) c.going = true;
    else if (d < gap * 1.1) c.going = false;
    if (c.going) this.steer.close(c, ahead, gap, sp.walkSpeed * c.size * (d > gap * 5 ? 1 : 0.6), dt, 0);
    else { brake(c, 4, dt); this.steer.slide(c, dt); }
    c.t = 1;
  }

  /** The headlamp's pull on it: one drawn to it comes into the beam (a little way off you); one that shuns it walks out of it. */
  private lampFor(c: Critter, lamp: Lamp, T: Temper, shy: number, len: number): void {
    const dx = c.x - lamp.x, dy = c.y + c.height / 2 - lamp.y, dz = c.z - lamp.z, d = Math.hypot(dx, dy, dz);
    const lit = d > 0.01 && d < LIT && (dx * lamp.dx + dy * lamp.dy + dz * lamp.dz) / d > lamp.cos;
    if (!lit) return;
    const fl = Math.hypot(lamp.dx, lamp.dz) || 1, fx = lamp.dx / fl, fz = lamp.dz / fl;
    if (T.lamp === 'moth') {
      if (c.bored) return;
      const out = Math.max(shy * 1.15, 2.5 + len);
      if (c.mode !== 'drawn') { c.mode = 'drawn'; c.t = this.rng.range(6, 14); }
      c.tx = lamp.x + fx * out; c.tz = lamp.z + fz * out;
    } else if (c.mode !== 'wander' || c.t > 3.5) {
      // Out of the beam, to the side it is already on.
      const side = fx * dz - fz * dx > 0 ? 1 : -1, w = 4 + len;
      c.tx = c.x - fz * side * w; c.tz = c.z + fx * side * w;
      c.mode = 'wander'; c.t = 3; c.going = false;
    }
  }

  /** A hunting animal's step (see the header). Returns 1 if it struck you. */
  private hunt(c: Critter, prey: Fighter, dt: number, dx: number, dz: number, d: number, toYou: number, len: number, near: boolean, range: number): number {
    const sp = c.species, H = HUNT, run = sp.runSpeed * c.size, plan = temperOf(sp).strategy;
    c.cool -= dt;
    const hopeless = c.health <= c.maxHealth * HERD.hopeless;
    if (c.provoked) {
      c.provoked = false;
      // Hurt: it turns on you, or runs if it is nearly done; its pack comes too.
      if (hopeless) this.frighten(c, HERD.flee * 1.5);
      else if (c.mode !== 'stalk' && c.mode !== 'back') c.mode = 'stalk';
      for (const o of this.list) if (o !== c && o.herd === c.herd && !o.dead && o.mode !== 'flee') if (o.mode !== 'back') o.mode = 'stalk';
    }
    if (c.mode !== 'stalk' && c.mode !== 'back' && c.mode !== 'lurk' && c.mode !== 'flee') c.mode = 'stalk';
    if ((c.mode === 'stalk' || c.mode === 'back') && (prey.dead || d > Math.max(H.forget, range * 1.3) || !near)) { c.mode = plan === 'ambush' ? 'lurk' : 'wander'; c.t = 0; }
    c.watching = c.mode === 'stalk' || c.mode === 'back' || c.mode === 'lurk' && d < range * 2;

    const windup = H.windup[plan];
    if (c.action) {
      // The tell, then the lunge (a charger stands and slams); the blow lands as the lunge reaches you.
      c.yaw += angleDiff(c.yaw, toYou) * Math.min(1, dt * (c.actionT * HERD.strike < windup ? 4 : 1));
      const at = c.actionT * HERD.strike, lunging = plan !== 'charge' && at >= windup && at < windup + 0.25;
      if (lunging) this.steer.move(c, prey.x, prey.z, run * H.lunge, dt, null);
      else { brake(c, 6, dt); this.steer.slide(c, dt); }
      let struck = 0;
      if (!c.struck && at >= windup + (plan === 'charge' ? 0 : 0.12)) {
        const ahead = Math.abs(angleDiff(c.yaw, toYou)) < 1.1;
        if (ahead && near && d - prey.radius - c.radius < len * HERD.reach + 0.35) {
          c.struck = true;
          const { blow } = powerOf(sp, c.size);
          damage(prey, this.rng.range(0.8, 1.2) * blow, c.x, c.z, clamp(1 + blow * 0.08, 1, 9), 'hunter');
          struck = 1;
        } else if (!lunging) c.struck = true;
      }
      if (c.actionT >= 1) {
        c.action = ''; c.actionT = 0; c.cool = H.every * this.rng.range(0.8, 1.2);
        if (c.mode === 'stalk') { c.mode = 'back'; c.t = H.back; }
      }
      return struck;
    }

    switch (c.mode) {
      case 'lurk':
        // Still as the rock, until you come too close.
        c.running = false;
        brake(c, 6, dt);
        this.steer.slide(c, dt);
        break;
      case 'back':
        // Springs back from you after its blow, facing you.
        c.running = false;
        this.steer.move(c, c.x - (dx / (d || 1)) * 3, c.z - (dz / (d || 1)) * 3, run * 0.7, dt, toYou);
        if (c.t <= 0) c.mode = 'stalk';
        break;
      case 'stalk': {
        // Comes for you; waits a little way off while it gathers for the next blow.
        let striking = 0;
        for (const o of this.list) if (o.herd === c.herd && o.action) striking++;
        const turn = c.cool <= 0 && striking < H.together;
        const stand = c.radius + prey.radius + len * HERD.reach * 0.5, hold = turn ? stand : stand + len * H.wait + 0.5;
        c.running = d > hold + len * 2;
        this.steer.close(c, prey, hold, c.running ? run : run * 0.5, dt, len * 3);
        // In reach of its blow (a lunge carries it the last bit; a charger's slam does not).
        const gap = d - prey.radius - c.radius, lunge = plan === 'charge' ? 0 : Math.min(len, run * H.lunge * 0.2);
        if (turn && gap < len * HERD.reach + 0.2 + lunge && Math.abs(angleDiff(c.yaw, toYou)) < 0.5) this.attack(c);
        break;
      }
      case 'flee':
        c.running = true;
        this.steer.move(c, c.x - (dx / (d || 1)) * 6, c.z - (dz / (d || 1)) * 6, run, dt, null);
        if (c.t <= 0) { [c.tx, c.tz] = this.roamFrom(c.herd, Math.max(HERD.roamMin, len * HERD.roam)); c.mode = 'wander'; c.t = 6; }
        break;
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
