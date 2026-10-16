/**
 * Farmland: a patchwork of fields (parcels) round a village, each with its crop, and the hedgerows
 * along some of their borders. Scale's land use (`world/landuse` `parcelAt`): a gently warped,
 * turned grid of cells in brick-offset rows, each cell split into one to three strips, each strip a
 * field with its own crop. A pure function of the seed and the point, cheap enough per vertex.
 */
import { Rng, deriveSeed, hash2i, hashToFloat } from '@futuremagic/core';

export type Crop = 'wheat' | 'barley' | 'green' | 'maize' | 'ploughed' | 'pasture' | 'rapeseed' | 'stubble';
/** A field's id (mod 16) to its crop: a lot of cereal, some pasture and plough, now and then rapeseed. */
const CROP_OF: readonly Crop[] = ['wheat', 'wheat', 'wheat', 'barley', 'green', 'green', 'green', 'maize', 'maize', 'ploughed', 'ploughed', 'pasture', 'pasture', 'pasture', 'rapeseed', 'stubble'];

/** The crops' colours (linear RGB), as they look under a lamp at night: muted. */
export const CROP_COLOR: Readonly<Record<Crop, readonly [number, number, number]>> = {
  wheat: [0.36, 0.28, 0.12],
  barley: [0.4, 0.34, 0.18],
  green: [0.14, 0.22, 0.07],
  maize: [0.1, 0.17, 0.06],
  ploughed: [0.2, 0.13, 0.08],
  pasture: [0.11, 0.18, 0.07],
  rapeseed: [0.42, 0.38, 0.06],
  stubble: [0.3, 0.26, 0.16],
};

/** How much grass grows on a crop's field (the rock shader's moss, src/gen/style.ts `Cover`). */
export const CROP_GRASS: Readonly<Record<Crop, number>> = { wheat: 0, barley: 0, green: 0.5, maize: 0.3, ploughed: 0, pasture: 1, rapeseed: 0.2, stubble: 0 };

/** The field grid of one place (from its seed). */
export interface ParcelGrid {
  readonly seed: number;
  readonly cos: number;
  readonly sin: number;
  /** Cell size across (u) and along (v) the rows, metres. */
  readonly su: number;
  readonly sv: number;
  /** How far the grid is warped, metres, and the warp's phases. */
  readonly warp: number;
  readonly ph1: number;
  readonly ph2: number;
}

const WARP_K1 = 1 / 330, WARP_K2 = 1 / 410;

/** The field grid for `seed`: its angle, cell sizes (smaller than Scale's: a village's fields, not a county's) and warp. */
export function parcelGrid(seed: number): ParcelGrid {
  const r = new Rng(deriveSeed(seed, 'parcels'));
  const a = r.range(0, Math.PI);
  return { seed: deriveSeed(seed, 'parcel-hash'), cos: Math.cos(a), sin: Math.sin(a), su: r.range(90, 140), sv: r.range(55, 85), warp: r.range(8, 18), ph1: r.range(0, 6.28), ph2: r.range(0, 6.28) };
}

/** The field at a point (filled in place, as the hot path asks it per vertex). */
export interface Parcel {
  /** Its id (a hash) and crop. */
  id: number;
  crop: Crop;
  /** Distance to its edge, metres. */
  border: number;
  /** Distance to the nearest border that carries a hedgerow, metres (Infinity: none near). */
  hedge: number;
  /** Where across its rows (metres, along the furrows' normal): for drawing them. */
  row: number;
}

export function newParcel(): Parcel {
  return { id: 0, crop: 'wheat', border: 0, hedge: Infinity, row: 0 };
}

/** Does the border under cell i of row j (between rows j - 1 and j, that cell's stretch of it) carry a hedge; does the border left of cell i in row j? */
function hedgeUnder(G: ParcelGrid, i: number, j: number): boolean {
  return hashToFloat(hash2i(G.seed ^ 0x51ed, i, j)) < 0.3;
}
function hedgeLeft(G: ParcelGrid, i: number, j: number): boolean {
  return hashToFloat(hash2i(G.seed ^ 0x2c1b, i, j)) < 0.25;
}

/** The field at (x, z). */
export function parcelAt(G: ParcelGrid, x: number, z: number, out: Parcel): Parcel {
  const px = x + G.warp * Math.sin(z * WARP_K1 + G.ph1), pz = z + G.warp * Math.sin(x * WARP_K2 + G.ph2);
  const u = px * G.cos + pz * G.sin, v = -px * G.sin + pz * G.cos;
  const vv = v / G.sv, j = Math.floor(vv), fv = vv - j;
  const off = hashToFloat(hash2i(G.seed, 7, j)) * G.su;
  const uu = (u + off) / G.su, i = Math.floor(uu), fu = uu - i;
  const k = 1 + (hash2i(G.seed, i, j) % 3), fsk = fu * k, si = Math.floor(fsk), fs = fsk - si;
  const id = hash2i(G.seed ^ 0x9e37, i * 4 + si, j);
  out.id = id;
  out.crop = CROP_OF[id % 16];
  const w = G.su / k;
  out.border = Math.min(Math.min(fs, 1 - fs) * w, Math.min(fv, 1 - fv) * G.sv);
  // Hedges: on some row borders (each cell's own stretch of it), and some cell borders (never between a cell's strips).
  const below = fv * G.sv, above = (1 - fv) * G.sv, left = fu * G.su, right = (1 - fu) * G.su;
  let hedge = Infinity;
  if (hedgeUnder(G, i, j)) hedge = Math.min(hedge, below);
  if (hedgeUnder(G, Math.floor((u + hashToFloat(hash2i(G.seed, 7, j + 1)) * G.su) / G.su), j + 1)) hedge = Math.min(hedge, above); // (row j + 1's own cell there: both sides agree)
  if (hedgeLeft(G, i, j)) hedge = Math.min(hedge, left);
  if (hedgeLeft(G, i + 1, j)) hedge = Math.min(hedge, right);
  out.hedge = hedge;
  out.row = w < G.sv ? u : v;
  return out;
}
