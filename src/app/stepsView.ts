/**
 * The first steps on screen (src/game/firstSteps.ts): a small paper card at the top right with the
 * steps showing, each with its keys on key caps and, while open, a line on how. A step done is struck
 * through with a pencil line drawn across it; new steps write themselves in. When the list is done
 * the card says goodbye and fades.
 */
import { STEP_GROUPS, type FirstSteps, type StepId } from '../game/firstSteps';
import { child, esc, keycap, panel } from './panel';
import { growOn, type Growth } from './growth';

const STYLE = `
  #steps { position: fixed; right: 16px; top: 130px; z-index: 6; width: min(330px, calc(100vw - 28px)); pointer-events: none; box-sizing: border-box;
    padding: 10px 14px 11px; font: 15px/1.35 var(--ui-font-paper); box-shadow: var(--ui-shadow);
    transform: rotate(0.6deg); opacity: 0; transition: opacity 0.8s var(--ui-ease), transform 0.8s var(--ui-ease); display: none; }
  #steps.open { display: block; }
  #steps.shown { opacity: 1; }
  #steps.bye { opacity: 0; transform: rotate(0.6deg) translateY(-12px); transition-duration: 2.4s; }
  #steps .ui-label { margin: 0 0 6px; }
  #steps .step { position: relative; padding: 3px 0 3px 22px; animation: stepIn 0.7s var(--ui-ease) both; }
  #steps .step::before { content: ''; position: absolute; left: 2px; top: 7px; width: 10px; height: 10px; border: 1.5px solid var(--ui-paper-dim); border-radius: 2px; }
  #steps .step.done { color: var(--ui-paper-dim); }
  #steps .step.done::after { content: '✓'; position: absolute; left: 3px; top: -1px; font: 700 16px var(--ui-font); color: var(--ui-paper-blue); animation: tickIn 0.4s var(--ui-ease) both; }
  #steps .step .text { position: relative; display: inline; margin-right: 4px; }
  #steps .step.done .text::after { content: ''; position: absolute; left: -2px; right: -2px; top: 55%; height: 1.5px; background: var(--ui-paper-ink); opacity: .7; transform-origin: left; animation: strike 0.5s var(--ui-ease) both; }
  #steps .step.was .text::after, #steps .step.was::after { animation: none; }
  #steps .step.was { animation: none; }
  #steps .ui-key { margin-left: 3px; font-size: 11px; }
  #steps .how { font-size: 13px; color: var(--ui-paper-dim); margin-top: 1px; font-style: italic; }
  #steps .bye { font-style: italic; }
  @keyframes stepIn { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: none; } }
  @keyframes strike { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  @keyframes tickIn { from { opacity: 0; transform: scale(1.8); } to { opacity: 1; transform: none; } }`;

/** What the card says when every step is done. */
export const GOODBYE = 'That is all the help there is. The rest you learn the way she did: a bit at a time, only as deep as you have got.';

export class StepsView {
  /** The card (holding the growth) and its content. */
  private readonly frame: HTMLDivElement;
  private readonly el: HTMLDivElement;
  private readonly growth: Growth;
  /** What was drawn last (a step id per line, with whether it was done), to redraw only on change and animate only what changed. */
  private drawn = '';
  private wasDone = new Set<StepId>();
  private byeAt = -1;

  constructor(host: HTMLElement) {
    this.frame = panel(host, 'div', 'steps', STYLE);
    this.frame.className = 'ui-paper';
    this.el = child(this.frame, 'div');
    this.growth = growOn(this.frame, 'steps', { amount: 0.6 });
  }

  /** Draw the card for `steps` (call each frame; it redraws only on change). `now`: seconds, for the goodbye. */
  pin(steps: FirstSteps, now: number): void {
    if (steps.over) {
      if (this.frame.classList.contains('open') && this.byeAt < 0) this.frame.classList.remove('open', 'shown');
      return;
    }
    if (!this.frame.classList.contains('open')) {
      this.frame.classList.add('open');
      this.growth.fit();
      requestAnimationFrame(() => this.frame.classList.add('shown'));
    }
    if (steps.finished) {
      if (this.byeAt < 0) {
        this.byeAt = now;
        this.el.innerHTML = `<div class="ui-label">First steps</div><div class="bye">${esc(GOODBYE)}</div>`;
      } else if (now - this.byeAt > 9) {
        this.frame.classList.add('bye');
        if (now - this.byeAt > 12) { steps.over = true; this.frame.classList.remove('open', 'shown', 'bye'); }
      }
      return;
    }
    const shown = steps.showing(), key = shown.map((s) => `${s.id}${steps.isDone(s.id) ? '+' : ''}`).join(' ');
    if (key === this.drawn) return;
    const before = new Set(this.drawn.split(' ').map((s) => s.replace('+', '')));
    this.drawn = key;
    const g = STEP_GROUPS[steps.group];
    this.el.innerHTML = `<div class="ui-label">${esc(g.title)}</div>` + shown.map((s) => {
      const done = steps.isDone(s.id), was = done ? this.wasDone.has(s.id) : before.has(s.id);
      return `<div class="step${done ? ' done' : ''}${was ? ' was' : ''}"><span class="text">${esc(s.text)}</span>${s.keys.map(keycap).join('')}`
        + `${done ? '' : `<div class="how">${esc(s.how)}</div>`}</div>`;
    }).join('');
    for (const s of shown) if (steps.isDone(s.id)) this.wasDone.add(s.id);
  }
}
