/**
 * What the game sounds like: everything heard follows from what the world is doing, read once a
 * frame (`update`), the way Scale's music reads its signals. Footsteps from the distance walked,
 * landings, getting hurt and dying from the body; growls, squeaks, swings and deaths from each
 * creature's mode changing; the ambience bed and the music from where one is. The few things only
 * the game knows (a stab, a door, a pickup) it plays itself through `play`.
 *
 * Every sound id is a public/sounds/manifest.json id (tools/audio/sounds.json).
 */
import { Rng, deriveSeed } from '@futuremagic/core';
import type { Body } from '../world/traverse/body';
import type { Level } from '../gen/level';
import type { Fauna } from '../creatures/fauna';
import type { DoorSpec } from '../gen/doorways';
import { TOWN } from '../gen/town';
import { CELLAR } from '../gen/cellar';
import { SoundEngine, type SoundLoop } from './audio';
import { Music } from './music/Music';
import type { Place } from './music/mood';

/** What the sounds read each frame. */
export interface SoundScene {
  readonly dt: number;
  readonly body: Body;
  readonly level: Level;
  readonly fauna: Fauna;
  /** The doors that open and shut (their `want` flips when one is opened or shut, or shuts itself). */
  readonly doors: readonly { readonly spec: DoorSpec; readonly want: number }[];
  /** The fire burning, if any. */
  readonly fire: { readonly x: number; readonly y: number; readonly z: number } | null;
  readonly resting: boolean;
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
  rats: { enter: { chase: ['rat_squeak', 0.7], bite: ['rat_bite'], alert: ['rat_squeak', 0.4] }, hurt: 'rat_squeak', die: 'rat_die' },
  crickets: { enter: { leap: ['cricket_leap'], bite: ['cricket_chirp'] }, hurt: 'cricket_chirp', die: 'cricket_chirp', idle: ['perch', 'cricket_chirp', 5, 14, 18], gain: 0.8 },
  dogs: { enter: { circle: ['dog_growl', 0.8], lunge: ['dog_bark'] }, hurt: 'dog_die', die: 'dog_die' },
  eels: { enter: { strike: ['eel_strike'], rise: ['eel_strike', 0.5] }, die: 'eel_strike' },
  lumen: { enter: { go: ['slime', 0.5], blow: ['slime'] }, hurt: 'slime', die: 'slime', pitch: 1.2 },
  murk: { enter: { go: ['slime', 0.5], blow: ['slime'] }, hurt: 'slime', die: 'slime', pitch: 0.75 },
  touched: { enter: { swing: ['pick_swing'] }, die: 'land', idle: ['work', 'pick_work', 1.6, 3.5, 30] },
  foreman: { enter: { swing: ['pick_swing'] }, die: 'land', pitch: 0.8, gain: 1.2 },
  scavengers: { enter: { swing: ['pick_swing'] }, die: 'land' },
  goblins: { enter: { shriek: ['rat_squeak'], jab: ['knife_swing'] }, hurt: 'rat_squeak', die: 'land', pitch: 0.7 },
  tall: {},
};

/** Metres between footsteps, walking and running. */
const STRIDE = { walk: 0.75, run: 1.05 };

export class GameSounds {
  readonly engine: SoundEngine;
  readonly music: Music;
  private readonly rng: Rng;
  private seen = new WeakMap<object, { mode: string; hurtT: number; idleAt: number }>();
  private doorWant = new WeakMap<object, number>();
  private walked = 0;
  private wasGrounded = true;
  private fallSpeed = 0;
  private hurtAt = -Infinity;
  private wasDead = false;
  private rungAt = 0;
  private bells = 0;
  private stares = 0;
  private fireLoop: SoundLoop | null = null;
  private time = 0;

  constructor(seed: number, base: string) {
    this.engine = new SoundEngine(seed, base);
    this.music = new Music(seed, base, this.engine);
    this.rng = new Rng(deriveSeed(seed, 'sounds'));
  }

  init(): Promise<void> { return this.engine.init(); }

  /** A one-shot the game decides on itself (null `at`: on the nobody, not placed). */
  play(id: string, at: { readonly x: number; readonly y: number; readonly z: number } | null = null, gain = 1, pitch = 1): void {
    this.engine.play(id, at, gain, pitch);
  }

  /** Where one is, for the ambience and the music. */
  static place(level: Level, b: { readonly x: number; readonly y: number; readonly z: number }): Place {
    if (level.band.id !== 'cellar') return level.band.id;
    const h = CELLAR.house;
    const inHouse = b.x >= h.x[0] && b.x <= h.x[1] && b.z >= h.z[0] && b.z <= h.z[1];
    return b.y > TOWN.ground - 0.5 && !inHouse ? 'town' : 'cellar';
  }

  update(s: SoundScene): void {
    const e = this.engine, b = s.body;
    this.time += s.dt;
    e.listen(s.ear.x, s.ear.y, s.ear.z, s.ear.fx, s.ear.fy, s.ear.fz);
    const place = GameSounds.place(s.level, b);
    const after = s.fauna.after(b);
    const boss = after && (s.fauna.foreman.list.some((f) => !f.dead && f.mode !== 'wait' && f.mode !== 'home') || s.fauna.tall.list.some((t) => !t.dead && t.mode !== 'stand' && t.mode !== 'home'));
    this.music.update(s.dt, { place, danger: !!after, boss, resting: s.resting, dead: b.dead });
    // The bed of the place one is in (the others fade out).
    const beds: Record<string, number> = { amb_town: 0, amb_cellar: 0, amb_quarry: 0, amb_salt: 0, amb_cistern: 0, amb_threshold: 0 };
    beds[`amb_${place}`] = b.dead ? 0.4 : 1;
    e.ambience(beds);
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
    // Footsteps: one per stride walked on the ground; soft when sneaking.
    const v = Math.hypot(b.vx, b.vz);
    if (b.mode === 'climb') this.walked += Math.abs(b.vy) * s.dt * 1.5;
    else if (b.grounded && b.mode === 'walk') this.walked += v * s.dt;
    const stride = v > 5 ? STRIDE.run : STRIDE.walk;
    if (this.walked >= stride) {
      this.walked = 0;
      const wet = s.level.waterAt(b.x, b.z) > b.y + 0.05;
      const soft = b.sneaking || b.tiptoe ? 0.35 : 1;
      this.play(wet ? 'step_water' : 'step_stone', feet, soft * (v > 5 ? 1.2 : 0.9));
    }
  }

  private creatures(s: SoundScene): void {
    const f = s.fauna, b = s.body;
    const pops: [string, readonly { x: number; y: number; z: number; mode: string; hurtT: number; dead: boolean }[]][] = [
      ['rats', f.rats.list], ['crickets', f.crickets.list], ['dogs', f.dogs.list], ['eels', f.eels.list], ['lumen', f.lumen.list],
      ['murk', f.murk.list], ['touched', f.touched.list], ['foreman', f.foreman.list], ['scavengers', f.scavengers.list], ['goblins', f.goblins.list], ['tall', f.tall.list],
    ];
    for (const [kind, list] of pops) {
      const v = VOICES[kind];
      for (const c of list) {
        const d = Math.hypot(c.x - b.x, c.z - b.z);
        if (d > 60) continue;
        const at = { x: c.x, y: c.y + 0.3, z: c.z };
        let m = this.seen.get(c);
        if (!m) { this.seen.set(c, { mode: c.mode, hurtT: c.hurtT, idleAt: this.time + this.rng.range(0, 4) }); continue; }
        if (c.mode !== m.mode) {
          if (c.dead) { if (v.die) this.play(v.die, at, v.gain ?? 1, (v.pitch ?? 1) * 0.9); }
          else {
            const say = v.enter?.[c.mode];
            if (say && this.rng.chance(say[1] ?? 1)) this.play(say[0], at, v.gain ?? 1, v.pitch ?? 1);
          }
          m.mode = c.mode;
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
