/**
 * Where a herd of the level's own animals feeds and sleeps (Arnd 2026-10-17: what they do when they
 * are not attacking or fleeing should not be standing around): spots round its home, found on the
 * level itself, so the life it lives comes from the cave.
 *
 * - Food, by its diet (src/creatures/temper.ts): patches of open floor it crops, the rock of a wall
 *   it licks the salt from, the edge of water it drinks and filters at, the salt blooms it browses.
 *   Each spot says which way to face (the wall, the water, the bloom). With none of its own kind near,
 *   it crops the floor.
 * - A nook to rest in: the spot round its home with the most rock close about it, sheltered.
 *
 * Every spot is one it can walk to from its home (`walkable`: over its own floor, no step too high,
 * no drop, no rock too low over it, no water): a spot behind rock or up a ledge is left out.
 *
 * Pure: the level and the home in, the spots out (seeded by the home's key; the same every time).
 */
import { MinHeap, Rng, deriveSeed } from '@futuremagic/core';
import type { Level } from '../gen/level';
import type { Diet } from './temper';

/** A place to feed or rest: where it stands, which way it faces there (NaN: any way), and what it eats there. */
export interface Spot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly face: number;
  readonly kind: Diet | 'nook';
}

export interface Pasture {
  readonly food: readonly Spot[];
  readonly nook: Spot;
  /** The way from (x, z) towards `spot` round the rock: the next point to walk to (the spot itself when it is in plain reach or off the walk). */
  way(spot: Spot, x: number, z: number): [number, number];
}

/** How many places round its home are tried; how many food spots it keeps; the rays round a place that count its shelter. */
const TRIES = 28;
const KEEP = 4;
const SHELTER = 8;
/** The walk from home: its grid, metres; the step up and the drop it takes there. */
const GRID = 0.5;
const STEP = 0.5;
const DROP = 1;

/** The pasture of a home at (x, y, z) (seeded by `key`): within `reach` metres, on its own floor, for an animal of `radius` and `height`. */
export function pastureOf(level: Level, home: { readonly key: number; readonly x: number; readonly y: number; readonly z: number }, diet: Diet, reach: number, radius: number, height: number, can?: Can): Pasture {
  const rng = new Rng(deriveSeed(level.seed, 'pasture', level.depth, home.key));
  const floor: Spot[] = [], food: Spot[] = [];
  let nook: Spot = { x: home.x, y: home.y, z: home.z, face: NaN, kind: 'nook' }, best = -1;
  const lift = Math.max(0.3, height * 0.6), room = Math.max(0.15, radius), walk = walkOf(level, home, reach * 2 + 1, radius, height, can), reached = walk.reached;
  for (let k = 0; k < TRIES; k++) {
    const a = rng.range(0, Math.PI * 2), d = rng.range(reach * 0.15, reach);
    const x = home.x + Math.cos(a) * d, z = home.z + Math.sin(a) * d, y = level.groundAt(x, z, home.y + 1);
    if (Math.abs(y - home.y) > 1 || level.sdf(x, y + lift, z) < room || !level.dry(x, z, 0.05) || !reached(x, z)) continue;
    floor.push({ x, y, z, face: NaN, kind: 'floor' });
    // Its shelter: how many of the rays round it meet rock close by.
    let shelter = 0;
    for (let r = 0; r < SHELTER; r++) {
      const b = (r / SHELTER) * Math.PI * 2;
      if (level.trace(x, y + lift, z, Math.cos(b), 0, Math.sin(b), 3.5) < 3.4) shelter++;
    }
    if (shelter > best && shelter < SHELTER) { best = shelter; nook = { x, y, z, face: NaN, kind: 'nook' }; }
    if (food.length >= KEEP) continue;
    if (diet === 'wall') {
      // Out to the nearest rock this way, stopping short of it to lick it.
      const t = level.trace(x, y + lift, z, Math.cos(a), 0, Math.sin(a), reach * 0.5);
      if (t < reach * 0.5 - 0.1 && t > 0.3) {
        const s = Math.max(0, t - radius - 0.15), sx = x + Math.cos(a) * s, sz = z + Math.sin(a) * s, sy = level.groundAt(sx, sz, home.y + 1);
        if (Math.abs(sy - y) < 0.6 && reached(sx, sz)) food.push({ x: sx, y: sy, z: sz, face: Math.atan2(-Math.cos(a), -Math.sin(a)), kind: 'wall' });
      }
    } else if (diet === 'water') {
      // On out this way to the water's edge.
      for (let s = 0.5; s < reach * 0.5; s += 0.5) {
        const wx = x + Math.cos(a) * s, wz = z + Math.sin(a) * s;
        if (level.dry(wx, wz, 0.02)) continue;
        const e = Math.max(0, s - radius - 0.4), ex = x + Math.cos(a) * e, ez = z + Math.sin(a) * e;
        if (level.dry(ex, ez, 0.05) && Math.abs(level.groundAt(ex, ez, home.y + 1) - y) < 0.8 && reached(ex, ez)) food.push({ x: ex, y: level.groundAt(ex, ez, home.y + 1), z: ez, face: Math.atan2(-Math.cos(a), -Math.sin(a)), kind: 'water' });
        break;
      }
    }
  }
  if (diet === 'bloom') {
    for (const b of level.blooms.near(home.x, home.z, reach * 2)) {
      if (food.length >= KEEP) break;
      const a = rng.range(0, Math.PI * 2), r = b.r + radius + 0.2, x = b.x + Math.cos(a) * r, z = b.z + Math.sin(a) * r, y = level.groundAt(x, z, home.y + 1);
      if (Math.abs(y - b.y) < 0.8 && level.sdf(x, y + lift, z) > room && reached(x, z)) food.push({ x, y, z, face: Math.atan2(-(b.x - x), -(b.z - z)), kind: 'bloom' });
    }
  }
  // Nothing of its own kind near: it crops the floor.
  for (const f of floor) if (food.length < KEEP && (diet === 'floor' || food.length < 2)) food.push(f);
  return { food, nook, way: walk.way };
}

/** Whether the walker, standing at `from`, may step to (x, z) (its kind's own steering: `Steer.walkable`, props and all). */
export type Can = (from: { readonly x: number; readonly y: number; readonly z: number }, x: number, z: number) => boolean;

/** How far ahead along the way it heads, in grid steps; what a step hard by the rock costs, in steps. */
const AHEAD = 3, TIGHT = 4;

/** Where an animal can walk from its home (`reached`), and the way to a spot round the rock (`way`). */
export interface Walk {
  reached(x: number, z: number): boolean;
  way(spot: { readonly x: number; readonly z: number }, x: number, z: number): [number, number];
}

/**
 * Where an animal of `radius` and `height` can walk from its home, within `far` metres: a walk over a
 * grid of the floor from the home's own spot (each step no higher than `STEP`, no deeper than `DROP`,
 * clear of the rock about the middle of its body, dry). A point counts as reached when the grid
 * point at it, or one beside it, is. The way to a spot is found on the same grid (each spot's
 * distances worked out once, the first time it is asked for): the walker heads a few steps along it.
 */
export function walkOf(level: Level, home: { readonly x: number; readonly y: number; readonly z: number }, far: number, radius: number, height: number, can?: Can): Walk {
  const n = Math.ceil(far / GRID), side = n * 2 + 1, ys = new Float32Array(side * side).fill(NaN);
  const clear = Math.max(0.1, radius * 0.8), mid = height * 0.5625;
  const at = (i: number, j: number) => (j + n) * side + (i + n);
  const inside = (i: number, j: number) => Math.abs(i) <= n && Math.abs(j) <= n;
  const NEXT = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  const open: number[] = [0, 0];
  // Cells hard by the rock (a walker a little off them would be in it) cost more on the way: it keeps off the rock.
  const tight = new Uint8Array(side * side);
  ys[at(0, 0)] = home.y;
  while (open.length) {
    const j = open.pop()!, i = open.pop()!, y = ys[at(i, j)];
    for (const [di, dj] of NEXT) {
      const a = i + di, b = j + dj;
      if (!inside(a, b) || !Number.isNaN(ys[at(a, b)])) continue;
      const x = home.x + a * GRID, z = home.z + b * GRID, g = level.groundAt(x, z, y + STEP + 0.5);
      if (g - y > STEP || y - g > DROP || (can ? !can({ x: home.x + i * GRID, y, z: home.z + j * GRID }, x, z) : !level.dry(x, z, -0.2) || level.sdf(x, Math.max(y, g) + mid, z) < clear)) continue;
      ys[at(a, b)] = g;
      tight[at(a, b)] = level.sdf(x, Math.max(y, g) + mid, z) < clear + GRID * 0.6 ? 1 : 0;
      open.push(a, b);
    }
  }
  const cell = (x: number, z: number): [number, number] => [Math.round((x - home.x) / GRID), Math.round((z - home.z) / GRID)];
  /** The reached grid point at (i, j) or the nearest beside it, if any. */
  const near = (i: number, j: number): [number, number] | null => {
    if (inside(i, j) && !Number.isNaN(ys[at(i, j)])) return [i, j];
    for (let b = j - 1; b <= j + 1; b++) for (let a = i - 1; a <= i + 1; a++) if (inside(a, b) && !Number.isNaN(ys[at(a, b)])) return [a, b];
    return null;
  };
  // Each spot's distances over the walk (a step 1, one hard by the rock `TIGHT`), from the spot out: a walker anywhere on it goes downhill.
  const flows = new Map<string, Int32Array>();
  const flowTo = (sx: number, sz: number): Int32Array | null => {
    const key = `${sx},${sz}`;
    let f = flows.get(key);
    if (f) return f;
    const s = near(...cell(sx, sz));
    if (!s) return null;
    f = new Int32Array(side * side).fill(-1);
    f[at(s[0], s[1])] = 0;
    // (Nearest first: the steps cost 1 or TIGHT.)
    const open = new MinHeap();
    open.push(0, at(s[0], s[1]));
    while (open.size) {
      const c = open.pop(), i = (c % side) - n, j = Math.floor(c / side) - n, d = f[c], y = ys[c];
      for (const [di, dj] of NEXT) {
        const a = i + di, b = j + dj;
        if (!inside(a, b)) continue;
        const k = at(a, b), yb = ys[k], e = d + (tight[k] ? TIGHT : 1);
        // (A walker at (a, b) steps to (i, j): up no more than a step, down no more than a drop.)
        if (Number.isNaN(yb) || y - yb > STEP || yb - y > DROP || (f[k] >= 0 && f[k] <= e)) continue;
        f[k] = e;
        open.push(e, k);
      }
    }
    flows.set(key, f);
    return f;
  };
  return {
    reached: (x, z) => near(...cell(x, z)) !== null,
    way: (spot, x, z) => {
      const f = flowTo(spot.x, spot.z), c = near(...cell(x, z));
      if (!f || !c || f[at(c[0], c[1])] < 0) return [spot.x, spot.z];
      let [i, j] = c;
      for (let k = 0; k < AHEAD; k++) {
        const d = f[at(i, j)];
        if (d <= 0) return [spot.x, spot.z];
        let next: [number, number] | null = null, best = d;
        for (const [di, dj] of NEXT) {
          const a = i + di, b = j + dj;
          if (inside(a, b) && f[at(a, b)] >= 0 && f[at(a, b)] < best) { next = [a, b]; best = f[at(a, b)]; }
        }
        if (!next) break;
        [i, j] = next;
      }
      return f[at(i, j)] === 0 ? [spot.x, spot.z] : [home.x + i * GRID, home.z + j * GRID];
    },
  };
}
