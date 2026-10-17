/**
 * A species' temper (Arnd 2026-10-17: "their behaviour should be as varied as their appearance"):
 * how it lives, grown from the same id as its body and leaning on its body plan and role, so a
 * herd of darting crab-things and a plodding procession of slugs differ in how they move as much
 * as in how they look.
 *
 * - `pace`: a plodder grazes long and ambles; a darter dashes and freezes like a lizard; a
 *   restless one never settles; steady is in between.
 * - `flock`: a tight cluster that drifts together, a procession in single file behind a leader,
 *   a loose scatter, or loners.
 * - `curious` (-1..1): shy ones bolt from far off; curious ones come over, circle you at a distance
 *   and trail after you a while; in between they keep their distance.
 * - `alarm`: what its herd does when one is frightened: bolt away, scatter every which way,
 *   freeze where it stands, or bunch up with the big ones facing you.
 * - `nerve` (0..1): how heavy it must be to fight back rather than run, and how hurt before it gives
 *   up; `bluff`: it rears up as a warning before it fights.
 * - `habit`: what it does now and then while it grazes: pecks at the floor, rears up to look round
 *   (a sentry), shows off (a tail flick, a claw wave), or nothing.
 * - `lamp`: drawn to your headlamp like a moth, shuns its beam, or minds it not.
 * - `strategy`: how it fights once it comes for you (its aggression, src/creatures/bestiary.ts, says
 *   whether and from how far): a pack that takes turns round you, an ambusher still as the rock until
 *   you are close, a swarm of small ones, or a charger that walks straight in and slams.
 *
 * Pure: a species in, its temper out (the same every time).
 */
import { Rng, deriveSeed } from '@futuremagic/core';
import { AGGRESSION, type Species } from './bestiary';

export type Pace = 'plod' | 'steady' | 'dart' | 'restless';
export type Flock = 'cluster' | 'file' | 'scatter' | 'loner';
export type Alarm = 'bolt' | 'scatter' | 'freeze' | 'bunch';
export type Habit = 'peck' | 'sentry' | 'display' | 'none';
export type LampSense = 'moth' | 'shun' | 'none';
export type Strategy = 'pack' | 'ambush' | 'swarm' | 'charge';

export interface Temper {
  readonly pace: Pace;
  readonly flock: Flock;
  readonly curious: number;
  readonly alarm: Alarm;
  readonly nerve: number;
  readonly bluff: boolean;
  readonly habit: Habit;
  readonly lamp: LampSense;
  readonly strategy: Strategy;
}

export const PACES: readonly Pace[] = ['plod', 'steady', 'dart', 'restless'];
export const FLOCKS: readonly Flock[] = ['cluster', 'file', 'scatter', 'loner'];
export const ALARMS: readonly Alarm[] = ['bolt', 'scatter', 'freeze', 'bunch'];
export const HABITS: readonly Habit[] = ['peck', 'sentry', 'display', 'none'];
export const LAMPS: readonly LampSense[] = ['moth', 'shun', 'none'];
export const STRATEGIES: readonly Strategy[] = ['pack', 'ambush', 'swarm', 'charge'];

const tempers = new WeakMap<Species, Temper>();

/** The temper of `sp` (its own seed; the weights lean on its plan, role, skin and strangeness). */
export function temperOf(sp: Species): Temper {
  let t = tempers.get(sp);
  if (!t) tempers.set(sp, (t = grownTemper(sp)));
  return t;
}

function grownTemper(sp: Species): Temper {
  const rng = new Rng(deriveSeed(0x7e3, 'temper', sp.id));
  const p = sp.plan, r = sp.role, s = Math.min(1.5, sp.strangeness);
  const jointed = p === 'hexapod' || p === 'octopod' || p === 'crab' || p === 'myriapod';
  const slow = p === 'slug' || p === 'floater' || r === 'giant';
  const pace = rng.weighted(PACES, (_, i) => [
    slow ? 4 : 1,
    2,
    jointed || p === 'serpent' ? 3 : r === 'scuttler' ? 2 : 0.6,
    r === 'scuttler' ? 1.5 : 0.8,
  ][i]);
  const alone = sp.group[1] <= 1;
  const flock = alone ? 'loner' : rng.weighted(FLOCKS, (_, i) => [
    r === 'grazer' || r === 'giant' ? 3 : 1.5,
    p === 'myriapod' || p === 'serpent' || p === 'slug' ? 3 : 1,
    r === 'scuttler' ? 2.5 : 1,
    0.5,
  ][i]);
  const lean = r === 'watcher' ? 0.5 : r === 'scuttler' ? -0.35 : r === 'giant' ? 0.2 : 0;
  const curious = Math.max(-1, Math.min(1, lean + rng.range(-0.8, 0.8) + s * 0.15));
  const alarm = rng.weighted(ALARMS, (_, i) => [
    2,
    r === 'scuttler' || jointed ? 2.5 : 1,
    p === 'slug' || r === 'scuttler' || p === 'radial' ? 2 : 0.8,
    r === 'grazer' || r === 'giant' ? 2.5 : 0.6,
  ][i]);
  const nerve = Math.max(0, Math.min(1, rng.range(0.1, 0.9) + (r === 'giant' ? 0.3 : 0) + (r === 'scuttler' ? -0.2 : 0)));
  const bluff = rng.chance(0.25 + nerve * 0.35 + (sp.head.horns ? 0.15 : 0));
  const tail = sp.tail.length > 0.3, claws = p === 'crab' || sp.limbs.bigClaw > 1;
  const habit = rng.weighted(HABITS, (_, i) => [
    r === 'grazer' ? 3 : 1,
    r === 'watcher' ? 3 : 1,
    (tail || claws ? 1.2 : 0.3) + s,
    1,
  ][i]);
  const lamp = rng.weighted(LAMPS, (_, i) => [
    (jointed || p === 'floater' ? 1.6 : 0.5) + s * 0.8,
    sp.integument === 'fur' || r === 'scuttler' ? 1.6 : 0.8,
    2,
  ][i]);
  const strategy = rng.weighted(STRATEGIES, (_, i) => [
    r === 'hunter' ? 4 : alone ? 0.3 : 1.5,
    r === 'lurker' ? 4 : p === 'serpent' || p === 'slug' || p === 'crab' || p === 'radial' ? 2 : 0.8,
    r === 'swarmer' ? 4 : sp.group[1] >= 5 ? 2 : 0.2,
    r === 'brute' ? 4 : sp.mass > 100 ? 2 : 0.5,
  ][i]);
  return { pace, flock, curious, alarm, nerve, bluff, habit, lamp, strategy };
}

/** What its habit plays (a rig action): a peck, a sentry's rearing up, a tail flick or claw wave; '' none. */
export function habitAction(sp: Species, t: Temper): string {
  switch (t.habit) {
    case 'peck': return sp.plan === 'floater' || sp.plan === 'radial' ? 'flinch' : 'bite';
    case 'sentry': return 'rear';
    case 'display': return sp.tail.length > 0.3 ? 'sting' : sp.plan === 'crab' || sp.limbs.bigClaw > 1 ? 'pinch' : 'rear';
    default: return '';
  }
}

/** Its temper in a line (the creature maker says it): how aggressive, how it lives and fights. */
export function temperLine(sp: Species): string {
  const t = temperOf(sp), a = sp.aggression;
  const dial = a < AGGRESSION.retaliate ? 'only flees' : a < AGGRESSION.attack ? 'fights back when hurt' : `attacks (${t.strategy})`;
  const mood = t.curious > 0.35 ? 'curious' : t.curious < -0.35 ? 'shy' : 'wary';
  return `Aggression ${a.toFixed(2)}: ${dial}. ${t.pace}, ${t.flock}, ${mood}; in alarm ${t.alarm}${t.bluff ? ', bluffs' : ''}; habit ${t.habit}; headlamp ${t.lamp}.`;
}
