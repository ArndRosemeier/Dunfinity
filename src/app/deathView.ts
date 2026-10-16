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
    background: #e9dfc6f4; color: #2b2116; border: 1px solid #8a7656; border-radius: 4px; padding: 18px 22px; font: 15px/1.45 Georgia, serif; box-shadow: 0 8px 40px #000c;
    opacity: 0; pointer-events: none; transition: opacity 0.9s ease, transform 0.9s ease; display: none; }
  #death.up { display: block; }
  #death.shown { opacity: 1; transform: translate(-50%, -50%); pointer-events: auto; }
  #death .how { font-size: 21px; margin: 0 0 10px; }
  #death .pen { font-style: italic; color: #5a4a35; margin-bottom: 6px; }
  #death .list { font: 15px/1.6 Georgia, serif; padding-left: 14px; margin-bottom: 12px; }
  #death .list .gone { color: #7b6a50; text-decoration: line-through; }
  #death .list .struck { text-decoration: line-through; text-decoration-color: #2b2116; text-decoration-thickness: 2px; }
  #death .list .where, #death .list .next { opacity: 0; transition: opacity 0.6s; }
  #death .list .where.on, #death .list .next.on { opacity: 1; }
  #death .list .next { color: #2f5d7a; }
  #death .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; opacity: 0; transition: opacity 0.8s; }
  #death .cols.on { opacity: 1; }
  @media (max-width: 640px) { #death .cols { grid-template-columns: 1fr; } }
  #death h3 { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #6d5a3d; border-bottom: 1px solid #b9a582; margin: 0 0 4px; font-weight: normal; }
  #death .cols div p { margin: 3px 0; font-size: 14px; }
  #death .kept p { color: #2f5d7a; }
  #death .lost p { color: #6d5a3d; }
  #death button { margin-top: 14px; font: 15px Georgia, serif; padding: 6px 14px; background: #d6c59f; color: #2b2116; border: 1px solid #8a7656; border-radius: 3px; cursor: pointer;
    opacity: 0; transition: opacity 0.6s; }
  #death button.on { opacity: 1; }
  #death button:hover { background: #c9b78f; }
  #death-letter { position: fixed; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center; color: #d8ccb0; font: italic 22px Georgia, serif;
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
    child(kept, 'h3', '', 'Back on the armchair');
    for (const l of m.end.kept) child(kept, 'p', '', l);
    child(lost, 'h3', '', 'Gone down with them');
    for (const l of m.end.lost) child(lost, 'p', '', l);
    this.button = child(this.el, 'button', '', `R: send ${m.next} down`);
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
