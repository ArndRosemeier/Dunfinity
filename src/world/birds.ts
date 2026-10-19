/**
 * Birds over the village (town-and-first-strata.md §3, the town alive): three loose flocks of four
 * wheeling above the roofs, their wings beating. A bird is a pure function of the flock's seed and
 * the time; the drawing (src/render/townLife.ts) reads `birdAt` each frame and moves one small mesh.
 *
 * The paths loop: each flock turns about a centre of its own, a fixed part of the village, and every
 * bird has its own ring, phase and height. No allocation here: a caller passes the bird it fills.
 */
import { TAU, deriveSeed, hash3f } from '@futuremagic/core';
import { HOUSES, TOWN_SEED, VILLAGE } from '../gen/town';
import { ridgeHeight } from '../gen/village';

export const BIRDS = {
  /** Three groups of four. */
  flocks: 3,
  each: 4,
  count: 12,
  /** The lowest the flocks fly above the highest roof, metres, and how much higher each group is. */
  clear: 12,
  groupRise: 5,
  /** The radii of the flocks' rings, metres. */
  ring: [6, 16] as const,
  /** How fast they wheel, rad/s. */
  wheel: [0.11, 0.17] as const,
  /** How fast the wings beat, rad/s. */
  beat: [5.2, 7.4] as const,
  /** A bird's wingspan, m. */
  span: [0.8, 1.25] as const,
} as const;

/** The highest roof in the town: no bird flies below it. */
export const ROOF_TOP = Math.max(...HOUSES.map(ridgeHeight));

/** The town's birds are the same every game. */
export const BIRD_SEED = deriveSeed(TOWN_SEED, 'birds');

/** A bird at a moment: where it is, which way it flies, its wings' beat (−1..1) and its wingspan (m). */
export interface Bird {
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** The wings' beat: −1 down .. +1 up. */
  flap: number;
  span: number;
}

/**
 * The `k`-th bird of a flock seed at time `t` (s), written into `out`: a ring about its flock's
 * centre, at a height above the roofs, its wings beating. Pure: the same seed and time always give
 * the same bird.
 */
export function birdAt(seed: number, k: number, t: number, out: Bird): Bird {
  const B = BIRDS, g = Math.floor(k / B.each), i = k % B.each;
  // The flock's centre: the groups spread over the built village, from the square east to her
  // street; the seed sets how far along and across it each one wheels, and its height.
  const spread = (g + 0.5) / B.flocks;
  const cx = VILLAGE.square.x + 8 + spread * 62;
  const cz = VILLAGE.square.z + (hash3f(seed, g, 2, 2) - 0.5) * 80;
  // Each bird wheels about it on a ring of its own, some turns one way, some the other.
  const ring = B.ring[0] + i * 2.6 + hash3f(seed, g, i, 3) * 2.2;
  const wheel = (B.wheel[0] + hash3f(seed, g, i, 4) * (B.wheel[1] - B.wheel[0])) * (g % 2 ? -1 : 1);
  const phase = hash3f(seed, k, 5, 5) * TAU, ang = phase + t * wheel;
  const y = ROOF_TOP + B.clear + g * B.groupRise + i * 0.9 + Math.sin(t * 0.55 + phase * 3) * 1.4;
  const vx = -Math.sin(ang) * ring * wheel, vz = Math.cos(ang) * ring * wheel;
  out.x = cx + Math.cos(ang) * ring;
  out.z = cz + Math.sin(ang) * ring;
  out.y = y;
  out.yaw = Math.atan2(-vx, -vz);
  out.flap = Math.sin(t * (B.beat[0] + hash3f(seed, k, 6, 6) * (B.beat[1] - B.beat[0])) + phase * 2);
  out.span = B.span[0] + hash3f(seed, k, 7, 7) * (B.span[1] - B.span[0]);
  return out;
}
