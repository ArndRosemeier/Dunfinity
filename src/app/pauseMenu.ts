/**
 * The pause menu (Escape once the mouse is free, or the Menu button): the game stands still behind
 * it. Go on, the settings (src/app/settingsView.ts), saving as the family's mode has it
 * (src/persist/save.ts: Rogue like saves and goes back to the title; Adventure saves by hand and
 * goes back to any of those saves), the keys. Escape or Go on closes it.
 */
import { keysHtml } from './hud';
import { Modal, button, child, keycap } from './panel';
import { MODE_NAMES, type GameMode, type ManualSave } from '../persist/save';
import { familyLine } from './titleScreen';

const STYLE = `
  #pause { width: min(560px, calc(100vw - 32px)); z-index: 11; }
  #pause.open { box-shadow: var(--ui-shadow), 0 0 0 100vmax #000a; }
  #pause > .ui-scroll { padding: 22px 28px 18px; }
  #pause .ui-title { font-size: 34px; text-align: center; margin-bottom: 2px; }
  #pause .sub { text-align: center; margin-bottom: 14px; }
  #pause .go { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-bottom: 4px; }
  #pause .saves { margin-top: 10px; }
  #pause .saves .save { display: flex; gap: 8px; align-items: center; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--ui-line); font-size: 14px; }
  #pause .saves .said { color: var(--ui-good); text-align: center; }
  #pause h3 { margin: 16px 0 8px; }
  #pause .keys { display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 5px 10px; align-items: center; font-size: 14px; }
  #pause .keys .k { text-align: right; white-space: nowrap; }
  #pause .keys .t { color: var(--ui-ink-dim); }
  @media (max-width: 560px) { #pause .keys { grid-template-columns: auto 1fr; } }
  #menu-button { position: fixed; right: 136px; top: 10px; z-index: 10; }
  :root.ui-touch #menu-button { right: 156px; }`;

/** What the menu asks of the game. */
export interface PauseActions {
  /** Close the menu and take the mouse again. */
  resume(): void;
  /** The menu opened (true) or closed: the game's clock stops and goes on. */
  paused(on: boolean): void;
  /** Open the settings. */
  settings(): void;
  /** How the family plays. */
  mode(): GameMode;
  /** Rogue like: keep the one save and go back to the title. */
  saveAndQuit(): void;
  /** Adventure: a save by hand; the saves made so far, newest first; go back to the one made at `at`; back to the title. */
  save(): void;
  saves(): readonly ManualSave[];
  load(at: number): void;
  quit(): void;
  /** Can the game be saved now (not a test view, not with the grandchild dead)? */
  canSave(): boolean;
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
    const mode = this.act.mode();
    this.showHtml(`<h2 class="ui-title">Dunfinity</h2><div class="sub ui-label">The game stands still · ${MODE_NAMES[mode]}</div><div class="go"></div><div class="saves"></div>`
      + `<h3 class="ui-label">Keys</h3><div class="keys">${keysHtml(this.act.keys())}</div>`
      + `<div class="ui-keys">${keycap('Esc')} go on</div>`);
    const go = this.el.querySelector<HTMLDivElement>('.go')!, saves = this.el.querySelector<HTMLDivElement>('.saves')!;
    button(go, 'Go on', () => this.act.resume(), 'ui-btn primary');
    const can = this.act.canSave();
    if (mode === 'rogue') {
      if (can) button(go, 'Save and quit', () => this.act.saveAndQuit(), 'ui-btn');
    } else {
      if (can) button(go, 'Save', () => { this.act.save(); this.listSaves(saves, 'Saved.'); }, 'ui-btn');
      button(go, 'Load', () => this.listSaves(saves, ''), 'ui-btn');
      button(go, 'Quit to title', () => this.act.quit(), 'ui-btn');
    }
    button(go, 'Settings', () => this.act.settings(), 'ui-btn');
  }

  /** The Adventure's saves by hand in `box`, each with Load (`said`: a line above them). */
  private listSaves(box: HTMLElement, said: string): void {
    box.textContent = '';
    if (said) child(box, 'div', 'said', said);
    const all = this.act.saves();
    if (!all.length) child(box, 'div', 'said', 'No saves yet: Save keeps the game as it stands.');
    for (const m of all) {
      const row = child(box, 'div', 'save');
      child(row, 'span', '', familyLine(m.entry));
      button(row, 'Load', () => this.act.load(m.at), 'ui-btn small');
    }
  }
}
