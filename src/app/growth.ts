/**
 * Grandma's salt growing over the interface (the game's design language, docs/design/ui.md): thin
 * blue veins that creep along a panel's frame, curl off it here and there, glow where they bud, and
 * a little moss in a corner. Like the veins in the rock they move very slowly: a tip creeps out and
 * back over a minute or so, and light runs along them now and then. They grow on the frame and
 * outwards, never over the text inside.
 *
 * Drawn as one small SVG per element, animated by CSS only (no script per frame); its shapes come
 * from a seed, so a panel always grows the same way. Still for players who ask for less motion
 * (`prefers-reduced-motion`, or the class `ui-still` on the root element).
 */
import { Rng, deriveSeed, hashString } from '@futuremagic/core';
import { THEME } from './theme';
import { addStyle } from './panel';

/** How far outside its element the growth may reach, px; the frame's rounding; the step along it. */
const GROWTH = { reach: 14, radius: 5, step: 3 } as const;

const STYLE = `
  .ui-growth { position: absolute; left: -${GROWTH.reach}px; top: -${GROWTH.reach}px; pointer-events: none; overflow: visible; z-index: 1; }
  .ui-growth path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .ui-growth .vein { stroke: var(--ui-vein); stroke-dasharray: 1 1; stroke-dashoffset: 1; filter: drop-shadow(0 0 1.5px var(--ui-vein-glow)); }
  .ui-growth .halo { stroke: var(--ui-vein-glow); stroke-opacity: .2; stroke-dasharray: 1 1; stroke-dashoffset: 1; }
  .ui-growth .flow { stroke: #e8f7ff; stroke-dasharray: .05 1.6; stroke-dashoffset: 1.6; opacity: 0; filter: drop-shadow(0 0 3px var(--ui-vein)); }
  .ui-growth .bud { fill: var(--ui-vein); opacity: 0; filter: drop-shadow(0 0 3px var(--ui-vein)); }
  .ui-growth .moss { opacity: 0; }
  :is(.open, .ui-grown) > .ui-growth :is(.vein, .halo) { animation: ui-grow var(--grow) var(--ui-ease) var(--at) forwards, ui-creep var(--creep) ease-in-out calc(var(--at) + var(--grow)) infinite alternate; }
  :is(.open, .ui-grown) > .ui-growth .flow { animation: ui-flow var(--flow) linear calc(var(--at) + var(--grow)) infinite; }
  :is(.open, .ui-grown) > .ui-growth .bud { animation: ui-show 1.2s ease-out calc(var(--at) + var(--grow)) forwards, ui-breathe 7s ease-in-out calc(var(--at) + var(--grow) + 1.2s) infinite alternate; }
  :is(.open, .ui-grown) > .ui-growth .moss { animation: ui-show 4s ease-out var(--at) forwards; }
  /* Redrawn while it shows (its element changed size): already grown, it only creeps on. */
  :is(.open, .ui-grown) > .ui-growth.settled :is(.vein, .halo) { animation: ui-creep var(--creep) ease-in-out infinite alternate; }
  :is(.open, .ui-grown) > .ui-growth.settled .flow { animation: ui-flow var(--flow) linear infinite; }
  :is(.open, .ui-grown) > .ui-growth.settled .bud { opacity: 1; animation: ui-breathe 7s ease-in-out infinite alternate; }
  :is(.open, .ui-grown) > .ui-growth.settled .moss { opacity: 1; animation: none; }
  @keyframes ui-grow { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
  @keyframes ui-creep { from { stroke-dashoffset: 0; } to { stroke-dashoffset: var(--back); } }
  @keyframes ui-flow { 0% { stroke-dashoffset: 1.6; opacity: 0; } 8% { opacity: .9; } 55% { opacity: .9; } 70%, 100% { stroke-dashoffset: -.2; opacity: 0; } }
  @keyframes ui-show { to { opacity: 1; } }
  @keyframes ui-breathe { from { opacity: 1; } to { opacity: .35; } }
  @media (prefers-reduced-motion: reduce) {
    .ui-growth * { animation: none !important; stroke-dashoffset: 0 !important; opacity: 1 !important; }
    .ui-growth .flow { display: none; }
  }
  :root.ui-still .ui-growth * { animation: none !important; stroke-dashoffset: 0 !important; opacity: 1 !important; }
  :root.ui-still .ui-growth .flow { display: none; }`;

/** How thickly things grow, 0…1 (more with depth: `setGrowth`), and every element grown over. */
let thickness = 0.25;
const grown = new Set<{ redraw(settled: boolean): void }>();
let styled = false;

/** How thickly the salt grows over the interface from now on, 0…1 (the game sets it from the depth); redraws every growth. */
export function setGrowth(amount: number): void {
  const t = Math.max(0, Math.min(1, amount));
  if (t === thickness) return;
  thickness = t;
  for (const g of grown) g.redraw(true);
}

/** How thickly the salt grows at `depth`: a little in grandma's cellar, more and more down to level 40. */
export function growthAt(depth: number): number {
  return 0.25 + 0.75 * Math.min(1, Math.max(0, depth) / 40);
}

export interface GrowOptions {
  /** More or less than the panel's share of the thickness (1: as much). */
  readonly amount?: number;
  /** Moss in a corner too (the paper panels and the HUD; not small buttons). */
  readonly moss?: boolean;
}

/**
 * Grow salt over `frame`'s edges, shaped by `name` (each element its own). `frame` must not clip
 * what it holds (no overflow: scroll on it: put a scrolling `ui-scroll` inside) and be positioned.
 * It shows while `frame` has the class `open` (growing in each time) or `ui-grown` (always).
 */
export function growOn(frame: HTMLElement, name: string, opts: GrowOptions = {}): Growth {
  if (!styled) { styled = true; addStyle(STYLE); }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  frame.appendChild(svg);
  let w0 = 0, h0 = 0, fresh = -Infinity;
  const g = {
    /** Draw it for the frame's size now; `settled`: already grown in (it is showing), else it grows in when it shows. */
    redraw: (settled: boolean) => {
      const w = frame.offsetWidth, h = frame.offsetHeight;
      svg.setAttribute('class', settled ? 'ui-growth settled' : 'ui-growth');
      if (!settled) fresh = performance.now();
      if (!w || !h) return;
      w0 = w;
      h0 = h;
      svg.setAttribute('width', String(w + 2 * GROWTH.reach));
      svg.setAttribute('height', String(h + 2 * GROWTH.reach));
      svg.innerHTML = drawing(w, h, hashString(name), thickness * (opts.amount ?? 1), opts.moss ?? true);
    },
  };
  const moved = () => frame.offsetWidth !== w0 || frame.offsetHeight !== h0;
  const showing = () => frame.classList.contains('open') || frame.classList.contains('ui-grown');
  grown.add(g);
  // It always follows the frame's real size (new content, a font loading, the window): redrawn
  // while it shows, it stays grown and creeps on rather than growing in again (unless it has only
  // just begun to: content filled in right after opening).
  new ResizeObserver(() => { if (moved()) g.redraw(showing() && performance.now() - fresh > 1000); }).observe(frame);
  g.redraw(false);
  return { fit: () => g.redraw(false) };
}

/** A growth on an element: `fit()` redraws it for the element's size, to grow in afresh (call it just before it shows). */
export interface Growth {
  fit(): void;
}

/** A point on the frame and its outward normal. */
interface Edge { x: number; y: number; nx: number; ny: number }

/** The frame of a w × h element as points every `step` px round it (clockwise from the top left), in the SVG's coordinates. */
function frameOf(w: number, h: number): Edge[] {
  const r = GROWTH.radius, o = GROWTH.reach, step = GROWTH.step, out: Edge[] = [];
  const straight = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let i = 0; i < n; i++) out.push({ x: o + x0 + (x1 - x0) * (i / n), y: o + y0 + (y1 - y0) * (i / n), nx, ny });
  };
  const arc = (cx: number, cy: number, a0: number) => {
    const n = Math.max(2, Math.round((r * Math.PI) / 2 / step));
    for (let i = 0; i < n; i++) {
      const a = a0 + (Math.PI / 2) * (i / n), nx = Math.cos(a), ny = Math.sin(a);
      out.push({ x: o + cx + nx * r, y: o + cy + ny * r, nx, ny });
    }
  };
  straight(r, 0, w - r, 0, 0, -1); arc(w - r, r, -Math.PI / 2);
  straight(w, r, w, h - r, 1, 0); arc(w - r, h - r, 0);
  straight(w - r, h, r, h, 0, 1); arc(r, h - r, Math.PI / 2);
  straight(0, h - r, 0, r, -1, 0); arc(r, r, Math.PI);
  return out;
}

const fmt = (v: number) => v.toFixed(1);

/** The SVG inside for a w × h frame: its veins, curls, buds and moss. */
function drawing(w: number, h: number, seed: number, amount: number, moss: boolean): string {
  const rng = new Rng(deriveSeed(seed, 'growth'));
  const edge = frameOf(w, h), n = edge.length, perimeter = n * GROWTH.step;
  // Longer frames carry more veins; thicker growth more and longer ones.
  const veins = Math.max(1, Math.round((1 + amount * 4) * Math.min(1.6, perimeter / 900)));
  let html = '', shade = 1;
  const vein = (d: string, width: number, at: number, grow: number, back: number, flow: number | null) => {
    const vars = `opacity:${shade.toFixed(2)};--at:${at.toFixed(2)}s;--grow:${grow.toFixed(2)}s;--creep:${rng.range(45, 100).toFixed(1)}s;--back:${back.toFixed(3)}`;
    html += `<path class="halo" pathLength="1" d="${d}" style="stroke-width:${fmt(width * 3.2)};${vars}"/>`;
    html += `<path class="vein" pathLength="1" d="${d}" style="stroke-width:${fmt(width)};${vars}"/>`;
    if (flow !== null) html += `<path class="flow" pathLength="1" d="${d}" style="stroke-width:${fmt(width * 1.3)};${vars};--flow:${flow.toFixed(1)}s"/>`;
  };
  const bud = (x: number, y: number, r: number, at: number) => {
    html += `<circle class="bud" cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(r)}" style="--at:${at.toFixed(2)}s;--grow:0s"/>`;
  };
  for (let v = 0; v < veins; v++) {
    const start = rng.int(0, n - 1), len = Math.round(n * rng.range(0.12, 0.22 + 0.25 * amount));
    // A wander off the frame: outwards, at most just onto the border (never in over what it holds).
    const waves = [0, 1, 2].map(() => ({ f: rng.range(0.02, 0.09), p: rng.range(0, Math.PI * 2), a: rng.range(0.6, 2.2) }));
    const off = (i: number) => Math.max(-1, 1.5 + waves.reduce((s, k) => s + Math.sin(i * GROWTH.step * k.f + k.p) * k.a, 0));
    const dir = rng.float() < 0.5 ? 1 : -1;
    const at = rng.range(0, 1.5), grow = rng.range(2.5, 5);
    shade = rng.range(0.6, 1);
    // The vein in three pieces, thinner towards its tip.
    const piece = (a: number, b: number) => {
      let d = '';
      for (let i = a; i <= b; i++) {
        const e = edge[(((start + dir * i) % n) + n) % n], o = off(i);
        d += `${i === a ? 'M' : 'L'}${fmt(e.x + e.nx * o)} ${fmt(e.y + e.ny * o)}`;
      }
      return d;
    };
    const cut = [0, Math.round(len * 0.45), Math.round(len * 0.8), len];
    const widths = [1.6, 1.1, 0.7];
    for (let k = 0; k < 3; k++) {
      const t = cut[k] / len;
      vein(piece(cut[k], cut[k + 1]), widths[k] * (0.8 + amount * 0.4), at + grow * t, grow * (cut[k + 1] - cut[k]) / len, k === 2 ? rng.range(0.3, 0.7) : 0, k === 0 && rng.float() < 0.7 ? rng.range(18, 40) : null);
    }
    const tip = edge[(((start + dir * len) % n) + n) % n];
    bud(tip.x + tip.nx * off(len), tip.y + tip.ny * off(len), rng.range(1, 1.8), at + grow);
    // Curls off the vein, outwards.
    const curls = rng.int(0, 1 + Math.round(amount * 2));
    for (let c = 0; c < curls; c++) {
      const i = rng.int(2, Math.max(3, len - 2)), e = edge[(((start + dir * i) % n) + n) % n], o = off(i);
      const x0 = e.x + e.nx * o, y0 = e.y + e.ny * o, turn = rng.float() < 0.5 ? 1 : -1;
      const size = rng.range(4, 9), spin = rng.range(1.1, 1.8) * Math.PI * 2;
      // Leave outwards, a little along the frame, then wind in (the coil stays outside the border).
      const a0 = Math.atan2(e.ny, e.nx) - turn * rng.range(0.2, 0.6);
      let d = `M${fmt(x0)} ${fmt(y0)}`, cx = x0 + Math.cos(a0) * size, cy = y0 + Math.sin(a0) * size, x = x0, y = y0;
      const steps = 22;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps, a = a0 + Math.PI + turn * spin * t, r = size * (1 - t * 0.85);
        x = cx + Math.cos(a) * r;
        y = cy + Math.sin(a) * r;
        d += `L${fmt(x)} ${fmt(y)}`;
      }
      const cat = at + grow * (i / len);
      vein(d, 0.6 + amount * 0.3, cat, rng.range(2, 4), 0, null);
      if (rng.float() < 0.6) bud(x, y, rng.range(0.8, 1.4), cat + 3);
    }
  }
  // Moss gathers in a corner or two, just outside the frame.
  if (moss) {
    const corners = [[0, 0], [w, 0], [w, h], [0, h]];
    const count = rng.int(1, 1 + Math.round(amount * 1.5));
    for (let c = 0; c < count; c++) {
      const [px, py] = corners[rng.int(0, 3)], sx = px ? 1 : -1, sy = py ? 1 : -1, at = rng.range(1, 4);
      html += `<g class="moss" style="--at:${at.toFixed(2)}s">`;
      // A cushion over the corner, spilling a little along both edges and just inside the border.
      const dots = Math.round(22 + amount * 34), spread = 10 + amount * 12;
      for (let k = 0; k < dots; k++) {
        const a = rng.range(-0.35, Math.PI / 2 + 0.35), r = rng.float() * rng.float() * spread;
        const x = GROWTH.reach + px + sx * (Math.cos(a) * r - 4), y = GROWTH.reach + py + sy * (Math.sin(a) * r - 4);
        const green = rng.float() < 0.3 ? THEME.mossLight : THEME.moss;
        html += `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(rng.range(1, 3) * (1 - (0.6 * r) / spread))}" fill="${green}" opacity="${rng.range(0.55, 0.95).toFixed(2)}"/>`;
      }
      html += '</g>';
    }
  }
  return html;
}
