/**
 * Thin places: now and then, a little way ahead in open air, a patch of air ripples and opens, and
 * for a few seconds one sees through it into a hall of another of the stacked worlds below: its
 * stone, its light, its haze, faint and silent. Then it closes. The stranger a level, the more often.
 * Never in the way of anything, never a way through: there for wonder.
 *
 * When and where one opens (`ThinPlaces`) and what world shows through (`glimpseOf`) are pure; the
 * view (src/render/thinView.ts) draws it.
 */
import { Rng, deriveSeed, smoothstep } from '@futuremagic/core';
import type { Level } from '../gen/level';
import { strangeness } from '../gen/genome';
import { airOf } from '../gen/air';
import { bandOf } from '../gen/bands';
import { rockRecipesOf } from '../gen/rockTypes';

export const THIN = {
  /** Seconds between two at strangeness 1 (min, max); a level of strangeness s waits these ÷ (0.4 + s). The first comes sooner. */
  gap: [150, 330] as const,
  first: [40, 110] as const,
  /** Seconds until it looks again when no air ahead had room. */
  retry: 4,
  /** Opens this far ahead of the viewer (m, min and max), its middle this high over the floor. */
  ahead: [7, 14] as const,
  over: 1.9,
  /** Its half width and half height (m). */
  half: [1.4, 1.75] as const,
  /** Seconds it takes to open, stays open, takes to close. */
  open: 2.2,
  hold: 5.5,
  close: 2.5,
  /** How many levels below one the glimpsed worlds lie (min, max). */
  below: [8, 40] as const,
} as const;

/** A thin place open now: its middle, its turn (it faces the viewer it opened for: +z along (sin yaw, cos yaw)), its age, and the world it shows. */
export interface ThinPlace {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  age: number;
  readonly glimpse: Glimpse;
}

/** The world a thin place shows: the depth it lies at, its stone and light and haze (linear rgb), its hall's bays (m apart) and height (m). */
export interface Glimpse {
  readonly depth: number;
  readonly stone: readonly [number, number, number];
  readonly light: readonly [number, number, number];
  readonly haze: readonly [number, number, number];
  readonly bay: number;
  readonly height: number;
}

/** How open a thin place is at its age (0 shut, 1 open), and whether it is over. */
export function openness(age: number): number {
  if (age < THIN.open) return smoothstep(0, THIN.open, age);
  if (age < THIN.open + THIN.hold) return 1;
  return 1 - smoothstep(THIN.open + THIN.hold, THIN.open + THIN.hold + THIN.close, age);
}

/** The whole life of a thin place (s). */
export const THIN_LIFE = THIN.open + THIN.hold + THIN.close;

/** The `k`-th world a thin place on (seed, depth) shows: a deeper one's stone (its first recipe on its band's rock), light and haze. */
export function glimpseOf(seed: number, depth: number, k: number): Glimpse {
  const rng = new Rng(deriveSeed(seed, 'glimpse', depth, k));
  const d = depth + rng.int(THIN.below[0], THIN.below[1]);
  const air = airOf(seed, d), rock = bandOf(d).rock, recipe = rockRecipesOf(seed, d)[rng.int(0, 2)];
  const lin = (c: readonly number[]) => c.map((v) => v ** 2.2) as unknown as [number, number, number];
  // Calmed towards grey: another world's air, not a coloured lamp.
  const calm = (c: readonly number[]) => { const g = (c[0] + c[1] + c[2]) / 3; return c.map((v) => g + (v - g) * 0.45); };
  const sky = calm(lin(air.sky)), flame = calm(lin(air.flame));
  return {
    depth: d,
    stone: [recipe.base[0] * rock[0], recipe.base[1] * rock[1], recipe.base[2] * rock[2]],
    light: [sky[0] * 0.8, sky[1] * 0.8, sky[2] * 0.8],
    haze: [flame[0] * 0.5 + sky[0] * 0.3, flame[1] * 0.5 + sky[1] * 0.3, flame[2] * 0.5 + sky[2] * 0.3],
    bay: rng.range(2.4, 4.2),
    height: rng.range(3.5, 7),
  };
}

export class ThinPlaces {
  /** The one open now, if any. */
  current: ThinPlace | null = null;
  /** Opened since last asked (for its sound): the caller empties it. */
  readonly opened: ThinPlace[] = [];
  private readonly rng: Rng;
  private readonly rate: number;
  private wait: number;
  private count = 0;

  constructor(private readonly level: Level) {
    this.rng = new Rng(deriveSeed(level.seed, 'thin', level.depth));
    this.rate = level.depth === 0 ? 0 : 0.4 + strangeness(level.seed, level.depth).s;
    this.wait = this.rng.range(THIN.first[0], THIN.first[1]);
  }

  /** Step by `dt` (s): the viewer's head at (x, y, z), looking along (fx, fz). */
  advance(dt: number, x: number, y: number, z: number, fx: number, fz: number): void {
    const c = this.current;
    if (c) {
      c.age += dt;
      if (c.age >= THIN_LIFE) this.current = null;
      return;
    }
    if (!this.rate) return;
    this.wait -= dt;
    if (this.wait > 0) return;
    const place = this.roomAhead(x, y, z, fx, fz);
    if (!place) { this.wait = THIN.retry; return; }
    this.current = place;
    this.opened.push(place);
    this.wait = this.rng.range(THIN.gap[0], THIN.gap[1]) / this.rate;
  }

  /** Room for one ahead of the viewer: open air round it, the floor under it, nothing between. */
  private roomAhead(x: number, y: number, z: number, fx: number, fz: number): ThinPlace | null {
    const l = this.level, len = Math.hypot(fx, fz) || 1, ux = fx / len, uz = fz / len;
    for (let k = 0; k < 6; k++) {
      const dist = this.rng.range(THIN.ahead[0], THIN.ahead[1]), turn = this.rng.range(-0.5, 0.5);
      const dx = ux * Math.cos(turn) - uz * Math.sin(turn), dz = uz * Math.cos(turn) + ux * Math.sin(turn);
      const px = x + dx * dist, pz = z + dz * dist, py = l.groundAt(px, pz) + THIN.over;
      if (Math.abs(py - THIN.over - l.floorAt(px, pz)) > 1 || l.sdf(px, py, pz) < THIN.half[1] + 0.3) continue;
      const ex = px - x, ey = py - y, ez = pz - z, e = Math.hypot(ex, ey, ez);
      if (l.trace(x, y, z, ex / e, ey / e, ez / e, e) < e - 0.5) continue;
      const yaw = Math.atan2(x - px, z - pz); // faces the viewer
      return { x: px, y: py, z: pz, yaw, age: 0, glimpse: glimpseOf(l.seed, l.depth, this.count++) };
    }
    return null;
  }
}
