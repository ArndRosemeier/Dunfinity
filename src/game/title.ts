/**
 * The title screen: an old television in a dark living room, playing the 1966 report on what came up
 * in grandma's town (src/app/tvSet.ts, src/lore/report.ts), the name and the menu beside it
 * (src/app/titleScreen.ts). Behind it the game's own level streams in and its shaders build; each
 * build slips the set's vertical hold. The choice switches the set off and ends it.
 */
import { Rng, deriveSeed } from '@futuremagic/core';
import { REPORT, shotStart, voiceOf } from '../lore/report';
import { TitleScreen, type TitleChoice } from '../app/titleScreen';
import { TvSet } from '../app/tvSet';
import type { SoundEngine, SoundLoop } from '../audio/audio';

/** Seconds: the set warming up before the name and menu come; from the choice to black. */
const TIMING = { reveal: 1.2, leave: 0.8 };
/** The set's sound: the hiss (and how much louder a rough signal makes it), a slip's crackle, and how soon after it comes on its clunk still plays (s). */
const SOUND = { hiss: 0.45, rough: 0.5, crackle: 0.8, clunk: 2 };

/** What the title needs from the game. */
export interface TitleCast {
  readonly seed: number;
  /** A family is kept: Continue goes on with it (and the report cuts in partway: it has been seen). */
  readonly canContinue: boolean;
  /** Hold on this shot of the report (`?title&shot=<n>`, for screenshots), or null. */
  readonly pinned: number | null;
  /** Resolves once everything play needs is compiled (src/render/stage.ts warmLater); the menu waits for it. */
  readonly ready: Promise<void>;
  /** The game's sound (it starts on the first touch or key: then the set hisses). */
  readonly sound: SoundEngine;
  /** Shader builds so far (src/render/shaders/monitor.ts): each new one slips the picture. */
  builds(): number;
  /** The set is on (the loading screen can go). */
  shown(): void;
  /** Once a frame: the game's level streams in behind the title (nothing is drawn). */
  stream(now: number): void;
}

/** Play the title until the player chooses; resolves with the screen black, the overlay gone. */
export async function playTitle(host: HTMLElement, cast: TitleCast): Promise<TitleChoice> {
  const screen = new TitleScreen(host, cast.canContinue);
  // A first visit watches from the start; later ones switch on partway through (a different shot each time).
  const from = cast.canContinue ? shotStart(new Rng(deriveSeed(cast.seed, 'title', Math.floor(performance.timeOrigin))).int(1, REPORT.length - 1)) : 0;
  const tv = new TvSet(screen.back, cast.seed, from, cast.pinned);
  await tv.loaded.catch(() => {}); // a missing picture leaves its shot dark, nothing worse
  let chosen: TitleChoice | null = null, chosenAt = 0, revealed = false, hiss: SoundLoop | null = null, said: string | null = null;
  const now = (): number => performance.now() / 1000;
  const start = now();
  tv.on(start);
  cast.shown();
  screen.chosen.then((c) => { chosen = c; chosenAt = now(); tv.off(chosenAt); });
  cast.ready.then(() => screen.ready());
  return new Promise((resolve) => {
    const beat = (): void => {
      const t = now();
      if (!revealed && t - start > TIMING.reveal) { revealed = true; screen.reveal(); }
      const leaving = chosen === null ? 0 : Math.min(1, (t - chosenAt) / TIMING.leave);
      screen.dark = leaving * leaving;
      const slipped = tv.frameAt(t, cast.builds());
      cast.stream(t);
      // The sound, once the browser lets it start: the clunk if the set has only just come on, its hiss, a crackle when the picture slips.
      if (!hiss && chosen === null && cast.sound.ctx && (hiss = cast.sound.loop('tv_static')) && t - start < SOUND.clunk) cast.sound.play('tv_on', null);
      hiss?.set(0, 0, -1, (SOUND.hiss + SOUND.rough * tv.trouble) * (1 - leaving));
      if (slipped) cast.sound.play('tv_glitch', null, SOUND.crackle);
      // The presenter speaks as each of his lines comes up (not one already under way when the set came on).
      const air = tv.playing, line = air ? `${air.shot}:${air.line}` : null, voice = air && voiceOf(air);
      if (line !== said && said !== null && voice && chosen === null) cast.sound.play(voice, null);
      said = line;
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
