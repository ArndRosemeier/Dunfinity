/**
 * The settings (O, or the button at the bottom right): the sound's volumes (all of it, effects,
 * ambience, music) and its switches, which key does what (click a key, then press the new one or
 * click with the mouse button you want), the graphics quality and reduced motion. Every change applies at once and
 * is kept (src/persist/settings.ts). While open the game hears no keys and the mouse is free.
 */
import type { SoundSettings, Quality } from '../persist/settings';
import { QUALITIES } from '../persist/settings';
import { keyLabel, type Bindings } from '../input/bindings';
import { Modal, button, child, keycap } from './panel';

/** What the panel reads and changes. */
export interface SettingsHooks {
  sound(): SoundSettings;
  setSound(s: Partial<SoundSettings>): void;
  /** The actions that answer to a key, grouped, in order (named by their own key). */
  readonly actions: readonly { readonly key: string; readonly name: string; readonly group: string }[];
  readonly bindings: Bindings;
  /** The keys changed (kept and put to use by the game). */
  keysChanged(): void;
  qualityNow(): Quality;
  setQuality(q: Quality): void;
  /** Reduced motion (the interface keeps still). */
  still(): boolean;
  setStill(on: boolean): void;
  /** What each quality means. */
  readonly qualityNotes: Readonly<Record<Quality, string>>;
  /** Opened or closed (the game stops and starts listening). */
  opened(open: boolean): void;
}

type Tab = 'sound' | 'keys' | 'graphics';
const TABS: readonly [Tab, string][] = [['sound', 'Sound'], ['keys', 'Keys'], ['graphics', 'Graphics']];

const STYLE = `
  #settings { width: min(560px, calc(100vw - 32px)); z-index: 10; }
  #settings > .ui-scroll { padding: 14px 18px 16px; }
  #settings .head { display: flex; justify-content: space-between; align-items: baseline; }
  #settings .head .ui-keys { margin: 0; }
  #settings .tabs { display: flex; gap: 6px; margin: 4px 0 12px; }
  #settings .row { display: grid; grid-template-columns: 110px 1fr 44px; align-items: center; gap: 10px; margin: 6px 0; }
  #settings .row input[type=range], #settings label.check input { accent-color: var(--ui-accent); }
  #settings .row input[type=range] { width: 100%; }
  #settings .row .v { text-align: right; color: var(--ui-ink-dim); font-variant-numeric: tabular-nums; }
  #settings label.check { display: block; margin: 8px 0 0; cursor: pointer; }
  #settings label.check input { margin-right: 6px; }
  #settings h3 { margin: 12px 0 4px; }
  #settings .key { display: flex; justify-content: space-between; align-items: center; padding: 2px 0; }
  #settings .key .ui-btn { min-width: 92px; }
  #settings .key .ui-btn.moved { color: var(--ui-accent); }
  #settings .key .ui-btn.wait { border-color: var(--ui-accent); box-shadow: var(--ui-glow); }
  #settings .said { min-height: 1.4em; margin-top: 8px; color: var(--ui-good); }
  #settings .quality { display: block; width: 100%; text-align: left; margin: 6px 0; line-height: 1.35; }
  #settings .quality b { display: block; margin-bottom: 2px; }
  #settings .quality span { color: var(--ui-ink-dim); }
  #settings .foot { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; color: var(--ui-ink-dim); }
  #settings-open { position: fixed; right: 12px; bottom: 14px; z-index: 6; }`;

export class SettingsView extends Modal {
  private tab: Tab = 'sound';
  /** The action waiting for its new key, and the button showing it. */
  private waiting: { action: string; button: HTMLButtonElement } | null = null;
  private said = '';

  constructor(host: HTMLElement, private readonly hooks: SettingsHooks) {
    super(host, 'settings', STYLE, 'dark');
    button(host, 'Settings (O)', () => this.toggle(), 'ui-btn small').id = 'settings-open';
    // Ahead of the game's listeners: keys go to the panel while it is open (a key being set, Escape or O to close).
    window.addEventListener('keydown', (e) => this.key(e), { capture: true });
    // A mouse button pressed on the key waiting for one is that key (anywhere else: never mind).
    window.addEventListener('mousedown', (e) => this.mouse(e), { capture: true });
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  toggle(): void {
    const open = !this.open;
    this.waiting = null;
    this.said = '';
    if (open) { document.exitPointerLock?.(); this.showHtml(''); this.redraw(); } else this.hide();
    this.hooks.opened(open);
  }

  private key(e: KeyboardEvent): void {
    if (!this.open) return;
    e.stopImmediatePropagation();
    if (e.code === 'Tab' || this.waiting) e.preventDefault();
    if (e.repeat) return;
    if (this.waiting) {
      if (e.code === 'Escape') { this.waiting = null; this.redraw(); return; }
      this.give(e.code);
    } else if (e.code === 'Escape' || this.hooks.bindings.actionOf(e.code) === 'KeyO') this.toggle();
  }

  private mouse(e: MouseEvent): void {
    const w = this.waiting;
    if (!this.open || !w) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    if (e.target === w.button) this.give(`Mouse${e.button}`);
    else { this.waiting = null; this.redraw(); }
  }

  /** Give the waiting action `code`. */
  private give(code: string): void {
    const { action } = this.waiting!;
    const b = this.hooks.bindings;
    this.waiting = null;
    if (!b.canTake(code)) this.said = `${keyLabel(code)} stays as it is (Esc, \` and the bar's number keys can't be moved).`;
    else {
      const other = b.rebind(action, code);
      this.said = other ? `${this.name(other)} moved to ${keyLabel(b.keyOf(other))}.` : '';
      this.hooks.keysChanged();
    }
    this.redraw();
  }

  private name(action: string): string { return this.hooks.actions.find((a) => a.key === action)?.name ?? action; }

  private redraw(): void {
    this.el.textContent = '';
    const h = child(this.el, 'div', 'head');
    child(h, 'h2', 'ui-title', 'Settings');
    child(h, 'div', 'ui-keys').innerHTML = `${keycap('Esc')} or ${keycap(keyLabel(this.hooks.bindings.keyOf('KeyO')))} to close`;
    const tabs = child(this.el, 'div', 'tabs');
    for (const [id, title] of TABS) {
      button(tabs, title, () => { this.tab = id; this.waiting = null; this.said = ''; this.redraw(); }, `ui-btn small${id === this.tab ? ' primary' : ''}`);
    }
    const body = child(this.el, 'div');
    if (this.tab === 'sound') this.sound(body);
    else if (this.tab === 'keys') this.keys(body);
    else this.graphics(body);
    child(this.el, 'div', 'said', this.said);
  }

  private sound(body: HTMLElement): void {
    const s = this.hooks.sound();
    const slider = (title: string, field: 'volume' | 'effects' | 'ambience' | 'musicVolume') => {
      const row = child(body, 'div', 'row');
      child(row, 'span', '', title);
      const r = child(row, 'input');
      r.type = 'range'; r.min = '0'; r.max = '100'; r.value = String(Math.round(s[field] * 100));
      const v = child(row, 'span', 'v', `${r.value}%`);
      r.addEventListener('input', () => { v.textContent = `${r.value}%`; this.hooks.setSound({ [field]: Number(r.value) / 100 }); });
    };
    slider('Volume', 'volume');
    slider('Effects', 'effects');
    slider('Ambience', 'ambience');
    slider('Music', 'musicVolume');
    const b = this.hooks.bindings;
    const check = this.check.bind(this, body);
    check(`Sound on (${keyLabel(b.keyOf('KeyN'))})`, !s.muted, (on) => this.hooks.setSound({ muted: !on }));
    check(`Music on (${keyLabel(b.keyOf('KeyB'))})`, s.music, (on) => this.hooks.setSound({ music: on }));
  }

  /** A checkbox saying `title` in `body`. */
  private check(body: HTMLElement, title: string, on: boolean, set: (on: boolean) => void): void {
    const l = child(body, 'label', 'check'), c = document.createElement('input');
    c.type = 'checkbox'; c.checked = on;
    c.addEventListener('change', () => set(c.checked));
    l.append(c, title);
  }

  private keys(body: HTMLElement): void {
    const b = this.hooks.bindings;
    let group = '';
    for (const a of this.hooks.actions) {
      if (a.group !== group) { group = a.group; child(body, 'h3', 'ui-label', group); }
      const row = child(body, 'div', 'key');
      child(row, 'span', '', a.name);
      const key = b.keyOf(a.key), waiting = this.waiting?.action === a.key;
      const set = button(row, waiting ? 'Press a key…' : keyLabel(key), () => {
        if (this.waiting) return; // (the click that set a mouse button)
        this.waiting = { action: a.key, button: set };
        this.said = 'Press the new key or click here with a mouse button; Esc keeps the old one.';
        this.redraw();
      }, `ui-btn small${waiting ? ' wait' : ''}${key !== a.key ? ' moved' : ''}`);
      set.title = key !== a.key ? `Was ${keyLabel(a.key)}` : '';
      if (waiting) this.waiting = { action: a.key, button: set };
    }
    const foot = child(body, 'div', 'foot');
    child(foot, 'span', '', '1–0, - and = always use the bar.');
    button(foot, 'Reset keys', () => { b.clear(); this.waiting = null; this.said = 'Every key is back where it was.'; this.hooks.keysChanged(); this.redraw(); }, 'ui-btn small');
  }

  private graphics(body: HTMLElement): void {
    const now = this.hooks.qualityNow();
    for (const q of QUALITIES) {
      const b = button(body, '', () => { this.hooks.setQuality(q); this.redraw(); }, `ui-btn quality${q === now ? ' primary' : ''}`);
      child(b, 'b', '', q[0].toUpperCase() + q.slice(1));
      child(b, 'span', '', this.hooks.qualityNotes[q]);
    }
    this.check(body, 'Reduced motion (the interface keeps still)', this.hooks.still(), (on) => this.hooks.setStill(on));
  }
}
