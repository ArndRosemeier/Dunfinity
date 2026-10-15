/**
 * The level's style regions (docs/design/level-styles.md §1): the plane cut into jittered Voronoi
 * regions a few hundred metres across (src/gen/voronoi.ts), each given one of the level's styles
 * by weight, so over a level each style covers about its weight's share. Where regions of two
 * styles meet there is an edge band `REGIONS.edge` metres wide (in blend distance) on each side; in
 * it, each style's share comes in and goes out smoothly (`sharesAt`).
 *
 * The region round the origin, where the level's arrival and its way up are, is always the mix's
 * first style (the one that knows how to stand a ladder: the excavation's pillars).
 *
 * Pure: everything from the seed.
 */
import { deriveSeed, hashToFloat } from '@futuremagic/core';
import { blendShare, newNear, voronoiNear } from './voronoi';
import type { StyleId } from './style';

export const REGIONS = {
  /** Average region size, metres, and how far its feature point strays (0..1). */
  size: 360,
  jitter: 0.85,
  /** The edge band between styles, metres (blend distance) on each side. */
  edge: 80,
  /** Regions of other styles this much further off (blend distance) are listed too (`Shares.others`): the passages between styles reach that far in. */
  reach: 200,
  /** How far off (blend distance, beyond the band) the nearest region of another style is still told (`Shares.edge`). */
  far: 900,
} as const;

/** A level's styles and how much of it each covers (weights need not add up to 1). */
export type Mix = readonly (readonly [StyleId, number])[];

/** The shares of the styles at a point: `n` of them, `styles[i]` an index into the mix, `w[i]` its share (they add up to 1; the owner's first). `edge`: blend distance to the nearest region of another style (Infinity: none within `edge + far`). */
export interface Shares {
  n: number;
  styles: number[];
  w: number[];
  edge: number;
  /** The region (x, z) is in: its hash and feature point (metres). */
  id: number;
  px: number;
  pz: number;
  /** Regions of other styles within `edge + reach`: `others` of them, their hash, feature point (metres) and style. */
  others: number;
  oids: number[];
  opx: number[];
  opz: number[];
  ostyles: number[];
}

export const newShares = (): Shares => ({ n: 0, styles: [], w: [], edge: Infinity, id: 0, px: 0, pz: 0, others: 0, oids: [], opx: [], opz: [], ostyles: [] });

export class Regions {
  private readonly seed: number;
  private readonly near = newNear();
  private readonly cum: number[];
  /** The region round the origin. */
  private readonly home: number;

  constructor(seed: number, readonly mix: Mix) {
    this.seed = deriveSeed(seed, 'regions');
    const total = mix.reduce((a, [, w]) => a + w, 0);
    let acc = 0;
    this.cum = mix.map(([, w]) => (acc += w / total));
    this.home = voronoiNear(this.seed, 0, 0, REGIONS.size, REGIONS.jitter, 0, newNear()).id;
  }

  /** The style (an index into the mix) of the region with hash `id`. */
  styleOf(id: number): number {
    if (this.mix.length === 1 || id === this.home) return 0;
    const r = hashToFloat(id * 747796405 + 1);
    const i = this.cum.findIndex((c) => r < c);
    return i < 0 ? this.mix.length - 1 : i;
  }

  /** The style (an index into the mix) that owns (x, z). */
  styleAt(x: number, z: number): number {
    if (this.mix.length === 1) return 0;
    const S = REGIONS;
    return this.styleOf(voronoiNear(this.seed, x / S.size, z / S.size, S.size, S.jitter, S.edge, this.near).id);
  }

  /** The region at (x, z) (in metres, its feature point in `out`), into `out`. */
  regionAt(x: number, z: number, out = this.near): { id: number; px: number; pz: number } {
    const S = REGIONS, r = voronoiNear(this.seed, x / S.size, z / S.size, S.size, S.jitter, 0, out);
    return { id: r.id, px: r.px * S.size, pz: r.pz * S.size };
  }

  /** The styles' shares at (x, z), into `out`. */
  sharesAt(x: number, z: number, out: Shares): Shares {
    out.n = 1; out.styles[0] = 0; out.w[0] = 1; out.edge = Infinity; out.others = 0;
    if (this.mix.length === 1) return out;
    const S = REGIONS, r = voronoiNear(this.seed, x / S.size, z / S.size, S.size, S.jitter, S.edge + S.far, this.near);
    const own = this.styleOf(r.id);
    out.styles[0] = own;
    out.id = r.id; out.px = r.px * S.size; out.pz = r.pz * S.size;
    // Every region near shares in the blend (as the workings do), and a style's share is its regions'.
    let sum = 1;
    for (let i = 0; i < r.count; i++) {
      const s = this.styleOf(r.ids[i]);
      const k = r.blends[i] < S.edge ? blendShare(r.blends[i], S.edge) : 0;
      sum += k;
      if (s === own) { out.w[0] += k; continue; } // (regions of one style run into each other seamlessly)
      out.edge = Math.min(out.edge, r.blends[i]);
      if (r.blends[i] < S.edge + S.reach) {
        const o = out.others++;
        out.oids[o] = r.ids[i]; out.opx[o] = r.pxs[i] * S.size; out.opz[o] = r.pzs[i] * S.size; out.ostyles[o] = s;
      }
      if (k === 0) continue;
      let j = 1;
      while (j < out.n && out.styles[j] !== s) j++;
      if (j === out.n) { out.styles[j] = s; out.w[j] = 0; out.n++; }
      out.w[j] += k;
    }
    for (let j = 0; j < out.n; j++) out.w[j] /= sum;
    return out;
  }
}
