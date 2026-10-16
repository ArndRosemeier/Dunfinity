/**
 * The settings (O, or the button at the bottom right): the sound's volumes (all of it, effects,
 * ambience, music) and its switches, which key does what (click a key, then press the new one or
 * click with the mouse button you want), the graphics quality and reduced motion. Every change applies at once and
 * is kept (src/persist/settings.ts). While open the game hears no keys and the mouse is free.
 */
import type { SoundSettings, Quality } from '../persist/settings';
import { QUALITIES } from '../persist/settings';
import { keyLabel, type Bindings } from '../input/bindings';
import { button, child, panel } from './panel';

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
  #settings { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 10; display: none;
    width: min(560px, calc(100vw - 32px)); max-height: calc(100vh - 48px); overflow-y: auto; box-sizing: border-box;
    padding: 14px 18px 16px; background: #15130ff2; color: #e3d9c4; border: 1px solid #8a7656; border-radius: 5px; box-shadow: 0 6px 30px #000a;
    font: 13px/1.4 system-ui, sans-serif; }
  #settings.open { display: block; }
  #settings h2 { margin: 0 0 10px; font: 18px Georgia, serif; color: #f0e6cf; display: flex; justify-content: space-between; align-items: baseline; }
  #settings h2 .hint { font: 12px system-ui, sans-serif; color: #8d8270; }
  #settings .tabs { display: flex; gap: 4px; border-bottom: 1px solid #6b5a40; margin-bottom: 12px; }
  #settings .tabs button { background: none; border: 1px solid transparent; border-bottom: none; color: #b9a582; padding: 5px 12px; border-radius: 4px 4px 0 0; cursor: pointer; font: inherit; }
  #settings .tabs button.on { background: #2a251d; border-color: #6b5a40; color: #f0c860; }
  #settings .row { display: grid; grid-template-columns: 110px 1fr 44px; align-items: center; gap: 10px; margin: 6px 0; }
  #settings .row input[type=range] { width: 100%; accent-color: #f0c860; }
  #settings .row .v { text-align: right; color: #b9a582; font-variant-numeric: tabular-nums; }
  #settings label.check { display: block; margin: 8px 0 0; cursor: pointer; }
  #settings label.check input { accent-color: #f0c860; margin-right: 6px; }
  #settings h3 { margin: 12px 0 4px; font-size: 11px; color: #c9a86a; text-transform: uppercase; letter-spacing: 0.06em; }
  #settings h3:first-child { margin-top: 0; }
  #settings .key { display: flex; justify-content: space-between; align-items: center; padding: 2px 0; }
  #settings .key button, #settings .act { min-width: 92px; padding: 3px 8px; background: #2a251d; color: #e3d9c4; border: 1px solid #6b5a40; border-radius: 3px; cursor: pointer; font: inherit; }
  #settings .key button:hover, #settings .act:hover, #settings .quality:hover { border-color: #b9a582; }
  #settings .key button.moved { color: #f0c860; }
  #settings .key button.wait { border-color: #f0c860; color: #f0c860; }
  #settings .said { min-height: 1.4em; margin-top: 8px; color: #a8c98a; }
  #settings .quality { display: block; width: 100%; text-align: left; margin: 6px 0; padding: 8px 10px; background: #2a251d; color: #e3d9c4; border: 1px solid #6b5a40; border-radius: 4px; cursor: pointer; font: inherit; }
  #settings .quality b { display: block; margin-bottom: 2px; }
  #settings .quality span { color: #8d8270; }
  #settings .quality.on { border-color: #f0c860; }
  #settings .quality.on b { color: #f0c860; }
  #settings .foot { display: flex; justify-content: space-between; margin-top: 14px; }
  #settings-open { position: fixed; right: 12px; bottom: 14px; z-index: 6; padding: 3px 9px; background: #14110dcc; color: #b9a582; border: 1px solid #6d5a3d; border-radius: 4px; cursor: pointer; font: 12px system-ui, sans-serif; }
  #settings-open:hover { color: #f0c860; border-color: #b9a582; }`;

export class SettingsView {
  private readonly el: HTMLDivElement;
  private tab: Tab = 'sound';
  /** The action waiting for its new key, and the button showing it. */
  private waiting: { action: string; button: HTMLButtonElement } | null = null;
  private said = '';

  constructor(host: HTMLElement, private readonly hooks: SettingsHooks) {
    this.el = panel(host, 'div', 'settings', STYLE);
    button(host, 'Settings (O)', () => this.toggle()).id = 'settings-open';
    // Ahead of the game's listeners: keys go to the panel while it is open (a key being set, Escape or O to close).
    window.addEventListener('keydown', (e) => this.key(e), { capture: true });
    // A mouse button pressed on the key waiting for one is that key (anywhere else: never mind).
    window.addEventListener('mousedown', (e) => this.mouse(e), { capture: true });
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  get open(): boolean { return this.el.classList.contains('open'); }

  toggle(): void {
    const open = !this.open;
    this.el.classList.toggle('open', open);
    this.waiting = null;
    this.said = '';
    if (open) { document.exitPointerLock?.(); this.redraw(); }
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
    const h = child(this.el, 'h2', '', 'Settings');
    child(h, 'span', 'hint', 'Esc or O to close');
    const tabs = child(this.el, 'div', 'tabs');
    for (const [id, title] of TABS) {
      button(tabs, title, () => { this.tab = id; this.waiting = null; this.said = ''; this.redraw(); }, id === this.tab ? 'on' : '');
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
      if (a.group !== group) { group = a.group; child(body, 'h3', '', group); }
      const row = child(body, 'div', 'key');
      child(row, 'span', '', a.name);
      const key = b.keyOf(a.key), waiting = this.waiting?.action === a.key;
      const set = button(row, waiting ? 'Press a key…' : keyLabel(key), () => {
        if (this.waiting) return; // (the click that set a mouse button)
        this.waiting = { action: a.key, button: set };
        this.said = 'Press the new key or click here with a mouse button; Esc keeps the old one.';
        this.redraw();
      }, `${waiting ? 'wait' : ''} ${key !== a.key ? 'moved' : ''}`.trim());
      set.title = key !== a.key ? `Was ${keyLabel(a.key)}` : '';
      if (waiting) this.waiting = { action: a.key, button: set };
    }
    const foot = child(body, 'div', 'foot');
    child(foot, 'span', '', '1–0, - and = always use the bar.');
    button(foot, 'Reset keys', () => { b.clear(); this.waiting = null; this.said = 'Every key is back where it was.'; this.hooks.keysChanged(); this.redraw(); }, 'act');
  }

  private graphics(body: HTMLElement): void {
    const now = this.hooks.qualityNow();
    for (const q of QUALITIES) {
      const b = button(body, '', () => { this.hooks.setQuality(q); this.redraw(); }, `quality${q === now ? ' on' : ''}`);
      child(b, 'b', '', q[0].toUpperCase() + q.slice(1));
      child(b, 'span', '', this.hooks.qualityNotes[q]);
    }
    this.check(body, 'Reduced motion (the interface keeps still)', this.hooks.still(), (on) => this.hooks.setStill(on));
  }
}
