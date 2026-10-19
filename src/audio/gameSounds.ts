/**
 * What the game sounds like: everything heard follows from what the world is doing, read once a
 * frame (`update`), the way Scale's music reads its signals. Footsteps on the figure's heel strikes,
 * landings, getting hurt and dying from the body; growls, squeaks, swings and deaths from each
 * creature's mode changing; the ambience bed and the music from where one is; the town's birds by
 * day, and its church bell as one comes back up to it. The few things only the game knows (a stab,
 * a door, a pickup) it plays itself through `play`.
 *
 * Every sound id is a public/sounds/manifest.json id (tools/audio/sounds.json).
 */
import { Rng, TAU, deriveSeed } from '@futuremagic/core';
import type { Body } from '../world/traverse/body';
import type { Level } from '../gen/level';
import type { Fauna } from '../creatures/fauna';
import type { DoorSpec } from '../gen/doorways';
import { daylightAt } from '../gen/cellar';
import { HOUSES } from '../gen/town';
import { SoundEngine, type SoundLoop } from './audio';
import { Music } from './music/Music';
import type { Place } from './music/mood';

/** What the sounds read each frame. */
export interface SoundScene {
  readonly dt: number;
  readonly body: Body;
  readonly level: Level;
  /** The town by night (the prologue's one night): its old bed, and no birds. Left out by day. */
  readonly night?: boolean;
  readonly fauna: Fauna;
  /** The doors that open and shut (their `want` flips when one is opened or shut, or shuts itself). */
  readonly doors: readonly { readonly spec: DoorSpec; readonly want: number }[];
  /** The fire burning, if any. */
  readonly fire: { readonly x: number; readonly y: number; readonly z: number } | null;
  readonly resting: boolean;
  /** The figure's gait phase 0..1 (the animator's `gaitPhase`: heel strikes at 0.25 and 0.75), so
   *  steps land with its feet; null where no figure walks (then steps go by distance). */
  readonly gait?: number | null;
  /** Climbing a ladder (played out, not walked). */
  readonly ladder: boolean;
  /** The camera: where one hears from, and which way it looks. */
  readonly ear: { readonly x: number; readonly y: number; readonly z: number; readonly fx: number; readonly fy: number; readonly fz: number };
}

/** A creature's voice: the sound when it enters a mode, when hurt, when it dies, and now and then while in a mode. */
export interface Voice {
  readonly enter?: Partial<Record<string, readonly [id: string, chance?: number]>>;
  readonly hurt?: string;
  readonly die?: string;
  /** In this mode, now and then (min, max seconds apart), only near (m). */
  readonly idle?: readonly [mode: string, id: string, min: number, max: number, near: number];
  readonly pitch?: number;
  readonly gain?: number;
}

export const VOICES: Record<string, Voice> = {
  rats: { enter: { stalk: ['rat_squeak', 0.7], bite: ['rat_bite'], rear: ['rat_squeak', 0.4] }, hurt: 'rat_squeak', die: 'rat_die' },
  crickets: { enter: { leap: ['cricket_leap'], bite: ['cricket_chirp'] }, hurt: 'cricket_chirp', die: 'cricket_chirp', idle: ['perch', 'cricket_chirp', 5, 14, 18], gain: 0.8 },
  dogs: { enter: { stalk: ['dog_growl', 0.8], bite: ['dog_bark'] }, hurt: 'dog_die', die: 'dog_die' },
  eels: { enter: { strike: ['eel_strike'], rise: ['eel_strike', 0.5] }, die: 'eel_strike' },
  lumen: { enter: { go: ['slime', 0.5], blow: ['slime'] }, hurt: 'slime', die: 'slime', pitch: 1.2 },
  murk: { enter: { go: ['slime', 0.5], blow: ['slime'] }, hurt: 'slime', die: 'slime', pitch: 0.75 },
  touched: { enter: { swing: ['pick_swing'] }, die: 'land', idle: ['work', 'pick_work', 1.6, 3.5, 30] },
  foreman: { enter: { swing: ['pick_swing'] }, die: 'land', pitch: 0.8, gain: 1.2 },
  scavengers: { enter: { swing: ['pick_swing'] }, die: 'land' },
  goblins: { enter: { shriek: ['rat_squeak'], jab: ['knife_swing'] }, hurt: 'rat_squeak', die: 'land', pitch: 0.7 },
  tall: {},
};

/** Metres between footsteps, walking and running, where there is no gait phase to follow. */
const STRIDE = { walk: 0.75, run: 1.05 };

/** Where the gait cycle puts a heel down (left, right). */
export const HEEL_STRIKES = [0.25, 0.75] as const;

/** How many heel strikes the gait phase passed going from `from` to `to` (either way round the cycle). */
export function footfalls(from: number, to: number): number {
  const d = (to - from + 1) % 1;
  if (d === 0) return 0;
  const [a, span] = d < 0.5 ? [from, d] : [to, 1 - d]; // backpedalling runs the cycle backwards
  let n = 0;
  for (const h of HEEL_STRIKES) { const u = (h - a + 1) % 1; if (u > 0 && u <= span) n++; }
  return n;
}

/** The ambience beds a place asks for: the town by day (`amb_town_day`) or by night (`amb_town`), else the place's own. The rest fade out. */
export function bedsOf(place: Place, night: boolean, dead = false): Record<string, number> {
  const beds: Record<string, number> = { amb_town: 0, amb_town_day: 0, amb_cellar: 0, amb_quarry: 0, amb_salt: 0, amb_cistern: 0, amb_threshold: 0 };
  const bed = place === 'town' ? (night ? 'amb_town' : 'amb_town_day') : `amb_${place}`;
  beds[bed] = dead ? 0.4 : 1;
  return beds;
}

/** Where the town's birds are heard from: how often they call, how far from the ear, how high over its ground. */
export const TOWN_BIRDS = {
  /** Seconds from one call to the next (chosen again each time). */
  every: [5, 13] as const,
  /** How far from the ear a call comes from, metres. */
  away: [8, 20] as const,
  /** How high over the town's ground a call is heard, metres. */
  above: [2, 8] as const,
} as const;

/** How far the town's birds and its church bell are heard at full gain, metres. */
export const TOWN_HEARD = { birds: 6, bell: 30 } as const;

/** One of the town's birds calling: where it is, and which of its takes is the `variant`. */
export interface BirdCall { readonly x: number; readonly y: number; readonly z: number; readonly variant: number }

/**
 * The birds over the town by day (never at night nor below it): now and then one calls, from a point
 * 8–20 m from the ear and a little over the town's ground, so the calls come from around one.
 */
export class TownBirds {
  private nextIn: number;
  private readonly rng: Rng;
  constructor(rng: Rng) { this.rng = rng; this.nextIn = this.waitBetween(); }
  private waitBetween(): number { return this.rng.range(TOWN_BIRDS.every[0], TOWN_BIRDS.every[1]); }
  /** Seconds until the next call (5–13 s). */
  get due(): number { return this.nextIn; }
  /**
   * A frame: the call it makes now, or null. `heard` is the town by day (nothing calls below it nor
   * at night); `ground` says how high the town's ground is at (x, z), so the call is above it.
   */
  nextCall(dt: number, heard: boolean, ear: { readonly x: number; readonly y: number; readonly z: number }, ground: (x: number, z: number) => number): BirdCall | null {
    if (!heard) return null;
    this.nextIn -= dt;
    if (this.nextIn > 0) return null;
    this.nextIn = this.waitBetween();
    const a = this.rng.range(0, TAU), d = this.rng.range(TOWN_BIRDS.away[0], TOWN_BIRDS.away[1]);
    const x = ear.x + Math.sin(a) * d, z = ear.z + Math.cos(a) * d;
    return { x, y: ground(x, z) + this.rng.range(TOWN_BIRDS.above[0], TOWN_BIRDS.above[1]), z, variant: this.rng.int(0, 2) };
  }
}

/** The town's church bell: it rings once as one comes back up to the town from below. */
export class ChurchBell {
  private last: number | null = null;
  /** Does it ring this frame, the level now being `depth` deep? (Not on the first frame, nor going down.) */
  ring(depth: number): boolean {
    const rung = this.last !== null && this.last > 0 && depth === 0;
    this.last = depth;
    return rung;
  }
}

/** Where the town's bell hangs: the church tower, at the top of its walls. */
export const TOWER_BELL: { readonly x: number; readonly y: number; readonly z: number } = (() => {
  const tower = HOUSES.find((h) => h.kind === 'tower');
  if (!tower) throw new Error('the town has no church tower');
  return { x: tower.cx, y: tower.eaves, z: tower.cz };
})();

export class GameSounds {
  readonly engine: SoundEngine;
  readonly music: Music;
  private readonly rng: Rng;
  private readonly birds: TownBirds;
  private readonly churchBell = new ChurchBell();
  private seen = new WeakMap<object, { mode: string; hurtT: number; idleAt: number }>();
  private doorWant = new WeakMap<object, number>();
  private walked = 0;
  private gaitWas: number | null = null;
  private wasGrounded = true;
  private fallSpeed = 0;
  private hurtAt = -Infinity;
  private wasDead = false;
  private rungAt = 0;
  private bells = 0;
  private stares = 0;
  private fireLoop: SoundLoop | null = null;
  private readonly hums: (SoundLoop | null)[] = [];
  private time = 0;

  constructor(seed: number, base: string) {
    this.engine = new SoundEngine(seed, base);
    this.music = new Music(seed, base, this.engine);
    this.rng = new Rng(deriveSeed(seed, 'sounds'));
    this.birds = new TownBirds(new Rng(deriveSeed(seed, 'sounds', 'birds')));
  }

  init(): Promise<void> { return this.engine.init(); }

  /** A one-shot the game decides on itself (null `at`: on the nobody, not placed). */
  play(id: string, at: { readonly x: number; readonly y: number; readonly z: number } | null = null, gain = 1, pitch = 1): void {
    this.engine.play(id, at, gain, pitch);
  }

  /** The low roar of sun `i` (src/creatures/suns.ts) at `at`, as loud as `gain` (null: silent). */
  hum(i: number, at: { readonly x: number; readonly y: number; readonly z: number } | null, gain = 1): void {
    if (!at) { this.hums[i]?.set(0, 0, 0, 0); return; }
    this.hums[i] ??= this.engine.loop('sun_hum', 8);
    this.hums[i]?.set(at.x, at.y, at.z, gain);
  }

  /** One of a sound's files in tune (its `variant`-th: a note of a scale), heard from `refDist` m. */
  note(id: string, at: { readonly x: number; readonly y: number; readonly z: number }, variant: number, gain = 1, refDist = 3): void {
    this.engine.play(id, at, gain, 1, refDist, variant);
  }

  /** Where one is, for the ambience and the music. */
  static place(level: Level, b: { readonly x: number; readonly y: number; readonly z: number }): Place {
    if (level.band.id !== 'cellar') return level.band.id;
    return daylightAt(b.x, b.y, b.z) < 1 ? 'cellar' : 'town';
  }

  update(s: SoundScene): void {
    const e = this.engine, b = s.body;
    this.time += s.dt;
    e.listen(s.ear.x, s.ear.y, s.ear.z, s.ear.fx, s.ear.fy, s.ear.fz);
    const place = GameSounds.place(s.level, b);
    const night = s.night ?? false;
    const after = s.fauna.after(b);
    const boss = after && (s.fauna.foreman.list.some((f) => !f.dead && f.mode !== 'wait' && f.mode !== 'home') || s.fauna.tall.list.some((t) => !t.dead && t.mode !== 'stand' && t.mode !== 'home'));
    this.music.update(s.dt, { place, danger: !!after, boss, resting: s.resting, dead: b.dead });
    // The bed of the place one is in (the others fade out).
    e.ambience(bedsOf(place, night, b.dead));
    // The town's birds by day, and its church bell as one comes back up to it.
    const call = this.birds.nextCall(s.dt, place === 'town' && !night, s.ear, (x, z) => s.level.groundAt(x, z));
    if (call) this.engine.play('birds', call, 1, 1, TOWN_HEARD.birds, call.variant);
    if (this.churchBell.ring(s.level.depth)) this.engine.play('church_bell', TOWER_BELL, 1, 1, TOWN_HEARD.bell);
    this.fire(s);
    for (const d of s.doors) {
      const was = this.doorWant.get(d);
      if (was !== undefined && was !== d.want) this.play(d.want ? 'door_open' : 'door_close', { x: d.spec.x, y: d.spec.y + 1, z: d.spec.z });
      this.doorWant.set(d, d.want);
    }
    this.bodySounds(s);
    this.creatures(s);
  }

  private fire(s: SoundScene): void {
    if (!s.fire) { this.fireLoop?.set(0, 0, 0, 0); return; }
    this.fireLoop ??= this.engine.loop('fire', 2);
    this.fireLoop?.set(s.fire.x, s.fire.y + 0.3, s.fire.z, 1);
  }

  private bodySounds(s: SoundScene): void {
    const b = s.body, feet = { x: b.x, y: b.y, z: b.z };
    if (b.dead && !this.wasDead) this.play('death');
    this.wasDead = b.dead;
    if (b.dead) return;
    if (b.hurtAt !== this.hurtAt) {
      if (b.hurtAt > this.hurtAt && b.lastCause !== 'fall') this.play('hurt', null, 0.8);
      this.hurtAt = b.hurtAt;
    }
    if (s.ladder) {
      // Hands and feet on the rungs.
      this.rungAt -= s.dt;
      if (this.rungAt <= 0) { this.rungAt = 0.42; this.play('ladder', feet, 0.8); }
      this.walked = 0;
      return;
    }
    // A landing: on the ground again after falling fast.
    if (b.grounded && !this.wasGrounded && this.fallSpeed > 6) this.play('land', feet, Math.min(1, this.fallSpeed / 12));
    if (!b.grounded) this.fallSpeed = Math.max(0, -b.vy);
    this.wasGrounded = b.grounded;
    // Footsteps: on each heel strike of the figure's gait (one per stride walked where there is no
    // figure, and when climbing rock); soft when sneaking.
    const v = Math.hypot(b.vx, b.vz);
    const gait = s.gait ?? null, was = this.gaitWas;
    this.gaitWas = gait;
    let steps = 0;
    if (b.mode === 'climb') this.walked += Math.abs(b.vy) * s.dt * 1.5;
    else if (gait !== null) { this.walked = 0; if (b.grounded && b.mode === 'walk' && v > 0.3 && was !== null) steps = footfalls(was, gait); }
    else if (b.grounded && b.mode === 'walk') this.walked += v * s.dt;
    const stride = v > 5 ? STRIDE.run : STRIDE.walk;
    if (this.walked >= stride) { this.walked = 0; steps = 1; }
    if (steps > 0) {
      const wet = s.level.waterAt(b.x, b.z) > b.y + 0.05;
      const soft = b.sneaking || b.tiptoe ? 0.35 : 1;
      this.play(wet ? 'step_water' : 'step_stone', feet, soft * (v > 5 ? 1.2 : 0.9));
    }
  }

  private creatures(s: SoundScene): void {
    const f = s.fauna, b = s.body;
    const pops: [string, readonly { x: number; y: number; z: number; mode: string; cue: string; hurtT: number; dead: boolean }[]][] = [
      ['rats', [...f.rats.list, ...f.townRats.list]], ['crickets', f.crickets.list], ['dogs', [...f.dogs.list, ...f.townDogs.list]], ['eels', f.eels.list], ['lumen', f.lumen.list],
      ['murk', f.murk.list], ['touched', f.touched.list], ['foreman', f.foreman.list], ['scavengers', f.scavengers.list], ['goblins', f.goblins.list], ['tall', f.tall.list],
    ];
    for (const [kind, list] of pops) {
      const v = VOICES[kind];
      for (const c of list) {
        const d = Math.hypot(c.x - b.x, c.z - b.z);
        if (d > 60) continue;
        const at = { x: c.x, y: c.y + 0.3, z: c.z };
        let m = this.seen.get(c);
        if (!m) { this.seen.set(c, { mode: c.cue, hurtT: c.hurtT, idleAt: this.time + this.rng.range(0, 4) }); continue; }
        if (c.cue !== m.mode) {
          if (c.dead) { if (v.die) this.play(v.die, at, v.gain ?? 1, (v.pitch ?? 1) * 0.9); }
          else {
            const say = v.enter?.[c.cue];
            if (say && this.rng.chance(say[1] ?? 1)) this.play(say[0], at, v.gain ?? 1, v.pitch ?? 1);
          }
          m.mode = c.cue;
        }
        if (c.hurtT < m.hurtT && !c.dead && v.hurt) this.play(v.hurt, at, v.gain ?? 1, (v.pitch ?? 1) * 1.15);
        m.hurtT = c.hurtT;
        const idle = v.idle;
        if (idle && c.mode === idle[0] && d < idle[4] && this.time >= m.idleAt) {
          m.idleAt = this.time + this.rng.range(idle[2], idle[3]);
          this.play(idle[1], at, (v.gain ?? 1) * 0.7, v.pitch ?? 1);
        }
      }
    }
    // The Foreman's bell, and the Tall One's stare.
    const boss = f.foreman.list[0];
    const rung = boss?.rung ?? 0;
    if (rung > this.bells && boss) this.play('bell', { x: boss.x, y: boss.y + 2, z: boss.z }, 1.4);
    this.bells = rung;
    if (f.tall.stares > this.stares) this.play('tall_stare', null, 0.9);
    this.stares = f.tall.stares;
  }
}
