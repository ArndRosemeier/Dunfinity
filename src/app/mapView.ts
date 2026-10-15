/**
 * The map (M): what this grandchild has seen of the level (src/world/explored.ts), drawn from above
 * round them, north up: the floor they have walked by, shaded by height, the ways down and up they
 * have seen, their fire, and themselves as an arrow. Never what they have not seen.
 */
import type { Level } from '../gen/level';
import { EXPLORE, type Explored } from '../world/explored';
import { panel } from './panel';

/** Pixels per metre, and how often it redraws while open, seconds. */
const MAP = { scale: 8, every: 0.25 } as const;

const STYLE = `
  #map { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 8; display: none;
    border: 1px solid #8a7656; border-radius: 4px; box-shadow: 0 6px 30px #000a; background: #1b1712; }
  #map.open { display: block; }`;

export class MapView {
  private readonly canvas: HTMLCanvasElement;
  private drawnAt = -Infinity;

  constructor(host: HTMLElement) {
    this.canvas = panel(host, 'canvas', 'map', STYLE);
  }

  get open(): boolean {
    return this.canvas.classList.contains('open');
  }

  toggle(): void {
    this.canvas.classList.toggle('open');
    this.drawnAt = -Infinity;
  }

  /** Redraw (now and then, while open) for the nobody at (x, y, z) looking along `yaw`; `fire`: their fire, if one burns. */
  draw(level: Level, seen: Explored, x: number, y: number, z: number, yaw: number, fire: { x: number; z: number } | null, now: number): void {
    if (!this.open || now - this.drawnAt < MAP.every) return;
    this.drawnAt = now;
    const w = Math.min(640, innerWidth - 32), h = Math.min(640, innerHeight - 64), cv = this.canvas;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const g = cv.getContext('2d');
    if (!g) return;
    const S = MAP.scale, c = EXPLORE.cell, px = (wx: number) => w / 2 + (wx - x) * S, pz = (wz: number) => h / 2 + (wz - z) * S;
    g.fillStyle = '#1b1712';
    g.fillRect(0, 0, w, h);
    // The floor seen: lighter where it is higher than the nobody, darker below.
    const i0 = Math.floor((x - w / 2 / S) / c), i1 = Math.ceil((x + w / 2 / S) / c), j0 = Math.floor((z - h / 2 / S) / c), j1 = Math.ceil((z + h / 2 / S) / c);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (!seen.has(level.depth, i, j)) continue;
      const f = level.floorAt((i + 0.5) * c, (j + 0.5) * c), t = Math.max(-1, Math.min(1, (f - y) / 8));
      const l = Math.round(150 + 60 * t);
      g.fillStyle = level.waterAt((i + 0.5) * c, (j + 0.5) * c) > f + 0.1 ? '#3d5a6e' : `rgb(${l}, ${Math.round(l * 0.9)}, ${Math.round(l * 0.75)})`;
      g.fillRect(px(i * c), pz(j * c), c * S + 0.5, c * S + 0.5);
    }
    const seenAt = (sx: number, sz: number) => seen.has(level.depth, Math.floor(sx / c), Math.floor(sz / c));
    // The ways down (rings) and the way up (a ladder mark), where seen.
    const half = Math.max(w, h) / 2 / S;
    for (const s of level.descents.within(x - half, z - half, x + half, z + half)) {
      if (!seenAt(s.x + s.r + 1, s.z) && !seenAt(s.x - s.r - 1, s.z) && !seenAt(s.x, s.z + s.r + 1) && !seenAt(s.x, s.z - s.r - 1)) continue;
      g.strokeStyle = s.up ? '#e8d27a' : '#111';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(px(s.x), pz(s.z), Math.max(4, s.r * S), 0, Math.PI * 2);
      g.stroke();
      if (s.up) { g.fillStyle = '#e8d27a'; g.fillText('up', px(s.x) + 8, pz(s.z) - 6); }
    }
    if (fire) { g.fillStyle = '#ff9a3c'; g.beginPath(); g.arc(px(fire.x), pz(fire.z), 4, 0, Math.PI * 2); g.fill(); }
    // The nobody: an arrow the way they look (forward is (-sin yaw, -cos yaw)).
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), cx = w / 2, cy = h / 2;
    g.fillStyle = '#c0392b';
    g.beginPath();
    g.moveTo(cx + fx * 9, cy + fz * 9);
    g.lineTo(cx - fx * 5 + fz * 5, cy - fz * 5 - fx * 5);
    g.lineTo(cx - fx * 5 - fz * 5, cy - fz * 5 + fx * 5);
    g.closePath();
    g.fill();
    g.fillStyle = '#d8c9a8';
    g.font = '13px Georgia, serif';
    g.fillText(`${level.depth ? `Level ${level.depth} · ${level.band.name}` : level.band.name} · what you have seen · M to close`, 10, h - 10);
  }
}
