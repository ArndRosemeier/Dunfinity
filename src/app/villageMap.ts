/**
 * The village on the map (M): the family knows grandma's village by heart, so up there the map
 * shows all of it from the start (its streets, gardens and fields in their own colours, every
 * building outlined, the quarry hill in contours), not only what this grandchild has seen, and names
 * the places one goes to: grandma's house, Kemal's hardware store, Ilse's pawn shop, Frau Weber's.
 */
import type { Level } from '../gen/level';
import { HOUSES, TOWN, VILLAGE, townGround, townLook } from '../gen/town';
import type { Known } from './mapSheet';

/** Whether a nobody at height y on `level` is up in the village (or in grandma's house), not down in her cellar. */
export function inVillage(level: Level, y: number): boolean {
  return level.depth === 0 && y > TOWN.ground - 1.2;
}

/** How far out from the square the map shows the village: its farthest building or farmyard, and a field beyond. */
const REACH = Math.max(
  ...HOUSES.map((h) => Math.hypot(h.cx - VILLAGE.square.x, h.cz - VILLAGE.square.z) + Math.hypot(h.hu, h.hv)),
  ...VILLAGE.farms.map((f) => Math.hypot(f.x - VILLAGE.square.x, f.z - VILLAGE.square.z) + Math.hypot(f.hu, f.hv)),
) + 30;

/** The village as the map knows it: the ground's height and its look (in sRGB, as the map's floors are), buildings as rock. */
export const VILLAGE_KNOWN: Known = (x, z) => {
  if (Math.hypot(x - VILLAGE.square.x, z - VILLAGE.square.z) > REACH) return null;
  const y = townGround(x, z).y;
  if (VILLAGE.nearestBuilding(x, y + 1, z).d < 0) return 'rock';
  const c = townLook(x, y + 0.01, z, 0).rgb;
  return { floor: y, water: false, rgb: [Math.pow(c[0], 1 / 2.2), Math.pow(c[1], 1 / 2.2), Math.pow(c[2], 1 / 2.2)] };
};

/** The places named on the village's map, by the role of their house. */
const NAMES: Readonly<Record<string, string>> = {
  grandma: "Grandma's house",
  hardware: "Kemal's hardware store",
  pawn: "Ilse's pawn shop",
  weber: 'Frau Weber',
};

/** A place named on the map: where (its house's middle), what it is called, and whether it is a shop. */
export interface MapMark {
  readonly x: number;
  readonly z: number;
  readonly name: string;
  readonly shop: boolean;
  /** Which side of the dot the name goes (−1 west, 1 east): away from grandma's street, so the two shops facing over it do not overlap. */
  readonly side: -1 | 1;
}

export const VILLAGE_MARKS: readonly MapMark[] = HOUSES.filter((h) => h.role && NAMES[h.role]).map((h) => ({
  x: h.cx, z: h.cz, name: NAMES[h.role!], shop: h.role === 'hardware' || h.role === 'pawn', side: h.cx < (TOWN.street.x[0] + TOWN.street.x[1]) / 2 ? -1 : 1,
}));
