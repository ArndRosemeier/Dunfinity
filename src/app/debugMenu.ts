/**
 * The debug menu (the key left of 1: ` or ^): give yourself every ability, become invulnerable or
 * tireless, go to any level, teleport into any level style, and to anything worth checking out on this level. A DOM panel;
 * it lets go of the mouse while open (click the game to look round again).
 */
import { bandOf } from '../gen/bands';
import { child, panel } from './panel';

/** What the menu asks the game to do. */
export interface DebugActions {
  /** Every recipe card at its top rank, and all of Kemal's gear. */
  allAbilities(): string;
  /** Go to level `depth` (at its arrival). */
  toLevel(depth: number): void;
  /** The places worth checking out on the level one is on. */
  places(): readonly { readonly name: string }[];
  /** Go to place `i` of `places()`. */
  toPlace(i: number): void;
  /** The level one is on. */
  depth(): number;
  /** The level styles one can be sent to, and sending one into the nearest region of one (another level if this one has none). */
  readonly styles: readonly string[];
  toStyle(id: string): void;
  /** What to copy for a report of where one stands (a link back, and what the level says there). */
  position(): string;
  /** Go to the place in a pasted report or link; what to say about it. */
  goTo(text: string): string;
}

/** The levels with a button of their own (any other through the number box). */
const LEVELS = 12;

const STYLE = `
  #debug { position: fixed; right: 12px; top: 44px; z-index: 9; display: none; width: 300px; max-height: calc(100vh - 54px); overflow-y: auto; padding: 10px 12px; font-size: 13px; line-height: 1.35; }
  #debug.open { display: block; }
  #debug h3 { margin: 12px 0 4px; }
  #debug h3:first-child { margin-top: 0; }
  #debug button { margin: 2px 2px 2px 0; }
  #debug button.here { border-color: var(--ui-accent); color: var(--ui-accent); }
  #debug .places button { display: block; width: 100%; text-align: left; }
  #debug label { display: block; margin: 2px 0; cursor: pointer; }
  #debug input, #debug textarea { background: var(--ui-dark-raised); color: var(--ui-ink); border: 1px solid var(--ui-line-bright); border-radius: 3px; font: inherit; }
  #debug input[type=text] { width: 180px; }
  #debug input[type=number] { width: 52px; }
  #debug textarea { width: 100%; box-sizing: border-box; height: 120px; margin-top: 4px; font: 11px monospace; }
  #debug input[type=checkbox] { accent-color: var(--ui-accent); }
  #debug .said { color: var(--ui-good); min-height: 1em; margin-top: 4px; white-space: pre-wrap; }
  #debug .hint { color: var(--ui-ink-faint); margin-top: 8px; }`;

export class DebugMenu {
  /** Blows and falls take nothing. */
  invulnerable = false;
  /** Stamina stays full. */
  tireless = false;
  private readonly el: HTMLDivElement;
  private readonly said: HTMLDivElement;
  private readonly levels: HTMLDivElement;
  private readonly list: HTMLDivElement;
  /** Where the position shows to copy by hand when the clipboard will not take it. */
  private readonly copy: HTMLTextAreaElement;

  constructor(host: HTMLElement, private readonly act: DebugActions) {
    this.el = panel(host, 'div', 'debug', STYLE);
    this.el.className = 'ui-panel';
    const heading = (text: string) => child(this.el, 'h3', 'ui-label', text);
    const button = (parent: HTMLElement, text: string, click: () => void): HTMLButtonElement => {
      const b = child(parent, 'button', 'ui-btn small', text);
      b.addEventListener('click', (e) => { e.stopPropagation(); click(); b.blur(); });
      return b;
    };
    const toggle = (text: string, set: (on: boolean) => void) => {
      const l = document.createElement('label'), c = document.createElement('input');
      c.type = 'checkbox';
      c.addEventListener('change', () => { set(c.checked); c.blur(); });
      l.append(c, ` ${text}`);
      this.el.appendChild(l);
    };
    heading('Debug');
    button(this.el, 'Give me all abilities', () => this.say(act.allAbilities()));
    toggle('Invulnerable', (on) => { this.invulnerable = on; });
    toggle('Tireless (stamina stays full)', (on) => { this.tireless = on; });
    heading('Go to level');
    this.levels = child(this.el, 'div');
    for (let d = 0; d <= LEVELS; d++) button(this.levels, String(d), () => act.toLevel(d)).title = d ? `Level ${d} · ${bandOf(d).name}` : bandOf(0).name;
    const any = document.createElement('div'), n = document.createElement('input');
    n.type = 'number'; n.min = '0'; n.value = String(LEVELS + 1);
    any.append(n, ' ');
    button(any, 'Go', () => { const d = Math.max(0, Math.floor(Number(n.value) || 0)); act.toLevel(d); });
    this.el.appendChild(any);
    heading('Report a spot');
    button(this.el, 'Copy position', () => {
      const text = act.position();
      const done = () => this.say('Copied. Paste it into the chat.');
      navigator.clipboard?.writeText(text).then(done, () => this.showCopy(text)) ?? this.showCopy(text);
    });
    const paste = document.createElement('div'), box = document.createElement('input');
    box.type = 'text'; box.placeholder = 'paste a position or link';
    box.addEventListener('keydown', (e) => e.stopPropagation());
    paste.append(box, ' ');
    button(paste, 'Go there', () => this.say(act.goTo(box.value)));
    this.el.appendChild(paste);
    this.copy = document.createElement('textarea');
    this.copy.readOnly = true;
    this.copy.style.display = 'none';
    this.el.appendChild(this.copy);
    heading('Teleport to a level style');
    const styles = child(this.el, 'div');
    for (const id of act.styles) button(styles, id, () => { act.toStyle(id); if (this.open) this.toggle(); }).title = 'The nearest region of this style, here or on the nearest level that has one';
    heading('Teleport on this level');
    this.list = child(this.el, 'div', 'places');
    this.said = child(this.el, 'div', 'said');
    child(this.el, 'div', 'hint', 'Kept in the save like anything you do. ` (^) closes; click the game to look round.');
    // The game's keys still work with the menu open; typing a level number must not walk.
    n.addEventListener('keydown', (e) => e.stopPropagation());
  }

  get open(): boolean {
    return this.el.classList.contains('open');
  }

  toggle(): void {
    this.el.classList.toggle('open');
    if (this.open) {
      document.exitPointerLock?.();
      this.refresh();
    }
  }

  /** Redraw the level buttons and the places (after going somewhere). */
  refresh(): void {
    if (!this.open) return;
    const depth = this.act.depth();
    [...this.levels.children].forEach((b, d) => b.classList.toggle('here', d === depth));
    this.list.replaceChildren();
    this.act.places().forEach((p, i) => {
      const b = child(this.list, 'button', 'ui-btn small', p.name);
      b.addEventListener('click', (e) => { e.stopPropagation(); this.act.toPlace(i); b.blur(); });
    });
  }

  /** The clipboard refused: show the text selected, to copy with Ctrl+C. */
  private showCopy(text: string): void {
    this.copy.value = text;
    this.copy.style.display = 'block';
    this.copy.select();
    this.say('Press Ctrl+C to copy it, then paste it into the chat.');
  }

  private say(text: string): void {
    this.said.textContent = text;
  }
}
