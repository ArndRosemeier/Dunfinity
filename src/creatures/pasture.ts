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
 * Pure: the level and the home in, the spots out (seeded by the home's key; the same every time).
 */
import { Rng, deriveSeed } from '@futuremagic/core';
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
}

/** How many places round its home are tried; how many food spots it keeps; the rays round a place that count its shelter. */
const TRIES = 28;
const KEEP = 4;
const SHELTER = 8;

/** The pasture of a home at (x, y, z) (seeded by `key`): within `reach` metres, on its own floor, for an animal of `radius` and `height`. */
export function pastureOf(level: Level, home: { readonly key: number; readonly x: number; readonly y: number; readonly z: number }, diet: Diet, reach: number, radius: number, height: number): Pasture {
  const rng = new Rng(deriveSeed(level.seed, 'pasture', level.depth, home.key));
  const floor: Spot[] = [], food: Spot[] = [];
  let nook: Spot = { x: home.x, y: home.y, z: home.z, face: NaN, kind: 'nook' }, best = -1;
  const lift = Math.max(0.3, height * 0.6), room = Math.max(0.15, radius);
  for (let k = 0; k < TRIES; k++) {
    const a = rng.range(0, Math.PI * 2), d = rng.range(reach * 0.15, reach);
    const x = home.x + Math.cos(a) * d, z = home.z + Math.sin(a) * d, y = level.groundAt(x, z, home.y + 1);
    if (Math.abs(y - home.y) > 1 || level.sdf(x, y + lift, z) < room || !level.dry(x, z, 0.05)) continue;
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
        if (Math.abs(sy - y) < 0.6) food.push({ x: sx, y: sy, z: sz, face: Math.atan2(-Math.cos(a), -Math.sin(a)), kind: 'wall' });
      }
    } else if (diet === 'water') {
      // On out this way to the water's edge.
      for (let s = 0.5; s < reach * 0.5; s += 0.5) {
        const wx = x + Math.cos(a) * s, wz = z + Math.sin(a) * s;
        if (level.dry(wx, wz, 0.02)) continue;
        const e = Math.max(0, s - radius - 0.4), ex = x + Math.cos(a) * e, ez = z + Math.sin(a) * e;
        if (level.dry(ex, ez, 0.05) && Math.abs(level.groundAt(ex, ez, home.y + 1) - y) < 0.8) food.push({ x: ex, y: level.groundAt(ex, ez, home.y + 1), z: ez, face: Math.atan2(-Math.cos(a), -Math.sin(a)), kind: 'water' });
        break;
      }
    }
  }
  if (diet === 'bloom') {
    for (const b of level.blooms.near(home.x, home.z, reach * 2)) {
      if (food.length >= KEEP) break;
      const a = rng.range(0, Math.PI * 2), r = b.r + radius + 0.2, x = b.x + Math.cos(a) * r, z = b.z + Math.sin(a) * r, y = level.groundAt(x, z, home.y + 1);
      if (Math.abs(y - b.y) < 0.8 && level.sdf(x, y + lift, z) > room) food.push({ x, y, z, face: Math.atan2(-(b.x - x), -(b.z - z)), kind: 'bloom' });
    }
  }
  // Nothing of its own kind near: it crops the floor.
  for (const f of floor) if (food.length < KEEP && (diet === 'floor' || food.length < 2)) food.push(f);
  return { food, nook };
}
