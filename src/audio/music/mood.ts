/**
 * Which music plays when (pure logic, no Web Audio: tested in test/music.test.ts).
 *
 * The game is scored sparsely, like Scale: calm music comes in episodes (one piece of the place one
 * is in, then silence until the next); danger always gets music while it lasts.
 *
 *   calm     town · cellar · quarry · salt · cistern · threshold (the band one is in) — episodes and rests
 *   fire     resting by a fire or in grandma's salt circle: its piece, once per rest
 *   danger   something after you                                                 — while it lasts
 *   boss     the Foreman or the Tall One after you (instead of danger)
 *   death    the grandchild died: one piece, then silence until the next one is sent down
 *
 * Danger comes in after a short confirmation and goes only after a hold (a rat stepping in and out
 * of range does not flap the score). Arriving somewhere new (another band) may start an episode
 * early, once the last rest has run a while.
 */
import { Rng } from '@futuremagic/core';

export type Place = 'town' | 'cellar' | 'quarry' | 'salt' | 'cistern' | 'threshold';
export type Mood = Place | 'fire' | 'danger' | 'boss' | 'death';
export const MOODS: readonly Mood[] = ['town', 'cellar', 'quarry', 'salt', 'cistern', 'threshold', 'fire', 'danger', 'boss', 'death'];
/** Moods that loop for as long as they last (the rest play one piece). */
export const LOOPED: ReadonlySet<Mood> = new Set<Mood>(['danger', 'boss']);

/** What the game tells the music each frame. */
export interface MusicSignals {
  place: Place;
  /** Something after you. */
  danger: boolean;
  /** The Foreman or the Tall One is what is after you. */
  boss: boolean;
  /** Resting by a fire (or in grandma's salt circle). */
  resting: boolean;
  dead: boolean;
}

export const MOOD_TUNING = {
  firstEpisode: [12, 25] as [number, number],
  rest: [90, 200] as [number, number],
  /** After a fight, calm music waits at least this long. */
  restAfterFight: [45, 90] as [number, number],
  /** A new place may start an episode once the rest has run this long. */
  placeRest: 30,
  dangerUp: 1.2,
  dangerHold: 10,
};

/** Fades (s) and level per mood. */
export const MOOD_FADE: Record<Mood, { fadeIn: number; fadeOut: number; level: number }> = {
  town: { fadeIn: 4, fadeOut: 5, level: 0.8 },
  cellar: { fadeIn: 4, fadeOut: 5, level: 0.8 },
  quarry: { fadeIn: 6, fadeOut: 6, level: 0.8 },
  salt: { fadeIn: 6, fadeOut: 6, level: 0.8 },
  cistern: { fadeIn: 6, fadeOut: 6, level: 0.8 },
  threshold: { fadeIn: 6, fadeOut: 6, level: 0.8 },
  fire: { fadeIn: 3, fadeOut: 4, level: 0.75 },
  danger: { fadeIn: 0.8, fadeOut: 4, level: 1 },
  boss: { fadeIn: 0.5, fadeOut: 4, level: 1 },
  death: { fadeIn: 1, fadeOut: 3, level: 0.9 },
};

export interface MoodOut { mood: Mood | null; why: string }

export class MoodDirector {
  /** Calm: playing an episode, or resting until `left` runs out. */
  phase: 'rest' | 'episode' = 'rest';
  left: number;
  /** Seconds the rest has run. */
  private rested = 0;
  private dangerT = 0;
  private holdT = 0;
  private fighting: 'danger' | 'boss' | null = null;
  private place: Place | null = null;
  /** The rest by the fire has had its piece. */
  private fired = false;
  private mourned = false;
  /** The calm piece of this episode (the place it began in, or the fire). */
  private calm: Mood | null = null;
  /** Dev: force a mood (null: automatic). */
  forced: Mood | null | undefined = undefined;

  constructor(private readonly rng: Rng) {
    this.left = rng.range(...MOOD_TUNING.firstEpisode);
  }

  update(dt: number, s: MusicSignals): MoodOut {
    if (this.forced !== undefined) return { mood: this.forced, why: 'forced' };
    const T = MOOD_TUNING;
    if (s.dead) {
      this.fighting = null;
      return { mood: this.mourned ? null : 'death', why: 'dead' };
    }
    if (this.mourned) { this.mourned = false; this.rest(T.firstEpisode); }
    // Danger: in after a short confirmation, out after a hold.
    this.dangerT = s.danger ? this.dangerT + dt : 0;
    if (this.dangerT > T.dangerUp || (this.fighting && s.danger)) {
      this.fighting = s.boss ? 'boss' : this.fighting === 'boss' ? 'boss' : 'danger';
      this.holdT = T.dangerHold;
    } else if (this.fighting) {
      this.holdT -= dt;
      if (this.holdT <= 0) { this.fighting = null; this.rest(T.restAfterFight); }
    }
    if (this.fighting) return { mood: this.fighting, why: s.boss ? 'a boss after you' : 'something after you' };
    // The fire's piece, once per rest (it ends when one gets up).
    if (!s.resting) {
      this.fired = false;
      if (this.calm === 'fire') this.rest(MOOD_TUNING.restAfterFight);
    } else if (!this.fired) { this.fired = true; this.phase = 'episode'; this.calm = 'fire'; }
    const moved = this.place !== null && this.place !== s.place;
    this.place = s.place;
    if (this.phase === 'episode') return { mood: this.calm ?? s.place, why: this.calm === 'fire' ? 'resting' : 'episode' };
    this.rested += dt;
    this.left -= dt;
    if (this.left <= 0 || (moved && this.rested > T.placeRest)) {
      this.phase = 'episode';
      this.calm = s.place;
      return { mood: s.place, why: moved ? 'somewhere new' : 'rest over' };
    }
    return { mood: null, why: 'rest' };
  }

  /** The piece of the episode played to its end (or the death piece): rest. */
  endEpisode(mood: Mood | null): void {
    if (mood === 'death') { this.mourned = true; return; }
    this.calm = null;
    this.rest(MOOD_TUNING.rest);
  }

  private rest(range: [number, number]): void {
    this.phase = 'rest';
    this.rested = 0;
    this.calm = null;
    this.left = this.rng.range(...range);
  }
}
