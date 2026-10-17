/**
 * The title screen's overlay (src/game/title.ts plays it): the television behind (`back`,
 * src/app/tvSet.ts), and beside it the name, a line under it, the menu (Continue, if there is a family
 * to go on with, and New Game), and the black the choice fades to.
 */
import { addStyle, button, child } from './panel';
import { useTheme } from './theme';
import { growOn } from './growth';
import { VERSION } from './whatsNew';
import { writeToUs } from './contact';

export type TitleChoice = 'continue' | 'new';

const CSS = `
  #title { position: fixed; inset: 0; z-index: 20; pointer-events: none; font-family: var(--ui-font-display); color: var(--ui-ink); }
  #title .back { position: absolute; inset: 0; background: #000; }
  #title .back canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  #title .black { position: absolute; inset: 0; background: #000; opacity: 0; }
  #title .shade { position: absolute; inset: 0; background: linear-gradient(to right, rgba(0,0,0,0.8), rgba(0,0,0,0.45) 30%, transparent 48%); }
  #title .card { position: absolute; left: clamp(24px, 6vw, 110px); top: 50%; transform: translateY(-50%); pointer-events: auto; max-width: 40vw; }
  #title h1 { margin: 0; font-weight: normal; font-size: clamp(40px, 5vw, 88px); letter-spacing: 0.12em; line-height: 1; color: var(--ui-ink); text-shadow: 0 0 28px color-mix(in srgb, var(--ui-accent) 30%, transparent), var(--ui-text-shadow); opacity: 0; transition: opacity 2.5s; }
  #title .line { margin: 14px 0 34px 4px; font-style: italic; font-size: clamp(15px, 1.7vw, 19px); color: var(--ui-ink-dim); text-shadow: var(--ui-text-shadow); opacity: 0; transition: opacity 2.5s 0.8s; }
  #title.shown h1, #title.shown .line { opacity: 1; }
  #title .menu { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; opacity: 0; transition: opacity 1.5s 1.6s; }
  #title.shown .menu { opacity: 1; }
  #title .menu > .ui-btn { position: relative; min-width: 220px; text-align: left; font: 400 20px/1 var(--ui-font-display); letter-spacing: .04em; padding: 11px 18px; }
  #title .ui-btn[disabled] { color: var(--ui-ink-faint); border-color: var(--ui-line); box-shadow: none; cursor: default; }
  #title .lamps { margin-top: 4px; font: italic 14px/1.3 var(--ui-font); color: var(--ui-ink-faint); text-shadow: var(--ui-text-shadow); transition: opacity 1.2s; }
  #title .lamps.done { opacity: 0; }
  /* The alpha note: a stamp over the name's corner and a line on what that means; a quiet contact button. */
  #title .name { position: relative; display: inline-block; }
  #title .stamp { position: absolute; right: -0.4em; top: -1.6em; transform: rotate(-8deg); font: 700 clamp(22px, 2.6vw, 40px)/1 var(--ui-font); letter-spacing: .18em; padding: .14em .4em .1em .55em; color: var(--ui-accent); border: 3px solid var(--ui-accent); border-radius: 6px; background: color-mix(in srgb, var(--ui-dark) 70%, transparent); box-shadow: 0 0 18px color-mix(in srgb, var(--ui-accent) 25%, transparent); text-shadow: var(--ui-text-shadow); opacity: 0; transition: opacity 1.2s 1.2s; }
  #title.shown .stamp { opacity: 1; }
  #title .alpha { margin: -22px 0 26px 4px; max-width: 30em; font: 14px/1.45 var(--ui-font); color: var(--ui-ink-dim); text-shadow: var(--ui-text-shadow); opacity: 0; transition: opacity 2s 1.2s; }
  #title .alpha b { color: var(--ui-accent); font-weight: 700; }
  #title.shown .alpha { opacity: 1; }
  #title .contact { margin-top: 18px; opacity: 0; transition: opacity 1.5s 2s; }
  #title.shown .contact { opacity: 1; }
  #title .ask { max-width: 26em; padding: 12px 16px; font: 15px/1.45 var(--ui-font); color: var(--ui-ink-dim); }
  #title .ask .ui-btn { margin: 10px 8px 0 0; }
  /* Upright screens: the set above, the name and menu under it. */
  @media (orientation: portrait) {
    #title .shade { background: linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.4) 38%, transparent 55%); }
    #title .card { top: auto; bottom: clamp(20px, 5vh, 60px); transform: none; max-width: none; right: 24px; }
    #title h1 { font-size: clamp(36px, 12vw, 72px); }
    #title .line { margin-bottom: 20px; }
    #title .alpha { margin: -12px 0 14px 2px; }
    #title .stamp { top: -1.7em; right: 0; }
  }
  #title.gone { transition: opacity 0.6s; opacity: 0; }
  /* The game's own HUD waits under the title (vitals, help, the ability bar, its Menu and Settings buttons). */
  body:has(#title) :is(#game-hud, #hud, #bar, #menu-button, #settings-open) { visibility: hidden; }
`;

export class TitleScreen {
  private readonly root: HTMLDivElement;
  private readonly black: HTMLDivElement;
  /** Behind the name and menu: where the television goes. */
  readonly back: HTMLDivElement;
  private readonly menu: HTMLDivElement;
  private readonly lamps: HTMLDivElement;
  /** The player's choice, once made. */
  readonly chosen: Promise<TitleChoice>;

  /** `canContinue`: a family is kept (src/persist/save.ts), so Continue goes on with it and New Game forgets it. */
  constructor(host: HTMLElement, canContinue: boolean) {
    useTheme();
    addStyle(CSS);
    this.root = child(host, 'div');
    this.root.id = 'title';
    this.back = child(this.root, 'div', 'back');
    child(this.root, 'div', 'shade');
    const card = child(this.root, 'div', 'card');
    const name = child(card, 'div', 'name');
    child(name, 'h1', '', 'DUNFINITY');
    child(name, 'div', 'stamp', 'ALPHA');
    child(card, 'div', 'line', 'Grandma left you her kitchen knife, and a way down that never ends.');
    child(card, 'div', 'alpha').innerHTML = `<b>Alpha ${VERSION}.</b> An early test: expect bugs, gaps and changes, and a family that may not survive an update. Tell us what you find.`;
    const menu = this.menu = child(card, 'div', 'menu');
    const contact = child(card, 'div', 'contact');
    button(contact, 'Contact us', () => writeToUs(VERSION), 'ui-btn small');
    this.black = child(this.root, 'div', 'black');
    let going = null as HTMLButtonElement | null;
    this.chosen = new Promise((resolve) => {
      if (canContinue) going = choice(menu, 'Continue', 'primary', () => resolve('continue'));
      const fresh = choice(menu, 'New Game', canContinue ? '' : 'primary', () => {
        if (!canContinue) { resolve('new'); return; }
        // A new family forgets the kept one: ask once.
        fresh.disabled = true;
        const ask = child(menu, 'div', 'ask ui-panel', 'Start a new family? Grandma\'s tin, the finds and everyone who went down will be forgotten.');
        const row = child(ask, 'div');
        button(row, 'Yes, start again', () => resolve('new'), 'ui-btn primary small');
        button(row, 'No', () => { ask.remove(); fresh.disabled = false; }, 'ui-btn small');
      });
    });
    // Continue is greyed out until the game's shaders are ready (src/render/stage.ts warmLater), so play
    // never stutters. New Game is not: the character creator (src/game/creator.ts) comes first, and they
    // go on building while it shows.
    if (going) going.disabled = true;
    this.going = going;
    this.lamps = child(menu, 'div', 'lamps', canContinue ? 'Lighting the lamps\u2026' : '');
  }

  /** Continue, while it waits for the shaders (null: no family to go on with). */
  private readonly going: HTMLButtonElement | null;

  /** The game is ready to play: Continue wakes up. */
  ready(): void {
    if (this.lamps.classList.contains('done')) return;
    this.lamps.classList.add('done');
    setTimeout(() => this.lamps.remove(), 1300);
    if (this.going) {
      this.going.disabled = false;
      this.going.focus({ preventScroll: true });
    }
  }

  /** Show the name and the menu (once the set is on); the salt grows in over the buttons. */
  reveal(): void {
    if (this.root.classList.contains('shown')) return;
    this.root.classList.add('shown');
    for (const b of this.root.querySelectorAll('.menu > .ui-btn')) b.classList.add('ui-grown');
    this.menu.querySelector<HTMLButtonElement>(':scope > button:not([disabled])')?.focus({ preventScroll: true });
  }

  /** How black the screen is, 0..1 (after the choice it fades to black). */
  set dark(v: number) { this.black.style.opacity = String(v); }

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
