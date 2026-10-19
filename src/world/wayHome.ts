/**
 * Grandma's Way Home as a door (Arnd 2026-10-17: "reuse the nice portal animation and show me the
 * room with the chair so i can step through. And the way back should work also like that"): after
 * the card's eyes-shut wait, a window like a thin place's opens a few steps ahead, and through it one
 * sees where it leads: grandma's room by her armchair, or (the way back, from her salt circle) the
 * place one left, as one saw it when one shut one's eyes there. Walk into it and you are there. It
 * stays open a while, then closes.
 *
 * Where it opens and how open it is are pure; src/render/wayView.ts draws it, src/game/Game.ts
 * walks one through.
 */
import type { Level } from '../gen/level';
import { THIN, homeGlimpse, openness, steppedIn, type Glimpse } from './thinPlaces';

export const WAY = {
  /** Its half width and half height (m), its middle this high over the floor: door-sized, so it fits under grandma's ceiling. */
  half: [0.8, 1.1] as const,
  over: 1.15,
  /** Opens this far ahead (m, the nearest first), within this of where one looks (radians). */
  ahead: [2.2, 3.4] as const,
  turn: 0.7,
  /** Air it needs round its middle (m). */
  air: 0.6,
  /** Where the way back opens in grandma's cellar: the brick vault west of the stair, clear of her chair and table (its middle under the crown). */
  cellar: [-13.5, 0] as const,
  /** Seconds it stays open (it opens and closes as a thin place does). */
  hold: 20,
} as const;

/** How the picture seen through it was taken: the camera's field of view (tan of half its height) and aspect. */
export interface Shot {
  readonly tan: number;
  readonly aspect: number;
}

/** Where one comes out: the level, the feet, the way one faces. */
export interface Landing {
  readonly depth: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
}

/**
 * Grandma's room as public/portal/home.jpg shows it: taken by the game's camera with the nobody at
 * the armchair (CELLAR.start), hidden (tools/shot/way-home-picture.mjs makes it again).
 */
export const HOME_SHOT: Shot = { tan: 0.7, aspect: 16 / 9 };

/** The window open now: its middle, its turn (it faces the one it opened for), its age; where it leads, what it shows (`picture` null: no picture kept, its hall). */
export interface WayDoor {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  age: number;
  /** Where one comes out (null: at the level's arrival). */
  readonly to: Landing | { readonly depth: number; readonly x?: undefined };
  readonly picture: 'home' | 'back' | null;
  readonly shot: Shot;
  /** The colours of the hall seen when there is no picture. */
  readonly glimpse: Glimpse;
}

/** How open it is at its age (0 shut, 1 open), and whether it is over (0 again after its time). */
export const wayOpen = (age: number): number => openness(age, WAY.hold);

/** The whole life of the window (s). */
export const WAY_LIFE = THIN.open + WAY.hold + THIN.close;

/**
 * Open a window on level l a few steps ahead of feet (x, y, z) looking along `yaw`, facing them:
 * on the floor, in open air, nothing between. Where there is no room it opens right in front. With
 * `spot` (x, z) it opens there instead, still facing them.
 */
export function openWay(l: Level, x: number, y: number, z: number, yaw: number, to: WayDoor['to'], picture: WayDoor['picture'], shot: Shot, spot?: readonly [number, number]): WayDoor {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), glimpse = homeGlimpse(l.seed, to.depth);
  const at = (px: number, pz: number): WayDoor => ({ x: px, y: l.groundAt(px, pz, y + 1) + WAY.over, z: pz, yaw: Math.atan2(x - px, z - pz), age: 0, to, picture, shot, glimpse });
  if (spot) return at(spot[0], spot[1]);
  for (const d of [WAY.ahead[0], (WAY.ahead[0] + WAY.ahead[1]) / 2, WAY.ahead[1]]) {
    for (const t of [0, WAY.turn / 2, -WAY.turn / 2, WAY.turn, -WAY.turn]) {
      const dx = fx * Math.cos(t) - fz * Math.sin(t), dz = fz * Math.cos(t) + fx * Math.sin(t);
      const px = x + dx * d, pz = z + dz * d, g = l.groundAt(px, pz, y + 1);
      if (Math.abs(g - y) > 0.6 || l.sdf(px, g + WAY.over, pz) < WAY.air) continue;
      const up = (g - y) / d, n = Math.hypot(1, up);
      if (l.trace(x, y + 1.2, z, dx / n, up / n, dz / n, d * n) < d * n - 0.3) continue;
      return at(px, pz);
    }
  }
  return at(x + fx * WAY.ahead[0], z + fz * WAY.ahead[0]);
}

/** Whether feet at (x, y, z) walk into door w now. */
export function walksThrough(w: WayDoor, x: number, y: number, z: number): boolean {
  return steppedIn(w, x, y, z, wayOpen(w.age), WAY.half[0], WAY.over);
}
