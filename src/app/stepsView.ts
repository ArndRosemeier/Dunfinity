/**
 * The first steps on screen (src/game/firstSteps.ts): a small paper card at the top right with the
 * steps showing, each with its keys on key caps and, while open, a line on how. A step done is struck
 * through with a pencil line drawn across it; new steps write themselves in. When the list is done
 * the card says goodbye and fades.
 */
import { STEP_GROUPS, type FirstSteps, type StepId } from '../game/firstSteps';
import { esc, panel } from './panel';

const STYLE = `
  #steps { position: fixed; right: 14px; top: 14px; z-index: 6; width: min(330px, calc(100vw - 28px)); pointer-events: none;
    background: #e9dfc6ee; color: #2b2116; border: 1px solid #8a7656; border-radius: 3px; padding: 10px 14px 11px; font: 14px/1.35 Georgia, serif;
    box-shadow: 0 4px 18px #0009; transform: rotate(0.6deg); opacity: 0; transition: opacity 0.8s ease, transform 0.8s ease; display: none; }
  #steps.open { display: block; }
  #steps.shown { opacity: 1; }
  #steps.bye { opacity: 0; transform: rotate(0.6deg) translateY(-12px); transition-duration: 2.4s; }
  #steps h3 { margin: 0 0 6px; font: 600 11px system-ui, sans-serif; letter-spacing: 0.1em; text-transform: uppercase; color: #6d5a3d; }
  #steps .step { position: relative; padding: 3px 0 3px 22px; animation: stepIn 0.7s ease both; }
  #steps .step::before { content: ''; position: absolute; left: 2px; top: 7px; width: 10px; height: 10px; border: 1.5px solid #6d5a3d; border-radius: 2px; }
  #steps .step.done { color: #8a7a60; }
  #steps .step.done::after { content: '✓'; position: absolute; left: 3px; top: -1px; font: 700 16px system-ui, sans-serif; color: #2f5d7a; animation: tickIn 0.4s ease both; }
  #steps .step .text { position: relative; display: inline; }
  #steps .step.done .text::after { content: ''; position: absolute; left: -2px; right: -2px; top: 55%; height: 1.5px; background: #5a4a35; transform-origin: left; animation: strike 0.5s ease both; }
  #steps .step.was .text::after, #steps .step.was::after { animation: none; }
  #steps .step.was { animation: none; }
  #steps .how { font-size: 12px; color: #6d5a3d; margin-top: 1px; }
  #steps kbd { display: inline-block; min-width: 1.1em; padding: 0 5px; margin-left: 4px; border: 1px solid #8a7656; border-bottom-width: 2px; border-radius: 3px;
    background: #f6efdc; font: 600 11px/1.5 system-ui, sans-serif; color: #3a2c1c; text-align: center; vertical-align: 1px; }
  #steps .bye { font-style: italic; color: #4a3a26; }
  @keyframes stepIn { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: none; } }
  @keyframes strike { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  @keyframes tickIn { from { opacity: 0; transform: scale(1.8); } to { opacity: 1; transform: none; } }`;

/** What the card says when every step is done. */
export const GOODBYE = 'That is all the help there is. The rest you learn the way she did: a bit at a time, only as deep as you have got.';

export class StepsView {
  private readonly el: HTMLDivElement;
  /** What was drawn last (a step id per line, with whether it was done), to redraw only on change and animate only what changed. */
  private drawn = '';
  private wasDone = new Set<StepId>();
  private byeAt = -1;

  constructor(host: HTMLElement) {
    this.el = panel(host, 'div', 'steps', STYLE);
  }

  /** Draw the card for `steps` (call each frame; it redraws only on change). `now`: seconds, for the goodbye. */
  redraw(steps: FirstSteps, now: number): void {
    if (steps.over) {
      if (this.el.classList.contains('open') && this.byeAt < 0) this.el.classList.remove('open', 'shown');
      return;
    }
    if (!this.el.classList.contains('open')) {
      this.el.classList.add('open');
      requestAnimationFrame(() => this.el.classList.add('shown'));
    }
    if (steps.finished) {
      if (this.byeAt < 0) {
        this.byeAt = now;
        this.el.innerHTML = `<h3>First steps</h3><div class="bye">${esc(GOODBYE)}</div>`;
      } else if (now - this.byeAt > 9) {
        this.el.classList.add('bye');
        if (now - this.byeAt > 12) { steps.over = true; this.el.classList.remove('open', 'shown', 'bye'); }
      }
      return;
    }
    const shown = steps.showing(), key = shown.map((s) => `${s.id}${steps.isDone(s.id) ? '+' : ''}`).join(' ');
    if (key === this.drawn) return;
    const before = new Set(this.drawn.split(' ').map((s) => s.replace('+', '')));
    this.drawn = key;
    const g = STEP_GROUPS[steps.group];
    this.el.innerHTML = `<h3>${esc(g.title)}</h3>` + shown.map((s) => {
      const done = steps.isDone(s.id), was = done ? this.wasDone.has(s.id) : before.has(s.id);
      return `<div class="step${done ? ' done' : ''}${was ? ' was' : ''}"><span class="text">${esc(s.text)}</span>${s.keys.map((k) => `<kbd>${esc(k)}</kbd>`).join('')}`
        + `${done ? '' : `<div class="how">${esc(s.how)}</div>`}</div>`;
    }).join('');
    for (const s of shown) if (steps.isDone(s.id)) this.wasDone.add(s.id);
  }
}
