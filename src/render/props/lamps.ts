/**
 * The level's lamplight: a fixed pool of point lights, made before the warm-up (the light count is
 * part of every shader's cache key, docs/SHADERS.md), moved each frame to the burning lamps nearest
 * the viewer. Unused lights stay in the scene at intensity 0, so no shader ever changes.
 *
 * Other things that give light for a while (wisps, src/creatures/wisps.ts) borrow from the same pool
 * through `lend` each frame: the brightest near the viewer are served first, up to `GLOW_SLOTS`, and the lamps get the rest.
 */
import { Color, PointLight, SRGBColorSpace, type Object3D } from 'three/webgpu';
import { hash3f, smoothstep } from '@futuremagic/core';

/** Lamps further than this get no light, metres. */
const RANGE = 60;
/** A lamp's brightness and how fast its light falls off: gentle, so the rock beside a lamp glows warm instead of burning out to white, and its light still reaches across the hall. */
const INTENSITY = 9;
const DECAY = 1.2;
/** A lamp light's reach, m. */
const REACH = 26;
/** At most this many of the pool's lights are lent (`lend`). */
export const GLOW_SLOTS = 4;

/** A light borrowed from the pool for a frame: where, how bright, how far it reaches (m), its colour (linear rgb 0–1). */
export interface Glow {
  x: number; y: number; z: number;
  intensity: number;
  reach: number;
  color: readonly [number, number, number];
}

export class LampLights {
  readonly lights: PointLight[] = [];
  private readonly near: { d: number; x: number; y: number; z: number }[] = [];
  /** How bright the lamps of this level are (its band's `lamplight`). */
  power = 1;
  /** The lights lent (`lend`), by who lends them, served before the lamps; and all of them for a frame. */
  private readonly lenders = new Map<string, readonly Glow[]>();
  private readonly glows: Glow[] = [];
  private readonly flame = new Color(0xffbe80);

  constructor(parent: Object3D, count = 8) {
    for (let i = 0; i < count; i++) {
      const l = new PointLight(0xffbe80, 0, REACH, DECAY);
      this.lights.push(l);
      parent.add(l);
    }
  }

  /** The colour of the flames (sRGB 0-1; the level's air, src/gen/air.ts): a light's colour, never a new shader. */
  tint(rgb: readonly [number, number, number]): void {
    this.flame.setRGB(rgb[0], rgb[1], rgb[2], SRGBColorSpace);
    for (const l of this.lights) l.color.copy(this.flame);
  }

  /** Lend lights (a wisp's, a sun's) under `key`, until lent again under it: they are read at each `update`. */
  lend(key: string, glows: readonly Glow[]): void {
    this.lenders.set(key, glows);
  }

  /** Light the lamps nearest (x, y, z). `lamps` lists x, y, z per burning lamp; `time` in seconds, for the flicker. */
  update(x: number, y: number, z: number, lamps: Iterable<Float32Array>, time: number): void {
    const near = this.near;
    near.length = 0;
    for (const list of lamps) {
      for (let i = 0; i < list.length; i += 3) {
        const d = Math.hypot(list[i] - x, list[i + 1] - y, list[i + 2] - z);
        if (d < RANGE) near.push({ d, x: list[i], y: list[i + 1], z: list[i + 2] });
      }
    }
    near.sort((a, b) => a.d - b.d);
    // The lent lights that matter most here: bright and near.
    this.glows.length = 0;
    for (const list of this.lenders.values()) this.glows.push(...list);
    const worth = (g: Glow) => g.intensity / (1 + Math.hypot(g.x - x, g.y - y, g.z - z) / g.reach);
    this.glows.sort((a, b) => worth(b) - worth(a));
    const lent = Math.min(GLOW_SLOTS, this.glows.length);
    for (let i = 0; i < lent; i++) {
      const l = this.lights[i], g = this.glows[i];
      l.position.set(g.x, g.y, g.z);
      l.color.setRGB(g.color[0], g.color[1], g.color[2]);
      l.intensity = g.intensity;
      l.distance = g.reach;
    }
    for (let i = lent; i < this.lights.length; i++) {
      const l = this.lights[i], n = near[i - lent];
      if (!n) { l.intensity = 0; continue; }
      l.color.copy(this.flame);
      l.distance = REACH;
      l.position.set(n.x, n.y, n.z);
      const phase = hash3f(17, n.x, n.y, n.z) * 100;
      const flicker = 0.92 + 0.05 * Math.sin(time * 9 + phase) + 0.03 * Math.sin(time * 23 + phase * 1.7);
      l.intensity = INTENSITY * this.power * flicker * smoothstep(RANGE, RANGE * 0.7, n.d);
    }
  }
}
