/**
 * The town at night (depth 0, above grandma's cellar; docs/design/town-and-first-strata.md §3):
 * grandma's street. Her house, its back built into the quarry hill the town stands against, the
 * cobbled street in front, a row of houses on each side, the valley closing round it all. Like the
 * cellar it is hand-placed (from a fixed seed), the same for every seed.
 *
 * A part of the cellar's field (src/gen/cellar.ts): air above the ground and outside the houses, the
 * houses solid (only grandma's has an inside). Pure.
 */
import { hash3f } from '@futuremagic/core';

/** Where things are, metres (the street level is the house floor; the cellar is below). */
export const TOWN = {
  /** Street level. */
  ground: 2.7,
  /** The cobbled street, along z in front of grandma's house. */
  street: { x: [-22, -16.2] },
  /** Her house: its walls and roof (the inside is CELLAR.house), the back in the hill. */
  grandma: { x: [-16.2, -6.4], z: [-5.6, 5.6], eaves: 6.2, pitch: 0.75 },
  /** Her front door, open: from the hall out onto the street (its air reaching well into both, as the cellar's doorway). */
  door: { x: [-17.4, -14.0], z: [-0.5, 0.5], top: 2.05 },
  /** The quarry hill behind her side of the street: where it starts, how steep, how high. */
  hill: { x: -9, slope: 1.2, rise: 30 },
  /** The valley's sides, closing the street off: past |z| = `z` and west of `x` the ground rises. */
  valley: { z: 60, x: -72, rise: 40 },
  /** The rows of houses: across the street (west) and on her side (east). */
  across: { x: [-31, -22] },
  side: { x: [-16.2, -6.4] },
} as const;

export interface House {
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  /** Height of the eaves, and the roof's pitch (the ridge runs along x, the gable to the street). */
  readonly eaves: number;
  readonly pitch: number;
  /** Which way its front faces the street (+1: east, -1: west), and a number for its look. */
  readonly faces: 1 | -1;
  readonly look: number;
  /** Where along its front its door is (z), and what it is (a shop, or someone's home). */
  readonly door: number;
  readonly shop?: Shop;
}

/** The shops of the street (town-and-first-strata.md §3). */
export type Shop = 'pawn';

const SEED = 1931;

/** The houses' plaster, picked by their `look`: limestone, ochre, whitewash gone grey, old pink. */
const PLASTER: readonly (readonly [number, number, number])[] = [[0.56, 0.53, 0.44], [0.55, 0.45, 0.3], [0.5, 0.5, 0.48], [0.5, 0.4, 0.37]];

/** A house's plaster and its roof (slate or red tile), by its look. */
export function houseColors(h: House): { wall: [number, number, number]; roof: [number, number, number] } {
  const p = PLASTER[Math.floor(h.look * PLASTER.length)];
  return { wall: [p[0], p[1], p[2]], roof: h.look < 0.5 ? [0.15, 0.16, 0.19] : [0.33, 0.15, 0.1] };
}

/** Lay out a row from z0 to z1 (each way from the middle, leaving `keep` clear round z = 0). */
function row(x0: number, x1: number, faces: 1 | -1, k: number, keep: number): House[] {
  const out: House[] = [];
  for (const dir of [1, -1]) {
    let z = keep;
    for (let i = 0; z < TOWN.valley.z - 4; i++) {
      const r = (j: number) => hash3f(SEED, k * 2 + (dir > 0 ? 0 : 1), i, j);
      const w = 6.5 + r(1) * 4, gap = 0.6 + r(2) * 1.8;
      const za = z + gap, zb = Math.min(TOWN.valley.z - 2, za + w);
      // A lane between the houses now and then, its gap wider.
      const lane = r(3) < 0.18 ? 3 : 0;
      const z0 = dir > 0 ? za + lane : -zb, z1 = dir > 0 ? zb : -(za + lane);
      out.push({ x0: x0 + (faces > 0 ? 0 : r(4) * 0.6), x1: x1 - (faces > 0 ? r(4) * 0.6 : 0), z0, z1, eaves: GROUND_EAVES + r(5) * 2.6, pitch: 0.55 + r(6) * 0.45, faces, look: r(7), door: (z0 + z1) / 2 + (r(8) - 0.5) * (z1 - z0 - 3) });
      z = zb + lane;
    }
  }
  return out;
}

const GROUND_EAVES = TOWN.ground + 3.2;

/** Every house of the street, grandma's first. */
export const HOUSES: readonly House[] = [
  { x0: TOWN.grandma.x[0], x1: TOWN.grandma.x[1], z0: TOWN.grandma.z[0], z1: TOWN.grandma.z[1], eaves: TOWN.grandma.eaves, pitch: TOWN.grandma.pitch, faces: -1, look: 0.5, door: 0 },
  ...shops(row(TOWN.across.x[0], TOWN.across.x[1], 1, 0, 3)), // a lane west, opposite her door
  ...row(TOWN.side.x[0], TOWN.side.x[1], -1, 1, TOWN.grandma.z[1]),
];

/** Ilse's pawn shop: the first house up the street across from grandma's, its door in the middle of its front. */
function shops(across: House[]): House[] {
  const i = across.findIndex((h) => h.z0 > 0);
  across[i] = { ...across[i], shop: 'pawn', door: (across[i].z0 + across[i].z1) / 2 };
  return across;
}

/** The shop's house, and where one stands at its door to deal (on the street, before its step). */
export function shopDoor(shop: Shop): { house: House; x: number; z: number } {
  const house = HOUSES.find((h) => h.shop === shop)!;
  return { house, x: (house.faces > 0 ? house.x1 : house.x0) + house.faces * 1.0, z: house.door };
}

/** The ground's height at (x, z), and how steep it is there (for the field's distance). */
export function townGround(x: number, z: number): { y: number; steep: number } {
  const H = TOWN.hill, V = TOWN.valley;
  const hill = Math.max(0, x - H.x) * H.slope, side = Math.max(0, Math.abs(z) - V.z), back = Math.max(0, V.x - x);
  const h = Math.min(H.rise, hill), v = Math.min(V.rise, side + back);
  const gx = (hill > 0 && hill < H.rise ? H.slope : 0) + (back > 0 && v < V.rise ? 1 : 0), gz = side > 0 && v < V.rise ? 1 : 0;
  return { y: TOWN.ground + h + v, steep: Math.hypot(1, gx, gz) };
}

/** Signed distance to house `h` (negative inside its walls or under its roof). */
export function houseDistance(h: House, x: number, y: number, z: number): number {
  const plan = Math.max(h.x0 - x, x - h.x1, h.z0 - z, z - h.z1);
  const half = (h.z1 - h.z0) / 2, top = h.eaves + (half - Math.abs(z - (h.z0 + h.z1) / 2)) * h.pitch;
  return Math.max(plan, (y - top) / Math.hypot(1, h.pitch));
}

/** The house (x, y, z) is nearest to, and how far (negative: inside it). */
export function nearestHouse(x: number, y: number, z: number): { house: House; d: number } {
  let best = HOUSES[0], d = Infinity;
  for (const h of HOUSES) {
    if (Math.max(h.x0 - x, x - h.x1, h.z0 - z, z - h.z1) > d) continue; // its plan alone is further
    const e = houseDistance(h, x, y, z);
    if (e < d) { d = e; best = h; }
  }
  return { house: best, d };
}

/** The town's air at (x, y, z): above the ground and outside every house (negative: earth or walls). */
export function townAir(x: number, y: number, z: number): number {
  const g = townGround(x, z);
  return Math.min((y - g.y) / g.steep, nearestHouse(x, y, z).d);
}
