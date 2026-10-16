/**
 * The rift style (docs/design/level-styles.md; level-generator.md §3, tectonic): where the rock
 * was torn apart rather than dissolved or dug. Long faults run side by side across the level, all
 * one way (its grain), and each is a slot canyon: a few metres wide at the floor, tens of metres
 * tall, its walls leaning in and out as it rises and pinching shut at the top. Ledges run along
 * both walls at intervals of height, broken in places; boulders hang wedged between the walls high
 * up; now and then a cross-cut joins one fault to the next. Between the faults, solid rock.
 * Vertical and dizzying: the opposite of the karst's domes and the excavation's flat halls.
 *
 * In plan, each fault is a meandering line along u in a frame turned by the level's grain angle;
 * a column keeps the two faults nearest it (their union is exact, so nothing jumps where the
 * nearest one changes). Its envelope (E1) is a slowly rolling floor and the canyons' full height.
 *
 * Pure, like every style.
 */
import { Noise, deriveSeed, hash2i, hashToFloat, smoothstep } from '@futuremagic/core';
import type { Band } from './bands';
import { STANDARD, gene, type Traits, type Tuned } from './genes';
import { unworked, type Column, type Working } from './quarry';
import { GrainLines, grainOf } from './grainLines';
import { rockMix } from './rockTypes';
import type { Style, StyleId } from './style';
import { boxDist3 } from './shapes';

export const RIFT = {
  /** Faults lie this far apart, metres, each strayed by up to `jitter`, and meander by up to `meander[0]` over `meander[1]` metres. */
  spacing: 90,
  jitter: 16,
  meander: [15, 140] as const,
  /** A canyon's half width at the floor (min, extra), metres. */
  half: [2.6, 3.4] as const,
  /** Its height (min, extra), metres: the envelope's ceiling over the floor. */
  height: [32, 46] as const,
  /** Its walls lean in and out by up to this much, metres, over this much height. */
  lean: [1.2, 7] as const,
  /** Over the top this many metres it pinches shut, by this much half width per metre. */
  top: [16, 0.4] as const,
  /** Ledges: the first above the floor and the gaps between them (min, extra), how far they cut in (min, extra), the headroom on them, metres; they run in cells this long along a fault, this share of which has one. */
  ledge: { first: [5, 5] as const, gap: [8, 6] as const, depth: [1.6, 1.4] as const, clear: 2.4, cell: 30, chance: 0.6 },
  /** Cross-cuts to the next fault: one per cell this long with this chance; half width and height at the middle, metres. */
  cross: { cell: 120, chance: 0.35, half: 3, height: 6.5 },
  /** Wedged boulders: one per cell this long along a fault with this chance; how far above the floor their underside hangs (min, extra), metres. */
  stone: { cell: 45, chance: 0.4, under: [4, 18] as const },
  /** The floor: rolling by this much over this distance, and a nearer swell, metres. */
  floor: [10, 320, 2.5, 70] as const,
} as const;

/**
 * The rift's genes (src/gen/genes.ts): how a world's rift strays from ours. `spacing` how far apart
 * the faults lie (and how far they stray and wander); `width` how wide the canyons are; `height` how
 * tall; `lean` how far their walls lean in and out (over as much more height, so no wall steepens);
 * `ledges` and `stones` the share of ledge cells and of wedged boulders.
 */
export const RIFT_GENES = {
  spacing: gene('rift.spacing', 1, [0.8, 1.3], [0.6, 1.8]),
  width: gene('rift.width', 1, [0.8, 1.3], [0.6, 2.2]),
  height: gene('rift.height', 1, [0.8, 1.25], [0.5, 1.6]),
  lean: gene('rift.lean', 1, [0.7, 1.4], [0.3, 2]),
  ledges: gene('rift.ledges', RIFT.ledge.chance, [0.4, 0.75], [0, 1]),
  stones: gene('rift.stones', RIFT.stone.chance, [0.25, 0.55], [0, 0.9]),
} as const;

/** A ledge counts for no more than the canyon beside it this far off in height, metres (no more than the least gap between ledges). */
const LEDGE_REACH = 8;
/** A ledge's end counts this far along the wall at most, metres (less than a ledge cell). */
const LEDGE_GATE = 6;

/** What a rift column is to the code that asks about workings: natural rock, no pillar grid. */
const RIFT_WORKING: Working = { id: 0x72696674, angle: 0, spacing: 1e9, pillar: 0, floor: 0, height: 40, collapse: 0, cavern: true, cx: 0, cz: 0 };

/** A column's own data: the two faults nearest it, and the cross-cut between them. */
interface RiftColumn {
  u: number;
  /** Per fault (two): its index, the distance to its middle line, its half width at the floor and the phase of its walls' lean. */
  k: [number, number];
  dv: [number, number];
  w0: [number, number];
  phi: [number, number];
  /** How far inside a cross-cut the column is in plan, metres (negative: outside). */
  cross: number;
}

/** Scratch: the middle lines of the five faults round a column. */
const CS: number[] = new Array(5);

export class Rift implements Style {
  readonly id: StyleId = 'rift';
  /** The rock it is cut through (src/gen/rockTypes.ts). */
  readonly rocks = rockMix({ shale: 0.35, sandstone: 0.3, granite: 0.2, slate: 0.15 });
  /** Rust-grey on the map (M). */
  readonly mapFloor = [0.5, 0.42, 0.38] as const;
  private readonly noise: Noise;
  private readonly rough: Noise;
  private readonly cells: number;
  private readonly lines: GrainLines;
  private readonly own = new WeakMap<Column, RiftColumn>();
  /** Its numbers, its genes read (RIFT at the standard). */
  readonly R: Tuned<typeof RIFT>;

  constructor(readonly seed: number, readonly band: Band, traits: Traits = STANDARD) {
    const G = RIFT_GENES, sp = traits(G.spacing), w = traits(G.width), ht = traits(G.height), lean = traits(G.lean);
    this.R = {
      ...RIFT,
      spacing: RIFT.spacing * sp,
      jitter: RIFT.jitter * sp,
      meander: [RIFT.meander[0] * sp, RIFT.meander[1] * sp],
      half: [RIFT.half[0] * w, RIFT.half[1] * w],
      height: [RIFT.height[0] * ht, RIFT.height[1] * ht],
      lean: [RIFT.lean[0] * lean, RIFT.lean[1] * lean],
      ledge: { ...RIFT.ledge, chance: traits(G.ledges) },
      stone: { ...RIFT.stone, chance: traits(G.stones), under: [RIFT.stone.under[0], RIFT.stone.under[1] * ht] },
    };
    this.noise = new Noise(deriveSeed(seed, 'rift', 'shape'));
    this.rough = new Noise(deriveSeed(seed, 'rift', 'rough'));
    this.cells = deriveSeed(seed, 'rift', 'cells');
    const R = this.R;
    this.lines = new GrainLines(this.noise, this.cells, grainOf(seed, 'rift'), R.spacing, R.jitter, R.meander);
  }

  /** The envelope's floor at (x, z). */
  private floorAt(x: number, z: number): number {
    const F = this.R.floor, n = this.noise;
    return n.n2(x / F[1] + 3.1, z / F[1] - 7.7) * F[0] + n.n2(x / F[3] - 2.3, z / F[3] + 9.1) * F[2];
  }

  column(x: number, z: number, col: Column): Column {
    const R = this.R, n = this.noise;
    const u = this.lines.u(x, z), v = this.lines.v(x, z);
    let o = this.own.get(col);
    if (!o) { o = { u: 0, k: [0, 0], dv: [0, 0], w0: [0, 0], phi: [0, 0], cross: 0 }; this.own.set(col, o); }
    o.u = u;
    // The two nearest faults (the jitter and meander never let one pass its neighbour).
    const k0 = Math.round(v / R.spacing), cs = CS;
    let a = 0, da = Infinity, b = 0, db = Infinity, lo = k0 - 2;
    for (let i = 0; i < 5; i++) {
      const k = k0 - 2 + i, c = (cs[i] = this.lines.line(k, u)), d = Math.abs(v - c);
      if (c <= v) lo = k;
      if (d < da) { b = a; db = da; a = k; da = d; } else if (d < db) { b = k; db = d; }
    }
    o.k[0] = a; o.k[1] = b; o.dv[0] = da; o.dv[1] = db;
    for (let i = 0; i < 2; i++) {
      const k = o.k[i];
      o.w0[i] = R.half[0] + R.half[1] * (0.5 + 0.5 * n.n2(u / 60, k * 3.7 + 100));
      o.phi[i] = k * 1.7 + n.n2(u / 90, k * 5.3 - 40) * 1.5;
    }
    // The cross-cut between the two faults the column lies between, if one passes here.
    const clo = cs[lo - k0 + 2], chi = cs[lo - k0 + 3];
    o.cross = -Infinity;
    if (lo < k0 + 2) {
      const C = R.cross, ci = Math.floor(u / C.cell);
      for (let c = ci - 1; c <= ci + 1; c++) {
        const h = hash2i(this.cells ^ 0x3c5, lo, c);
        if (hashToFloat(h) >= C.chance) continue;
        const uc = (c + 0.15 + 0.7 * hashToFloat(h * 2654435761)) * C.cell;
        o.cross = Math.max(o.cross, Math.min(C.half - Math.abs(u - uc), v - clo, chi - v));
      }
    }
    col.floor = this.floorAt(x, z);
    col.ceiling = col.floor + R.height[0] + R.height[1] * (0.5 + 0.5 * n.n2(x / 260 - 4.4, z / 260 + 1.9));
    col.wall = Math.max(o.w0[0] - o.dv[0], o.w0[1] - o.dv[1], o.cross);
    unworked(col, RIFT_WORKING, 1000, 1);
    return col;
  }

  /** A fault's half width h metres over the floor, in a canyon `height` tall. */
  private half(w0: number, phi: number, h: number, height: number): number {
    const R = this.R;
    return w0 + R.lean[0] * (Math.sin(h / R.lean[1] + phi) - Math.sin(phi)) - R.top[1] * Math.max(0, h - (height - R.top[0]));
  }

  at(col: Column, x: number, y: number, z: number): number {
    const R = this.R, L = R.ledge, o = this.own.get(col)!;
    const h = y - col.floor, height = col.ceiling - col.floor;
    const cap = Math.min(h, col.ceiling - y);
    let d = -Infinity;
    for (let i = 0; i < 2; i++) {
      const k = o.k[i], w = this.half(o.w0[i], o.phi[i], h, height);
      // The canyon itself.
      const canyon = Math.min(w - o.dv[i], cap);
      d = Math.max(d, canyon);
      // The two ledges nearest in height: a shelf cut in, flat underfoot, with headroom over it.
      const first = L.first[0] + L.first[1] * hashToFloat(hash2i(this.cells, k, 2)), gap = L.gap[0] + L.gap[1] * hashToFloat(hash2i(this.cells, k, 3));
      const j0 = Math.floor((h - first) / gap);
      const depth = L.depth[0] + L.depth[1] * hashToFloat(hash2i(this.cells ^ 0x1ed, k, 0));
      for (let j = Math.max(0, j0 - 1); j <= j0 + 1; j++) {
        // (Held to the canyon's distance once LEDGE_REACH metres off in height, so the ledges not looked at never count.)
        const ly = first + j * gap, reach = canyon + Math.max(0, 0.75 * (LEDGE_REACH - Math.abs(h - ly - L.clear / 2)));
        d = Math.max(d, Math.min(this.half(o.w0[i], o.phi[i], ly, height) + depth - o.dv[i], this.ledgeGate(k, j, o.u), h - ly, ly + L.clear - h, col.ceiling - y, reach));
      }
    }
    // The cross-cut: a low, round-roofed passage across to the next fault.
    if (o.cross > -Infinity) {
      const roof = R.cross.height - 1.5 + 1.5 * Math.min(1, Math.max(0, o.cross / R.cross.half));
      d = Math.max(d, Math.min(o.cross, h, roof - h));
    }
    // Boulders wedged between the walls.
    d = Math.min(d, this.stones(o, col.floor, height, x, y, z));
    // Fractured walls, a little uneven underfoot.
    const up = smoothstep(0.4, 2.5, h);
    return d + this.rough.n3(x / 4, y / 6, z / 4) * 0.3 * up + this.rough.n3(x / 1.5, y / 1.5, z / 1.5) * 0.06;
  }

  /**
   * How far along the ledge j of fault k reaches past u, metres (negative: none there; never below
   * -LEDGE_GATE, so the ledges of the cells not looked at, further off than that, never count).
   */
  private ledgeGate(k: number, j: number, u: number): number {
    const L = this.R.ledge, ci = Math.floor(u / L.cell);
    let g = -LEDGE_GATE;
    for (let c = ci - 1; c <= ci + 1; c++) {
      const h = hash2i(this.cells ^ 0x7a1, k * 64 + j, c);
      if (hashToFloat(h) >= L.chance) continue;
      const a = (c + 0.25 * hashToFloat(h * 2654435761)) * L.cell, b = (c + 1 - 0.25 * hashToFloat(h * 40503)) * L.cell;
      g = Math.max(g, Math.min(u - a, b - u));
    }
    return g;
  }

  /** Distance to the nearest wedged boulder of the column's faults (Infinity: none near). */
  private stones(o: RiftColumn, floor: number, height: number, x: number, y: number, z: number): number {
    const S = this.R.stone, ci = Math.floor(o.u / S.cell);
    const u = o.u, v = this.lines.v(x, z);
    let d = Infinity;
    for (let i = 0; i < 2; i++) {
      const k = o.k[i];
      for (let c = ci - 1; c <= ci + 1; c++) {
        const hs = hash2i(this.cells ^ 0x570e, k, c);
        if (hashToFloat(hs) >= S.chance) continue;
        const f = (m: number) => hashToFloat(hash2i(hs, m, 9));
        const us = (c + 0.2 + 0.6 * f(1)) * S.cell, vs = this.lines.line(k, us);
        // Wedged: as wide as the canyon where it hangs, so it touches both walls.
        const w0 = this.R.half[0] + this.R.half[1] * (0.5 + 0.5 * this.noise.n2(us / 60, k * 3.7 + 100));
        const phi = k * 1.7 + this.noise.n2(us / 90, k * 5.3 - 40) * 1.5;
        const under = S.under[0] + S.under[1] * f(2);
        const r = Math.max(1.2, this.half(w0, phi, under + w0, height) + 0.6);
        // A rough block, not a ball: a box with rounded edges, turned its own way.
        const ys = floor + under + r, a = f(3) * Math.PI, ca = Math.cos(a), sa = Math.sin(a);
        const du = u - us, dv = v - vs, dy = y - ys, round = r * 0.3;
        const qx = Math.abs(du * ca + dv * sa) - r * (0.75 + 0.25 * f(4)) + round, qy = Math.abs(dy) - r * (0.55 + 0.2 * f(5)) + round, qz = Math.abs(-du * sa + dv * ca) - r * 0.85 + round;
        d = Math.min(d, boxDist3(qx, qy, qz) - round);
      }
    }
    return d;
  }

  color(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    const B = this.band, n = this.noise;
    // Tilted beds, banded light and dark, stained with iron low down where water ran.
    const v = this.lines.v(x, z);
    const bed = 0.5 + 0.5 * Math.sin((y + v * 0.35) / 2.6 + n.n2(x / 40, z / 40) * 2);
    const iron = smoothstep(6, 0, y - col.floor) * (0.5 + 0.5 * n.n2(x / 9, z / 9));
    const k = 0.78 + 0.3 * bed;
    out[o] = (B.rock[0] * k) * (1 + 0.25 * iron);
    out[o + 1] = (B.rock[1] * k) * (1 + 0.05 * iron);
    out[o + 2] = (B.rock[2] * k) * (1 - 0.15 * iron);
  }

  /** A passage from another style ends on the floor of the fault nearest (x, z) (E3). */
  portal(x: number, z: number): [number, number] {
    return this.lines.nearest(x, z);
  }

  climbable(): boolean {
    return true;
  }
}
