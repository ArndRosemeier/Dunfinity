/**
 * The title screen's overlay (the scene behind it is src/game/title.ts): the name, a line under it,
 * the menu (Continue, if there is a family to go on with, and New Game), the caption of the shot
 * playing, and the black the shots fade through.
 */
import { addStyle, button, child } from './panel';
import { useTheme } from './theme';
import { growOn } from './growth';

export type TitleChoice = 'continue' | 'new';

const CSS = `
  #title { position: fixed; inset: 0; z-index: 20; pointer-events: none; font-family: var(--ui-font-display); color: var(--ui-ink); }
  #title .black { position: absolute; inset: 0; background: #000; }
  #title .shade { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 55%, transparent 40%, rgba(0,0,0,0.75) 100%), linear-gradient(to right, rgba(0,0,0,0.65), transparent 55%); }
  #title .card { position: absolute; left: clamp(24px, 8vw, 120px); top: 50%; transform: translateY(-50%); pointer-events: auto; }
  #title h1 { margin: 0; font-weight: normal; font-size: clamp(44px, 9vw, 104px); letter-spacing: 0.12em; line-height: 1; color: var(--ui-ink); text-shadow: 0 0 28px color-mix(in srgb, var(--ui-accent) 30%, transparent), var(--ui-text-shadow); opacity: 0; transition: opacity 2.5s; }
  #title .line { margin: 14px 0 34px 4px; font-style: italic; font-size: clamp(15px, 1.7vw, 19px); color: var(--ui-ink-dim); text-shadow: var(--ui-text-shadow); opacity: 0; transition: opacity 2.5s 0.8s; }
  #title.shown h1, #title.shown .line { opacity: 1; }
  #title .menu { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; opacity: 0; transition: opacity 1.5s 1.6s; }
  #title.shown .menu { opacity: 1; }
  #title .menu > .ui-btn { position: relative; min-width: 220px; text-align: left; font: 400 20px/1 var(--ui-font-display); letter-spacing: .04em; padding: 11px 18px; }
  #title .ui-btn[disabled] { color: var(--ui-ink-faint); border-color: var(--ui-line); box-shadow: none; cursor: default; }
  #title .ask { max-width: 26em; padding: 12px 16px; font: 15px/1.45 var(--ui-font); color: var(--ui-ink-dim); }
  #title .ask .ui-btn { margin: 10px 8px 0 0; }
  #title .caption { position: absolute; right: clamp(16px, 4vw, 48px); bottom: clamp(16px, 4vh, 40px); font-style: italic; font-size: 15px; letter-spacing: 0.05em; color: var(--ui-ink-dim); text-shadow: var(--ui-text-shadow); opacity: 0; transition: opacity 1.2s; }
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
    useTheme();
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
      if (canContinue) choice(menu, 'Continue', 'primary', () => resolve('continue'));
      const fresh = choice(menu, 'New Game', canContinue ? '' : 'primary', () => {
        if (!canContinue) { resolve('new'); return; }
        // A new family forgets the kept one: ask once.
        fresh.disabled = true;
        const ask = child(menu, 'div', 'ask ui-panel', 'Start a new family? Grandma\'s tin, the finds and everyone who went down will be forgotten.');
        const row = child(ask, 'div');
        button(row, 'Yes, start again', () => resolve('new'), 'ui-btn primary small');
        button(row, 'No', () => { ask.remove(); fresh.disabled = false; }, 'ui-btn small');
      });
      (menu.querySelector('button') as HTMLButtonElement | null)?.focus({ preventScroll: true });
    });
  }

  /** Show the name and the menu (once the first shot is on screen); the salt grows in over the buttons. */
  show(): void {
    if (this.root.classList.contains('shown')) return;
    this.root.classList.add('shown');
    for (const b of this.root.querySelectorAll('.menu > .ui-btn')) b.classList.add('ui-grown');
  }

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

/** A menu choice (`kind`: 'primary' for the first), with the salt to grow over it. */
function choice(menu: HTMLElement, text: string, kind: string, click: () => void): HTMLButtonElement {
  const b = button(menu, text, click, `ui-btn ${kind}`.trim());
  growOn(b, `title-${text}`, { moss: false, amount: 0.8 });
  return b;
}
