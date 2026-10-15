/**
 * The mark over the Tab target (src/game/target.ts): a red chevron above its head and how much
 * health it has left, where the camera sees it.
 */
import type { Camera } from 'three';
import { toScreen } from '../render/screen';
import { child, panel } from './panel';

const STYLE = `
  #target { position: fixed; z-index: 4; transform: translate(-50%, -100%); pointer-events: none; display: none; flex-direction: column; align-items: center; gap: 2px; }
  #target .hp { width: 46px; height: 5px; background: #000a; border: 1px solid #000; }
  #target .hp div { height: 100%; background: #c8402c; }
  #target .v { color: #e0503a; font: bold 16px system-ui, sans-serif; text-shadow: 0 0 3px #000; line-height: 1; }`;

export class TargetMark {
  private readonly el: HTMLDivElement;
  private readonly hp: HTMLDivElement;

  constructor(host: HTMLElement) {
    this.el = panel(host, 'div', 'target', STYLE);
    this.hp = child(child(this.el, 'div', 'hp'), 'div');
    child(this.el, 'div', 'v', '▼');
  }

  /** Mark (x, y, z) (the top of the target's head) seen by `camera`, its health a share `left` (null: none). */
  paint(camera: Camera, x: number, y: number, z: number, left: number | null): void {
    if (left === null) { this.el.style.display = 'none'; return; }
    const at = toScreen(camera, x, y, z);
    if (!at) { this.el.style.display = 'none'; return; }
    this.el.style.display = 'flex';
    this.el.style.left = `${at.x}px`;
    this.el.style.top = `${at.y}px`;
    this.hp.style.width = `${Math.round(Math.max(0, Math.min(1, left)) * 100)}%`;
  }
}
