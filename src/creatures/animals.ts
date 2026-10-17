/**
 * The one mind every animal lives by (Arnd 2026-10-17: the strange creatures and the ordinary
 * animals alike, no kind with a behaviour of its own; people are the exception): what an animal is
 * (its `Nature`: how aggressive, its temper, its weight, length and speeds, its blow) decides how
 * it acts, and the same code steps them all.
 *
 * Its aggression (src/creatures/bestiary.ts `AGGRESSION`) says whether it only flees, fights back
 * when hurt, or comes for you from a range growing with it; its temper (src/creatures/temper.ts)
 * how it lives: its pace, its flock (a cluster, a procession in single file, a scatter, loners), how
 * curious or shy it is, what its lot does in alarm (bolt, scatter, freeze, bunch up), its nerve and
 * its warning, its habits, what it makes of your headlamp, and how it fights once it comes for you
 * (a pack taking turns, an ambusher, a swarm, a charger). Between all that it lives the life of
 * src/creatures/life.ts: off to feed, by its diet, and lying down with its lot in their hours of rest.
 * Every blow has its tell (the wind-up), then the lunge or the slam; badly hurt, it runs.
 *
 * A kind of animal (src/creatures/critters.ts, ...) says where its dens are, what is born in one,
 * and each den's nature; `Animals` does the rest. Pure: floor walking with src/creatures/steer.ts,
 * blows through src/combat.
 */
import { angleDiff, clamp } from '@futuremagic/core';
import { damage, type Fighter, noticed } from '../combat/combat';
import { Creature } from './creature';
import { Population, type Den } from './population';
import { brake, thwarted } from './steer';
import { CANDLE } from '../combat/thrown';
import { AGGRESSION } from './bestiary';
import type { Diet, Flock, Pace, Strategy, Temper } from './temper';
import type { Lamp } from './crickets';
import { LIFE } from './life';

/** How every animal lives and fights back. */
export const CALM = {
  /** How far they wander from their herd's place, in their own lengths (and at least `roam` metres). */
  roam: 4,
  roamMin: 3,
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

/** How the ones that come for you go about it. */
export const HUNTING = {
  /** An ambusher comes for you only from this share of its range; they all give up beyond `forget` (and beyond its range). */
  lurk: 0.35,
  forget: 32,
  /** How long it leaves you be after finding no way to you, s; how long a bluffer rears before it comes, of its action. */
  balk: 8,
  rear: 0.45,
  /** The wind-up before its blow, s (a charger's slam is slower and plainer), and the lunge's speed share of its run. */
  windup: { pack: 0.4, swarm: 0.3, ambush: 0.3, charge: 0.65 } as Readonly<Record<Strategy, number>>,
  lunge: 1.2,
  /** After a blow: how long it springs back, s; the least time between its blows; how far off it waits meanwhile, in lengths. */
  back: 0.6,
  every: 1.8,
  wait: 1.5,
  /** At most this many of a pack strike at once (a swarm: all of it); the rest wait their turn round you. */
  together: 2,
} as const;

/** What an animal is, as far as how it acts goes (a species of the bestiary; a quarry rat, a feral dog). */
export interface Nature {
  /** 0..1: flees only, fights back when hurt, comes for you (AGGRESSION); `peaceful`: it does not come for you. */
  readonly aggression: number;
  readonly peaceful: boolean;
  readonly temper: Temper;
  /** How close it lets you come: a 'giant' minds nobody, a 'scuttler' lets you nearer, a 'watcher' stands and looks. */
  readonly role: string;
  /** At size 1: its weight, kg; its whole length, m; its walk and run, m/s. */
  readonly mass: number;
  readonly totalLength: number;
  readonly walkSpeed: number;
  readonly runSpeed: number;
  /** What its blow is called where you die of it ('rat', 'dog', ...; none: 'critter', 'colossus' or 'hunter'). */
  readonly cause?: string;
  /** Its blow (the rig's action: 'bite', 'slam', ...) and its habit's action ('' none). */
  readonly strike: string;
  readonly habit: string;
  /** Its health and blow at a size. */
  power(size: number): { health: number; blow: number };
}

export type AnimalMode = 'graze' | 'wander' | 'watch' | 'approach' | 'freeze' | 'bunch' | 'drawn' | 'lurk' | 'flee' | 'fight' | 'stalk' | 'back' | 'dead';

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

/** How far off one that attacks comes for you (its own length added; an ambusher only from close): none for one that leaves you be. */
export function rangeOf(n: Pick<Nature, 'peaceful' | 'aggression' | 'temper'>, len: number): number {
  if (n.peaceful) return 0;
  const k = (n.aggression - AGGRESSION.attack) / (1 - AGGRESSION.attack), r = len + AGGRESSION.near + k * (AGGRESSION.far - AGGRESSION.near);
  return n.temper.strategy === 'ambush' ? len + AGGRESSION.near + (r - len - AGGRESSION.near) * HUNTING.lurk : r;
}

export class Animal<D extends Den & { readonly y: number } = Den & { readonly y: number }> extends Creature<AnimalMode> {
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
  /** What it runs from: a candle at (fx, fz), or (NaN) you. */
  fx = NaN;
  fz = NaN;
  /** Seconds it leaves you be, having found no way to you (`HUNTING.balk`). */
  balk = 0;
  readonly maxHealth: number;

  constructor(readonly id: number, readonly den: D, readonly nature: Nature, x: number, y: number, z: number, yaw: number, readonly size: number, radius: number, height: number) {
    super(x, y, z, yaw, radius, height, nature.power(size).health, 'graze');
    this.maxHealth = this.health;
    this.tx = x; this.tz = z;
  }
}

/** A kind of animal on the shared mind: it says where its dens are, what is born in one, and the nature of a den's animals. */
export abstract class Animals<D extends Den & { readonly y: number }, C extends Animal<D>> extends Population<D, C, Lamp | null> {
  /** The nature of the animals of `den`. */
  protected abstract natureIn(den: D): Nature;

  /** One animal's step. Returns 1 if it struck you. */
  protected act(c: C, prey: Fighter, lamp: Lamp | null, dt: number): number {
    const sp = c.nature, H = CALM;
    c.t -= dt;
    if (c.action) c.actionT = Math.min(1, c.actionT + dt / H.strike);
    if (c.dead) { c.action = ''; c.running = false; c.watching = false; return this.lieDead(c, dt, 4); }
    const dx = prey.x - c.x, dz = prey.z - c.z, d = Math.hypot(dx, dz), toYou = Math.atan2(-dx, -dz);
    const len = Math.max(0.2, sp.totalLength * c.size), near = Math.abs(prey.y - c.y) < 2 + c.height;
    c.balk = Math.max(0, c.balk - dt);
    // A Sunday candle (where its kind shuns them): it runs from the light, whatever it was doing.
    const glare = c.mode === 'flee' || !this.glare.length ? null : this.glaring(c, CANDLE.shun);
    if (glare) { c.provoked = false; c.action = ''; this.frighten(c, this.rng.range(1.2, 1.8), glare.x, glare.z); }
    // One that attacks comes for you once you are within its range (or it is hurt, or already at you); else it lives as the rest do.
    if (!sp.peaceful) {
      const range = rangeOf(sp, len), lurking = c.mode === 'lurk';
      const spots = (lurking || this.idle(c)) && !c.balk && !prey.dead && near && noticed(prey, d, range * this.wakeful(c, LIFE.wake));
      // Its lot comes too; a bluffer rears up at you first (the tell that they are coming).
      if (spots) for (const o of this.herdOf(c)) if (o.mode !== 'flee' && o.mode !== 'stalk' && o.mode !== 'back' && !o.balk) {
        o.mode = 'stalk'; o.aim = undefined; // (a fresh start: whatever it got nowhere with before)
        if (sp.temper.bluff && !o.action) { o.action = 'rear'; o.actionT = -(o.id % 3) * 0.12; o.struck = false; o.harmless = true; }
        else if (o.harmless) { o.action = ''; o.harmless = false; }
      }
      if (spots || lurking || c.mode === 'stalk' || c.mode === 'back' || (c.provoked && c.cause === 'knife')) return this.hunt(c, prey, dt, dx, dz, d, toYou, len, near, range);
    }

    const T = sp.temper, bold = this.bold(c, T);
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
    if (!prey.dead && near && d < shy * this.wakeful(c) && this.idle(c) && c.mode !== 'watch') {
      if (T.bluff && bold && !c.warned) { this.warn(c); }
      else if (sp.role === 'watcher' || T.curious > 0.35 || c.mode === 'approach') { c.mode = 'watch'; c.t = 3; }
      else {
        // It startles, and its herd with it.
        this.alarm(c, T, 2 + H.flee * 0.4);
        // (A sleeping herd wakes all together.)
        for (const o of this.herdOf(c)) if (o !== c && this.idle(o) && (Math.hypot(o.x - c.x, o.z - c.z) < 12 || o.pose === 'rest')) this.alarm(o, T, 2 + H.flee * 0.4);
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
    if (lamp && T.lamp !== 'none' && (c.mode === 'graze' || c.mode === 'wander' || c.mode === 'drawn') && c.pose !== 'rest') this.lampFor(c, lamp, T, shy, len);
    // Its life between it all: feeding, resting with its herd.
    if ((c.mode === 'graze' || c.mode === 'wander') && !c.action && this.live(c, c.den, dt, sp.walkSpeed * c.size * 0.7, this.reachOf(len))) {
      c.running = false;
      c.watching = c.pose === 'feed' && !prey.dead && d < shy * 1.5;
      return 0;
    }

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
          const { blow } = sp.power(c.size);
          damage(prey, this.rng.range(0.8, 1.2) * blow, c.x, c.z, clamp(1 + blow * 0.08, 1, 9), sp.cause ?? (sp.mass * c.size ** 3 > 400 ? 'colossus' : 'critter'));
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
          const a = sp.habit;
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
        this.flee(c, prey, sp.runSpeed * c.size, dt);
        if (c.t <= 0) { this.onward(c, T, len); c.t = 6; c.veer = 0; c.fx = NaN; }
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
  private idle(c: C): boolean {
    return !c.dead && !c.action && (c.mode === 'graze' || c.mode === 'wander' || c.mode === 'watch' || c.mode === 'approach' || c.mode === 'drawn');
  }

  /** Heavy enough to fight back (by its nerve: a timid one needs more weight) and not too hurt. */
  private bold(c: C, T: Temper): boolean {
    const sp = c.nature;
    if (sp.aggression < AGGRESSION.retaliate) return false;
    return sp.mass * c.size ** 3 >= CALM.bold * (2.2 - 1.8 * T.nerve) && c.health > c.maxHealth * CALM.hopeless * (1.4 - 0.8 * T.nerve);
  }

  /** How close you may come before it minds (a giant minds nobody; a curious one lets you nearer, a shy one less). */
  private shyOf(c: C, len: number, T: Temper): number {
    const r = c.nature.role;
    const base = r === 'giant' ? 0 : r === 'scuttler' ? 2.5 + len : r === 'watcher' ? 3.5 + len : 4 + len * 1.5;
    return base * (1 - 0.45 * T.curious);
  }

  /** Angry: it comes for you this long (bigger ones longer; `k` of it). */
  private anger(c: C, k = 1): void {
    c.mode = 'fight';
    c.t = CALM.anger * (1 + Math.log10(1 + c.nature.mass) * 0.5) * k;
  }

  /** A warning: it rears up at you (harmless), then watches; come closer still and it fights. */
  private warn(c: C): void {
    c.mode = 'watch'; c.t = 4; c.warned = 8;
    c.action = 'rear'; c.actionT = 0; c.struck = false; c.harmless = true;
  }

  /** Frightened: as its temper says, it bolts, scatters, freezes or bunches up (for about `t` seconds). */
  private alarm(c: C, T: Temper, t: number): void {
    switch (T.alarm) {
      case 'freeze': c.mode = 'freeze'; c.t = t * 1.2; break;
      case 'bunch': c.mode = 'bunch'; c.t = t * 1.2; break;
      case 'scatter': this.frighten(c, t); c.veer = ((c.id * 2654435761) % 1000 / 1000 - 0.5) * 2.2; break;
      default: this.frighten(c, t);
    }
  }

  /** Its herd's living. */
  private herdOf(c: C): C[] {
    return this.list.filter((o) => o.den === c.den && !o.dead);
  }

  /** The middle of its herd's living. */
  private herdMiddle(c: C): [number, number] {
    const h = this.herdOf(c);
    let x = 0, z = 0;
    for (const o of h) { x += o.x; z += o.z; }
    return h.length ? [x / h.length, z / h.length] : [c.den.x, c.den.z];
  }

  /** Its den's diet (its temper). */
  protected override dietOf(den: D): Diet {
    return this.natureIn(den).temper.diet;
  }

  /** How far out its herd's pasture reaches. */
  private reachOf(len: number): number {
    return Math.max(CALM.roamMin * 2, len * CALM.roam * 1.5);
  }

  /** Done grazing: on somewhere new, as its pace and flock say (a darter dashes on to where it was going), or off to feed. */
  private onward(c: C, T: Temper, len: number): void {
    const P = PACE[T.pace], F = FLOCK[T.flock], roam = Math.max(CALM.roamMin, len * CALM.roam) * P.roam * F.roam;
    if (!c.going && !this.follows(c, T) && this.toFood(c, c.den, c.nature.walkSpeed * c.size * 0.7, this.reachOf(len))) { c.mode = 'graze'; c.t = this.rng.range(1, 3); return; }
    if (!c.going) {
      if (T.flock === 'cluster') {
        // The herd drifts together: round its middle, the middle drawn back towards home.
        const [mx, mz] = this.herdMiddle(c);
        [c.tx, c.tz] = this.roamFrom({ key: c.den.key, x: mx * 0.7 + c.den.x * 0.3, z: mz * 0.7 + c.den.z * 0.3 }, roam);
      } else [c.tx, c.tz] = this.roamFrom(c.den, roam);
    }
    c.mode = 'wander';
    c.t = T.pace === 'dart' ? this.rng.range(0.4, 0.9) : 4 + len * 2;
    c.going = false;
  }

  /** In a procession (single file) and not its head: it follows the one before it. */
  private follows(c: C, T: Temper): boolean {
    if (T.flock !== 'file') return false;
    const h = this.herdOf(c);
    return h.indexOf(c) > 0;
  }

  /** Follow the one before it in the file: moves when it has fallen behind, stops close up (never dithering between the two). */
  private procession(c: C, sp: Nature, len: number, dt: number): void {
    const h = this.herdOf(c), ahead = h[h.indexOf(c) - 1], gap = c.radius + ahead.radius + len * 0.4;
    const d = Math.hypot(ahead.x - c.x, ahead.z - c.z);
    if (d > gap * 1.8) c.going = true;
    else if (d < gap * 1.1) c.going = false;
    if (c.going) this.steer.close(c, ahead, gap, sp.walkSpeed * c.size * (d > gap * 5 ? 1 : 0.6), dt, 0);
    else { brake(c, 4, dt); this.steer.slide(c, dt); }
    c.t = 1;
  }

  /** The headlamp's pull on it: one drawn to it comes into the beam (a little way off you); one that shuns it walks out of it. */
  private lampFor(c: C, lamp: Lamp, T: Temper, shy: number, len: number): void {
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
  private hunt(c: C, prey: Fighter, dt: number, dx: number, dz: number, d: number, toYou: number, len: number, near: boolean, range: number): number {
    const sp = c.nature, H = HUNTING, run = sp.runSpeed * c.size, plan = sp.temper.strategy;
    c.cool -= dt;
    const hopeless = c.health <= c.maxHealth * CALM.hopeless;
    if (c.provoked) {
      c.provoked = false;
      // Hurt: it turns on you, or runs if it is nearly done; its pack comes too.
      if (hopeless) this.frighten(c, CALM.flee * 1.5);
      else if (c.mode !== 'stalk' && c.mode !== 'back') c.mode = 'stalk';
      for (const o of this.list) if (o !== c && o.den === c.den && !o.dead && o.mode !== 'flee') if (o.mode !== 'back') o.mode = 'stalk';
    }
    if (c.mode !== 'stalk' && c.mode !== 'back' && c.mode !== 'lurk' && c.mode !== 'flee') c.mode = 'stalk';
    if ((c.mode === 'stalk' || c.mode === 'back') && (prey.dead || d > Math.max(H.forget, range * 1.3) || !near)) { c.mode = plan === 'ambush' ? 'lurk' : 'wander'; c.t = 0; }
    c.watching = c.mode === 'stalk' || c.mode === 'back' || c.mode === 'lurk' && d < range * 2;

    // No way to you (up a ledge, past a drop): it gives up a while and goes home.
    if (c.mode === 'stalk' && thwarted(c)) { c.balk = H.balk; c.mode = 'wander'; c.t = 4; c.action = ''; [c.tx, c.tz] = this.roamFrom(c.den, Math.max(CALM.roamMin, len * CALM.roam)); return 0; }
    const windup = H.windup[plan];
    if (c.action && c.harmless) {
      // Reared up at you before it comes (harmless), eyes on you.
      c.yaw += angleDiff(c.yaw, toYou) * Math.min(1, dt * 6);
      brake(c, 8, dt);
      this.steer.slide(c, dt);
      if (c.actionT >= H.rear) { c.action = ''; c.actionT = 0; c.harmless = false; }
      return 0;
    }
    if (c.action) {
      // The tell, then the lunge (a charger stands and slams); the blow lands as the lunge reaches you.
      c.yaw += angleDiff(c.yaw, toYou) * Math.min(1, dt * (c.actionT * CALM.strike < windup ? 4 : 1));
      const at = c.actionT * CALM.strike, lunging = plan !== 'charge' && at >= windup && at < windup + 0.25;
      if (lunging) this.steer.move(c, prey.x, prey.z, run * H.lunge, dt, null);
      else { brake(c, 6, dt); this.steer.slide(c, dt); }
      let struck = 0;
      if (!c.struck && at >= windup + (plan === 'charge' ? 0 : 0.12)) {
        const ahead = Math.abs(angleDiff(c.yaw, toYou)) < 1.1;
        if (ahead && near && d - prey.radius - c.radius < len * CALM.reach + 0.35) {
          c.struck = true;
          const { blow } = sp.power(c.size);
          damage(prey, this.rng.range(0.8, 1.2) * blow, c.x, c.z, clamp(1 + blow * 0.08, 1, 9), sp.cause ?? 'hunter');
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
        for (const o of this.list) if (o.den === c.den && o.action) striking++;
        const turn = c.cool <= 0 && (plan === 'swarm' || striking < H.together);
        const stand = c.radius + prey.radius + len * CALM.reach * 0.5, hold = turn ? stand : stand + len * H.wait + 0.5;
        c.running = d > hold + len * 2;
        this.steer.close(c, prey, hold, c.running ? run : run * 0.5, dt, len * 3);
        // In reach of its blow (a lunge carries it the last bit; a charger's slam does not).
        const gap = d - prey.radius - c.radius, lunge = plan === 'charge' ? 0 : Math.min(len, run * H.lunge * 0.2);
        if (turn && gap < len * CALM.reach + 0.2 + lunge && Math.abs(angleDiff(c.yaw, toYou)) < 0.5) this.attack(c);
        break;
      }
      case 'flee':
        c.running = true;
        this.flee(c, prey, run, dt);
        if (c.t <= 0) { [c.tx, c.tz] = this.roamFrom(c.den, Math.max(CALM.roamMin, len * CALM.roam)); c.mode = 'wander'; c.t = 6; c.fx = NaN; }
        break;
    }
    return 0;
  }

  private attack(c: C): void {
    c.action = c.nature.strike;
    c.actionT = 0;
    c.struck = false;
  }

  /** Frightened: it runs for `t` s, from you, or from (fx, fz) (a candle). */
  private frighten(c: C, t: number, fx = NaN, fz = NaN): void {
    c.mode = 'flee';
    c.t = t; c.fx = fx; c.fz = fz;
  }

  /** Running away: from what frightened it (you, veering off as it scatters; or a candle), at `speed`. */
  private flee(c: C, prey: Fighter, speed: number, dt: number): void {
    const fromX = Number.isNaN(c.fx) ? prey.x : c.fx, fromZ = Number.isNaN(c.fx) ? prey.z : c.fz;
    const dx = fromX - c.x, dz = fromZ - c.z, d = Math.hypot(dx, dz) || 1, cs = Math.cos(c.veer), sn = Math.sin(c.veer);
    this.steer.move(c, c.x - (cs * dx - sn * dz) / d * 6, c.z - (sn * dx + cs * dz) / d * 6, speed, dt, null);
  }
}

/** Whether an animal is after you now (coming for you, at you, springing back, or angry): the knife comes out (src/creatures/fauna.ts). */
export function afterYou(c: Animal): boolean {
  return !c.dead && (c.mode === 'fight' || c.mode === 'stalk' || c.mode === 'back');
}
