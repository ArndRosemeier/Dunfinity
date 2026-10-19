/**
 * Grandma's Salt Sight drawn (src/game/Game.ts holds it open): an aura of salt-light round each
 * creature in sight, coloured by how tough it is for you (pale blue easy, green fair, amber risky,
 * orange run, red deadly; src/combat/challenge.ts). At its heart a thin bright line of salt a
 * little off the body; round it a glow, brightest at the body and fading with the distance from it,
 * its edge flowing slowly round the creature like a liquid, its brightness breathing and drifting
 * round in patches; now and then a mote of salt comes off it and drifts away, fading. A kind never
 * fought gets a dimmer aura in a muted colour of its rough band (harmless, dangerous, deadly), its
 * line broken and wavering; a guess flickers a little; one well known holds steady.
 *
 * Drawn on a canvas over the 3D view (not on the creature: the aura goes round it, and the body
 * itself is kept clear of it). Everything moving is a function of the time and the creature's own
 * seed (the motes too: no state, no random numbers). It all stands still, motes gone, for players
 * who ask for less motion (`prefers-reduced-motion`, or `ui-still` on the root).
 */
import type { Camera } from 'three';
import { toScreen } from '../render/screen';
import { hash3f, hexToRgb } from '@futuremagic/core';
import { THEME } from './theme';
import { panel } from './panel';
import { bandOf, type Knowledge, type Tier } from '../combat/challenge';
import { along, hull, rounded, type Edge } from './outline';

/** Something to ring: where it stands (its feet), which way it faces, its half width, height and whole length, and what is known of it. */
export interface Ringed {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly radius: number;
  readonly height: number;
  readonly length: number;
  readonly tier: Tier;
  readonly known: Knowledge;
  /** Its own wobble (each ring creeps its own way). */
  readonly seed: number;
}

export const SALT_SIGHT = {
  /** How far outside the body the salt line runs, px, plus a share of the body's size on screen. */
  pad: 3,
  padShare: 0.04,
  /** How much rounder than its box the aura goes, a share of its size on screen. */
  soften: 0.55,
  /** The spacing of the points along the aura's outline, px. */
  step: 9,
  /** The flow: how far the aura's edge swells and falls back (a share of the size on screen, more at its outer reach), and how fast it runs round. */
  flow: 0.13,
  flowSpeed: 0.55,
  /** The glow: how far it reaches out from the line (a share of the size on screen, held between these px), in how many layers, how bright at the line. */
  reach: 0.55,
  reachPx: [18, 100] as const,
  layers: 10,
  bright: 0.95,
  /** How bright the glow is over the body itself, a share of its brightness at the line. */
  within: 0.5,
  /** The glow is drawn this many times smaller and stretched back over the view: soft, and cheap; blurred so much more (px, at its size) where the browser can. */
  coarse: 4,
  blur: 2,
  /** Its breathing: by how much and how fast its brightness swells and falls, and how much brighter and dimmer the patches drifting round it are. */
  breathe: 0.2,
  breatheSpeed: 1.2,
  patches: 0.45,
  /** The salt at its heart: two currents running round the line, each in streaks (their length and gap, a share of the size on screen; how fast they run, px a second), their width and glow, px, and how much paler than the aura they are. */
  streak: [0.9, 0.55] as const,
  run: 22,
  width: 1.2,
  glow: 9,
  pale: 0.5,
  /** The motes coming off: one every so many seconds (some skipped), living so long, flying so far (a share of the size, out and up), so big (px). */
  every: 0.16,
  skip: 0.3,
  life: [0.8, 1.8] as const,
  fly: 0.55,
  mote: [1.1, 2.6] as const,
} as const;

const STYLE = `#salt-sight { position: fixed; inset: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 3; }`;

/** A smooth closed path through the midpoints of `q`, its points as the bends. */
function smooth(q: readonly (readonly [number, number])[]): Path2D {
  const p = new Path2D(), n = q.length, mid = (i: number) => [(q[i][0] + q[(i + 1) % n][0]) / 2, (q[i][1] + q[(i + 1) % n][1]) / 2] as const;
  const m0 = mid(n - 1);
  p.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) { const m = mid(i); p.quadraticCurveTo(q[i][0], q[i][1], m[0], m[1]); }
  p.closePath();
  return p;
}

/** A theme colour (#rrggbb) as 0..255 channels. */
function rgbOf(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(parseInt(hex.slice(1), 16));
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/** The colour of a tier (a kind never fought: its rough band's, muted). */
export function ringColour(tier: Tier, known: Knowledge): string {
  return known === 'untested' ? THEME.challengeRough[bandOf(tier)] : THEME.challenge[tier];
}

export class SaltSightView {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly still = matchMedia('(prefers-reduced-motion: reduce)');
  private shown = false;
  /** The glows, drawn small (`SALT_SIGHT.coarse`) and laid over the view stretched. */
  private readonly haze = document.createElement('canvas');
  private readonly hctx = this.haze.getContext('2d')!;

  constructor(host: HTMLElement) {
    this.canvas = panel(host, 'canvas', 'salt-sight', STYLE);
    this.ctx = this.canvas.getContext('2d')!;
  }

  /** Ring `them` as `camera` sees them at `time` seconds (none: clear). */
  paint(camera: Camera, them: readonly Ringed[], time: number): void {
    const c = this.canvas, ctx = this.ctx, dpr = Math.min(2, devicePixelRatio || 1);
    if (!them.length) {
      if (this.shown) { ctx.clearRect(0, 0, c.width, c.height); this.shown = false; }
      return;
    }
    const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.shown = true;
    const still = this.still.matches || document.documentElement.classList.contains('ui-still');
    const k = 1 / SALT_SIGHT.coarse, hw = Math.ceil(innerWidth * k), hh = Math.ceil(innerHeight * k), hz = this.hctx;
    if (this.haze.width !== hw || this.haze.height !== hh) { this.haze.width = hw; this.haze.height = hh; }
    hz.setTransform(1, 0, 0, 1, 0, 0);
    hz.clearRect(0, 0, hw, hh);
    hz.setTransform(k, 0, 0, k, 0, 0);
    if ('filter' in hz) hz.filter = `blur(${SALT_SIGHT.blur}px)`;
    for (const r of them) this.aura(camera, r, time, still);
    // The glows under the lines and motes, stretched over the view: their light added.
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.haze, 0, 0, hw * SALT_SIGHT.coarse, hh * SALT_SIGHT.coarse);
    ctx.restore();
  }

  /** One creature's aura: the glow, the salt line at its heart, the motes coming off it. */
  private aura(camera: Camera, r: Ringed, time: number, still: boolean): void {
    const ctx = this.ctx, S = SALT_SIGHT, pts = this.corners(camera, r);
    if (pts.length < 3) return;
    const shape = hull(pts);
    let cx = 0, cy = 0;
    for (const [x, y] of shape) { cx += x; cy += y; }
    cx /= shape.length; cy /= shape.length;
    const size = Math.max(...shape.map(([x, y]) => Math.hypot(x - cx, y - cy)));
    const pad = S.pad + S.padShare * size, t = still ? 0 : time, sd = r.seed * 7.31;
    // The body's outline drawn in towards its middle and grown out again: rounder, like a body, not a box.
    const inset = Math.min(S.soften * size, 60);
    const soft = hull(shape.map(([x, y]) => { const d = Math.hypot(x - cx, y - cy) || 1, k = Math.min(inset, d * 0.9); return [x - ((x - cx) / d) * k, y - ((y - cy) / d) * k] as const; }));
    const line = along(rounded(soft, inset + pad), S.step);
    if (line.length < 3) return;
    // The flow: swellings running round the outline (u: the way round, 0..1), each its own speed.
    const flow = (u: number) => {
      const a = u * Math.PI * 2, ft = t * S.flowSpeed;
      return Math.sin(a * 2 + ft * 1.0 + sd) * 0.5 + Math.sin(a * 3 - ft * 0.7 + sd * 1.7) * 0.32 + Math.sin(a * 5 + ft * 1.6 + sd * 2.3) * 0.18;
    };
    /** The outline pushed out `by` px and swollen by the flow times `swell` px: a closed smooth path. */
    const path = (from: Edge[], by: number, swell: number): Path2D => {
      const q = from.map((e) => { const o = by + swell * flow(e.u); return [e.x + e.nx * o, e.y + e.ny * o] as const; });
      return smooth(q);
    };
    const untested = r.known === 'untested';
    const [cr, cg, cb] = rgbOf(ringColour(r.tier, r.known));
    const flicker = still ? 1 : untested ? 0.75 + 0.25 * Math.sin(time * 3.1 + sd) * Math.sin(time * 1.3 + sd * 0.5) : r.known === 'guess' ? 0.88 + 0.12 * Math.sin(time * 2.3 + sd) : 1;
    const breath = (still ? 1 : 1 + S.breathe * Math.sin(time * S.breatheSpeed + sd)) * flicker * (untested ? 0.8 : 1);
    const reach = Math.max(S.reachPx[0], Math.min(S.reachPx[1], S.reach * size));
    // Brighter and dimmer patches drifting slowly round it: the colour as a turning cone of light.
    const tint = (c: CanvasRenderingContext2D, alpha: number): CanvasGradient | string => {
      if (!c.createConicGradient) return `rgba(${cr},${cg},${cb},${alpha})`;
      const g = c.createConicGradient(t * 0.35 + sd, cx, cy);
      for (let k = 0; k <= 6; k++) {
        const w = k === 6 ? 0 : k, lit = 1 - S.patches * (0.5 + 0.5 * Math.sin(w * 2.1 + sd * 3 + t * 0.6 * (w % 2 ? 1 : -1)));
        g.addColorStop(k / 6, `rgba(${cr},${cg},${cb},${alpha * lit})`);
      }
      return g;
    };
    // The glow (on the small canvas): strokes along the salt line, each wider and fainter and swelling
    // more with the flow, added up: brightest at the line, fading with the distance from it, outwards
    // in the swell of its edge and inwards over the body's own edge.
    const hz = this.hctx;
    hz.save();
    hz.globalCompositeOperation = 'lighter';
    hz.lineJoin = hz.lineCap = 'round';
    hz.fillStyle = tint(hz, S.bright * S.within * breath);
    hz.fill(path(line, -reach * 0.1, size * S.flow * 0.3));
    for (let i = 0; i < S.layers; i++) {
      const f = 1 - i / S.layers;
      hz.strokeStyle = tint(hz, (S.bright / S.layers) * breath);
      hz.lineWidth = 2 * reach * f + 4;
      hz.stroke(path(line, reach * 0.15 * (1 - f), size * S.flow * (0.3 + 1.7 * (1 - f))));
    }
    hz.restore();
    ctx.save();
    ctx.lineJoin = ctx.lineCap = 'round';
    // The salt at its heart, paler than its glow: streaks running round the line with the flow (a
    // kind never fought: short broken flecks, wavering).
    const pale = (k: number) => Math.round(k + (255 - k) * S.pale);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgb(${pale(cr)},${pale(cg)},${pale(cb)})`;
    ctx.shadowColor = `rgb(${cr},${cg},${cb})`;
    ctx.shadowBlur = S.glow;
    ctx.lineWidth = S.width;
    for (const [way, by, alpha] of [[1, 0, 0.75], [-0.7, reach * 0.25, 0.4]] as const) {
      ctx.globalAlpha = alpha * flicker;
      ctx.setLineDash(untested ? [Math.max(3, S.streak[0] * size * 0.15), Math.max(5, S.streak[1] * size * 0.5), Math.max(6, S.streak[0] * size * 0.35), Math.max(8, S.streak[1] * size)] : [Math.max(12, S.streak[0] * size), Math.max(8, S.streak[1] * size)]);
      ctx.lineDashOffset = -t * S.run * way + r.seed * 13;
      ctx.stroke(path(line, by, size * S.flow * (0.35 + by / reach)));
    }
    ctx.setLineDash([]);
    // The motes: born one every so often (which, where and how is the creature's seed and the
    // mote's number), each flying out from the line and up, fading.
    if (!still) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowBlur = 8;
      const h = (k: number, j: number) => hash3f(1966, r.seed, k, j);
      for (let k = Math.floor((time - S.life[1]) / S.every) - 1; k <= Math.floor(time / S.every); k++) {
        if (h(k, 0) < S.skip * (untested ? 2 : 1)) continue;
        const born = (k + h(k, 1)) * S.every, life = S.life[0] + (S.life[1] - S.life[0]) * h(k, 2), a = (time - born) / life;
        if (a < 0 || a >= 1) continue;
        const e = line[Math.floor(h(k, 3) * line.length) % line.length], go = S.fly * size * (1 - (1 - a) * (1 - a)) * (0.5 + h(k, 4));
        const side = (h(k, 5) - 0.5) * 0.8, dx = e.nx * 0.8 + side * -e.ny, dy = e.ny * 0.8 + side * e.nx - 0.7;
        const x = e.x + dx * go + Math.sin(time * 4 + k) * 1.5, y = e.y + dy * go;
        ctx.globalAlpha = Math.min(1, a * 6) * (1 - a) ** 1.5 * flicker;
        ctx.fillStyle = `rgb(${pale(cr)},${pale(cg)},${pale(cb)})`;
        ctx.beginPath();
        ctx.arc(x, y, (S.mote[0] + (S.mote[1] - S.mote[0]) * h(k, 6)) * (1 - 0.5 * a), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /** The corners of `r`'s body (a box along its yaw) on screen, CSS pixels; none if any is behind the camera or far off screen. */
  private corners(camera: Camera, r: Ringed): [number, number][] {
    const out: [number, number][] = [];
    const fx = -Math.sin(r.yaw), fz = -Math.cos(r.yaw), half = Math.max(r.radius, r.length / 2);
    for (const a of [-half, half]) for (const b of [-r.radius, r.radius]) for (const y of [r.y, r.y + r.height]) {
      const at = toScreen(camera, r.x + fx * a - fz * b, y, r.z + fz * a + fx * b, 4);
      if (!at) return [];
      out.push([at.x, at.y]);
    }
    return out;
  }
}
