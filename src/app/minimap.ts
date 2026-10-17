/**
 * The minimap: the map (src/app/mapView.ts) small in a corner of the HUD, north up and centred on
 * the nobody, in the same salt-vein look: what this grandchild has seen below, all of the village up
 * top with its names. Drawn by the map's own `MapPainter` (its static layer is made again only every
 * few metres, so a paint is a blit and what moves). Off in Settings (graphics: Minimap).
 */
import type { Level } from '../gen/level';
import type { Explored } from '../world/explored';
import { growOn } from './growth';
import { MapPainter } from './mapView';
import { child, panel } from './panel';

/** Its size (css px, square), pixels per metre, and how often it redraws (s). */
export const MINIMAP = { size: 168, S: 4, every: 0.1 } as const;

const STYLE = `
  #minimap { position: fixed; right: 16px; bottom: 58px; z-index: 3; pointer-events: none; display: none; }
  #minimap.on { display: block; }
  #minimap .frame { position: relative; padding: 4px; border-radius: var(--ui-radius); }
  #minimap .sheet { border-radius: 3px; overflow: hidden; line-height: 0; box-shadow: inset 0 0 0 1px #0008, 0 0 0 1px var(--ui-line); }
  /* Played by touch the corner below is the right thumb's: up under the purse instead. */
  :root.ui-touch #minimap { bottom: auto; top: 128px; }
  @media (max-width: 720px) { #minimap .frame { padding: 3px; } }`;

export class Minimap {
  private readonly el: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly painter = new MapPainter();
  private drawnAt = -Infinity;
  private shown = false;

  constructor(host: HTMLElement) {
    this.el = panel(host, 'div', 'minimap', STYLE);
    const frame = child(this.el, 'div', 'frame ui-panel ui-grown');
    this.canvas = child(child(frame, 'div', 'sheet'), 'canvas');
    growOn(frame, 'minimap', { amount: 0.5, moss: false });
  }

  /** Show it or not (the setting is on, nothing covers the game, the nobody lives). */
  show(on: boolean): void {
    if (on === this.shown) return;
    this.shown = on;
    this.el.classList.toggle('on', on);
    this.drawnAt = -Infinity;
  }

  /** Redraw (now and then, while it shows) for the nobody at (x, y, z) looking along `yaw`; `fire`: their fire, if one burns. */
  draw(level: Level, seen: Explored, x: number, y: number, z: number, yaw: number, fire: { x: number; z: number } | null, now: number): void {
    if (!this.shown || now - this.drawnAt < MINIMAP.every) return;
    this.drawnAt = now;
    this.painter.paint(this.canvas, MINIMAP.size, MINIMAP.size, MINIMAP.S, true, level, seen, x, y, z, yaw, fire, now);
  }
}
