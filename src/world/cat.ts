/**
 * The cat by grandma's front door (town-and-first-strata.md §3, the town alive): it walks the low
 * stone ledge along the front of her house, sits a while, jumps down into the street, walks, sits,
 * and jumps back up. Scenery only: it never fights, never blocks and is never taken for a creature.
 *
 * Pure: a function of the cat's seed and the time stepped; the drawing is src/render/townLife.ts.
 */
import { TAU, deriveSeed, hash3f } from '@futuremagic/core';
import { TOWN, TOWN_SEED, townGround } from '../gen/town';

export const CAT = {
  /**
   * The ledge: the house's stone plinth along its front, out from the wall (src/gen/townProps.ts
   * `shell`, its `P.out = SHELL + 0.4` half of it), its top `P.top = 0.55` above the street.
   */
  wall: { x: TOWN.grandma.x[0] - 0.425, top: TOWN.ground + 0.55, z0: 1.1, z1: 5.2 },
  /** The line it walks on the street, and how fast it walks on the wall and on the cobbles. */
  ground: { x: TOWN.grandma.x[0] - 1.15 },
  pace: { wall: 0.55, ground: 0.7 },
  /** How long it sits on the wall, how long at the foot of it, and how long a jump takes (s). */
  sit: 4,
  pause: 1.4,
  jump: 0.6,
  /** How near the viewer it is drawn, m. */
  seen: 70,
} as const;

/** The town's cat, the same every game. */
export const CAT_SEED = deriveSeed(TOWN_SEED, 'cat');

export type CatPose = 'walk' | 'sit' | 'jump';

/** The cat at a moment: where it is, which way it faces, what it is doing and how far through its stride. */
export interface Cat {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pose: CatPose;
  /** Its stride, radians (0 while it sits). */
  gait: number;
  /** 1 while it sits, 0 while it walks (the drawing settles the body). */
  sit: number;
  /** 0..1 through a jump, 0 otherwise. */
  jump: number;
}

/**
 * The cat at time `t` (s), written into `out`: walking the wall, sitting, jumping down, walking the
 * street, sitting, jumping back up, and round again. Pure: the same seed and time give the same cat.
 */
export function catAt(seed: number, t: number, out: Cat): Cat {
  const C = CAT;
  // Its own clock: the seed starts it somewhere in the round and sets its pace a little.
  const pace = 1 + (hash3f(seed, 2, 2, 2) - 0.5) * 0.16;
  const wallWalk = (C.wall.z1 - C.wall.z0) / (C.pace.wall * pace);
  const groundWalk = (C.wall.z1 - C.wall.z0) / (C.pace.ground * pace);
  const total = wallWalk + C.sit + C.jump + groundWalk + C.pause + C.jump;
  const phase = hash3f(seed, 1, 1, 1) * total;
  const u = (((t + phase) % total) + total) % total;
  const groundY = townGround(C.ground.x, C.wall.z0).y;
  const stride = 0.34;
  let at = u;
  out.jump = 0;
  out.sit = 0;
  if (at < wallWalk) {
    // Along the ledge, nose up the street (+z).
    out.x = C.wall.x; out.z = C.wall.z0 + (C.wall.z1 - C.wall.z0) * (at / wallWalk); out.y = C.wall.top;
    out.yaw = Math.PI; out.pose = 'walk'; out.gait = ((out.z - C.wall.z0) / stride) * TAU;
    return out;
  }
  at -= wallWalk;
  if (at < C.sit) {
    // Sitting on the wall, looking down the street.
    out.x = C.wall.x; out.z = C.wall.z1; out.y = C.wall.top;
    out.yaw = Math.PI; out.pose = 'sit'; out.gait = 0; out.sit = 1;
    return out;
  }
  at -= C.sit;
  if (at < C.jump) {
    // Down from the wall, out into the street.
    const f = at / C.jump;
    out.x = C.wall.x + (C.ground.x - C.wall.x) * f; out.z = C.wall.z1;
    out.y = C.wall.top + (groundY - C.wall.top) * f + Math.sin(Math.PI * f) * 0.45;
    out.yaw = Math.PI / 2; out.pose = 'jump'; out.gait = 0; out.jump = f;
    return out;
  }
  at -= C.jump;
  if (at < groundWalk) {
    // Along the cobbles, back towards her door.
    out.x = C.ground.x; out.z = C.wall.z1 + (C.wall.z0 - C.wall.z1) * (at / groundWalk); out.y = townGround(out.x, out.z).y;
    out.yaw = 0; out.pose = 'walk'; out.gait = ((out.z - C.wall.z1) / stride) * TAU;
    return out;
  }
  at -= groundWalk;
  if (at < C.pause) {
    // A last sit at the foot of the wall before it goes up.
    out.x = C.ground.x; out.z = C.wall.z0; out.y = groundY;
    out.yaw = 0; out.pose = 'sit'; out.gait = 0; out.sit = 1;
    return out;
  }
  at -= C.pause;
  // Back up onto the ledge.
  const f = Math.min(1, at / C.jump);
  out.x = C.ground.x + (C.wall.x - C.ground.x) * f; out.z = C.wall.z0;
  out.y = groundY + (C.wall.top - groundY) * f + Math.sin(Math.PI * f) * 0.45;
  out.yaw = -Math.PI / 2; out.pose = 'jump'; out.gait = 0; out.jump = f;
  return out;
}
