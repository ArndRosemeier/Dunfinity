/**
 * Thin places: now and then, a little way ahead in open air, a patch of air ripples and opens, and
 * for a few seconds one sees through it into a hall of another of the stacked worlds below: its
 * stone, its light, its haze, faint and silent. Then it closes. The stranger a level, the more often.
 * Never in the way of anything.
 *
 * Walk into one while it is open and you stand in that world for a while (a `Pocket`): nothing
 * lives there that can see you, and the way back hangs open behind you. After a short while the
 * pocket grows unstable (the way back flickers, the edges of sight shake) and then it lets go of
 * you: you are back where you stepped in. Walking into the way back takes you home sooner.
 *
 * When and where one opens (`ThinPlaces`), what world shows through (`glimpseOf`) and a stay in
 * one (`Pocket`) are pure; the view (src/render/thinView.ts) draws it.
 */
import { Rng, deriveSeed, smoothstep } from '@futuremagic/core';
import type { Level } from '../gen/level';
import { strangeness } from '../gen/genome';
import { airOf } from '../gen/air';
import { bandOf } from '../gen/bands';
import { rockRecipesOf } from '../gen/rockTypes';
import { inFrame } from '../gen/gates';

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
  hold: 7,
  close: 2.5,
  /** How many levels below one the glimpsed worlds lie (min, max). */
  below: [8, 40] as const,
  /** Walking within this of its face (m), inside its frame, while it is at least this open, steps through. */
  through: 0.5,
  enough: 0.6,
  /** Seconds a pocket holds you; it grows unstable from `shaky` on. */
  stay: 40,
  shaky: 14,
  /** The gift waiting in a pocket lies this far from where one comes out (m, min and max), within this of where one faces (radians). */
  gift: [6, 11] as const,
  giftTurn: 0.6,
  /** The way back hangs this far from where one comes out (m, min and max). */
  back: [3, 6] as const,
  /** One comes out within this of the other world's arrival (m), where there is the most air round one's head (enough at `headroom` m). */
  near: 40,
  headroom: 2.4,
  /** Air round the way back's middle (m): less than a thin place ahead needs, it may brush the rock. */
  backAir: 1.4,
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

/** How open a thin place (or another window held open `hold` s: Way Home's) is at its age (0 shut, 1 open), and whether it is over. */
export function openness(age: number, hold: number = THIN.hold): number {
  if (age < THIN.open) return smoothstep(0, THIN.open, age);
  if (age < THIN.open + hold) return 1;
  return 1 - smoothstep(THIN.open + hold, THIN.open + hold + THIN.close, age);
}

/** The whole life of a thin place (s). */
export const THIN_LIFE = THIN.open + THIN.hold + THIN.close;

/** The `k`-th world a thin place on (seed, depth) shows: a deeper one's stone (its first recipe on its band's rock), light and haze. */
export function glimpseOf(seed: number, depth: number, k: number): Glimpse {
  const rng = new Rng(deriveSeed(seed, 'glimpse', depth, k));
  return lookOf(seed, depth + rng.int(THIN.below[0], THIN.below[1]), rng);
}

/** How the world at `depth` looks through a thin place (the way back out of a pocket shows home). */
export function homeGlimpse(seed: number, depth: number): Glimpse {
  return lookOf(seed, depth, new Rng(deriveSeed(seed, 'glimpse home', depth)));
}

function lookOf(seed: number, d: number, rng: Rng): Glimpse {
  const air = airOf(seed, d), rock = bandOf(seed, d).rock, recipe = rockRecipesOf(seed, d)[rng.int(0, 2)];
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

/** Room for a thin place `dist` m (min, max) from (x, y, z), within `turn` radians of (ux, uz): open air round it, the floor under it, nothing between. It faces (x, z). */
function roomFor(l: Level, rng: Rng, x: number, y: number, z: number, ux: number, uz: number, dist: readonly [number, number], turn: number, tries = 6, air = THIN.half[1] + 0.3): { x: number; y: number; z: number; yaw: number } | null {
  for (let k = 0; k < tries; k++) {
    const d = rng.range(dist[0], dist[1]), t = rng.range(-turn, turn);
    const dx = ux * Math.cos(t) - uz * Math.sin(t), dz = uz * Math.cos(t) + ux * Math.sin(t);
    const px = x + dx * d, pz = z + dz * d, py = l.groundAt(px, pz) + THIN.over;
    if (Math.abs(py - THIN.over - l.floorAt(px, pz)) > 1 || l.sdf(px, py, pz) < air) continue;
    const ex = px - x, ey = py - y, ez = pz - z, e = Math.hypot(ex, ey, ez);
    if (l.trace(x, y, z, ex / e, ey / e, ez / e, e) < e - 0.5) continue;
    return { x: px, y: py, z: pz, yaw: Math.atan2(x - px, z - pz) };
  }
  return null;
}

/** Open, dry floor `THIN.gift` m from feet (x, y, z) looking along `facing`, in sight of the eyes, or null. */
function giftSpot(l: Level, rng: Rng, x: number, y: number, z: number, facing: number): [number, number, number] | null {
  for (let k = 0; k < 16; k++) {
    const d = rng.range(THIN.gift[0], THIN.gift[1]), a = facing + rng.range(-THIN.giftTurn, THIN.giftTurn);
    const px = x - Math.sin(a) * d, pz = z - Math.cos(a) * d, g = l.groundAt(px, pz, y + 2);
    if (Math.abs(g - l.floorAt(px, pz)) > 0.5 || Math.abs(g - y) > 3 || !l.dry(px, pz, 0.3) || l.sdf(px, g + 0.5, pz) < 0.3) continue;
    const ex = px - x, ey = g + 0.2 - (y + 1.6), ez = pz - z, e = Math.hypot(ex, ey, ez);
    if (l.trace(x, y + 1.6, z, ex / e, ey / e, ez / e, e) < e - 0.3) continue;
    return [px, g, pz];
  }
  return null;
}

/** Feet on open, dry floor near level l's arrival: the most air round one's head, searched ring by ring outwards until there is enough. */
function openFloor(l: Level, rng: Rng): [number, number, number] {
  const [ax, , az] = l.arrival, turn = rng.range(0, Math.PI * 2);
  let best: [number, number, number] = [ax, l.groundAt(ax, az) + 0.2, az], most = -Infinity;
  for (let r = 4; r <= THIN.near && most < THIN.headroom; r += 4) {
    for (let k = 0; k < r; k++) {
      const a = turn + (k / r) * Math.PI * 2, x = ax + Math.sin(a) * r, z = az + Math.cos(a) * r, g = l.groundAt(x, z);
      if (Math.abs(g - l.floorAt(x, z)) > 0.5 || !l.dry(x, z, 0.3)) continue;
      const air = l.sdf(x, g + 1.9, z);
      if (air > most) { most = air; best = [x, g + 0.2, z]; }
    }
  }
  return best;
}

/** Whether feet at (x, y, z) are walking into thin place `p`: near its face, inside its frame, and it open enough. */
export function steppedIn(p: Pick<ThinPlace, 'x' | 'y' | 'z' | 'yaw' | 'age'>, x: number, y: number, z: number, open = openness(p.age), half: number = THIN.half[0], over: number = THIN.over): boolean {
  return open >= THIN.enough && inFrame(p, x, y, z, half, over, -THIN.through, THIN.through);
}

/**
 * A stay in another world, stepped into through thin place `through` on the level at `home`: where
 * one stands at first there (`at`: open floor near its arrival, looking along `facing`), the way back
 * open behind (null where there was no room for it), how unstable it has grown, and the gift waiting
 * a few steps ahead (`gift`: a crystal of that world on open floor in sight, null where there was none).
 */
export class Pocket {
  age = 0;
  readonly at: readonly [number, number, number];
  readonly way: ThinPlace | null;
  readonly facing: number;
  readonly gift: readonly [number, number, number] | null;

  constructor(readonly home: number, readonly through: ThinPlace, readonly there: Level) {
    const rng = new Rng(deriveSeed(there.seed, 'pocket', home, through.glimpse.depth));
    const [x, y, z] = this.at = openFloor(there, rng), a = rng.range(0, Math.PI * 2);
    const room = roomFor(there, rng, x, y + 1.6, z, Math.sin(a), Math.cos(a), THIN.back, Math.PI, 16, THIN.backAir);
    this.way = room ? { ...room, age: THIN.open, glimpse: homeGlimpse(there.seed, home) } : null;
    // Facing away from the way back: into the world.
    this.facing = room ? Math.atan2(room.x - x, room.z - z) : a;
    this.gift = giftSpot(there, rng, x, y, z, this.facing);
  }

  /** 0 steady, rising to 1 as the pocket lets go. */
  get instability(): number {
    return smoothstep(THIN.shaky, THIN.stay, this.age);
  }

  /** How open the way back is now: steady at first, flickering more and more as it grows unstable. */
  get open(): number {
    const t = this.age, f = 0.5 + 0.5 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1.7);
    return 1 - this.instability * (0.25 + 0.55 * f);
  }

  /** Step by `dt` (s); true once it lets go. */
  advance(dt: number): boolean {
    this.age += dt;
    if (this.way) this.way.age = THIN.open + this.age;
    return this.age >= THIN.stay;
  }

  /** Whether feet at (x, y, z) walk into the way back. */
  walksBack(x: number, y: number, z: number): boolean {
    return !!this.way && steppedIn(this.way, x, y, z, Math.max(THIN.enough, this.open));
  }
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
    const len = Math.hypot(fx, fz) || 1, room = roomFor(this.level, this.rng, x, y, z, fx / len, fz / len, THIN.ahead, 0.5);
    return room ? { ...room, age: 0, glimpse: glimpseOf(this.level.seed, this.level.depth, this.count++) } : null;
  }
}
