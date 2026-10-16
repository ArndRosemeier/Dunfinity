/**
 * Wisps: now and then a light pulls itself out of the glowing rock (the salt veins, a stratum's
 * glowing stone), drifts slowly along the rock lighting it, swells, and pops in a bright flash.
 * Never foes: nothing hits them and they touch no one. They are there for wonder.
 *
 * A few at a time, near the viewer, as often as the level's rock glows (`glowOf`). Their light is
 * borrowed from the lamp pool (src/render/props/lamps.ts), so they never add a light or a shader.
 *
 * Pure: the level's field only (src/render/creatures/wispView.ts draws them).
 */
import { Rng, damp, deriveSeed, smoothstep } from '@futuremagic/core';
import type { Level } from '../gen/level';
import { airOf } from '../gen/air';

export const WISP = {
  /** At most this many at once. */
  most: 3,
  /** Seconds between births on fully glowing rock (min, max); fainter rock waits longer (÷ strength). None below `faint`. */
  gap: [5, 12] as const,
  faint: 0.05,
  /** Seconds until it looks again when no rock in reach had room for one. */
  retry: 1.5,
  /** Born on rock this far from the viewer, m (min, max). */
  reach: [4, 20] as const,
  /** Seconds it lives, from its birth to its pop (min, max). */
  life: [8, 13] as const,
  /** Seconds it takes to pull out of the rock, and how far out it comes, m. */
  rise: 1.6,
  out: 0.9,
  /** Drifting speed, m/s, and how quickly it turns to where it wants to go (1/s). */
  speed: 0.35,
  turn: 1.5,
  /** It keeps between these distances from the rock, m: it drifts along it, never into it. */
  near: 0.8,
  far: 2.2,
  /** It keeps this far from the viewer's head, m. */
  shy: 1.4,
  /** Seconds it swells before it pops, and the flash, s. */
  swell: 0.5,
  flash: 0.2,
  /** Gone, quietly, beyond this distance from the viewer, m. */
  lose: 45,
  /** Its halo's size, m, and its light: brightness and reach (m) while drifting, and at the flash's peak. */
  size: 0.45,
  light: 2.4,
  lightReach: 9,
  flashLight: 30,
  flashReach: 16,
} as const;

type Rgb = readonly [number, number, number];

/** The salt veins' blue (the rock shader's vein emissive, src/render/materials.ts). */
const VEIN_BLUE: Rgb = [0.25, 0.6, 1.0];

/**
 * How much the level's rock glows (0: not at all; 1: the Salt Works' veins), and the colour of the
 * glow (linear): the seams' veins (`airOf(...).veins`), or a stratum's glowing stone, whichever is brighter.
 */
export function glowOf(level: Level): { strength: number; color: Rgb } {
  const veins = airOf(level.seed, level.depth).veins;
  let stone = 0, color = VEIN_BLUE;
  for (const r of level.rockRecipes) if (r.glow > stone) { stone = r.glow; if (stone > veins) color = r.veinColor; }
  return { strength: Math.min(1, Math.max(veins, stone)), color };
}

export interface Wisp {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  /** Where on the rock it came out, and the rock's normal there. */
  readonly ox: number; readonly oy: number; readonly oz: number;
  readonly nx: number; readonly ny: number; readonly nz: number;
  /** Seconds since its birth; seconds from birth to the pop; its wander's phase (0–1). */
  age: number;
  readonly life: number;
  readonly phase: number;
}

/** How a wisp shines at its age: its halo's size (m) and brightness, and its light's brightness and reach (m). 0 once gone. */
export function shine(w: Wisp): { size: number; bright: number; light: number; reach: number } {
  const t = w.age, pop = w.life;
  if (t >= pop + WISP.flash) return { size: 0, bright: 0, light: 0, reach: 0 };
  if (t >= pop) {
    // The flash: at once at its brightest, a wide bright halo, then gone (a fast fall).
    const f = (t - pop) / WISP.flash, k = (1 - f) * (1 - f);
    return { size: WISP.size * (2.6 + 1.4 * f), bright: 3.5 * k, light: WISP.flashLight * k, reach: WISP.flashReach };
  }
  const born = smooth(Math.min(1, t / WISP.rise));
  const swell = smooth(Math.max(0, (t - (pop - WISP.swell)) / WISP.swell));
  // A slow breath while it drifts (smooth: never a flicker).
  const breath = 1 + 0.12 * Math.sin(t * 2.1 + w.phase * 6.283);
  const b = born * breath * (1 + 0.8 * swell);
  return { size: WISP.size * (0.3 + 0.7 * born) * (1 + 0.5 * swell), bright: b, light: WISP.light * b, reach: WISP.lightReach };
}

export class Wisps {
  readonly list: Wisp[] = [];
  /** Born and popped since last asked (for their sounds): the caller empties them. */
  readonly risen: Wisp[] = [];
  readonly popped: Wisp[] = [];
  readonly strength: number;
  readonly color: Rgb;
  private readonly rng: Rng;
  private wait: number;
  private readonly n: [number, number, number] = [0, 1, 0];

  constructor(private readonly level: Level) {
    const glow = glowOf(level);
    this.strength = glow.strength;
    this.color = glow.color;
    this.rng = new Rng(deriveSeed(level.seed, 'wisps', level.depth));
    this.wait = this.gap() * 0.5; // the first one comes sooner
  }

  /** Step `dt` seconds round a viewer whose head is at (x, y, z), looking along (fx, fz). */
  advance(dt: number, x: number, y: number, z: number, fx: number, fz: number): void {
    if (this.strength < WISP.faint) return;
    this.wait -= dt;
    if (this.wait <= 0) {
      // No glowing rock in reach where it looked: it looks again soon.
      this.wait = this.list.length >= WISP.most || this.bear(x, y, z, fx, fz) ? this.gap() : WISP.retry;
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const w = this.list[i];
      const was = w.age;
      w.age += dt;
      if (was < w.life && w.age >= w.life) this.popped.push(w);
      if (w.age >= w.life + WISP.flash) { this.list.splice(i, 1); continue; }
      this.drift(w, dt, x, y, z);
      // Too far off to matter: gone without a flash.
      if (Math.hypot(w.x - x, w.y - y, w.z - z) > WISP.lose) this.list.splice(i, 1);
    }
  }

  private gap(): number {
    return this.rng.range(WISP.gap[0], WISP.gap[1]) / Math.max(this.strength, WISP.faint);
  }

  /** A new one out of the rock round the viewer (ahead, mostly), if a few looks find glowing rock in reach. */
  private bear(x: number, y: number, z: number, fx: number, fz: number): boolean {
    const level = this.level, rng = this.rng;
    const ahead = Math.atan2(fz, fx);
    for (let tries = 0; tries < 10; tries++) {
      const yaw = rng.chance(0.75) ? ahead + rng.range(-1.1, 1.1) : rng.range(0, Math.PI * 2);
      const pitch = rng.range(-0.5, 0.7), cp = Math.cos(pitch);
      const dx = Math.cos(yaw) * cp, dy = Math.sin(pitch), dz = Math.sin(yaw) * cp;
      const t = level.trace(x, y, z, dx, dy, dz, WISP.reach[1]);
      if (t < WISP.reach[0] || t >= WISP.reach[1]) continue;
      const hx = x + dx * t, hy = y + dy * t, hz = z + dz * t;
      if (hy < level.waterAt(hx, hz) + 0.3) continue; // not out of the water
      const [nx, ny, nz] = level.normal(hx, hy, hz, this.n);
      const ox = hx + nx * 0.1, oy = hy + ny * 0.1, oz = hz + nz * 0.1;
      // Room to come out: its way off the rock runs through open air (not into a crack or a corner).
      if (level.sdf(ox + nx * WISP.out * 0.5, oy + ny * WISP.out * 0.5, oz + nz * WISP.out * 0.5) < WISP.out * 0.4) continue;
      if (level.sdf(ox + nx * WISP.out, oy + ny * WISP.out, oz + nz * WISP.out) < WISP.near * 0.8) continue;
      const w: Wisp = {
        x: ox, y: oy, z: oz, vx: 0, vy: 0, vz: 0, ox, oy, oz, nx, ny, nz,
        age: 0, life: rng.range(WISP.life[0], WISP.life[1]), phase: rng.float(),
      };
      this.list.push(w);
      this.risen.push(w);
      return true;
    }
    return false;
  }

  private drift(w: Wisp, dt: number, x: number, y: number, z: number): void {
    const t = w.age;
    if (t < WISP.rise) {
      // Pulling out of the rock along its normal, slowing as it comes free.
      const k = WISP.out * smooth(t / WISP.rise), dk = WISP.out * smoothSlope(t / WISP.rise) / WISP.rise;
      w.x = w.ox + w.nx * k; w.y = w.oy + w.ny * k; w.z = w.oz + w.nz * k;
      w.vx = w.nx * dk; w.vy = w.ny * dk; w.vz = w.nz * dk;
      return;
    }
    // Where it wants to go: a slow wander (smooth in time, so it never jitters), slowing as it swells.
    const p = w.phase * 6.283;
    const yaw = p + 0.9 * Math.sin(t * 0.21 + p * 3) + 0.6 * Math.sin(t * 0.47 + p * 7);
    const calm = 1 - 0.7 * smooth(Math.max(0, (t - (w.life - WISP.swell)) / WISP.swell));
    const s = WISP.speed * calm;
    let tx = Math.cos(yaw) * s, ty = 0.35 * s * Math.sin(t * 0.33 + p * 5), tz = Math.sin(yaw) * s;
    // Along the rock: pushed off it when close, drawn back to it when far.
    const d = this.level.sdf(w.x, w.y, w.z);
    const [nx, ny, nz] = this.level.normal(w.x, w.y, w.z, this.n);
    const off = d < WISP.near ? (WISP.near - d) * 1.2 : d > WISP.far ? -(d - WISP.far) * 0.5 : 0;
    tx += nx * off; ty += ny * off; tz += nz * off;
    // Shy of the viewer's head.
    const hx = w.x - x, hy = w.y - y, hz = w.z - z, h = Math.hypot(hx, hy, hz);
    if (h < WISP.shy && h > 1e-6) { const k = (WISP.shy - h) / h; tx += hx * k; ty += hy * k; tz += hz * k; }
    const a = damp(WISP.turn, dt);
    w.vx += (tx - w.vx) * a; w.vy += (ty - w.vy) * a; w.vz += (tz - w.vz) * a;
    w.x += w.vx * dt; w.y += w.vy * dt; w.z += w.vz * dt;
  }
}

/** Smoothstep on 0–1, and its slope. */
const smooth = (u: number): number => smoothstep(0, 1, u);
const smoothSlope = (u: number): number => 6 * u * (1 - u);
