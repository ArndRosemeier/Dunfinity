/**
 * The title screen's overlay (the scene behind it is src/game/title.ts): the name, a line under it,
 * the menu (Continue, if there is a family to go on with, and New Game), the caption of the shot
 * playing, and the black the shots fade through.
 */
import { addStyle, child } from './panel';

export type TitleChoice = 'continue' | 'new';

const CSS = `
  #title { position: fixed; inset: 0; z-index: 20; pointer-events: none; font-family: Georgia, 'Times New Roman', serif; color: #e8e2d4; }
  #title .black { position: absolute; inset: 0; background: #000; }
  #title .shade { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 55%, transparent 40%, rgba(0,0,0,0.75) 100%), linear-gradient(to right, rgba(0,0,0,0.65), transparent 55%); }
  #title .card { position: absolute; left: clamp(24px, 8vw, 120px); top: 50%; transform: translateY(-50%); pointer-events: auto; }
  #title h1 { margin: 0; font-weight: normal; font-size: clamp(44px, 9vw, 104px); letter-spacing: 0.14em; line-height: 1; color: #efe6d2; text-shadow: 0 0 24px rgba(255, 214, 150, 0.25), 0 2px 3px #000; opacity: 0; transition: opacity 2.5s; }
  #title .line { margin: 14px 0 34px 4px; font-style: italic; font-size: clamp(14px, 1.6vw, 18px); color: #b9b0a0; opacity: 0; transition: opacity 2.5s 0.8s; }
  #title.shown h1, #title.shown .line { opacity: 1; }
  #title .menu { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; opacity: 0; transition: opacity 1.5s 1.6s; }
  #title.shown .menu { opacity: 1; }
  #title button { font: inherit; font-size: clamp(18px, 2vw, 22px); letter-spacing: 0.06em; color: #d8cfbd; background: none; border: none; border-left: 2px solid transparent; padding: 4px 12px; cursor: pointer; text-shadow: 0 1px 2px #000; }
  #title button:hover, #title button:focus-visible { color: #fff4dc; border-left-color: #e8b860; outline: none; }
  #title button[disabled] { color: #6c665c; cursor: default; border-left-color: transparent; }
  #title .ask { margin: 10px 0 0 14px; font-size: 14px; color: #b9b0a0; max-width: 30em; }
  #title .ask button { font-size: 16px; padding: 2px 10px 2px 0; border: none; }
  #title .caption { position: absolute; right: clamp(16px, 4vw, 48px); bottom: clamp(16px, 4vh, 40px); font-style: italic; font-size: 15px; letter-spacing: 0.05em; color: #cfc6b4; text-shadow: 0 1px 3px #000; opacity: 0; transition: opacity 1.2s; }
  #title .caption.on { opacity: 0.85; }
  #title.gone { transition: opacity 0.6s; opacity: 0; }
`;

export class TitleScreen {
  private readonly root: HTMLDivElement;
  private readonly black: HTMLDivElement;
  private readonly caption: HTMLDivElement;
  /** The player's choice, once made. */
  readonly chosen: Promise<TitleChoice>;

  /** `canContinue`: a family is kept (src/persist/save.ts), so Continue goes on with it and New Game forgets it. */
  constructor(host: HTMLElement, canContinue: boolean) {
    addStyle(CSS);
    this.root = child(host, 'div');
    this.root.id = 'title';
    this.black = child(this.root, 'div', 'black');
    child(this.root, 'div', 'shade');
    const card = child(this.root, 'div', 'card');
    child(card, 'h1', '', 'DUNFINITY');
    child(card, 'div', 'line', 'Grandma left you her kitchen knife, and a way down that never ends.');
    const menu = child(card, 'div', 'menu');
    this.caption = child(this.root, 'div', 'caption');
    this.chosen = new Promise((resolve) => {
      if (canContinue) child(menu, 'button', '', 'Continue').addEventListener('click', () => resolve('continue'));
      const fresh = child(menu, 'button', '', 'New Game');
      fresh.addEventListener('click', () => {
        if (!canContinue) { resolve('new'); return; }
        // A new family forgets the kept one: ask once.
        fresh.disabled = true;
        const ask = child(menu, 'div', 'ask', 'Start a new family? Grandma\'s tin, the finds and everyone who went down will be forgotten. ');
        child(ask, 'button', '', 'Yes, start again').addEventListener('click', () => resolve('new'));
        child(ask, 'button', '', 'No').addEventListener('click', () => { ask.remove(); fresh.disabled = false; });
      });
      (menu.querySelector('button') as HTMLButtonElement | null)?.focus({ preventScroll: true });
    });
  }

  /** Show the name and the menu (once the first shot is on screen). */
  show(): void { this.root.classList.add('shown'); }

  /** How black the screen is, 0..1 (the shots fade through black). */
  set dark(v: number) { this.black.style.opacity = String(v); }

  /** The caption of the shot playing (empty: none). */
  set line(text: string) {
    if (text) this.caption.textContent = text;
    this.caption.classList.toggle('on', !!text);
  }

  /** Fade the overlay away and drop it. */
  close(): void {
    this.root.classList.add('gone');
    setTimeout(() => this.root.remove(), 700);
  }
}
