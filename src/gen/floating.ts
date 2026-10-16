/**
 * The floating islands (catalog §5, the third alien style; levels 61 and deeper): the floor of the
 * hall gives way to drops, round pits with no floor one can see, and in each drop islands of rock
 * hang in the void, flat-topped and mossy, tapering beneath to a point like turned-over mountains.
 * Natural arches join them to one another and to the drop's rim, so every island can be walked to;
 * a step off the edge is a long fall, and the field gives the level a way to say a body has fallen
 * out (`Style.drop`, `Level.fellOut`), so the game can bring it back to the last island it stood on.
 *
 * In plan, one drop per cell of a grid at most, its radius kept clear of the region's edges (the
 * other styles' ground, `Style.edge`) and of the arrival. Envelope (E1): the rim's rolling floor
 * and a high roof, the same over the drops (the void is the style's own shape, under its floor);
 * walkable ground over a drop is found by marching down (`Level.groundAt`).
 *
 * Pure, like every style.
 */
import { Noise, deriveSeed, hash2i, hashToFloat, smoothstep } from '@futuremagic/core';
import type { Band } from './bands';
import { STANDARD, gene, type Traits, type Tuned } from './genes';
import { unworked, type Column, type Working } from './quarry';
import { rockMix } from './rockTypes';
import { putSurface, type Style, type StyleId, type Surface } from './style';
import { taperDist, taperPlan, type Taper } from './caveThings';
import { glowCluster, scatter, type Dress, type GlowCluster } from './styleProps';

export const FLOATING = {
  /** One drop at most per cell this wide, metres, with this chance; its radius (min, extra), kept this far (blend distance) from another style's ground and this far from the arrival. */
  cell: 300,
  chance: 0.8,
  radius: [60, 70] as const,
  least: 34,
  clear: 110,
  home: 70,
  /** The void goes this far under the floor; the roof stands this high over it, metres. */
  depth: 90,
  height: 60,
  /** Islands per drop (min, extra); their radius and how deep they taper beneath (min, extra each), and their tops between these heights over the floor, metres. */
  islands: [4, 5] as const,
  size: [8, 10] as const,
  under: [12, 16] as const,
  tops: [-16, 2] as const,
  /** The arches: their radius, and how steep they may climb (rise over run). */
  arch: { radius: 2.6, slope: 0.4 },
  /** The floor: rolling by this much over this distance, metres. */
  floor: [3, 220] as const,
  /** Glowing lichen on the islands: the share of spots with a tuft, and the share of tufts that light the rock round them. */
  lichen: { chance: 0.05, bright: 0.25 },
} as const;

/**
 * The floating islands' genes (src/gen/genes.ts): how one deep world's void differs from another's.
 * Drops scales how wide the drops are, islands how many hang in each, size how big they are, spread
 * how far apart in height their tops lie.
 */
export const FLOATING_GENES = {
  drops: gene('floating.drops', 1, [0.85, 1.15], [0.7, 1.25]),
  islands: gene('floating.islands', 1, [0.75, 1.3], [0.5, 1.6]),
  size: gene('floating.size', 1, [0.85, 1.2], [0.7, 1.4]),
  spread: gene('floating.spread', 1, [0.7, 1.2], [0.4, 1.4]),
} as const;

/** Rock or air further than this from the void's edge, an island or an arch counts as this far, metres. */
const FAR = 16;

/** What a floating column is to the code that asks about workings: natural, no pillar grid. */
const VOID: Working = { id: 0x666c6f61, angle: 0, spacing: 1e9, pillar: 0, floor: 0, height: 60, collapse: 0, cavern: true, cx: 0, cz: 0 };

/** Natural broken rock. */
const RAW: Surface = [0, 0, 0, 0];

/** A tuft of lichen, glowing green. */
const LICHEN: GlowCluster = { n: 4, spread: 1.6, size: [0.1, 0.16], shape: [1.4, 0.6, 1.4], sit: 0.4, colour: [0.35, 0.95, 0.75] };

/** An island: its middle in plan, its top, radius and how deep it tapers beneath. */
export interface Island {
  x: number;
  z: number;
  top: number;
  r: number;
  under: number;
}

/** A drop: its middle and radius, the floor height its islands' tops were set from, its islands and the arches joining them. */
export interface Drop {
  x: number;
  z: number;
  r: number;
  islands: Island[];
  arches: Taper[];
}

/** A column's own data: the drop it is in or near (or none), and the islands and arches near it. */
interface FloatColumn {
  drop: Drop | null;
  /** Plan distance inside the drop's rim (negative outside). */
  inside: number;
  islands: Island[];
  arches: Taper[];
}

export class Floating implements Style {
  readonly id: StyleId = 'floating';
  /** Dark rock of the rim, paler islands (src/gen/rockTypes.ts). */
  readonly rocks = rockMix({ basalt: 0.4, slate: 0.35, limestone: 0.25 });
  /** Dark slate on the map (M). */
  readonly mapFloor = [0.32, 0.36, 0.42] as const;
  /** FLOATING as this level's genes read it. */
  readonly F: Tuned<typeof FLOATING>;
  /** Told by the field (`Style.share`, `Style.edge`): its drops keep to its own ground. */
  share?: (x: number, z: number) => number;
  edge?: (x: number, z: number) => number;
  /** The void under the floor (`Style.drop`). */
  readonly drop: number;
  private readonly noise: Noise;
  private readonly cells: number;
  private readonly spread: number;
  private readonly own = new WeakMap<Column, FloatColumn>();
  private readonly drops = new Map<number, Drop | null>();

  constructor(readonly seed: number, readonly band: Band, traits: Traits = STANDARD) {
    const G = FLOATING_GENES, d = traits(G.drops), n = traits(G.islands), s = traits(G.size);
    this.F = {
      ...FLOATING,
      radius: [FLOATING.radius[0] * d, FLOATING.radius[1] * d],
      islands: [Math.max(2, Math.round(FLOATING.islands[0] * n)), FLOATING.islands[1] * n],
      size: [FLOATING.size[0] * s, FLOATING.size[1] * s],
      under: [FLOATING.under[0] * s, FLOATING.under[1] * s],
    };
    this.spread = traits(G.spread);
    this.drop = FLOATING.depth;
    this.noise = new Noise(deriveSeed(seed, 'floating', 'shape'));
    this.cells = deriveSeed(seed, 'floating', 'cells');
  }

  /** The rim's floor at (x, z). */
  private floorAt(x: number, z: number): number {
    const F = this.F;
    return this.noise.n2(x / F.floor[1] + 5.3, z / F.floor[1] - 2.1) * F.floor[0];
  }

  /** The drop of cell (i, j), if it has one: placed, sized to keep clear of other styles and the arrival, its islands hung and joined. */
  dropOf(i: number, j: number): Drop | null {
    const key = hash2i(this.cells, i, j);
    let b = this.drops.get(key);
    if (b !== undefined) return b;
    const F = this.F, f = (m: number) => hashToFloat(hash2i(key, m, 9));
    b = null;
    if (f(0) < F.chance) {
      const x = (i + 0.3 + 0.4 * f(1)) * F.cell, z = (j + 0.3 + 0.4 * f(2)) * F.cell;
      // The widest it may be: within its cell, clear of the arrival, and of other styles' ground all round its rim.
      // (Its own ground there: wholly this style's, and that far from another's.)
      const clear = (px: number, pz: number) => (!this.share || this.share(px, pz) > 0.999) && (!this.edge || this.edge(px, pz) >= F.clear);
      let r = Math.min(F.radius[0] + F.radius[1] * f(3), F.cell * 0.3 - 20, Math.hypot(x, z) - F.home);
      if (!clear(x, z)) r = 0;
      for (let k = 0; k < 12 && r >= F.least; k++) {
        const a = (k / 12) * Math.PI * 2;
        while (r >= F.least && !clear(x + Math.cos(a) * (r + 6), z + Math.sin(a) * (r + 6))) r -= 6;
      }
      if (r >= F.least) b = this.hang(key, x, z, r);
      if (b && b.islands.length < 2) b = null;
    }
    if (this.drops.size > 1024) this.drops.clear();
    this.drops.set(key, b);
    return b;
  }

  /**
   * Hangs a drop's islands (none touching another or the rim) and joins them: the first to the rim,
   * each later one to the nearest island before it, the last back to the rim on the far side. Each
   * top is its neighbour's give or take what an arch may climb between them.
   */
  private hang(key: number, x: number, z: number, r: number): Drop {
    const F = this.F, g = (m: number) => hashToFloat(hash2i(key, m, 17));
    const base = this.floorAt(x, z), lo = base + F.tops[0] * this.spread, hi = base + F.tops[1];
    const islands: Island[] = [], arches: Taper[] = [];
    const want = F.islands[0] + Math.floor(F.islands[1] * g(0));
    for (let t = 0; t < want * 6 && islands.length < want; t++) {
      const ir = F.size[0] + F.size[1] * g(10 + t * 4);
      const a = g(11 + t * 4) * Math.PI * 2, d = Math.sqrt(g(12 + t * 4)) * (r - ir - 8);
      if (d < 0) continue;
      const ix = x + Math.cos(a) * d, iz = z + Math.sin(a) * d;
      if (islands.some((o) => Math.hypot(o.x - ix, o.z - iz) < o.r + ir + 8)) continue;
      islands.push({ x: ix, z: iz, top: 0, r: ir, under: F.under[0] + F.under[1] * g(13 + t * 4) });
    }
    // Nearest the rim first; the rim's entry where the first island faces it.
    const ea = islands.length ? Math.atan2(islands[0].z - z, islands[0].x - x) : 0;
    // (The rim's end of an arch sits on the brink, its back flush with the floor there.)
    const ex = x + Math.cos(ea) * (r - 1), ez = z + Math.sin(ea) * (r - 1);
    islands.sort((p, q) => Math.hypot(p.x - ex, p.z - ez) - Math.hypot(q.x - ex, q.z - ez));
    const A = F.arch, sag = A.radius - 0.4, flush = A.radius - 0.2;
    const climb = (from: number, run: number, k: number) => Math.min(hi, Math.max(lo, from + (g(k) * 2 - 1) * A.slope * run * this.spread));
    islands.forEach((p, n) => {
      // Joined from the rim (the first) or the nearest island before it.
      let ax = ex, az = ez, at = this.floorAt(ex, ez) + sag - flush, ar = 0;
      if (n > 0) {
        let best = 0;
        for (let m = 1; m < n; m++) if (Math.hypot(islands[m].x - p.x, islands[m].z - p.z) < Math.hypot(islands[best].x - p.x, islands[best].z - p.z)) best = m;
        const q = islands[best];
        ax = q.x; az = q.z; at = q.top; ar = q.r;
      }
      const span = Math.max(1, Math.hypot(p.x - ax, p.z - az) - ar - p.r);
      p.top = climb(at, span, 200 + n);
      // From the edge of one to the edge of the other (a little in, so the arch sits in the rock).
      const ux = (p.x - ax) / Math.max(1e-6, Math.hypot(p.x - ax, p.z - az)), uz = (p.z - az) / Math.max(1e-6, Math.hypot(p.x - ax, p.z - az));
      const sx = ax + ux * Math.max(0, ar - 2), sz = az + uz * Math.max(0, ar - 2), tx = p.x - ux * (p.r - 2), tz = p.z - uz * (p.r - 2);
      arches.push({ ax: sx, ay: at - sag, az: sz, bx: tx, by: p.top - sag, bz: tz, ra: A.radius, rb: A.radius });
    });
    // The last island back to the rim on its far side, if it can climb there.
    const last = islands[islands.length - 1];
    if (islands.length > 2) {
      const la = Math.atan2(last.z - z, last.x - x), rx = x + Math.cos(la) * (r - 1), rz = z + Math.sin(la) * (r - 1), rt = this.floorAt(rx, rz) + sag - flush;
      const run = Math.max(1, Math.hypot(rx - last.x, rz - last.z) - last.r);
      if (Math.abs(rt - last.top) <= A.slope * run) {
        const ux = (rx - last.x) / Math.hypot(rx - last.x, rz - last.z), uz = (rz - last.z) / Math.hypot(rx - last.x, rz - last.z);
        arches.push({ ax: last.x + ux * (last.r - 2), ay: last.top - sag, az: last.z + uz * (last.r - 2), bx: rx, by: rt - sag, bz: rz, ra: A.radius, rb: A.radius });
      }
    }
    return { x, z, r, islands, arches };
  }

  column(x: number, z: number, col: Column): Column {
    const F = this.F;
    let o = this.own.get(col);
    if (!o) { o = { drop: null, inside: -Infinity, islands: [], arches: [] }; this.own.set(col, o); }
    col.floor = this.floorAt(x, z);
    col.ceiling = col.floor + F.height;
    o.drop = null; o.inside = -Infinity; o.islands.length = 0; o.arches.length = 0;
    const ci = Math.floor(x / F.cell), cj = Math.floor(z / F.cell);
    // The nearest drop (each lies within its own cell, apart from the others), and what of it is near.
    for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) {
      const d = this.dropOf(i, j), inside = d ? d.r - Math.hypot(x - d.x, z - d.z) : -Infinity;
      if (d && inside > o.inside) { o.inside = inside; o.drop = d; }
    }
    const d = o.drop;
    if (d && o.inside > -2 * FAR) {
      // (An island further than this in plan is FAR or more away: see `islandDist`.)
      for (const p of d.islands) if ((Math.hypot(x - p.x, z - p.z) - p.r) * (p.under / Math.hypot(p.under, p.r)) < 2 * FAR) o.islands.push(p);
      for (const a of d.arches) if (taperPlan(a, x, z) < FAR) o.arches.push(a);
    }
    col.wall = Infinity;
    unworked(col, VOID, 1000, 1);
    return col;
  }

  at(col: Column, x: number, y: number, z: number): number {
    const o = this.own.get(col)!, h = y - col.floor, cap = col.ceiling - y;
    // The hall over the floor, and the drop's void under it.
    let d = Math.min(cap, Math.max(h, Math.min(o.inside, y - (col.floor - this.drop))));
    // The islands (cones turned over, flat on top) and the arches are rock in it.
    for (const p of o.islands) d = Math.min(d, Math.max(islandDist(p, x, y, z), -FAR));
    for (const a of o.arches) d = Math.min(d, Math.max(taperDist(a, x, y, z), -FAR));
    return Math.min(FAR, Math.max(d, -FAR));
  }

  color(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    const n = this.noise, own = this.own.get(col), h = y - col.floor;
    const k = 0.85 + 0.25 * n.n2(x / 7 + y / 11, z / 7 - y / 9);
    // Dark blue-grey rock; the islands paler, bleached towards their tops, streaked with rust beneath.
    const isl = own && own.drop && y < col.floor + 4 && h > -this.drop + 2 && own.inside > 0 ? smoothstep(-3, -0.5, -nearestIsland(own, x, y, z)) : 0;
    const streak = isl * smoothstep(0.55, 0.85, n.n2(x / 1.8, z / 1.8 + y / 9)) * smoothstep(0, -6, y - col.floor);
    out[o] = (0.17 + 0.2 * isl + 0.18 * streak) * k;
    out[o + 1] = (0.19 + 0.19 * isl + 0.06 * streak) * k;
    out[o + 2] = (0.23 + 0.14 * isl) * k;
  }

  surface(_col: Column, _x: number, _y: number, _z: number, out: Float32Array, o: number): void {
    putSurface(RAW, out, o);
  }

  /** Moss on the islands' tops and the arches' backs, the rim bare. */
  cover(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    const own = this.own.get(col);
    const moss = own && own.drop && own.inside > 0 && y > col.floor - this.drop + 4 ? 0.85 * smoothstep(0.2, 0.6, this.noise.n2(x / 6, z / 6) * 0.5 + 0.5) : 0;
    out[o] = moss; out[o + 1] = 0;
  }

  /** A passage from another style ends on the rim, never over a drop (E3). */
  portal(x: number, z: number): [number, number] {
    const F = this.F, d = this.dropOf(Math.floor(x / F.cell), Math.floor(z / F.cell));
    if (!d) return [x, z];
    const r = Math.hypot(x - d.x, z - d.z);
    if (r > d.r + 8) return [x, z];
    const ux = r > 1e-6 ? (x - d.x) / r : 1, uz = r > 1e-6 ? (z - d.z) / r : 0;
    return [d.x + ux * (d.r + 12), d.z + uz * (d.r + 12)];
  }

  /** Tufts of glowing lichen on the islands, the bright ones lighting the rock round them. */
  props(d: Dress): void {
    const L = this.F.lichen;
    scatter(d, 2.5, 0xf10a, 1, (x, z, g, r) => {
      if (r(3) >= L.chance || g > this.floorAt(x, z) + 6) return;
      glowCluster(d, x, z, g, r, LICHEN, r(4) < L.bright);
    });
  }

  climbable(): boolean {
    return true;
  }
}

/**
 * Distance to an island: a cone turned over, flat on top (positive outside; a bound, steeper sides
 * read shorter). Never less than half its plan distance beyond the rim times the side's slope, k.
 */
export function islandDist(p: Island, x: number, y: number, z: number): number {
  const q = p.top - y, r = Math.hypot(x - p.x, z - p.z), k = p.under / Math.hypot(p.under, p.r);
  return Math.max(-q, (r - p.r * (1 - q / p.under)) * k);
}

/** Distance to the nearest island in a column's list (Infinity: none near). */
function nearestIsland(o: FloatColumn, x: number, y: number, z: number): number {
  let d = Infinity;
  for (const p of o.islands) d = Math.min(d, islandDist(p, x, y, z));
  for (const a of o.arches) d = Math.min(d, taperDist(a, x, y, z));
  return d;
}
