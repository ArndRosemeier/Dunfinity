/**
 * The mark over the Tab target (src/game/target.ts): a red chevron above its head, how much health
 * it has left (a meter grown over with grandma's salt, src/app/growth.ts) and, under it, how tough
 * it is for you (src/combat/challenge.ts: "a fair fight", "run?", "untested"), where the camera sees it.
 */
import type { Camera } from 'three';
import { toScreen } from '../render/screen';
import { child, panel } from './panel';
import { growOn } from './growth';

const STYLE = `
  #target { position: fixed; z-index: 4; transform: translate(-50%, -100%); pointer-events: none; display: none; flex-direction: column; align-items: center; gap: 3px; }
  #target .bar { position: relative; }
  #target .ui-meter { width: 52px; height: 5px; --c: var(--ui-blood); }
  #target .word { font: 600 11px var(--ui-font); letter-spacing: .04em; text-shadow: 0 0 4px #000, 0 0 2px #000; line-height: 1; white-space: nowrap; }
  #target .word:empty { display: none; }
  #target .v { color: var(--ui-blood); font: 700 16px var(--ui-font); text-shadow: 0 0 4px #000, 0 0 2px #000; line-height: 1; animation: target-bob 1.2s ease-in-out infinite; }
  @keyframes target-bob { 50% { transform: translateY(-3px); } }`;

export class TargetMark {
  private readonly el: HTMLDivElement;
  private readonly bar: HTMLDivElement;
  private readonly hp: HTMLDivElement;
  private readonly word: HTMLDivElement;

  constructor(host: HTMLElement) {
    this.el = panel(host, 'div', 'target', STYLE);
    this.word = child(this.el, 'div', 'word');
    this.bar = child(this.el, 'div', 'bar');
    this.hp = child(this.bar, 'div', 'ui-meter');
    child(this.el, 'div', 'v', '▼');
    growOn(this.bar, 'target', { amount: 0.45, moss: false });
  }

  /**
   * Mark (x, y, z) (the top of the target's head) seen by `camera`, its health a share `left` (null:
   * none); `word` says how tough it is, in `colour` (empty: nothing said).
   */
  paint(camera: Camera, x: number, y: number, z: number, left: number | null, word = '', colour = ''): void {
    if (left === null) { this.el.style.display = 'none'; this.bar.classList.remove('open'); return; }
    const at = toScreen(camera, x, y, z);
    if (!at) { this.el.style.display = 'none'; return; }
    this.el.style.display = 'flex';
    this.bar.classList.add('open');
    this.el.style.left = `${at.x}px`;
    this.el.style.top = `${at.y}px`;
    this.hp.style.setProperty('--v', String(Math.max(0, Math.min(1, left))));
    if (this.word.textContent !== word) this.word.textContent = word;
    this.word.style.color = colour;
  }
}
