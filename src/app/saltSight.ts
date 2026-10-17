/**
 * Grandma's Salt Sight drawn (src/game/Game.ts holds it open): a thin line of salt round each
 * creature in sight, a little off its body, coloured by how tough it is for you (pale blue easy,
 * green fair, amber risky, orange run, red deadly; src/combat/challenge.ts). A kind never fought is
 * ringed dashed and wavering in a muted colour of its rough band (harmless, dangerous, deadly); a
 * guess flickers a little; one well known holds still.
 *
 * Drawn on a canvas over the 3D view (not on the creature: the line goes round it). The line creeps
 * slowly like the veins on the interface's frames, and stands still for players who ask for less
 * motion (`prefers-reduced-motion`, or `ui-still` on the root).
 */
import type { Camera } from 'three';
import { toScreen } from '../render/screen';
import { THEME } from './theme';
import { panel } from './panel';
import { bandOf, type Knowledge, type Tier } from '../combat/challenge';

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
  /** How far outside the body the line runs, px, plus a share of its size on screen. */
  pad: 7,
  padShare: 0.12,
  /** How far the line creeps in and out, px, and how fast. */
  creep: 1.6,
  speed: 0.7,
  /** How much rounder than its box the line goes, a share of its size on screen. */
  soften: 0.35,
  /** The length of a step of the line, px (each bends on its own). */
  step: 14,
  /** The line's width and its glow, px. */
  width: 1.6,
  glow: 9,
} as const;

const STYLE = `#salt-sight { position: fixed; inset: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 3; }`;

/** The convex hull of `pts` (Andrew's monotone chain), anticlockwise on screen. */
export function hull(pts: readonly (readonly [number, number])[]): [number, number][] {
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (s.length < 3) return s.map((q) => [q[0], q[1]]);
  const cross = (o: readonly number[], a: readonly number[], b: readonly number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [], upper: [number, number][] = [];
  for (const q of s) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push([q[0], q[1]]); }
  for (let i = s.length - 1; i >= 0; i--) { const q = s[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push([q[0], q[1]]); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** A convex outline (`hull`) grown out by `pad`: each edge pushed out, each corner an arc. */
export function rounded(shape: readonly (readonly [number, number])[], pad: number): [number, number][] {
  const n = shape.length, out: [number, number][] = [];
  let cx = 0, cy = 0;
  for (const [x, y] of shape) { cx += x / n; cy += y / n; }
  // Each edge's outward normal, as an angle (the side away from the middle).
  const outward = (i: number) => {
    const [ax, ay] = shape[i], [bx, by] = shape[(i + 1) % n];
    let a = Math.atan2(bx - ax, -(by - ay));
    if (Math.cos(a) * ((ax + bx) / 2 - cx) + Math.sin(a) * ((ay + by) / 2 - cy) < 0) a += Math.PI;
    return a;
  };
  for (let i = 0; i < n; i++) {
    const a0 = outward((i + n - 1) % n), a1 = outward(i), turn = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0));
    const steps = Math.max(1, Math.ceil(Math.abs(turn) / 0.3));
    for (let k = 0; k <= steps; k++) {
      const a = a0 + (turn * k) / steps;
      out.push([shape[i][0] + Math.cos(a) * pad, shape[i][1] + Math.sin(a) * pad]);
    }
  }
  return out;
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
    for (const r of them) {
      const pts = this.corners(camera, r);
      if (pts.length < 3) continue;
      const shape = hull(pts);
      let cx = 0, cy = 0;
      for (const [x, y] of shape) { cx += x; cy += y; }
      cx /= shape.length; cy /= shape.length;
      const size = Math.max(...shape.map(([x, y]) => Math.hypot(x - cx, y - cy)));
      const pad = SALT_SIGHT.pad + SALT_SIGHT.padShare * size;
      const t = still ? 0 : time * SALT_SIGHT.speed;
      // Round the body's outline out by `pad` (its corners become arcs), then cut it into short steps,
      // each creeping in and out on its own: a line of salt, not a drawn box.
      // Drawn in towards the middle first and grown out by as much more: rounder, like a body, not a box.
      const inset = Math.min(SALT_SIGHT.soften * size, 60);
      const soft = shape.map(([x, y]) => { const d = Math.hypot(x - cx, y - cy) || 1, k = Math.min(inset, d * 0.9); return [x - ((x - cx) / d) * k, y - ((y - cy) / d) * k] as const; });
      const round = rounded(hull(soft), pad + inset);
      const ring: (readonly [number, number])[] = [];
      for (let i = 0; i < round.length; i++) {
        const [ax, ay] = round[i], [bx, by] = round[(i + 1) % round.length], steps = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / SALT_SIGHT.step));
        for (let k = 0; k < steps; k++) {
          const x = ax + ((bx - ax) * k) / steps, y = ay + ((by - ay) * k) / steps, j = ring.length;
          const d = Math.hypot(x - cx, y - cy) || 1, out = SALT_SIGHT.creep * (Math.sin(t + r.seed * 7.31 + j * 0.9) + 0.5 * Math.sin(t * 1.7 + r.seed * 3.1 + j * 1.9));
          ring.push([x + ((x - cx) / d) * out, y + ((y - cy) / d) * out]);
        }
      }
      const colour = ringColour(r.tier, r.known);
      const flicker = still ? 1 : r.known === 'untested' ? 0.7 + 0.2 * Math.sin(time * 3.1 + r.seed * 5) : r.known === 'guess' ? 0.8 + 0.2 * Math.sin(time * 2.3 + r.seed * 3) : 1;
      ctx.save();
      ctx.globalAlpha = (r.known === 'untested' ? 0.8 : 0.9) * flicker;
      ctx.strokeStyle = colour;
      ctx.shadowColor = colour;
      ctx.shadowBlur = SALT_SIGHT.glow;
      ctx.lineWidth = SALT_SIGHT.width;
      ctx.lineJoin = ctx.lineCap = 'round';
      if (r.known === 'untested') ctx.setLineDash([4, 5]);
      // A smooth closed line through the midpoints, the corners as its bends.
      ctx.beginPath();
      const n = ring.length, mid = (i: number) => [(ring[i][0] + ring[(i + 1) % n][0]) / 2, (ring[i][1] + ring[(i + 1) % n][1]) / 2] as const;
      const m0 = mid(n - 1);
      ctx.moveTo(m0[0], m0[1]);
      for (let i = 0; i < n; i++) { const m = mid(i); ctx.quadraticCurveTo(ring[i][0], ring[i][1], m[0], m[1]); }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
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
