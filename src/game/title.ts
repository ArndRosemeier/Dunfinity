/**
 * The title screen: an old television in a dark living room, playing the 1966 report on what came up
 * in grandma's town (src/app/tvSet.ts, src/lore/report.ts), the name and the menu beside it
 * (src/app/titleScreen.ts). Behind it the game's own level streams in and its shaders build; each
 * build slips the set's vertical hold. The choice switches the set off and ends it.
 */
import { Rng, deriveSeed } from '@futuremagic/core';
import { REPORT, shotStart } from '../lore/report';
import { TitleScreen, type TitleChoice } from '../app/titleScreen';
import { TvSet } from '../app/tvSet';

/** Seconds: the set warming up before the name and menu come; from the choice to black. */
const TIMING = { reveal: 1.2, leave: 0.8 };

/** What the title needs from the game. */
export interface TitleCast {
  readonly seed: number;
  /** A family is kept: Continue goes on with it (and the report cuts in partway: it has been seen). */
  readonly canContinue: boolean;
  /** Hold on this shot of the report (`?title&shot=<n>`, for screenshots), or null. */
  readonly pinned: number | null;
  /** Resolves once everything play needs is compiled (src/render/stage.ts warmLater); the menu waits for it. */
  readonly ready: Promise<void>;
  /** Shader builds so far (src/render/shaders/monitor.ts): each new one slips the picture. */
  builds(): number;
  /** The set is on (the loading screen can go). */
  shown(): void;
  /** Once a frame: the game's level streams in behind the title (nothing is drawn). */
  frame(now: number): void;
}

/** Play the title until the player chooses; resolves with the screen black, the overlay gone. */
export async function playTitle(host: HTMLElement, cast: TitleCast): Promise<TitleChoice> {
  const screen = new TitleScreen(host, cast.canContinue);
  // A first visit watches from the start; later ones switch on partway through (a different shot each time).
  const from = cast.canContinue ? shotStart(new Rng(deriveSeed(cast.seed, 'title', Math.floor(performance.timeOrigin))).int(1, REPORT.length - 1)) : 0;
  const tv = new TvSet(screen.back, cast.seed, from, cast.pinned);
  await tv.loaded.catch(() => {}); // a missing picture leaves its shot dark, nothing worse
  let chosen: TitleChoice | null = null, chosenAt = 0, revealed = false;
  const now = (): number => performance.now() / 1000;
  const start = now();
  tv.on(start);
  cast.shown();
  screen.chosen.then((c) => { chosen = c; chosenAt = now(); tv.off(chosenAt); });
  cast.ready.then(() => screen.ready());
  return new Promise((resolve) => {
    const frame = (): void => {
      const t = now();
      if (!revealed && t - start > TIMING.reveal) { revealed = true; screen.reveal(); }
      const leaving = chosen === null ? 0 : Math.min(1, (t - chosenAt) / TIMING.leave);
      screen.dark = leaving * leaving;
      tv.frameAt(t, cast.builds());
      cast.frame(t);
      (globalThis as { __ready?: boolean }).__ready = revealed && chosen === null;
      if (leaving >= 1) {
        tv.dispose();
        screen.close();
        resolve(chosen!);
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
