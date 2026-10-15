/**
 * The basalt columns style (catalog §3.5): where a thick flow cooled slowly and cracked into
 * hexagonal columns. The whole floor is a field of column tops, each a step above or below its
 * neighbours (walkable, or a small climb); towards the walls the columns rise like giant stairs,
 * and the walls themselves are the columns standing to the roof (organ pipes). The roof is flat
 * and high. Black-grey basalt, every column a shade of its own, pale rims round the tops: the only
 * style stepped everywhere, and the most regular.
 *
 * The columns stand on a hexagonal grid; each is a prism, solid from below up to its own top (the
 * air's field is the nearest one's max(its hexagon's plan distance, y − top), within the
 * 1-Lipschitz bound; inside the rock, the nearest air's over a column, max(plan distance, top − y)).
 * A column keeps the prisms within REACH of it in plan, and the field is capped at REACH, so one
 * that drops out of the list changes nothing; deep under the floor the floor itself bounds it. Which cells are open floor and which stairs or wall
 * is slow noise read at each cell's middle. Envelope (E1): a rolling floor under the tops, the
 * flat roof.
 *
 * Pure, like every style.
 */
import { Noise, deriveSeed, hash2i, hashToFloat, smoothstep } from '@futuremagic/core';
import type { Band } from './bands';
import { unworked, type Column, type Working } from './quarry';
import { rockMix } from './rockTypes';
import type { Style, StyleId } from './style';

export const BASALT = {
  /** A column's half width across its flats, metres (the catalog's 1–2.5 m would vanish in the 1 m mesh; a pale rim round each top shows the hexagons). */
  half: 2,
  /** A top stands within this much of the floor, up or down, metres. */
  step: 0.5,
  /** The floor rolls by this much over this distance, metres. */
  floor: [10, 260] as const,
  /** The roof over the floor, metres (min, extra). */
  roof: [12, 7] as const,
  /** Open floor where the plan noise is over `open`; under it the columns rise by `stair` metres for every `per` of noise, up to the roof. */
  open: -0.12,
  stair: 1.4,
  per: 0.07,
  /** The plan noise's scales, metres. */
  plan: [80, 26] as const,
} as const;

/** A column's field reaches this far in plan, metres; the field is capped at it (far enough that whole chunks of air or rock are skipped). */
const REACH = 14;
/** The floor (and so the columns' tops) falls no steeper than this, so the air beyond REACH is no nearer than (floor − y) / (1 + this). */
const FLOOR_SLOPE = 0.5;
/** Colour looks at the columns this near in plan, metres. */
const NEAR = 3;

const SQRT3 = Math.sqrt(3);

/** What a basalt column is to the code that asks about workings: natural rock, no pillar grid. */
const FLOW: Working = { id: 0x62617361, angle: 0, spacing: 1e9, pillar: 0, floor: 0, height: 14, collapse: 0, cavern: true, cx: 0, cz: 0 };

/** A column near a column of the field: its plan distance (negative inside), its top, its shade. */
interface Prism {
  d: number;
  top: number;
  shade: number;
}

export class Basalt implements Style {
  readonly id: StyleId = 'basalt';
  /** The rock it is cut through (src/gen/rockTypes.ts). */
  readonly rocks = rockMix({ basalt: 0.7, slate: 0.2, granite: 0.1 });
  /** Slate on the map (M). */
  readonly mapFloor = [0.4, 0.42, 0.45] as const;
  private readonly noise: Noise;
  private readonly cells: number;
  private readonly own = new WeakMap<Column, { near: Prism[]; high: Prism[]; low: Prism[] }>();
  /** Tops already worked out, by cell (exact for cells within 100 km). */
  private readonly tops = new Map<number, number>();

  constructor(readonly seed: number, readonly band: Band) {
    this.noise = new Noise(deriveSeed(seed, 'basalt', 'shape'));
    this.cells = deriveSeed(seed, 'basalt', 'cells');
  }

  /** The rolling floor under the tops. */
  private floor(x: number, z: number): number {
    const F = BASALT.floor;
    return this.noise.n2(x / F[1] + 3.1, z / F[1] - 7.7) * F[0];
  }

  /** The plan noise: open floor over BASALT.open, stairs and wall under it. */
  private plan(x: number, z: number): number {
    const P = BASALT.plan, n = this.noise;
    return n.n2(x / P[0] - 4.4, z / P[0] + 2.2) + 0.4 * n.n2(x / P[1] + 9.1, z / P[1] - 5.3);
  }

  /** The roof over the floor at (x, z). */
  private roofOver(x: number, z: number): number {
    const R = BASALT.roof;
    return R[0] + R[1] * (0.5 + 0.5 * this.noise.n2(x / 200 - 6.6, z / 200 + 1.9));
  }

  /** Cell (i, j)'s middle: the grid of hexagons with flats facing ±z and ±60°. */
  private middle(i: number, j: number): [number, number] {
    const a = BASALT.half;
    return [i * SQRT3 * a, (i + 2 * j) * a];
  }

  /** Cell (i, j)'s top: on the floor, a step up or down, and up the stairs where the plan closes in. */
  private top(i: number, j: number, mx: number, mz: number): number {
    const B = BASALT, h = hash2i(this.cells, i, j);
    const key = (i + 0x8000) * 0x10000 + (j + 0x8000);
    const known = this.tops.get(key);
    if (known !== undefined) return known;
    const step = Math.max(-1, Math.min(1, this.noise.n2(mx / 14 + 0.7, mz / 14 - 3.3) * 1.2 + (hashToFloat(h) - 0.5) * 0.9)) * B.step;
    const shut = B.open - this.plan(mx, mz);
    const rise = shut > 0 ? Math.ceil(shut / B.per) * B.stair : 0;
    const top = this.floor(mx, mz) + step + Math.min(rise, 60);
    if (this.tops.size > 65536) this.tops.clear();
    this.tops.set(key, top);
    return top;
  }

  column(x: number, z: number, col: Column): Column {
    const a = BASALT.half;
    let o = this.own.get(col);
    if (!o) { o = { near: [], high: [], low: [] }; this.own.set(col, o); }
    const all: Prism[] = [];
    const env = this.floor(x, z);
    col.floor = env - BASALT.step;
    col.ceiling = env + this.roofOver(x, z);
    let wall = Infinity;
    const i0 = Math.round(x / (SQRT3 * a));
    for (let i = i0 - 5; i <= i0 + 5; i++) {
      const j0 = Math.round((z / a - i) / 2);
      for (let j = j0 - 5; j <= j0 + 5; j++) {
        const [mx, mz] = this.middle(i, j), d = hexagon(x - mx, z - mz, a);
        if (d >= REACH) continue;
        const top = this.top(i, j, mx, mz);
        all.push({ d, top, shade: hashToFloat(hash2i(this.cells ^ 0x5ade, i, j)) });
        if (top > col.ceiling) wall = Math.min(wall, d);
      }
    }
    // Only the columns no nearer one beats count: for the air, those higher than every nearer one; for the rock, those lower.
    all.sort((p, q) => p.d - q.d);
    o.near.length = o.high.length = o.low.length = 0;
    let hi = -Infinity, lo = Infinity;
    for (const p of all) {
      if (p.d < NEAR) o.near.push(p);
      if (p.top > hi) { hi = p.top; o.high.push(p); }
      if (p.top < lo) { lo = p.top; o.low.push(p); }
    }
    col.wall = wall;
    unworked(col, FLOW, 1000, 1);
    return col;
  }

  at(col: Column, _x: number, y: number, _z: number): number {
    const o = this.own.get(col)!;
    // In the air: how far to the nearest column, below its top or beside it.
    let air = REACH;
    for (const p of o.high) air = Math.min(air, Math.max(p.d, y - p.top));
    if (air > 0) return Math.min(air, col.ceiling - y);
    // In a column: how far to the air over the nearest one (and the air further off is over the floor).
    let rock = Math.max(REACH, (col.floor - y) / (1 + FLOOR_SLOPE));
    for (const p of o.low) rock = Math.min(rock, Math.max(p.d, p.top - y));
    return Math.min(-rock, col.ceiling - y);
  }

  color(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    const B = this.band, near = this.own.get(col)?.near;
    // The column this point is on: the one whose prism is nearest.
    let best: Prism | null = null, bd = Infinity;
    for (const p of near ?? []) { const d = Math.max(p.d, y - p.top); if (Math.abs(d) < bd) { bd = Math.abs(d); best = p; } }
    if (!best) { out[o] = out[o + 1] = out[o + 2] = 0.15; return; }
    // Black-grey, a shade of its own; dark joints between columns; a pale rim round each top.
    const k = 0.6 + 0.8 * best.shade + 0.1 * this.noise.n2(x / 2 + y, z / 2 - y);
    const onTop = smoothstep(-0.5, -0.1, y - best.top);
    const joint = smoothstep(-0.6, -0.1, best.d) * (1 - onTop);
    const rim = onTop * smoothstep(-0.8, -0.4, best.d);
    for (let c = 0; c < 3; c++) {
      const stone = (0.17 + B.rock[c] * 0.08) * k * (1 - 0.5 * joint);
      out[o + c] = stone * (1 - rim) + (0.55 + B.rock[c] * 0.08) * rim;
    }
  }

  /** A passage from another style ends on open floor near (x, z) (E3). */
  portal(x: number, z: number): [number, number] {
    const want = BASALT.open + 0.15;
    for (let r = 0; r < 600; r += 8) {
      const steps = Math.max(1, Math.round((r * Math.PI * 2) / 8));
      for (let s = 0; s < steps; s++) {
        const t = (s / steps) * Math.PI * 2, px = x + Math.cos(t) * r, pz = z + Math.sin(t) * r;
        if (this.plan(px, pz) > want) return [px, pz];
      }
    }
    return [x, z];
  }

  climbable(): boolean {
    return true;
  }
}

/** Plan distance from (x, z) to a hexagon round the origin with flats facing ±z and ±60°, `a` from its middle to a flat (negative inside). */
function hexagon(x: number, z: number, a: number): number {
  const qx = Math.abs(x), qz = Math.abs(z);
  return Math.max(qx * (SQRT3 / 2) + qz * 0.5, qz) - a;
}
