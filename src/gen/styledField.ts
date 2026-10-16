/**
 * The level's one field, put together from its styles (docs/design/level-styles.md): what bodies,
 * creatures, meshes and props read through `Level`. The region map (src/gen/regions.ts) says which
 * style owns each point; inside a region, away from other styles, the field is exactly that style's.
 *
 * Where styles meet, the edge contract (level-styles.md §2):
 * - E1, a shared envelope: each style's floor and ceiling are blended by share, and every style
 *   then answers with that floor and ceiling, so the ground ramps from one to the other.
 * - E2, shape fades: the field is the share-weighted sum of the styles' answers, each held within
 *   a limit of zero (so far-off rock of one style cannot outweigh the other's air, and the blend
 *   stays near 1-Lipschitz, E4). Their own things (pillars, props) stand only where their share is
 *   at least SHARE_OWN (src/gen/style.ts).
 * - E3, passable edges: between every two regions of different styles that share a border, a
 *   passage runs from one style's open space (`Style.portal`) through the middle of the border to
 *   the other's, whatever else the edge does there.
 * - E6: all of it pure.
 */
import { newColumn, type Column, type ColumnMix, type QuarryField } from './quarry';
import { REGIONS, Regions, newShares, type Mix, type Shares } from './regions';
import { BARE, NATURAL, SHARE_OWN, type Style } from './style';
import { putRocks, rockMix, type RockMix } from './rockTypes';
import { segDist } from './shapes';

/**
 * How far from zero the field counts (E4), on a level of more than one style: CLAMP metres on a
 * border between styles, growing GROW per metre (blend distance) away from it, up to where the
 * nearest region of another style is no longer told (REGIONS.far), everywhere the same beyond. So
 * far-off rock of one style cannot outweigh the other's air in a blend, every style's answer is
 * held to the same limit on both sides of the band's outer edge (no jump), and where the limit is
 * what counts, the field changes by no more than 2·GROW per metre (blend distance changes at most
 * twice as fast as position). That can be steeper than the field's own bound, but only where it is
 * at least CLAMP from zero, and there the limit only ever makes the distance smaller than it is:
 * whoever trusts it (sphere tracing, bodies, chunk skipping) steps shorter, never through rock. It
 * grows that fast so that big chunks of solid rock or open air near an edge are still far enough
 * from any surface to be skipped (src/gen/chunkMesh.ts); further than the limit from a surface,
 * nothing needs the exact distance.
 */
const CLAMP = 4, GROW = 1, MAX = CLAMP + GROW * (REGIONS.edge + REGIONS.far);
/** The passages between styles' regions (E3): half width, height at the walls and in the middle, how far in from the border they start looking for open space, metres. */
export const PASSAGE = { half: 5, wall: 3, crown: 5.5, into: 45 } as const;

/** Styles' weights at a point: `n` of them, `styles[i]` an index into the mix (the owner's first), `w[i]` its weight (they add up to 1). */
interface Weights {
  n: number;
  styles: number[];
  w: number[];
}

/** A passage between two regions: from a (open space in one) through m (the middle of their border) to b (open space in the other). */
interface Passage {
  ax: number; az: number;
  mx: number; mz: number;
  bx: number; bz: number;
}

export class StyledField {
  readonly regions: Regions;
  private readonly shares = newShares();
  /** The styles' weights in the field (see `weigh`). */
  private readonly weights: Weights = { n: 0, styles: [], w: [] };
  private readonly passages = new Map<string, Passage | null>();
  /** Scratch for blending a colour, a surface or a rock mix over a mix of styles. */
  private readonly sum = new Float64Array(8);
  /** The band's rock, for styles that do not say theirs. */
  private readonly bandRocks: RockMix;

  /**
   * `styles`: the level's styles, in the order of `mix` (one style: `mix` may be left out).
   * `excavation`: the excavation style among them, for what is its own business (workings, the
   * pillar grid; levels without one still have one, unused, for the water table).
   */
  constructor(readonly excavation: QuarryField, readonly styles: readonly Style[] = [excavation], mix: Mix = [[styles[0].id, 1]], seed = excavation.seed) {
    this.regions = new Regions(seed, mix);
    this.bandRocks = rockMix(excavation.band.rocks);
    if (styles.length > 1) {
      const probe = newShares();
      styles.forEach((s, i) => {
        s.share = (x, z) => {
          const sh = this.regions.sharesAt(x, z, probe);
          for (let j = 0; j < sh.n; j++) if (sh.styles[j] === i) return sh.w[j];
          return 0;
        };
        s.edge = (x, z) => this.regions.sharesAt(x, z, probe).edge;
      });
    }
  }

  /** Fill `col` with the y-independent part of the field at (x, z). */
  column(x: number, z: number, col: Column): Column {
    const sh = this.regions.sharesAt(x, z, this.shares), wt = this.weigh(sh);
    if (wt.n === 1) {
      this.styles[wt.styles[0]].column(x, z, col);
      col.style = wt.styles[0];
      col.mix = null;
      col.passage = this.inPassage(x, z, sh);
      col.clamp = this.clampAt(sh);
      return col;
    }
    const m: ColumnMix = col.mix ?? { n: 0, styles: [], w: [], cols: [] };
    let floor = 0, ceiling = 0, cavern = 0;
    for (let i = 0; i < wt.n; i++) {
      const c = (m.cols[i] ??= newColumn());
      this.styles[wt.styles[i]].column(x, z, c);
      m.styles[i] = wt.styles[i];
      m.w[i] = wt.w[i];
      floor += wt.w[i] * c.floor;
      ceiling += wt.w[i] * c.ceiling;
      cavern += wt.w[i] * c.cavern;
    }
    m.n = wt.n;
    for (let i = 0; i < m.n; i++) { m.cols[i].floor = floor; m.cols[i].ceiling = ceiling; }
    // To everyone asking about the column: the owner's, with the shared envelope.
    Object.assign(col, m.cols[0]);
    col.floor = floor;
    col.ceiling = ceiling;
    col.cavern = cavern;
    col.style = m.styles[0];
    col.mix = m;
    col.passage = this.inPassage(x, z, sh);
    col.clamp = this.clampAt(sh);
    return col;
  }

  /**
   * The styles' weights in the field, from their shares: a style with at most 1 - SHARE_OWN of a
   * point has none, the others what is left, in proportion. So wherever a style owns a point (E5:
   * its things stand there) the field is exactly its own, and its things fit it; the weights still
   * come in and go out continuously. (The owner keeps a weight: its share is never below a half
   * of two, a third of three.)
   */
  private weigh(sh: Shares): Weights {
    const out = this.weights, cut = 1 - SHARE_OWN;
    let n = 0, sum = 0;
    for (let i = 0; i < sh.n; i++) {
      const w = sh.w[i] - cut;
      if (w <= 0) continue;
      out.styles[n] = sh.styles[i];
      out.w[n++] = w;
      sum += w;
    }
    out.n = n;
    for (let i = 0; i < n; i++) out.w[i] /= sum;
    return out;
  }

  /** The field's limit (E4) at a point with these shares. */
  private clampAt(sh: Shares): number {
    return this.styles.length === 1 ? Infinity : Math.min(MAX, CLAMP + GROW * sh.edge);
  }

  /** How far inside any passage between styles (x, z) is, metres (-Infinity: none near). */
  private inPassage(x: number, z: number, sh: Shares): number {
    let best = -Infinity;
    for (let i = 0; i < sh.others; i++) {
      const p = this.passage(sh.id, sh.px, sh.pz, sh.styles[0], sh.oids[i], sh.opx[i], sh.opz[i], sh.ostyles[i]);
      if (!p) continue;
      best = Math.max(best, PASSAGE.half - Math.min(segDist(x, z, p.ax, p.az, p.mx, p.mz), segDist(x, z, p.mx, p.mz, p.bx, p.bz)));
    }
    return best;
  }

  /** The passage between regions a and b (the same asked from either), or null where they share no border. */
  private passage(a: number, ax: number, az: number, as: number, b: number, bx: number, bz: number, bs: number): Passage | null {
    if (a > b) return this.passage(b, bx, bz, bs, a, ax, az, as);
    const key = `${a},${b}`;
    let p = this.passages.get(key);
    if (p === undefined) {
      // The middle of their border: halfway between their feature points, if no other region is nearer there.
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, at = this.regions.regionAt(mx, mz);
      if (at.id !== a && at.id !== b) p = null;
      else {
        const into = (px: number, pz: number, s: number) => {
          const dx = px - mx, dz = pz - mz, d = Math.hypot(dx, dz) || 1, k = Math.min(PASSAGE.into, d * 0.8) / d;
          return this.styles[s].portal(mx + dx * k, mz + dz * k);
        };
        const [pax, paz] = into(ax, az, as), [pbx, pbz] = into(bx, bz, bs);
        p = { ax: pax, az: paz, mx, mz, bx: pbx, bz: pbz };
      }
      if (this.passages.size > 1024) this.passages.clear();
      this.passages.set(key, p);
    }
    return p;
  }

  /** Signed distance at height y in a column filled by `column`: positive in air. */
  at(col: Column, x: number, y: number, z: number): number {
    const m = col.mix;
    const k = col.clamp;
    let d = 0;
    if (!m) d = Math.max(-k, Math.min(k, this.styles[col.style].at(col, x, y, z)));
    else for (let i = 0; i < m.n; i++) d += m.w[i] * Math.max(-k, Math.min(k, this.styles[m.styles[i]].at(m.cols[i], x, y, z)));
    if (col.passage > -Infinity) {
      // The passage: air from the floor up to an arched roof, whatever rock the styles have there.
      const roof = col.floor + PASSAGE.wall + (PASSAGE.crown - PASSAGE.wall) * Math.min(1, Math.max(0, col.passage / PASSAGE.half));
      d = Math.max(d, Math.min(col.passage, y - col.floor, roof - y));
    }
    return d;
  }

  color(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    this.blend(col, out, o, 3, (st, c) => st.color(c, x, y, z, out, o));
  }

  /** How the rock is worked at a surface point (`Surface`), blended across edges like the colour. */
  surface(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    this.record('surface', NATURAL, col, x, y, z, out, o);
  }

  /** Which rock it is at a surface point (`RockMix`, eight numbers), blended across edges like the colour. */
  rocks(col: Column, out: Float32Array, o: number): void {
    this.blend(col, out, o, 8, (st) => putRocks(st.rocks ?? this.bandRocks, out, o));
  }

  /** What covers the rock at a surface point (`Cover`: moss, bark), blended across edges like the colour. */
  cover(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    this.record('cover', BARE, col, x, y, z, out, o);
  }

  /** A style's record at a point (its `surface` or `cover`, else `none`), blended across edges. */
  private record(key: 'surface' | 'cover', none: readonly number[], col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    this.blend(col, out, o, none.length, (st, c) => { const f = st[key]; if (f) f.call(st, c, x, y, z, out, o); else for (let k = 0; k < none.length; k++) out[o + k] = none[k]; });
  }

  /** `size` numbers at out[o] written by `one` for the column's style, or weighted over its mix of styles. */
  private blend(col: Column, out: Float32Array, o: number, size: number, one: (style: Style, col: Column) => void): void {
    const m = col.mix;
    if (!m) { one(this.styles[col.style], col); return; }
    const sum = this.sum;
    sum.fill(0);
    for (let i = 0; i < m.n; i++) {
      one(this.styles[m.styles[i]], m.cols[i]);
      for (let k = 0; k < size; k++) sum[k] += m.w[i] * out[o + k];
    }
    for (let k = 0; k < size; k++) out[o + k] = sum[k];
  }

  climbable(x: number, y: number, z: number): boolean {
    return this.styles[this.regions.styleAt(x, z)].climbable(x, y, z);
  }

  /** The water table at (x, z): one for the whole level, whatever the style (E5). */
  water(x: number, z: number): number {
    return this.excavation.water(x, z);
  }
}
