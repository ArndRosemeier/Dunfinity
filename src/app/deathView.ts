/**
 * The death screen (decision D11, permadeath), played out over a few seconds once the grandchild has
 * fallen: the view darkens round the body, then the notary's sheet comes up. The death line, Herr
 * Brüggemann crossing the name out stroke by stroke, the next heir's name written in under it, and
 * what the family keeps and what went down with them (src/game/runEnd.ts). Only once the pen is down
 * can the next grandchild be sent (R, or the button), so a key mashed in the fight does not skip it.
 * Then the screen goes black and a line says who the letter is for, while the cellar is made ready.
 */
import { child, panel } from './panel';
import type { RunEnd } from '../game/runEnd';

/** Seconds after death: when the sheet comes up, when the pen starts, letters struck per second, when the keep lines and the button come. */
export const DEATH = { sheet: 2.2, strike: 3.0, perSec: 16, kept: 1.0, ready: 1.6, dark: 0.6 } as const;
/** Sending the next one down: seconds to black, then seconds the letter's line stays on black. */
export const NEXT = { black: 0.8, letter: 2.2 } as const;

const STYLE = `
  #death { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -48%); z-index: 10; width: min(760px, calc(100vw - 32px)); max-height: calc(100vh - 48px); overflow-y: auto;
    padding: 20px 26px;
    opacity: 0; pointer-events: none; transition: opacity 0.9s ease, transform 0.9s ease; display: none; }
  #death.up { display: block; }
  #death.shown { opacity: 1; transform: translate(-50%, -50%); pointer-events: auto; }
  #death .how { font: 400 30px/1.15 var(--ui-font-display); margin: 0 0 12px; }
  #death .pen { font-style: italic; color: var(--ui-paper-dim); margin-bottom: 6px; }
  #death .list { font: 16px/1.6 var(--ui-font-paper); padding-left: 14px; margin-bottom: 12px; }
  #death .list .gone { color: #7b6a50; text-decoration: line-through; }
  #death .list .struck { text-decoration: line-through; text-decoration-color: var(--ui-paper-ink); text-decoration-thickness: 2px; }
  #death .list .where, #death .list .next { opacity: 0; transition: opacity 0.6s; }
  #death .list .where.on, #death .list .next.on { opacity: 1; }
  #death .list .next { color: var(--ui-paper-blue); font: 400 21px var(--ui-font-display); }
  #death .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; opacity: 0; transition: opacity 0.8s; }
  #death .cols.on { opacity: 1; }
  @media (max-width: 640px) { #death .cols { grid-template-columns: 1fr; } }
  #death h3 { border-bottom: 1px solid var(--ui-paper-line); margin: 0 0 4px; padding-bottom: 2px; }
  #death .cols div p { margin: 3px 0; font-size: 14px; }
  #death .kept p { color: var(--ui-paper-blue); }
  #death .lost p { color: var(--ui-paper-dim); }
  #death button { margin-top: 14px; opacity: 0; transition: opacity 0.6s, border-color .12s, box-shadow .12s; }
  #death button.on { opacity: 1; }
  #death-letter { position: fixed; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center; color: var(--ui-ink); font: italic 24px var(--ui-font-paper); text-shadow: var(--ui-text-shadow);
    pointer-events: none; opacity: 0; transition: opacity 0.7s; text-align: center; padding: 16px; }
  #death-letter.on { opacity: 1; }`;

export interface Mourning {
  /** The death line ("The rats got you."). */
  readonly how: string;
  /** The notary's list before this one: lines already crossed out. */
  readonly before: readonly string[];
  /** The fallen grandchild's name, to be crossed out, and where and of what. */
  readonly name: string;
  readonly where: string;
  /** The next heir's name. */
  readonly next: string;
  readonly end: RunEnd;
}

export class DeathView {
  private readonly el: HTMLDivElement;
  private readonly letter: HTMLDivElement;
  private struck!: HTMLSpanElement;
  private rest!: HTMLSpanElement;
  private where!: HTMLSpanElement;
  private nextName!: HTMLDivElement;
  private cols!: HTMLDivElement;
  private button!: HTMLButtonElement;
  private name = '';
  private asked = false;
  private up = false;
  private t = 0;
  constructor(host: HTMLElement) {
    this.el = panel(host, 'div', 'death', STYLE);
    this.el.className = 'ui-paper';
    this.letter = child(host, 'div');
    this.letter.id = 'death-letter';
  }

  /** Lay the sheet out for `m` (not shown yet: `playOut` brings it up). */
  layOut(m: Mourning): void {
    this.el.innerHTML = '';
    this.asked = false;
    this.name = m.name;
    child(this.el, 'div', 'how', m.how);
    child(this.el, 'div', 'pen', 'Herr Brüggemann takes out his list and uncaps his pen.');
    const list = child(this.el, 'div', 'list');
    for (const l of m.before) child(list, 'div', 'gone', l);
    const line = child(list, 'div');
    this.struck = child(line, 'span', 'struck');
    this.rest = child(line, 'span', '', m.name);
    this.where = child(line, 'span', 'where', `  (${m.where})`);
    this.nextName = child(list, 'div', 'next', m.next);
    this.cols = child(this.el, 'div', 'cols');
    const kept = child(this.cols, 'div', 'kept'), lost = child(this.cols, 'div', 'lost');
    child(kept, 'h3', 'ui-label', 'Back on the armchair');
    for (const l of m.end.kept) child(kept, 'p', '', l);
    child(lost, 'h3', 'ui-label', 'Gone down with them');
    for (const l of m.end.lost) child(lost, 'p', '', l);
    this.button = child(this.el, 'button', 'ui-btn primary', `R: send ${m.next} down`);
    this.button.addEventListener('click', () => { if (this.ready) this.asked = true; });
    this.el.classList.add('up');
    this.up = true;
    this.t = 0;
  }

  /** Seconds since the death at which the pen is down and the next grandchild can go. */
  private get readyAt(): number {
    return DEATH.strike + this.name.length / DEATH.perSec + DEATH.ready;
  }

  /** Whether the next grandchild can be sent now. */
  get ready(): boolean {
    return this.up && this.t >= this.readyAt;
  }

  /** Whether the button was clicked (once). */
  takeAsked(): boolean {
    const a = this.asked;
    this.asked = false;
    return a;
  }

  /** Play the sheet `t` seconds after the death; returns how dark the view should be (0 … 1). */
  playOut(t: number): number {
    this.t = t;
    this.el.classList.toggle('shown', t >= DEATH.sheet);
    const n = Math.max(0, Math.min(this.name.length, Math.floor((t - DEATH.strike) * DEATH.perSec)));
    if (this.struck.textContent!.length !== n) { this.struck.textContent = this.name.slice(0, n); this.rest.textContent = this.name.slice(n); }
    const penDown = DEATH.strike + this.name.length / DEATH.perSec;
    this.where.classList.toggle('on', t >= penDown);
    this.nextName.classList.toggle('on', t >= penDown + 0.5);
    this.cols.classList.toggle('on', t >= penDown + DEATH.kept);
    this.button.classList.toggle('on', t >= this.readyAt);
    return Math.min(1, t / DEATH.sheet) * DEATH.dark;
  }

  /** Put the sheet away (it fades, then leaves the page). */
  putAway(): void {
    this.up = false;
    this.el.classList.remove('shown');
  }

  /** On black, while the next one is made ready: who the letter is for (null: fade it out). */
  letterFor(text: string | null): void {
    if (text) { this.letter.textContent = text; this.el.classList.remove('up'); }
    this.letter.classList.toggle('on', !!text);
  }
}
