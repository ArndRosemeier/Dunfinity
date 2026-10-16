/**
 * The pause menu (Escape once the mouse is free, or the Menu button): the game stands still behind
 * it. Go on, the keys, the sound, What's new. Escape or Go on closes it.
 */
import type { SoundSettings } from '../persist/settings';
import { HELP, keysHtml } from './hud';
import { Modal, child, keycap, onClick } from './panel';

const STYLE = `
  #pause { width: min(560px, calc(100vw - 32px)); z-index: 11; }
  #pause > .ui-scroll { padding: 22px 28px 18px; }
  #pause .ui-title { font-size: 34px; text-align: center; margin-bottom: 2px; }
  #pause .sub { text-align: center; margin-bottom: 14px; }
  #pause .go { display: flex; gap: 10px; justify-content: center; margin-bottom: 4px; }
  #pause h3 { margin: 16px 0 8px; }
  #pause .keys { display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 5px 10px; align-items: center; font-size: 14px; }
  #pause .keys .k { text-align: right; white-space: nowrap; }
  #pause .keys .t { color: var(--ui-ink-dim); }
  @media (max-width: 560px) { #pause .keys { grid-template-columns: auto 1fr; } }
  #pause .row { display: flex; align-items: center; gap: 12px; margin: 6px 0; }
  #pause .row label { min-width: 90px; color: var(--ui-ink-dim); }
  #pause input[type=range] { flex: 1; accent-color: var(--ui-accent); }
  #pause .ui-btn.on { border-color: var(--ui-accent); color: var(--ui-accent); }
  #menu-button { position: fixed; right: 136px; top: 10px; z-index: 10; }`;

/** What the menu asks of the game. */
export interface PauseActions {
  /** Close the menu and take the mouse again. */
  resume(): void;
  /** The menu opened (true) or closed: the game's clock stops and goes on. */
  paused(on: boolean): void;
  /** The sound settings, and changing them. */
  sound(): SoundSettings;
  setSound(s: Partial<SoundSettings>): void;
}

export class PauseMenu extends Modal {
  constructor(host: HTMLElement, private readonly act: PauseActions) {
    super(host, 'pause', STYLE, 'dark', (open) => act.paused(open));
    const button = child(host, 'button', 'ui-btn small', 'Menu');
    button.id = 'menu-button';
    onClick(button, () => { if (this.open) act.resume(); else this.showMenu(); });
  }

  showMenu(): void {
    if (document.pointerLockElement) document.exitPointerLock();
    const s = this.act.sound();
    this.showHtml(`<h2 class="ui-title">Dunfinity</h2><div class="sub ui-label">The game stands still</div>`
      + `<div class="go"><button class="ui-btn primary" data-do="resume">Go on</button></div>`
      + `<h3 class="ui-label">Sound</h3>`
      + `<div class="row"><label for="pause-volume">Volume</label><input id="pause-volume" type="range" min="0" max="100" value="${Math.round(s.volume * 100)}"></div>`
      + `<div class="row"><label>Switches</label><button class="ui-btn small${s.muted ? '' : ' on'}" data-do="mute">Sound ${s.muted ? 'off' : 'on'}</button>`
      + `<button class="ui-btn small${s.music ? ' on' : ''}" data-do="music">Music ${s.music ? 'on' : 'off'}</button></div>`
      + `<h3 class="ui-label">Keys</h3><div class="keys">${keysHtml(HELP)}</div>`
      + `<div class="ui-keys">${keycap('Esc')} go on</div>`);
    this.el.querySelector<HTMLInputElement>('#pause-volume')!.addEventListener('input', (e) => this.act.setSound({ volume: Number((e.target as HTMLInputElement).value) / 100 }));
    for (const b of this.el.querySelectorAll<HTMLButtonElement>('[data-do]')) {
      onClick(b, () => {
        const what = b.dataset.do;
        if (what === 'resume') { this.act.resume(); return; }
        const now = this.act.sound();
        this.act.setSound(what === 'mute' ? { muted: !now.muted } : { music: !now.music });
        this.showMenu();
      });
    }
  }
}
