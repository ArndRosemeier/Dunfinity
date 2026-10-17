/**
 * The title screen: an old television in a dark living room, playing the 1966 report on what came up
 * in grandma's town (src/app/tvSet.ts, src/lore/report.ts), the name and the menu beside it
 * (src/app/titleScreen.ts). It comes on first, before the game is set up; behind it the game loads,
 * its level streams in and its shaders build, each build slipping the set's vertical hold. The
 * choice switches the set off and ends it.
 */
import { Rng, deriveSeed } from '@futuremagic/core';
import { REPORT, shotStart, voiceOf } from '../lore/report';
import { TitleScreen, type TitleChoice } from '../app/titleScreen';
import { TvSet } from '../app/tvSet';
import type { SoundEngine, SoundLoop } from '../audio/audio';
import type { FamilyEntry } from '../persist/save';

/** Seconds: the set warming up before the name and menu come; from the choice to black. */
const TIMING = { reveal: 1.2, leave: 0.8 };
/** The set's sound: the hiss (and how much louder a rough signal makes it), what is left of it once the melody has come up, a slip's crackle, and how soon after it comes on its clunk still plays (s). */
const SOUND = { hiss: 0.45, rough: 0.5, faded: 0.08, crackle: 0.8, clunk: 2 };
/** The title's melody (src/audio/music/Music.ts theme): its level under the report, once the report is over, and how fast it swells (its share a second). */
const TUNE = { under: 0.25, after: 1, swell: 0.12 };
/** Seconds: a voice is not begun this close to its end. */
const VOICE = { tail: 0.8 };

/** What the title needs from the game, once the game is set up (the set comes on before that). */
export interface TitleGame {
  /** Resolves once everything play needs is compiled (src/render/stage.ts warmLater); Continue waits for it (New Game goes to the creator, which waits too). */
  readonly ready: Promise<void>;
  /** Shader builds so far (src/render/shaders/monitor.ts): each new one slips the picture. */
  builds(): number;
  /** Once a frame: the game's level streams in behind the title (nothing is drawn). */
  stream(now: number): void;
}

/** What the title needs to begin. */
export interface TitleCast {
  readonly seed: number;
  /** A family is kept: Continue goes on with it (and the report cuts in partway: it has been seen). */
  readonly canContinue: boolean;
  /** Every family kept (the menu's Load). */
  readonly families: readonly FamilyEntry[];
  /** Hold on this shot of the report (`?title&shot=<n>`, for screenshots), or null. */
  readonly pinned: number | null;
  /** The game's sound, made before the set comes on (it starts on the first touch or key: then the set hisses and the presenter speaks). */
  readonly sound: SoundEngine;
  /** Once a frame: the title's melody, at `level` (0…1; it fades to it). */
  tune(dt: number, level: number): void;
  /** The game, once set up: the set plays while it loads, and a choice made before then waits for it. */
  readonly game: Promise<TitleGame>;
  /** The set is on (the loading screen can go). */
  shown(): void;
}

/** Play the title until the player chooses; resolves with the screen black, the overlay gone. */
export async function playTitle(host: HTMLElement, cast: TitleCast): Promise<TitleChoice> {
  const screen = new TitleScreen(host, cast.canContinue, cast.families);
  // A first visit watches from the start; later ones switch on partway through (a different shot each time).
  const from = cast.canContinue ? shotStart(new Rng(deriveSeed(cast.seed, 'title', Math.floor(performance.timeOrigin))).int(1, REPORT.length - 1)) : 0;
  const tv = new TvSet(screen.back, cast.seed, from, cast.pinned);
  await tv.loaded.catch(() => {}); // a missing picture leaves its shot dark, nothing worse
  let chosen: TitleChoice | null = null, chosenAt = 0, revealed = false, hiss: SoundLoop | null = null, spoken = -1;
  let game: TitleGame | null = null, gameAt = 0, swell = 0, last = 0;
  const now = (): number => performance.now() / 1000;
  const start = now();
  tv.on(start);
  cast.shown();
  screen.chosen.then((c) => { chosen = c; chosenAt = now(); });
  cast.game.then((g) => { game = g; gameAt = now(); g.ready.then(() => screen.ready()); });
  return new Promise((resolve) => {
    const beat = (): void => {
      const t = now(), dt = last ? t - last : 0;
      last = t;
      if (!revealed && t - start > TIMING.reveal) { revealed = true; screen.reveal(); }
      // (A choice made while the game still sets up waits for it, the set playing on.)
      const leaving = chosen === null || !game ? 0 : Math.min(1, (t - Math.max(chosenAt, gameAt)) / TIMING.leave);
      screen.dark = leaving * leaving;
      if (chosen !== null && game) tv.off(Math.max(chosenAt, gameAt)); // (once: it keeps the first)
      const slipped = tv.frameAt(t, game?.builds() ?? 0);
      game?.stream(t);
      const sound = cast.sound;
      // The sound, once the browser lets it start: the clunk if the set has only just come on, its hiss, a crackle when the picture slips.
      if (!hiss && chosen === null && sound.ctx && (hiss = sound.loop('tv_static')) && t - start < SOUND.clunk) sound.play('tv_on', null);
      // The report airs once; then the set shows snow, and the melody comes up from under it as the hiss fades away.
      const over = !!tv.playing && tv.playing.shot < 0;
      if (over) swell = Math.min(1, swell + dt * TUNE.swell);
      const quiet = 1 - (1 - SOUND.faded) * swell; // (the set's own noises, crackles too)
      hiss?.set(0, 0, -1, (SOUND.hiss + SOUND.rough * tv.trouble) * quiet * (1 - leaving));
      cast.tune(dt, (TUNE.under + (TUNE.after - TUNE.under) * swell) * (1 - leaving));
      if (slipped) sound.play('tv_glitch', null, SOUND.crackle * quiet);
      // The presenter reads each shot's words. His clip begins as far in as the shot is (a set switched on
      // late, a sound started late, a slow frame), so he is never out of step; he is played at his own pitch.
      const air = tv.playing, voice = air && voiceOf(air);
      if (air && voice && air.shot !== spoken && chosen === null && sound.ctx) {
        const len = sound.length(voice); // (decoding: next frame)
        if (len && air.t < len - VOICE.tail) { sound.play(voice, null, 1, 1, 3, 0, air.t); spoken = air.shot; }
      }
      if (air && sound.ctx) { const next = REPORT[(air.shot + 1) % REPORT.length]?.voice; if (next) sound.length(next); } // (the next one ready in time)
      (globalThis as { __ready?: boolean }).__ready = revealed && chosen === null;
      if (leaving >= 1) {
        hiss?.stop();
        tv.dispose();
        screen.close();
        resolve(chosen!);
        return;
      }
      requestAnimationFrame(beat);
    };
    requestAnimationFrame(beat);
  });
}
