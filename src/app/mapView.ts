/**
 * The map (M): what this grandchild has seen of the level (src/world/explored.ts), drawn from above
 * round them, north up, in the game's grown-over look (docs/design/ui.md). The floor they have walked
 * by, smooth-edged, shaded by height with contour lines and coloured by the kind of place
 * (`Style.mapFloor`); the rock walls they have seen beside it as glowing salt veins with veinlets
 * running off into the stone (the edge of what they have not seen only fades into the dark); water;
 * the ways down and up they have seen, their fire, and themselves with their lamp's beam. Never what
 * they have not seen. Its shapes come from src/app/mapSheet.ts.
 */
import { hash2f, hash3f, hashString } from '@futuremagic/core';
import type { Level } from '../gen/level';
import type { Explored } from '../world/explored';
import { MapCells, sheetOf, type Sheet } from './mapSheet';
import { Modal, esc, keycap } from './panel';
import { THEME } from './theme';

/** Pixels per metre (the zoom steps, and where it starts), how often it redraws while open (s), how far the nobody moves before the shapes are made again (m). */
const MAP = { zooms: [4, 6, 8, 12, 16], zoom: 2, every: 0.1, remake: 2 } as const;

const STYLE = `
  #map { z-index: 8; }
  #map > .ui-scroll { padding: 12px 16px 10px; overflow: visible; }
  #map header { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin: 0 2px 8px; }
  #map header .ui-title { margin: 0; }
  #map header .ui-label { white-space: nowrap; }
  #map .sheet { position: relative; border-radius: 3px; overflow: hidden; line-height: 0; box-shadow: inset 0 0 0 1px #0008, 0 0 0 1px var(--ui-line); }
  #map .ui-keys { margin-top: 8px; display: flex; justify-content: space-between; gap: 12px; }`;

const still = () => document.documentElement.classList.contains('ui-still') || matchMedia('(prefers-reduced-motion: reduce)').matches;
const rgba = (hex: string, a: number) => `${hex.slice(0, 7)}${Math.round(a * 255).toString(16).padStart(2, '0')}`;

export class MapView extends Modal {
  private readonly canvas = document.createElement('canvas');
  /** What changes only when the shapes are made again (the ground, the floor, the walls, the ways down), a margin round the view. */
  private readonly layer = document.createElement('canvas');
  private readonly floor = document.createElement('canvas');
  private readonly cellsPx = document.createElement('canvas');
  private grain: CanvasPattern | null = null;
  private cells: MapCells | null = null;
  private made: { x: number; z: number; seen: number; zoom: number; w: number; h: number; walls: Path2D } | null = null;
  private zoom: number = MAP.zoom;
  private drawnAt = -Infinity;

  constructor(host: HTMLElement) {
    super(host, 'map', STYLE, 'dark');
    // The wheel over it (the game hands it the wheel too while the pointer is locked), and + or − as typed on any keyboard.
    this.canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomBy(e.deltaY < 0 ? 1 : -1); }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (!this.open) return;
      if (e.key === '+' || e.key === '=') this.zoomBy(1);
      else if (e.key === '-' || e.key === '_') this.zoomBy(-1);
    });
  }

  /** Open or close it (`name`: the level's name for its header). */
  toggle(name = ''): void {
    if (this.open) { this.hide(); return; }
    this.showHtml(`<header><h2 class="ui-title">${esc(name)}</h2><span class="ui-label">What you have seen</span></header><div class="sheet"></div>`
      + `<div class="ui-keys"><span>${keycap('M')} or ${keycap('Esc')} close</span><span>${keycap('+')} ${keycap('−')} or the wheel: nearer, farther</span></div>`);
    this.el.querySelector('.sheet')!.appendChild(this.canvas);
    this.drawnAt = -Infinity;
  }

  /** Nearer (+1) or farther (−1). */
  zoomBy(d: number): void {
    this.zoom = Math.max(0, Math.min(MAP.zooms.length - 1, this.zoom + d));
    this.drawnAt = -Infinity;
  }

  /** Redraw (now and then, while open) for the nobody at (x, y, z) looking along `yaw`; `fire`: their fire, if one burns. */
  draw(level: Level, seen: Explored, x: number, y: number, z: number, yaw: number, fire: { x: number; z: number } | null, now: number): void {
    if (!this.open || now - this.drawnAt < MAP.every) return;
    this.drawnAt = now;
    const dpr = Math.min(2, devicePixelRatio || 1), w = Math.min(760, innerWidth - 64), h = Math.min(580, innerHeight - 150), cv = this.canvas;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
    }
    const g = cv.getContext('2d');
    if (!g) return;
    const S = MAP.zooms[this.zoom], margin = Math.ceil(MAP.remake * S) + 4, L = SALT;
    if (this.cells?.level !== level) { this.cells = new MapCells(level); this.made = null; }
    let k = this.made;
    if (!k || Math.hypot(x - k.x, z - k.z) > MAP.remake || seen.cells(level.depth) !== k.seen || this.zoom !== k.zoom || w !== k.w || h !== k.h) {
      k = this.made = { ...this.make(level, seen, L, x, y, z, w + 2 * margin, h + 2 * margin, S, dpr), w, h };
    }
    const ox = (k.x - x) * S - margin, oz = (k.z - z) * S - margin;
    reset(g, dpr);
    g.clearRect(0, 0, w, h);
    g.drawImage(this.layer, ox, oz, w + 2 * margin, h + 2 * margin);
    const p: Paint = { g, w, h, S, x, y, z, yaw, now: still() ? 0 : now, moving: !still(), sheet: null, level, seed: hashString(`map${level.depth}`) };
    L.lamp(p);
    g.save();
    g.translate(ox, oz);
    L.shimmer(p, k.walls);
    g.restore();
    const [sx, sz] = screen(p);
    if (fire) L.blaze(p, sx(fire.x), sz(fire.z));
    L.nobody(p, w / 2, h / 2, -Math.sin(yaw), -Math.cos(yaw));
    rim(p, L);
  }

  /** Make the shapes round (x, z) and paint what stays put onto the layer (w × h px). */
  private make(level: Level, seen: Explored, L: LookPaint, x: number, y: number, z: number, w: number, h: number, S: number, dpr: number) {
    const hw = w / 2 / S + 1, hh = h / 2 / S + 1, sheet = sheetOf(this.cells!, seen, x - hw, z - hh, x + hw, z + hh);
    for (const c of [this.layer, this.floor]) if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = this.layer.getContext('2d')!, fg = this.floor.getContext('2d')!;
    reset(g, dpr);
    reset(fg, dpr);
    g.clearRect(0, 0, w, h);
    fg.clearRect(0, 0, w, h);
    const p: Paint = { g, w, h, S, x, y, z, yaw: 0, now: 0, moving: false, sheet, level, seed: hashString(`map${level.depth}`) };
    this.ground(p, L);
    this.floorLayer(p, fg, L);
    g.drawImage(this.floor, 0, 0, w, h);
    const walls = wallPath(p);
    L.walls(p, walls);
    const [sx, sz] = screen(p), half = Math.max(w, h) / 2 / S;
    const seenAt = (ax: number, az: number) => seen.has(level.depth, Math.floor(ax), Math.floor(az));
    for (const s of level.descents.within(x - half, z - half, x + half, z + half)) {
      if (!seenAt(s.x + s.r + 1, s.z) && !seenAt(s.x - s.r - 1, s.z) && !seenAt(s.x, s.z + s.r + 1) && !seenAt(s.x, s.z - s.r - 1)) continue;
      L.shaft(p, sx(s.x), sz(s.z), Math.max(5, s.r * S), s.up);
    }
    return { x, z, seen: seen.cells(level.depth), zoom: this.zoom, w, h, walls };
  }

  /** The rock under everything, grained, the grain fixed to the world. */
  private ground(p: Paint, L: LookPaint): void {
    if (!this.grain) this.grain = grainPattern(p.g, L);
    const { g, w, h, S, x, z } = p;
    g.fillStyle = L.ground;
    g.fillRect(0, 0, w, h);
    if (this.grain) {
      this.grain.setTransform(new DOMMatrix().translate(((w / 2 - x * S) % 256) - 256, ((h / 2 - z * S) % 256) - 256));
      g.fillStyle = this.grain;
      g.fillRect(0, 0, w, h);
    }
  }

  /** The seen floor on its own layer: a pixel per cell scaled up smooth (soft edges, smooth shading), then its contours and what lies on it. */
  private floorLayer(p: Paint, fg: CanvasRenderingContext2D, L: LookPaint): void {
    const { S } = p, sheet = p.sheet!, c = this.cellsPx;
    if (c.width !== sheet.nx || c.height !== sheet.ny) { c.width = sheet.nx; c.height = sheet.ny; }
    const cg = c.getContext('2d');
    if (!cg) return;
    const img = cg.createImageData(sheet.nx, sheet.ny), d = img.data;
    for (let k = 0; k < sheet.cells.length; k++) {
      const m = sheet.cells[k];
      if (m) d.set(L.cell(m, Math.max(-1, Math.min(1, (m.floor - p.y) / 8))), k * 4);
    }
    cg.putImageData(img, 0, 0);
    const [sx, sz] = screen(p);
    fg.imageSmoothingEnabled = true;
    fg.imageSmoothingQuality = 'high';
    fg.filter = `blur(${Math.max(1.5, S * 0.6).toFixed(1)}px)`;
    fg.drawImage(c, sx(sheet.i0), sz(sheet.j0), sheet.nx * S, sheet.ny * S);
    fg.filter = 'none';
    fg.globalCompositeOperation = 'source-atop';
    // Contours of the floor's height.
    const k = sheet.contours;
    fg.strokeStyle = L.contour;
    fg.lineWidth = 1;
    fg.beginPath();
    for (let i = 0; i < k.length; i += 4) { fg.moveTo(sx(k[i]), sz(k[i + 1])); fg.lineTo(sx(k[i + 2]), sz(k[i + 3])); }
    fg.stroke();
    L.onFloor(p, fg, sx, sz);
  }
}

function reset(c: CanvasRenderingContext2D, dpr: number): void {
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
  c.filter = 'none';
  c.setLineDash([]);
}

/** One redraw's state. */
interface Paint {
  readonly g: CanvasRenderingContext2D;
  readonly w: number;
  readonly h: number;
  readonly S: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  /** Seconds (0 when still). */
  readonly now: number;
  readonly moving: boolean;
  /** The shapes, while the layer is painted. */
  readonly sheet: Sheet | null;
  readonly level: Level;
  readonly seed: number;
}

type ToScreen = (v: number) => number;

/** How a look paints each part. */
interface LookPaint {
  readonly ground: string;
  readonly grain: (v: number) => [number, number, number, number];
  readonly contour: string;
  cell(m: { water: boolean; rgb: readonly [number, number, number] }, t: number): [number, number, number, number];
  /** On the floor's own layer `fg` (it stays on the floor). */
  onFloor(p: Paint, fg: CanvasRenderingContext2D, sx: ToScreen, sz: ToScreen): void;
  walls(p: Paint, path: Path2D): void;
  /** The light of the nobody's lamp, each redraw. */
  lamp(p: Paint): void;
  /** Light running along the walls (`path`), each redraw. */
  shimmer(p: Paint, path: Path2D): void;
  shaft(p: Paint, cx: number, cy: number, r: number, up: boolean): void;
  blaze(p: Paint, cx: number, cy: number): void;
  nobody(p: Paint, cx: number, cy: number, fx: number, fz: number): void;
  /** The shade round the edge, and the ink of the compass and the scale. */
  readonly rim: string;
  readonly ink: string;
}

/** A 256 px tile of grain (speckle over soft blotches, wrapping round), coloured by the look. */
function grainPattern(g: CanvasRenderingContext2D, L: LookPaint): CanvasPattern | null {
  const c = document.createElement('canvas'), N = 256;
  c.width = c.height = N;
  const cg = c.getContext('2d');
  if (!cg) return null;
  // Blotches: noise blurred along each axis with wrap, so the tile has no seams.
  let v = new Float32Array(N * N).map((_, k) => hash2f(3, k % N, Math.floor(k / N)));
  for (const r of [6, 6, 6]) {
    const out = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      let s = 0;
      for (let d = -r; d <= r; d++) s += v[j * N + ((i + d + N) % N)] + v[((j + d + N) % N) * N + i];
      out[j * N + i] = s / (4 * r + 2);
    }
    v = out;
  }
  let lo = Infinity, hi = -Infinity;
  for (const x of v) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
  const img = cg.createImageData(N, N);
  for (let k = 0; k < N * N; k++) img.data.set(L.grain(((v[k] - lo) / (hi - lo)) * 2 - 1 + (hash2f(5, k % N, Math.floor(k / N)) - 0.5) * 0.5), k * 4);
  cg.putImageData(img, 0, 0);
  return g.createPattern(c, 'repeat');
}

/** The world point (x, z) on screen. */
function screen(p: Paint): [ToScreen, ToScreen] {
  return [(wx: number) => p.w / 2 + (wx - p.x) * p.S, (wz: number) => p.h / 2 + (wz - p.z) * p.S];
}

function wallPath(p: Paint): Path2D {
  const [sx, sz] = screen(p), path = new Path2D();
  for (const l of p.sheet!.walls) {
    path.moveTo(sx(l[0]), sz(l[1]));
    for (let i = 2; i < l.length; i += 2) path.lineTo(sx(l[i]), sz(l[i + 1]));
  }
  return path;
}

/** A short wandering line from a wall edge into the rock (a veinlet, a hatch), seeded by its edge; its points on screen. */
function sprig(p: Paint, t: { x: number; z: number; nx: number; nz: number; i: number; j: number; side: number }, salt: number, steps: number, len: number, wander: number): number[] {
  const [sx, sz] = screen(p), h = (k: number) => hash3f(p.seed + salt, t.i * 4 + t.side, t.j, k);
  let a = Math.atan2(t.nz, t.nx) + (h(0) - 0.5) * 1.2, wx = t.x + (h(1) - 0.5) * 0.8 * Math.abs(t.nz), wz = t.z + (h(1) - 0.5) * 0.8 * Math.abs(t.nx);
  const pts = [sx(wx), sz(wz)];
  for (let s = 0; s < steps; s++) {
    a += (h(2 + s) - 0.5) * wander;
    wx += Math.cos(a) * len;
    wz += Math.sin(a) * len;
    pts.push(sx(wx), sz(wz));
  }
  return pts;
}

function polyline(g: CanvasRenderingContext2D, pts: number[]): void {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.stroke();
}

/** The nobody as an arrow the way they look, outlined. */
function arrow(g: CanvasRenderingContext2D, cx: number, cy: number, fx: number, fz: number, fill: string, edge: string): void {
  g.beginPath();
  g.moveTo(cx + fx * 10, cy + fz * 10);
  g.lineTo(cx - fx * 6 + fz * 6, cy - fz * 6 - fx * 6);
  g.lineTo(cx - fx * 3, cy - fz * 3);
  g.lineTo(cx - fx * 6 - fz * 6, cy - fz * 6 + fx * 6);
  g.closePath();
  g.lineJoin = 'round';
  g.lineWidth = 3;
  g.strokeStyle = edge;
  g.stroke();
  g.fillStyle = fill;
  g.fill();
}

/** The shade round the edge; north, and a bar of ten metres. */
function rim(p: Paint, L: LookPaint): void {
  const { g, w, h, S } = p, gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) / 2), ink = L.ink, font = THEME.fontDisplay;
  gr.addColorStop(0, '#0000');
  gr.addColorStop(1, L.rim);
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  g.save();
  g.strokeStyle = ink;
  g.fillStyle = ink;
  g.lineWidth = 1;
  const cx = w - 30, cy = 34;
  g.globalAlpha = 0.8;
  g.beginPath(); g.arc(cx, cy, 14, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(cx, cy - 13); g.lineTo(cx + 4, cy); g.lineTo(cx, cy + 4); g.lineTo(cx - 4, cy); g.closePath(); g.fill();
  g.font = `15px ${font}`;
  g.textAlign = 'center';
  g.fillText('N', cx, cy - 19);
  const len = 10 * S, x0 = 16, y0 = h - 16;
  g.beginPath(); g.moveTo(x0, y0 - 4); g.lineTo(x0, y0); g.lineTo(x0 + len, y0); g.lineTo(x0 + len, y0 - 4); g.stroke();
  g.textAlign = 'left';
  g.font = `13px ${font}`;
  g.fillText('10 m', x0 + len + 6, y0 + 1);
  g.restore();
}

/** Grandma's salt in the dark: walls as glowing veins, moss here and there, the lamp's warm beam. */
const SALT: LookPaint = {
  ground: THEME.darkSolid,
  grain: (v) => [20 + v * 9, 17 + v * 7, 14 + v * 6, 255],
  contour: '#fff1d81a',
  cell: (m, t) => {
    if (m.water) return [34, 70, 92, 225];
    const l = 120 + 70 * t;
    return [l * m.rgb[0] + 18, l * m.rgb[1] + 15, l * m.rgb[2] + 12, 205];
  },
  onFloor: (p, fg, sx, sz) => {
    // Moss on the floor by a few walls.
    const S = p.S;
    for (const t of p.sheet!.ticks) {
      if (hash3f(p.seed, t.i * 4 + t.side, t.j, 91) > 0.06) continue;
      for (let k = 0; k < 9; k++) {
        const u = hash3f(p.seed, t.i * 4 + t.side, t.j, 100 + k) - 0.5, v = hash3f(p.seed, t.i * 4 + t.side, t.j, 200 + k);
        const mx = t.x - t.nx * v * 0.9 + (t.nz ? u * 1.4 : 0), mz = t.z - t.nz * v * 0.9 + (t.nx ? u * 1.4 : 0);
        fg.fillStyle = k % 3 ? rgba(THEME.moss, 0.85) : rgba(THEME.mossLight, 0.8);
        fg.beginPath(); fg.arc(sx(mx), sz(mz), Math.max(0.8, S * (0.12 + 0.1 * (1 - v))), 0, Math.PI * 2); fg.fill();
      }
    }
  },
  walls: (p, path) => {
    const { g } = p;
    g.save();
    g.lineCap = g.lineJoin = 'round';
    // A dark lip on the rock side, then the vein: halo, body, a bright core.
    g.strokeStyle = '#0009'; g.lineWidth = 5; g.stroke(path);
    g.strokeStyle = rgba(THEME.veinGlow, 0.22); g.lineWidth = 7; g.stroke(path);
    g.shadowColor = THEME.veinGlow; g.shadowBlur = 6;
    g.strokeStyle = rgba(THEME.vein, 0.85); g.lineWidth = 1.7; g.stroke(path);
    g.shadowBlur = 0;
    g.strokeStyle = '#e8f7ffb0'; g.lineWidth = 0.6; g.stroke(path);
    // Veinlets off into the stone, with a bud at some tips.
    g.shadowColor = THEME.veinGlow; g.shadowBlur = 4;
    for (const t of p.sheet!.ticks) {
      const r = hash3f(p.seed, t.i * 4 + t.side, t.j, 7);
      if (r > 0.16) continue;
      const pts = sprig(p, t, 11, 3 + Math.floor(r * 25), 0.55, 1.3);
      g.strokeStyle = rgba(THEME.vein, 0.5); g.lineWidth = 0.9;
      polyline(g, pts);
      if (r < 0.07) { g.fillStyle = rgba(THEME.vein, 0.8); g.beginPath(); g.arc(pts[pts.length - 2], pts[pts.length - 1], 1.6, 0, Math.PI * 2); g.fill(); }
    }
    g.restore();
  },
  lamp: (p) => {
    const { g, w, h, S, yaw } = p, cx = w / 2, cy = h / 2, R = 11 * S;
    g.save();
    g.globalCompositeOperation = 'lighter';
    let gr = g.createRadialGradient(cx, cy, 0, cx, cy, R * 1.2);
    gr.addColorStop(0, rgba(THEME.accent, 0.16));
    gr.addColorStop(1, rgba(THEME.accent, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    const a = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
    gr = g.createRadialGradient(cx, cy, 0, cx, cy, R * 1.8);
    gr.addColorStop(0, rgba(THEME.accent, 0.18));
    gr.addColorStop(1, rgba(THEME.accent, 0));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R * 1.8, a - 0.45, a + 0.45); g.closePath(); g.fill();
    g.restore();
  },
  shimmer: (p, path) => {
    // Now and then light runs along the veins, and they breathe.
    if (!p.moving) return;
    const { g, now } = p;
    g.save();
    g.lineCap = 'round';
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = rgba(THEME.veinGlow, 0.12 + 0.1 * Math.sin(now * 0.35)); g.lineWidth = 6; g.stroke(path);
    g.setLineDash([3, 90]); g.lineDashOffset = -now * 9;
    g.strokeStyle = '#f2fbffb0'; g.lineWidth = 2.2; g.stroke(path);
    g.restore();
  },
  shaft: (p, cx, cy, r, up) => {
    const { g } = p;
    g.save();
    if (up) {
      g.strokeStyle = THEME.accent; g.lineWidth = 2; g.shadowColor = THEME.accent; g.shadowBlur = 8;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
      g.shadowBlur = 0; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(cx - 3, cy - 6); g.lineTo(cx - 3, cy + 6); g.moveTo(cx + 3, cy - 6); g.lineTo(cx + 3, cy + 6);
      for (let k = -1; k <= 1; k++) { g.moveTo(cx - 3, cy + k * 4); g.lineTo(cx + 3, cy + k * 4); }
      g.stroke();
    } else {
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      gr.addColorStop(0, '#000'); gr.addColorStop(0.75, '#000c'); gr.addColorStop(1, '#0000');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = rgba(THEME.vein, 0.8); g.lineWidth = 1.2; g.shadowColor = THEME.veinGlow; g.shadowBlur = 6;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    }
    g.shadowBlur = 0;
    g.font = `500 12px ${THEME.fontUi}`; g.fillStyle = up ? THEME.accent : THEME.inkDim; g.textAlign = 'left';
    g.shadowColor = '#000'; g.shadowBlur = 3;
    g.fillText(up ? 'up' : 'down', cx + r + 4, cy - r * 0.5);
    g.restore();
  },
  blaze: (p, cx, cy) => {
    const { g, now } = p, f = 1 + 0.08 * Math.sin(now * 9) + 0.05 * Math.sin(now * 23);
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, 18 * f);
    gr.addColorStop(0, '#ffe2a0'); gr.addColorStop(0.25, '#ff9a3ccc'); gr.addColorStop(1, '#ff6a2000');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 18 * f, 0, Math.PI * 2); g.fill();
  },
  nobody: (p, cx, cy, fx, fz) => {
    const { g } = p;
    g.save(); g.shadowColor = THEME.accent; g.shadowBlur = 10;
    arrow(g, cx, cy, fx, fz, THEME.accent, '#000c');
    g.restore();
  },
  rim: rgba(THEME.darkSolid, 0.9),
  ink: THEME.inkDim,
};
