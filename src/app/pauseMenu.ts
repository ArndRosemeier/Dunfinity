/**
 * The pause menu (Escape once the mouse is free, or the Menu button): the game stands still behind
 * it. Go on, the settings (src/app/settingsView.ts), the keys. Escape or Go on closes it.
 */
import { keysHtml } from './hud';
import { Modal, button, keycap } from './panel';

const STYLE = `
  #pause { width: min(560px, calc(100vw - 32px)); z-index: 11; }
  #pause.open { box-shadow: var(--ui-shadow), 0 0 0 100vmax #000a; }
  #pause > .ui-scroll { padding: 22px 28px 18px; }
  #pause .ui-title { font-size: 34px; text-align: center; margin-bottom: 2px; }
  #pause .sub { text-align: center; margin-bottom: 14px; }
  #pause .go { display: flex; gap: 10px; justify-content: center; margin-bottom: 4px; }
  #pause h3 { margin: 16px 0 8px; }
  #pause .keys { display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 5px 10px; align-items: center; font-size: 14px; }
  #pause .keys .k { text-align: right; white-space: nowrap; }
  #pause .keys .t { color: var(--ui-ink-dim); }
  @media (max-width: 560px) { #pause .keys { grid-template-columns: auto 1fr; } }
  #menu-button { position: fixed; right: 136px; top: 10px; z-index: 10; }`;

/** What the menu asks of the game. */
export interface PauseActions {
  /** Close the menu and take the mouse again. */
  resume(): void;
  /** The menu opened (true) or closed: the game's clock stops and goes on. */
  paused(on: boolean): void;
  /** Open the settings. */
  settings(): void;
  /** The keys and what they do (as the player has bound them). */
  keys(): readonly (readonly [readonly string[], string])[];
}

export class PauseMenu extends Modal {
  constructor(host: HTMLElement, private readonly act: PauseActions) {
    super(host, 'pause', STYLE, 'dark', (open) => act.paused(open));
    button(host, 'Menu', () => { if (this.open) act.resume(); else this.showMenu(); }, 'ui-btn small').id = 'menu-button';
  }

  showMenu(): void {
    if (document.pointerLockElement) document.exitPointerLock();
    this.showHtml(`<h2 class="ui-title">Dunfinity</h2><div class="sub ui-label">The game stands still</div><div class="go"></div>`
      + `<h3 class="ui-label">Keys</h3><div class="keys">${keysHtml(this.act.keys())}</div>`
      + `<div class="ui-keys">${keycap('Esc')} go on</div>`);
    const go = this.el.querySelector<HTMLDivElement>('.go')!;
    button(go, 'Go on', () => this.act.resume(), 'ui-btn primary');
    button(go, 'Settings', () => this.act.settings(), 'ui-btn');
  }
}
