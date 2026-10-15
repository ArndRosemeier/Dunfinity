/**
 * The flooded galleries style (catalog §2.4, a sump style): half-drowned tubes where the water table
 * and the roof nearly meet. Air bells, round domed chambers each with a beach of its own, stand
 * 30–60 m apart, joined by tubes. Most tubes are sumps: you swim with your head in a narrow gap
 * under the roof, a metre or so. The rest are galleries, high enough to stand in, with a ledge
 * along one wall just over the water to walk on. Dark wet rock, pale calcite where the water stood
 * a long time.
 *
 * Everything hangs off the level's one water table (E5: the style does not own water; it sets its
 * floors and roofs against the table). In plan, the bells stand one to a cell of a jittered grid,
 * and the tubes join them as the grid tree does (src/gen/gridTree.ts): all are joined, and some
 * more. A column keeps the bells and tubes within FAR of it; each is air over its own floor and
 * under its own roof, and their union is the cave. Envelope (E1): the floors, weighted by how far
 * in one is, and a roof over all of them that no feature leaving the list can lower.
 *
 * Pure, like every style.
 */
import { Noise, deriveSeed, hash2i, hashToFloat, smoothstep } from '@futuremagic/core';
import type { Band } from './bands';
import { joined } from './gridTree';
import { unworked, type Column, type Working } from './quarry';
import type { Style, StyleId } from './style';

export const FLOODED = {
  /** One air bell to a cell this wide, metres, strayed by up to `jitter` of it; its radius (min, extra) and dome over the water (min, extra). */
  cell: 46,
  jitter: 0.3,
  bell: [8, 5] as const,
  dome: [5, 6] as const,
  /** A bell's beach: this much of its radius across, standing this high over the water, its edge sloping down at `slope` into the pool `pool` deep. */
  beach: { r: 0.7, over: 0.35, slope: 1.2, pool: 2.6 },
  /** Tubes: half width (min, extra), metres; how deep under the water their floor lies; the chance of one besides those joining everything. */
  tube: { half: [2.6, 1.6] as const, deep: 2.8, extra: 0.3 },
  /** A sump's gap between the water and its roof, metres (min, extra), changing slowly along it. */
  gap: [0.5, 1] as const,
  /** The share of tubes that are galleries; a gallery's roof over the water, its ledge's height over the water and width, metres. */
  gallery: { share: 0.35, roof: 3.6, ledge: 0.25, width: 1.6 },
} as const;

/** Rock further than this from a bell or tube counts as this far, metres; every feature this near is looked at. */
const FAR = 20;
/** The envelope's roof falls away from a feature no steeper than this. */
const FALL = 0.75;

/** What a gallery column is to the code that asks about workings: natural rock, no pillar grid. */
const SUMP: Working = { id: 0x73756d70, angle: 0, spacing: 1e9, pillar: 0, floor: 0, height: 6, collapse: 0, cavern: true, cx: 0, cz: 0 };

/** The level's water table at (x, z) (src/gen/quarry.ts `water`). */
export type WaterTable = (x: number, z: number) => number;

/** A bell or a tube near a column: how far in from its wall in plan, its floor and roof over the water there. */
interface Near {
  inside: number;
  floor: number;
  roof: number;
}

interface Bell {
  x: number;
  z: number;
  r: number;
  dome: number;
  /** The beach's middle. */
  bx: number;
  bz: number;
}

export class Flooded implements Style {
  readonly id: StyleId = 'flooded';
  /** Deep water on the map (M). */
  readonly mapFloor = [0.3, 0.42, 0.48] as const;
  private readonly noise: Noise;
  private readonly cells: number;
  private readonly bells = new Map<number, Bell>();
  private readonly own = new WeakMap<Column, { near: Near[]; water: number }>();

  constructor(readonly seed: number, readonly band: Band, private readonly water: WaterTable) {
    this.noise = new Noise(deriveSeed(seed, 'flooded', 'shape'));
    this.cells = deriveSeed(seed, 'flooded', 'cells');
  }

  /** The air bell of cell (i, j). */
  private bell(i: number, j: number): Bell {
    const key = (i + 0x8000) * 0x10000 + (j + 0x8000);
    let b = this.bells.get(key);
    if (!b) {
      const F = FLOODED, h = hash2i(this.cells, i, j), f = (k: number) => hashToFloat(hash2i(h, k, 7));
      const x = (i + 0.5 + (f(0) - 0.5) * 2 * F.jitter) * F.cell, z = (j + 0.5 + (f(1) - 0.5) * 2 * F.jitter) * F.cell;
      const r = F.bell[0] + F.bell[1] * f(2), a = f(3) * Math.PI * 2;
      b = { x, z, r, dome: F.dome[0] + F.dome[1] * f(4), bx: x + Math.cos(a) * r * 0.35, bz: z + Math.sin(a) * r * 0.35 };
      if (this.bells.size > 16384) this.bells.clear();
      this.bells.set(key, b);
    }
    return b;
  }

  column(x: number, z: number, col: Column): Column {
    const F = FLOODED, n = this.noise;
    let o = this.own.get(col);
    if (!o) { o = { near: [], water: 0 }; this.own.set(col, o); }
    o.near.length = 0;
    const w = this.water(x, z);
    o.water = w;
    const i0 = Math.floor(x / F.cell), j0 = Math.floor(z / F.cell);
    // Bells within reach, and the tubes from each node of a wider window to its neighbours along x and z.
    for (let j = j0 - 2; j <= j0 + 2; j++) for (let i = i0 - 2; i <= i0 + 2; i++) {
      const b = this.bell(i, j);
      const inB = b.r - Math.hypot(x - b.x, z - b.z);
      if (inB > -FAR) {
        // The beach: dry ground round its middle, sloping into the pool.
        const beach = Math.min(F.beach.over, -F.beach.pool + F.beach.slope * (b.r * F.beach.r - Math.hypot(x - b.bx, z - b.bz)));
        o.near.push({ inside: inB, floor: Math.max(-F.beach.pool, beach), roof: F.beach.over + 1.5 + Math.min(Math.max(inB, 0) * 1.1, b.dome) });
      }
      for (let axis = 0; axis < 2; axis++) {
        if (!joined(this.cells, i, j, axis, F.tube.extra)) continue;
        const c = axis ? this.bell(i, j + 1) : this.bell(i + 1, j);
        // (From rim to rim, so it does not cut under a bell's beach.)
        const ex = c.x - b.x, ez = c.z - b.z, l2 = ex * ex + ez * ez, len = Math.sqrt(l2);
        const t = Math.max(b.r / len, Math.min(1 - c.r / len, ((x - b.x) * ex + (z - b.z) * ez) / l2));
        const th = hash2i(this.cells ^ 0x7b, i * 2 + axis, j), half = F.tube.half[0] + F.tube.half[1] * hashToFloat(th);
        const inT = half - Math.hypot(x - b.x - ex * t, z - b.z - ez * t);
        if (inT <= -FAR) continue;
        if (hashToFloat(hash2i(th, 1, 1)) < F.gallery.share) {
          // A gallery: deep water but for a ledge along one wall; a roof to stand under.
          const G = F.gallery, side = hashToFloat(hash2i(th, 2, 1)) < 0.5 ? 1 : -1;
          const across = ((x - b.x) * -ez + (z - b.z) * ex) / Math.hypot(ex, ez) * side;
          const ledge = Math.min(G.ledge, -F.tube.deep + 1.2 * (across - (half - G.width)));
          o.near.push({ inside: inT, floor: Math.max(-F.tube.deep, ledge), roof: G.ledge - 0.5 + Math.min(Math.max(inT, 0), G.roof) });
        } else {
          // A sump: the roof just over the water, arched a little, dipping under it at the walls.
          const gap = F.gap[0] + F.gap[1] * (0.5 + 0.5 * n.n2(x / 40 + i * 0.7, z / 40 - j * 0.3));
          o.near.push({ inside: inT, floor: -F.tube.deep, roof: -0.4 + Math.min(Math.max(inT, 0), gap + 0.4) });
        }
      }
    }
    // The envelope: floors weighted by how far in each feature is; a roof over all of them, falling away outside each no steeper than FALL.
    // (A little weight on the tubes' depth, so a feature coming into reach with no weight changes nothing.)
    let wsum = 0.5, fsum = -0.5 * F.tube.deep, roof = -FAR;
    for (const p of o.near) {
      const k = Math.max(0, p.inside + 4);
      wsum += k; fsum += k * p.floor;
      roof = Math.max(roof, p.roof + FALL * Math.min(0, p.inside));
    }
    col.floor = w + fsum / wsum;
    col.ceiling = w + Math.max(roof, -F.tube.deep + 1) + 0.5;
    col.wall = Infinity;
    unworked(col, SUMP, 1000, 1);
    return col;
  }

  at(col: Column, _x: number, y: number, _z: number): number {
    const o = this.own.get(col)!, h = y - o.water;
    let d = -FAR;
    for (const p of o.near) d = Math.max(d, Math.min(p.inside, h - p.floor, p.roof - h));
    return d;
  }

  color(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    const B = this.band, n = this.noise, own = this.own.get(col), h = own ? y - own.water : 1;
    // Pale calcite in a band where the water stood, dark and wet above, darker under.
    const calcite = smoothstep(-0.5, -0.1, h) * (1 - smoothstep(0.3, 0.9, h + 0.2 * n.n2(x / 3, z / 3)));
    const under = 1 - smoothstep(-0.8, -0.2, h);
    for (let c = 0; c < 3; c++) {
      const wet = (0.12 + B.rock[c] * 0.18) * (1 - 0.35 * under) + (c === 2 ? 0.02 : 0);
      out[o + c] = wet * (1 - calcite) + (0.62 + B.rock[c] * 0.1) * calcite;
    }
  }

  /** A passage from another style ends on the beach of the nearest air bell (E3). */
  portal(x: number, z: number): [number, number] {
    const b = this.bell(Math.floor(x / FLOODED.cell), Math.floor(z / FLOODED.cell));
    return [b.bx, b.bz];
  }

  climbable(): boolean {
    return true;
  }
}
