/**
 * The town by day (depth 0, above grandma's cellar; docs/design/town-and-first-strata.md §3): a
 * country village (src/gen/village.ts) in the lee of the quarry hill, with fields all round it.
 * Grandma's street runs along the foot of the hill, her house's back built into it; a lane leads
 * from opposite her door to the square and the church; country roads, lanes and side lanes, houses
 * along them all, and farmsteads out in the fields, all laid out from the town's seed (the same for
 * every seed of the game: the family's town does not move). Ilse's pawn shop is across the street,
 * Kemal's hardware store next door, Frau Weber across the street just down from the lane.
 *
 * A part of the cellar's field (src/gen/cellar.ts): air above the ground and outside the buildings,
 * the buildings solid (only grandma's has an inside), hedgerows along some of the fields' borders.
 * Pure.
 */
import { Noise, Rng, deriveSeed, lerp, smoothstep } from '@futuremagic/core';
import { CROP_COLOR, CROP_GRASS, newParcel, parcelAt, parcelGrid, type Crop } from './fields';
import { local, unlocal } from './propMesh';
import { Village, buildingDistance, type Building, type Road } from './village';

/** Where things are, metres (the street level is the house floor; the cellar is below). */
export const TOWN = {
  /** Street level: the village's ground. */
  ground: 2.7,
  /** Grandma's street, along z in front of her house (between the house fronts), and how far it runs each way. */
  street: { x: [-22, -16.2], reach: 92 },
  /** Her house: its walls and roof (the inside is CELLAR.house), the back in the hill. */
  grandma: { x: [-16.2, -6.4], z: [-5.6, 5.6], eaves: 6.2, pitch: 0.75 },
  /** Her front door, open: from the hall out onto the street (its air reaching well into both, as the cellar's doorway). */
  door: { x: [-17.4, -14.0], z: [-0.5, 0.5], top: 2.05 },
  /**
   * The quarry hill behind her side of the street: where its foot is (x, along her street within
   * `straight` of her door, curving away east beyond, by `bend` per metre², wandering by up to
   * `wobble`), how steep, how high.
   */
  hill: { x: -9, slope: 1.2, rise: 30, straight: 25, bend: 0.006, wobble: 14 },
  /** How far the village reaches from its square; how high the land rolls out beyond it. */
  village: { r: 150, roll: 8 },
} as const;

/** The town's seed: its layout, the same for every game. */
export const TOWN_SEED = 1931;
const SEED = TOWN_SEED;

/** A building of the town (src/gen/village.ts); its `role` says whose it is. */
export type House = Building;

/** The shops of the street (town-and-first-strata.md §3). */
export type Shop = 'pawn' | 'hardware';

/** The neighbours one can call on (town-and-first-strata.md §3): old Frau Weber, across the street. */
export type Neighbour = 'weber';

const land = new Noise(deriveSeed(SEED, 'land'));

/** The quarry hill at (x, z): its height and its slope. */
function hill(x: number, z: number): { h: number; gx: number; gz: number } {
  const H = TOWN.hill, a = Math.max(0, Math.abs(z) - H.straight), wobble = H.wobble * smoothstep(0, 40, a);
  const foot = H.x + H.bend * a * a + (wobble > 0 ? wobble * land.n2(z / 90, 7.7) : 0), t = x - foot;
  if (t <= 0) return { h: 0, gx: 0, gz: 0 };
  const h = Math.min(H.rise, t * H.slope), on = t * H.slope < H.rise;
  // (The wobble's own slope along z is at most about wobble / 40 per metre: counted in.)
  return { h, gx: on ? H.slope : 0, gz: on ? H.slope * (2 * H.bend * a + wobble / 40) : 0 };
}

/** The square's place (from the seed): out west of her street, roughly opposite her door. */
const SQUARE = (() => {
  const r = new Rng(deriveSeed(SEED, 'square'));
  return { x: (TOWN.street.x[0] + TOWN.street.x[1]) / 2 - r.range(50, 70), z: r.range(-12, 12) };
})();

/** How much the land rolls at (x, z): none in the village (nor over the cellar), more the farther out. */
function rollOf(x: number, z: number): number {
  return smoothstep(TOWN.village.r, TOWN.village.r * 2.2, Math.hypot(x - SQUARE.x, z - SQUARE.z));
}

/** The ground before the farmyards are levelled: the village's level, the hill, the rolling land. */
function rawGround(x: number, z: number): number {
  const m = rollOf(x, z);
  return TOWN.ground + hill(x, z).h + (m > 0 ? m * TOWN.village.roll * land.fbm2(x / 260, z / 260, 3) : 0);
}

const STREET_X = (TOWN.street.x[0] + TOWN.street.x[1]) / 2;

/** Her house, as the village keeps it: front to the street (west), the ridge running back into the hill. */
const GRANDMAS: Building = {
  kind: 'house', cx: (TOWN.grandma.x[0] + TOWN.grandma.x[1]) / 2, cz: 0, yaw: -Math.PI / 2,
  hu: (TOWN.grandma.z[1] - TOWN.grandma.z[0]) / 2, hv: (TOWN.grandma.x[1] - TOWN.grandma.x[0]) / 2,
  base: TOWN.ground, eaves: TOWN.grandma.eaves, pitch: TOWN.grandma.pitch, ridge: 'across', look: 0.5, door: 0, role: 'grandma',
};

/** The village. */
export const VILLAGE = new Village({
  seed: SEED,
  x: SQUARE.x,
  z: SQUARE.z,
  r: TOWN.village.r,
  ground: rawGround,
  blocked: (x, z) => hill(x, z).h > 0.3,
  streets: [{ pts: [STREET_X, -TOWN.street.reach, STREET_X, TOWN.street.reach], kind: 'lane', hw: (TOWN.street.x[1] - TOWN.street.x[0]) / 2, join: [STREET_X, 0] }],
  buildings: [GRANDMAS],
  farms: 5,
});

/** Every building of the town, grandma's first. */
export const HOUSES: readonly House[] = VILLAGE.buildings;

/** Give the house on her street that `pick` chooses its role (its door in the middle of its front). */
function assign(role: Shop | Neighbour, pick: (h: House) => number): void {
  let best = -1, bk = Infinity;
  VILLAGE.buildings.forEach((h, i) => {
    if (h.kind !== 'house' || h.role || Math.abs(h.cz) > TOWN.street.reach) return;
    const k = pick(h);
    if (k < bk) { bk = k; best = i; }
  });
  if (best < 0) throw new Error(`no house in the town for ${role}`);
  VILLAGE.buildings[best] = { ...VILLAGE.buildings[best], role, door: 0 };
}
/** Facing the street from her side (west), or from across it (east). */
const herSide = (h: House) => Math.abs(h.yaw + Math.PI / 2) < 0.01 && h.cx > TOWN.street.x[1];
const across = (h: House) => Math.abs(h.yaw - Math.PI / 2) < 0.01 && h.cx < TOWN.street.x[0];
// Kemal's next door to her (up the street), Ilse's across the street just up from the lane, Frau Weber's just down from it.
assign('hardware', (h) => (herSide(h) && h.cz > 0 ? h.cz : Infinity));
assign('pawn', (h) => (across(h) && h.cz > 0 ? h.cz : Infinity));
assign('weber', (h) => (across(h) && h.cz < 0 ? -h.cz : Infinity));

/** The houses' plaster, picked by their `look`: limestone, ochre, whitewash gone grey, old pink. */
const PLASTER: readonly (readonly [number, number, number])[] = [[0.56, 0.53, 0.44], [0.55, 0.45, 0.3], [0.5, 0.5, 0.48], [0.5, 0.4, 0.37]];
const CHURCH_STONE: readonly [number, number, number] = [0.46, 0.43, 0.37];
const BARN_WOOD: readonly [number, number, number] = [0.26, 0.15, 0.09];

/** A building's walls and roof: plaster and slate or red tile; the church's stone and slate; a barn's boards. */
export function houseColors(h: House): { wall: [number, number, number]; roof: [number, number, number] } {
  const p = h.kind === 'church' || h.kind === 'tower' ? CHURCH_STONE : h.kind === 'barn' ? BARN_WOOD : PLASTER[Math.floor(h.look * PLASTER.length)];
  const slate = h.kind === 'church' || h.kind === 'tower' || h.look < 0.5;
  return { wall: [p[0], p[1], p[2]], roof: slate ? [0.15, 0.16, 0.19] : [0.33, 0.15, 0.1] };
}

/** Where one stands at a house's door (out on the street, before its step), which way is out (nx, nz) and which way along its front (sx, sz). */
export function atDoor(house: House): { house: House; x: number; z: number; nx: number; nz: number; sx: number; sz: number } {
  const [x, z] = local(house.cx, house.cz, house.yaw)(house.door, house.hv + 1.0);
  return { house, x, z, nx: Math.sin(house.yaw), nz: Math.cos(house.yaw), sx: Math.cos(house.yaw), sz: -Math.sin(house.yaw) };
}

/** The shop's house, and where one stands at its door to deal. */
export function shopDoor(shop: Shop): ReturnType<typeof atDoor> {
  return atDoor(HOUSES.find((h) => h.role === shop)!);
}

/**
 * Inside the two shops (Ilse's and Kemal's): one small room behind the front, `depth` deep from
 * `inset` inside the front wall and `inset` in from the ends, `height` high, lined (src/gen/townProps.ts
 * `shopInside`): the field's own room reaches `lining` further out and `over` higher, behind the
 * lining, so the field's rounded corners stay out of sight; the front door open on it, `door` wide and high, its air reaching `reach` into the room and out over the street (so the two airs overlap well where they meet: a body passes the seam); the counter `counter` in from the back of the room, `deep` through,
 * `high`; the keeper standing `keeper` in from the back. Metres.
 */
export const SHOP = { inset: 0.35, depth: 5, height: 2.5, lining: 0.17, over: 0.4, door: { hw: 0.55, top: 2.1, reach: 1.5 }, counter: { at: 1.35, deep: 0.28, high: 1.0 }, keeper: 0.6 } as const;

/** A shop's room in its house's frame: across (u) and front-to-back (v, the front at v1), and its floor. */
export function shopRoom(H: House): { u: number; v0: number; v1: number; floor: number } {
  const v1 = H.hv - SHOP.inset;
  return { u: H.hu - SHOP.inset, v0: Math.max(-H.hv + SHOP.inset, v1 - SHOP.depth), v1, floor: H.base };
}

const SHOP_HOUSES = (['pawn', 'hardware'] as const).map((s) => HOUSES.find((h) => h.role === s)!);

/** How far inside a shop's room or its open front door (x, y, z) is (positive: in the air there); far negative away from the shops. */
export function shopAir(x: number, y: number, z: number): number {
  let best = -9;
  for (const H of SHOP_HOUSES) {
    if (Math.abs(x - H.cx) > H.hv + H.hu + 2 || Math.abs(z - H.cz) > H.hv + H.hu + 2) continue;
    const [u, v] = unlocal(x, z, H.cx, H.cz, H.yaw), R = shopRoom(H), D = SHOP.door;
    const room = Math.min(R.u + SHOP.lining - Math.abs(u), v - R.v0 + SHOP.lining, R.v1 + SHOP.lining - v, y - R.floor, R.floor + SHOP.height + SHOP.over - y);
    const door = Math.min(D.hw - Math.abs(u - H.door), v - (R.v1 - D.reach), H.hv + D.reach - v, y - R.floor, R.floor + D.top - y);
    best = Math.max(best, room, door);
  }
  return best;
}

/** Where the shop's keeper stands behind the counter, and which way they face (out of the door). */
export function shopKeeper(shop: Shop): { x: number; z: number; yaw: number } {
  const H = HOUSES.find((h) => h.role === shop)!, R = shopRoom(H), [x, z] = local(H.cx, H.cz, H.yaw)(H.door, R.v0 + SHOP.keeper);
  return { x, z, yaw: Math.atan2(-Math.sin(H.yaw), -Math.cos(H.yaw)) };
}

/** The neighbour's house, and where one stands at her door. */
export function homeDoor(who: Neighbour): ReturnType<typeof atDoor> {
  return atDoor(HOUSES.find((h) => h.role === who)!);
}

/**
 * The ground's height at (x, z) (the farmyards levelled), and how steep it may be there (for the
 * field's distance). Read it at once: the answer is a slot of the column table, reused.
 */
export function townGround(x: number, z: number): { readonly y: number; readonly steep: number } {
  return columnAt(x, z);
}

function landHeight(x: number, z: number): { y: number; steep: number } {
  const H = hill(x, z), m = rollOf(x, z);
  let y = rawGround(x, z), g = Math.hypot(H.gx, H.gz) + m * TOWN.village.roll * 0.02;
  if (m > 0) {
    const f = VILLAGE.farmAt(x, z);
    if (f.farm) {
      const w = smoothstep(-8, 2, f.d);
      g += Math.abs(y - f.farm.base) / 10;
      y = lerp(y, f.farm.base, w);
    }
  }
  return { y, steep: Math.hypot(1, g) };
}

/** Signed distance to house `h` (negative inside its walls or under its roof). */
export const houseDistance = buildingDistance;

/** The house (x, y, z) is nearest to, and how far (negative: inside it); none when it is some metres from them all. */
export function nearestHouse(x: number, y: number, z: number): { house: House | null; d: number } {
  const n = VILLAGE.nearestBuilding(x, y, z);
  return { house: n.building, d: n.d };
}

/** What the land is at (x, z): on a road (which), on the square, in a farmyard, how much a field (and which), how much the hill. */
export interface Land {
  road: Road | null;
  /** Distance to the nearest road's edge (negative on it). */
  roadEdge: number;
  square: number;
  yard: number;
  field: number;
  crop: Crop;
  /** Distance to the field's edge; to the nearest hedgerow. */
  border: number;
  hedge: number;
  hill: number;
}

const GRID = parcelGrid(SEED), parcel = newParcel(), hit: { road: Road | null } = { road: null };

/** The land at (x, z) (filled into `out`). */
export function landAt(x: number, z: number, out: Land): Land {
  out.roadEdge = VILLAGE.roadEdge(x, z, hit);
  out.road = hit.road;
  out.square = VILLAGE.squareEdge(x, z);
  const f = VILLAGE.farmAt(x, z);
  out.yard = f.d;
  const H = hill(x, z);
  out.hill = H.h;
  // (Fields on the hill's top too, not on its steep side.)
  out.field = (1 - VILLAGE.clearing(x, z)) * smoothstep(1, 4, out.roadEdge) * (1 - smoothstep(0.1, 0.4, Math.hypot(H.gx, H.gz)));
  if (out.field > 0) {
    parcelAt(GRID, x, z, parcel);
    out.crop = parcel.crop;
    out.border = parcel.border;
    out.hedge = parcel.hedge;
  } else {
    out.crop = 'pasture';
    out.border = 0;
    out.hedge = Infinity;
  }
  return out;
}

export function newLand(): Land {
  return { road: null, roadEdge: Infinity, square: Infinity, yard: -Infinity, field: 0, crop: 'pasture', border: 0, hedge: Infinity, hill: 0 };
}

const probe = newLand();

/** The hedgerows' signed distance at (x, y, z), over ground at `g` (Infinity where there are none). */
function hedgeAir(c: TownColumn, y: number): number {
  return c.hedge === Infinity || y > c.top + 1 ? Infinity : Math.max(c.hedge, y - c.top);
}

/** What the town is in one column (x, z), whatever the height: the ground, how steep, the hedgerow's distance in plan and top. */
interface TownColumn {
  x: number;
  z: number;
  y: number;
  steep: number;
  hedge: number;
  top: number;
}

/**
 * The columns asked lately (a chunk asks each of its columns over and over, a row of x at a time):
 * a small table indexed by a hash of the point, each slot keeping the last column that fell in it.
 */
const COLUMNS: TownColumn[] = Array.from({ length: 4096 }, () => ({ x: NaN, z: NaN, y: 0, steep: 1, hedge: Infinity, top: 0 }));

function columnAt(x: number, z: number): TownColumn {
  const c = COLUMNS[(Math.imul(Math.round(x * 8), 73856093) ^ Math.imul(Math.round(z * 8), 19349663)) & 4095];
  if (c.x === x && c.z === z) return c;
  const g = landHeight(x, z);
  c.x = x; c.z = z; c.y = g.y; c.steep = g.steep; c.hedge = Infinity;
  landAt(x, z, probe);
  if (probe.field >= 0.6 && probe.hedge < 3) {
    c.top = g.y + 1.5 + 0.45 * land.n2(x / 3.1, z / 3.1);
    c.hedge = probe.hedge - (0.75 + 0.25 * land.n2(x / 2.3 + 40, z / 2.3));
  }
  return c;
}

/** The town's air at (x, y, z): above the ground and the hedgerows, outside every building (negative: earth or walls). */
export function townAir(x: number, y: number, z: number): number {
  const c = columnAt(x, z);
  return Math.min((y - c.y) / c.steep, hedgeAir(c, y), nearestHouse(x, y, z).d);
}

/** Whether the solid nearest (x, y, z) is a building (not the ground, the hill or a hedge): not climbed. */
export function onBuilding(x: number, y: number, z: number): boolean {
  const c = columnAt(x, z);
  return nearestHouse(x, y, z).d < Math.min((y - c.y) / c.steep, hedgeAir(c, y)) + 0.2;
}

/** How a point of the town's surface looks: its colour (linear RGB), how much grass grows on it, whether it is cobbled or plastered. */
export interface Look {
  rgb: [number, number, number];
  grass: number;
  cobbles: boolean;
  plaster: boolean;
}

const looked = { x: NaN, y: NaN, z: NaN }, look: Look = { rgb: [0, 0, 0], grass: 0, cobbles: false, plaster: false }, at = newLand();

/** The look of the town's surface at (x, y, z) (the last answer again when asked about the same point: colour, surface and cover ask in turn). */
export function townLook(x: number, y: number, z: number, k: number): Look {
  if (x === looked.x && y === looked.y && z === looked.z) return look;
  looked.x = x; looked.y = y; looked.z = z;
  const g = townGround(x, z), { house, d } = nearestHouse(x, y, z), c = look.rgb;
  look.grass = 0; look.cobbles = false; look.plaster = false;
  const set = (r: number, gg: number, b: number) => { c[0] = r + k; c[1] = gg + k; c[2] = b + k; };
  if (house && d < 0.25 && y > g.y + 0.05) {
    // (Mostly under the buildings' own walls and roofs, src/gen/townProps.ts: what shows is in the same colours.)
    const roof = y > house.eaves - 0.05;
    const w = houseColors(house)[roof ? 'roof' : 'wall'];
    set(w[0], w[1], w[2]);
    look.plaster = true;
    return look;
  }
  landAt(x, z, at);
  if (y > g.y + 0.3) {
    // A hedgerow: dark leaves.
    set(0.06, 0.1, 0.04);
    look.grass = 1;
    return look;
  }
  const R = at.road;
  if (at.square < 0 || (R && at.roadEdge < 0 && R.kind === 'lane')) {
    // Cobbles: grey setts in rows, darker between.
    const sett = Math.abs(Math.sin(x * 6.5)) * Math.abs(Math.sin(z * 4.7 + Math.floor(x * 2.07) * 1.3)), v = 0.2 + 0.1 * Math.min(1, sett * 3);
    set(v, v * 0.98, v * 0.95);
    look.cobbles = true;
    return look;
  }
  if (R && at.roadEdge < 0 && R.kind === 'main') {
    // Old tarmac, patched.
    const v = 0.1 + 0.03 * land.n2(x / 4, z / 4);
    set(v, v, v * 1.05);
    return look;
  }
  if ((R && at.roadEdge < 0) || at.yard > 0) {
    // A dirt track (grass down its middle), a trodden farmyard.
    const mid = R && at.roadEdge < 0 ? 1 - smoothstep(0.2, 0.5, R.hw + at.roadEdge) : 0;
    set(lerp(0.2, 0.12, mid), lerp(0.15, 0.16, mid), lerp(0.1, 0.08, mid));
    look.grass = mid * 0.6;
    return look;
  }
  if (g.steep > 1.2) { set(0.3, 0.29, 0.26); return look; }
  // Grass (verges, gardens, meadows), giving way to the fields' crops, a grass margin round each.
  const fw = at.field * smoothstep(0.8, 1.6, at.border), crop = CROP_COLOR[at.crop];
  const shade = 1 + 0.12 * land.n2(x / 17, z / 17);
  set(lerp(0.12, crop[0], fw) * shade, lerp(0.16, crop[1], fw) * shade, lerp(0.08, crop[2], fw) * shade);
  look.grass = lerp(1, CROP_GRASS[at.crop], fw);
  return look;
}
