/**
 * Background music: the MoodDirector (mood.ts) chooses the mood from what the game tells it, tracks.ts
 * names the piece, the TrackPlayer plays and crossfades it. The music switch and the master volume
 * are the SoundEngine's settings (N mutes everything, B turns the music off).
 *
 * Dev (console): __music.status(), __music.mood('danger' | 'quarry' | … | null), __music.auto().
 */
import { Rng, deriveSeed } from '@futuremagic/core';
import type { SoundEngine } from '../audio';
import { MoodDirector, MOOD_FADE, LOOPED, MOODS, type Mood, type MoodOut, type MusicSignals } from './mood';
import { TrackPlayer, type TrackWant } from './TrackPlayer';
import { MOOD_TRACKS } from './tracks';

/** The pieces are mastered loud (−16 LUFS): this sits them under the game's sounds. */
const MUSIC_LEVEL = 0.5;

export class Music {
  readonly director: MoodDirector;
  readonly player: TrackPlayer;
  last: MoodOut = { mood: null, why: 'start' };
  /** The piece chosen for the mood playing now (a mood's pieces take turns). */
  private pick: { mood: Mood; id: string } | null = null;
  private turn: Partial<Record<Mood, number>> = {};
  private readonly rng: Rng;

  constructor(seed: number, base: string, private readonly sound: SoundEngine) {
    this.rng = new Rng(deriveSeed(seed, 'music'));
    this.director = new MoodDirector(this.rng.fork('director'));
    this.player = new TrackPlayer(base);
    this.player.level = MUSIC_LEVEL;
    (globalThis as { __music?: unknown }).__music = {
      status: () => ({ ...this.last, audio: this.sound.ctx?.state ?? 'not started', on: this.sound.settings.music && this.sound.audible, phase: this.director.phase, left: Math.round(this.director.left), pick: this.pick, player: this.player.status() }),
      mood: (m: Mood | null) => { if (m !== null && !MOODS.includes(m)) return `moods: ${MOODS.join(', ')}`; this.director.forced = m; return m; },
      auto: () => { this.director.forced = undefined; return 'auto'; },
      music: this,
    };
  }

  update(dt: number, s: MusicSignals): void {
    const out = this.sound.musicOut();
    if (!out) return;
    if (!this.player.attached) this.player.attach(out.ctx, out.out);
    dt = Math.min(dt, 0.25);
    this.last = this.director.update(dt, s);
    const on = this.sound.settings.music && this.sound.audible;
    const want = on ? this.want() : { id: null, fadeIn: 1, fadeOut: 2, level: 0 };
    this.player.update(dt, want, { duck: 1 });
    // A calm piece (or the death piece) played to its end: rest.
    if (this.pick && !LOOPED.has(this.pick.mood) && this.player.ended(this.pick.id)) {
      this.director.endEpisode(this.pick.mood);
      this.pick = null;
    }
  }

  private want(): TrackWant {
    const m = this.last.mood;
    if (!m) { this.pick = null; return { id: null, fadeIn: 1, fadeOut: this.fadeOutNow(), level: 0 }; }
    if (this.pick?.mood !== m) {
      const list = MOOD_TRACKS[m];
      const n = this.turn[m] ?? this.rng.int(0, list.length - 1);
      this.turn[m] = n + 1;
      this.pick = { mood: m, id: list[n % list.length] };
      // A fight may come next: have its loop ready.
      this.player.prepare(MOOD_TRACKS.danger[(this.turn.danger ?? 0) % MOOD_TRACKS.danger.length]);
    }
    const f = MOOD_FADE[m];
    return { id: this.pick.id, fadeIn: f.fadeIn, fadeOut: this.fadeOutNow(m), level: f.level };
  }

  /** How fast what plays now gives way (to `next`, or to silence). */
  private fadeOutNow(next?: Mood): number {
    const cur = this.pick?.mood;
    const out = cur ? MOOD_FADE[cur].fadeOut : 4;
    return next ? Math.min(out, MOOD_FADE[next].fadeIn * 1.5 + 0.5) : out;
  }
}
