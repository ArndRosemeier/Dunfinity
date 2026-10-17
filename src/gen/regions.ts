/**
 * The level's style regions (docs/design/level-styles.md §1): the plane cut into jittered Voronoi
 * regions a few hundred metres across (src/gen/voronoi.ts), each given one of the level's styles
 * by weight, so over a level each style covers about its weight's share. Where regions of two
 * styles meet there is an edge band `REGIONS.edge` metres wide (in blend distance) on each side; in
 * it, each style's share comes in and goes out smoothly (`sharesAt`).
 *
 * The home ground round the origin, where the level's arrival and its way up are (the region there
 * and every region whose feature point is within `REGIONS.home`), is always the mix's first style
 * (the one that knows how to stand a ladder: the excavation's pillars). One sets out from the
 * familiar workings into the other kinds of place.
 *
 * Pure: everything from the seed.
 */
import { deriveSeed, hash2i, hashString, hashToFloat } from '@futuremagic/core';
import { blendShare, newNear, voronoiNear } from './voronoi';
import type { StyleId } from './style';

export const REGIONS = {
  /** Average region size, metres, and how far its feature point strays (0..1). */
  size: 360,
  jitter: 0.85,
  /** The edge band between styles, metres (blend distance) on each side. */
  edge: 80,
  /** How far off (blend distance, beyond the band) the nearest region of another style is still told (`Shares.edge`). */
  far: 900,
  /** Regions whose feature point is this near the origin are the mix's first style: the home ground round the arrival, metres. */
  home: 520,
} as const;

/** A level's styles and how much of it each covers (weights need not add up to 1). */
export type Mix = readonly (readonly [StyleId, number])[];

/** How much of a level of `mix` is style `id`'s: its weight over all of them. */
export function shareOf(mix: Mix, id: StyleId): number {
  let all = 0, own = 0;
  for (const [s, w] of mix) { all += w; if (s === id) own += w; }
  return all > 0 ? own / all : 0;
}

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
  /**
   * Regions of other styles within `edge + far` (all that are told): `others` of them, their hash,
   * feature point (metres) and style. The passages between styles are looked for among these, so a
   * passage drops out of the field only where it is hundreds of metres off (a style's portal can
   * carry its end well into the region, and a nearer cut would make the field jump there).
   */
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
  /** Per style of the mix: its weight's share, and a salt for its draws (from its id, so the same style draws the same in any mix). */
  private readonly weights: number[];
  private readonly salts: number[];
  /** The regions of the home ground (`REGIONS.home`), by hash. */
  private readonly home = new Set<number>();

  constructor(seed: number, readonly mix: Mix) {
    this.seed = deriveSeed(seed, 'regions');
    const total = mix.reduce((a, [, w]) => a + w, 0);
    this.weights = mix.map(([, w]) => w / total);
    this.salts = mix.map(([id]) => hashString(id));
    // The home ground: the region round the origin, and every region whose feature point is near it.
    const S = REGIONS, probe = newNear();
    this.home.add(voronoiNear(this.seed, 0, 0, S.size, S.jitter, 0, probe).id);
    for (let z = -S.home - S.size; z <= S.home + S.size; z += S.size / 4) for (let x = -S.home - S.size; x <= S.home + S.size; x += S.size / 4) {
      const r = voronoiNear(this.seed, x / S.size, z / S.size, S.size, S.jitter, 0, probe);
      if (Math.hypot(r.px, r.pz) * S.size < S.home) this.home.add(r.id);
    }
  }

  /**
   * The style (an index into the mix) of the region with hash `id`. Each style draws a time
   * -ln(u) / weight and the earliest wins (so each wins its weight's share). The draws depend only
   * on the region and the style's id: changing one style's weight, or adding or taking out a style,
   * changes only the regions that style wins or loses, not the rest of the level.
   */
  styleOf(id: number): number {
    if (this.mix.length === 1 || this.home.has(id)) return 0;
    let best = 0, bt = Infinity;
    for (let i = 0; i < this.weights.length; i++) {
      const t = -Math.log(hashToFloat(hash2i(this.salts[i], id, 0x5e1)) + 1e-12) / this.weights[i];
      if (t < bt) { bt = t; best = i; }
    }
    return best;
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
      const o = out.others++;
      out.oids[o] = r.ids[i]; out.opx[o] = r.pxs[i] * S.size; out.opz[o] = r.pzs[i] * S.size; out.ostyles[o] = s;
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
