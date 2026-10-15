/**
 * Jittered Voronoi cells with smooth blending across their borders: the excavation's workings
 * (src/gen/quarry.ts) and the level's style regions (src/gen/regions.ts) are both laid out this way.
 *
 * `voronoiNear` finds the cell a point is in, how far it is from that cell's border (the nearest
 * Voronoi edge, exact), and every neighbour near enough to blend with, with its blend distance
 * (`blends`, under `blend`). A neighbour comes in and goes out smoothly, so anything blended from
 * these is continuous (blending with the second-nearest cell alone is not: it switches at a
 * three-way corner). Pure.
 */
import { hash2i, hashToFloat } from '@futuremagic/core';

export interface Near {
  id: number;
  px: number;
  pz: number;
  border: number;
  count: number;
  ids: number[];
  pxs: number[];
  pzs: number[];
  blends: number[];
}

export const newNear = (): Near => ({ id: 0, px: 0, pz: 0, border: 0, count: 0, ids: [], pxs: [], pzs: [], blends: [] });

const FX: number[] = new Array(25), FZ: number[] = new Array(25), HS: number[] = new Array(25);

/**
 * The cells round (x, z), in cell units (x / size): cells `size` metres across, their feature points
 * straying `jitter` (0..1) from the cell's middle, seeded by `seed`. Distances out are in metres;
 * feature points (px, pz) in cell units. Into `out`.
 */
export function voronoiNear(seed: number, x: number, z: number, size: number, jitter: number, blend: number, out: Near): Near {
  const xi = Math.floor(x), zi = Math.floor(z);
  const fx = FX, fz = FZ, hs = HS;
  let best = 0, f1 = Infinity;
  for (let k = 0, dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++, k++) {
      const cx = xi + dx, cz = zi + dz, h = hash2i(seed, cx, cz);
      hs[k] = h;
      fx[k] = cx + 0.5 + (hashToFloat(h) - 0.5) * jitter;
      fz[k] = cz + 0.5 + (hashToFloat(h * 2654435761) - 0.5) * jitter;
      const d = (fx[k] - x) ** 2 + (fz[k] - z) ** 2;
      if (d < f1) { f1 = d; best = k; }
    }
  }
  out.id = hs[best]; out.px = fx[best]; out.pz = fz[best];
  out.border = Infinity;
  out.count = 0;
  for (let k = 0; k < 25; k++) {
    if (k === best) continue;
    const ex = fx[k] - fx[best], ez = fz[k] - fz[best];
    const e = (fx[k] - x) ** 2 + (fz[k] - z) ** 2 - f1;
    out.border = Math.min(out.border, (e / (2 * Math.hypot(ex, ez))) * size);
    // For blending, the border's distance as if every neighbour were one cell away: the same seen
    // from either side of any border, so a blend never jumps (the exact one does at a three-way corner).
    const b = (e / 2) * size;
    if (b >= blend) continue;
    out.ids[out.count] = hs[k]; out.pxs[out.count] = fx[k]; out.pzs[out.count] = fz[k]; out.blends[out.count] = b;
    out.count++;
  }
  return out;
}

/** A neighbour's share in a blend, `b` metres (blend distance) from the border, blending over `blend`: 1 on the border, 0 at `blend` (one neighbour: its share is k / (1 + k), halfway on the border). */
export function blendShare(b: number, blend: number): number {
  const s = smooth(b / blend);
  return (1 - s) / (1 + s);
}

function smooth(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
}
