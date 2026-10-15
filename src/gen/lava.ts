/**
 * The lava tube style (catalog §3.1): where molten rock once ran underground and drained away.
 * Long round tunnels side by side across the level, all one way (its grain), meandering slowly:
 * a circle 8–18 m across, cut flat at the floor where the last flow cooled into a level glassy
 * floor, with benches along the walls where the flow stood for a while. Now and then a smaller
 * tube branches across to the next; here and there a skylight rises from the roof, a round shaft
 * where the crust fell in. Black basalt, ropey floors, rust-red crusts; on hot levels the floor
 * still glows through its cracks. Smooth and round: uniform headroom, the strongest grain.
 *
 * In plan, each tube is a meandering line along u in a frame turned by the level's grain angle;
 * a column keeps the two nearest (their union is exact, so nothing jumps where the nearest one
 * changes), the branch between them, and their skylights. Envelope (E1): a rolling floor and the
 * tubes' roofs (a bound over the round roof, so it never cuts it).
 *
 * Pure, like every style.
 */
import { Noise, deriveSeed, hash2i, hashToFloat, smoothstep } from '@futuremagic/core';
import type { Band } from './bands';
import { unworked, type Column, type Working } from './quarry';
import { GrainLines, grainOf } from './grainLines';
import { rockMix } from './rockTypes';
import type { Style, StyleId } from './style';
import { propModel } from './models';
import { roofOver, scatter, type Dress } from './styleProps';

export const LAVA = {
  /** Tubes lie this far apart, metres, each strayed by up to `jitter`, meandering by up to `meander[0]` over `meander[1]` metres. */
  spacing: 60,
  jitter: 6,
  meander: [10, 170] as const,
  /** A tube's radius (min, extra), changing slowly along it; its middle stands this much of its radius over the floor. */
  radius: [4, 5] as const,
  middle: 0.6,
  /** Benches: their top this much of the radius over the floor; where there is one, it reaches in to this much of the radius from the middle. */
  bench: { top: 0.35, reach: 0.6 },
  /** Branches to the next tube: one per cell this long with this chance; radius, metres; they run this far along u. */
  branch: { cell: 150, chance: 0.5, radius: 3.5, run: 50 },
  /** Skylights: one per cell this long along a tube with this chance; radius (min, extra), metres. (They rise into a dome about ten metres over the roof: the envelope's own slope.) */
  skylight: { cell: 180, chance: 0.45, radius: [3, 3] as const },
  /** The floor: rolling by this much over this distance, metres. */
  floor: [8, 300] as const,
  /** The chance a level's tubes are still hot. */
  hot: 0.5,
} as const;

/** Rock further than this from a tube counts as this far, metres. */
const FAR = 10;

/** What a lava tube column is to the code that asks about workings: natural rock, no pillar grid. */
const TUBE: Working = { id: 0x6c617661, angle: 0, spacing: 1e9, pillar: 0, floor: 0, height: 12, collapse: 0, cavern: true, cx: 0, cz: 0 };

/** A column's own data: the two nearest tubes (distance across, radius, bench reach), the branch, the skylights. */
interface TubeColumn {
  across: [number, number];
  r: [number, number];
  bench: [number, number];
  /** How far inside the branch between the two tubes in plan (negative: outside). */
  branch: number;
  /** How far inside the nearest skylight in plan. */
  sky: number;
}

export class Lava implements Style {
  readonly id: StyleId = 'lava';
  /** The rock it is cut through (src/gen/rockTypes.ts). */
  readonly rocks = rockMix({ basalt: 0.8, slate: 0.2 });
  /** Rust on the map (M). */
  readonly mapFloor = [0.5, 0.32, 0.26] as const;
  private readonly noise: Noise;
  private readonly cells: number;
  private readonly lines: GrainLines;
  private readonly hot: boolean;
  private readonly own = new WeakMap<Column, TubeColumn>();

  constructor(readonly seed: number, readonly band: Band) {
    this.noise = new Noise(deriveSeed(seed, 'lava', 'shape'));
    this.cells = deriveSeed(seed, 'lava', 'cells');
    this.lines = new GrainLines(this.noise, this.cells, grainOf(seed, 'lava'), LAVA.spacing, LAVA.jitter, LAVA.meander);
    this.hot = hashToFloat(deriveSeed(seed, 'lava', 'hot')) < LAVA.hot;
  }

  /** Tube k's radius at u. */
  private radius(k: number, u: number): number {
    return LAVA.radius[0] + LAVA.radius[1] * (0.5 + 0.5 * this.noise.n2(u / 120, k * 3.3 + 50));
  }

  column(x: number, z: number, col: Column): Column {
    const L = LAVA, n = this.noise;
    const u = this.lines.u(x, z), v = this.lines.v(x, z);
    let o = this.own.get(col);
    if (!o) { o = { across: [0, 0], r: [0, 0], bench: [0, 0], branch: 0, sky: 0 }; this.own.set(col, o); }
    // The two nearest tubes (the jitter and meander never let one pass its neighbour), and the one below v.
    const k0 = Math.round(v / L.spacing);
    let a = 0, da = Infinity, b = 0, db = Infinity, lo = k0 - 2;
    for (let k = k0 - 2; k <= k0 + 2; k++) {
      const c = this.lines.line(k, u), d = Math.abs(v - c);
      if (c <= v) lo = k;
      if (d < da) { b = a; db = da; a = k; da = d; } else if (d < db) { b = k; db = d; }
    }
    const ks = [a, b];
    col.floor = n.n2(x / L.floor[1] + 3.1, z / L.floor[1] - 7.7) * L.floor[0];
    let roof = 1;
    o.sky = -FAR;
    for (let i = 0; i < 2; i++) {
      const k = ks[i], r = this.radius(k, u);
      o.across[i] = i ? db : da; o.r[i] = r;
      // A bench where the noise says so: its edge from the middle (at r or more: none).
      o.bench[i] = r * (L.bench.reach + 0.7 * smoothstep(-0.2, 0.4, n.n2(u / 250, k * 5.1 - 20)));
      roof = Math.max(roof, this.roof(r * L.middle, r, o.across[i]));
      // Skylights along this tube.
      const S = L.skylight, ci = Math.floor(u / S.cell);
      for (let c = ci - 1; c <= ci + 1; c++) {
        const h = hash2i(this.cells ^ 0x5c1, k, c), f = (m: number) => hashToFloat(hash2i(h, m, 4));
        if (f(0) >= S.chance) continue;
        const us = (c + 0.2 + 0.6 * f(1)) * S.cell, rs = S.radius[0] + S.radius[1] * f(2);
        const inside = rs - Math.hypot(u - us, v - this.lines.line(k, us));
        o.sky = Math.max(o.sky, inside);
      }
    }
    // A skylight lifts the roof from FAR metres off, no steeper than 0.75, into a dome over the shaft.
    roof += 0.75 * (FAR + o.sky);
    // The branch across to the next tube, if one runs past here: a straight tube from one line to the next, clipped to the strip between them.
    const B = L.branch, ci = Math.floor(u / B.cell);
    o.branch = -FAR;
    for (let c = ci - 1; c <= ci + 1; c++) {
      const h = hash2i(this.cells ^ 0xb7a, lo, c);
      if (hashToFloat(h) >= B.chance) continue;
      const ua = (c + 0.1 + 0.5 * hashToFloat(hash2i(h, 1, 4))) * B.cell, ub = ua + B.run;
      const va = this.lines.line(lo, ua), vb = this.lines.line(lo + 1, ub);
      const eu = ub - ua, ev = vb - va, t = Math.max(0, Math.min(1, ((u - ua) * eu + (v - va) * ev) / (eu * eu + ev * ev)));
      o.branch = Math.max(o.branch, Math.min(B.radius - Math.hypot(u - ua - eu * t, v - va - ev * t), v - this.lines.line(lo, u) + 1, this.lines.line(lo + 1, u) - v + 1));
    }
    o.branch = Math.max(o.branch, -FAR);
    roof = Math.max(roof, this.roof(B.radius * L.middle, B.radius, B.radius - o.branch));
    col.ceiling = col.floor + roof;
    col.wall = Math.max(o.r[0] - o.across[0], o.r[1] - o.across[1], o.branch, o.sky);
    unworked(col, TUBE, 1000, 1);
    return col;
  }

  /**
   * The envelope's roof over the floor for a tube of radius r whose middle stands `mid` over the
   * floor, `a` metres across from its middle: over the round roof everywhere, no steeper than 0.75.
   */
  private roof(mid: number, r: number, a: number): number {
    const t = Math.min(a, r);
    return mid + r - (0.375 * t * t) / r - 0.75 * Math.max(0, a - r);
  }

  at(col: Column, _x: number, y: number, _z: number): number {
    const L = LAVA, o = this.own.get(col)!, h = y - col.floor, cap = col.ceiling - y;
    let d = -FAR;
    for (let i = 0; i < 2; i++) {
      const r = o.r[i], a = o.across[i];
      // The round tube, cut flat at the floor; a bench is rock out past its edge and under its top.
      const tube = Math.max(r - Math.hypot(a, h - r * L.middle), -FAR);
      d = Math.max(d, Math.min(tube, h, Math.max(o.bench[i] - a, h - r * L.bench.top), cap));
    }
    // The branch: a smaller round tube.
    const B = L.branch;
    d = Math.max(d, Math.min(o.branch, B.radius - Math.hypot(B.radius - o.branch, h - B.radius * L.middle), h, cap));
    // The skylight: a shaft up from the roof to the envelope's dome.
    d = Math.max(d, Math.min(o.sky, h, cap));
    return d;
  }

  color(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    const B = this.band, n = this.noise, own = this.own.get(col), h = y - col.floor;
    const u = this.lines.u(x, z), across = own ? own.across[0] : 0;
    if (h < 0.3) {
      // The last flow's floor: ropes of pahoehoe bowed downstream, and on hot levels cracks glowing through.
      const rope = 0.5 + 0.5 * Math.sin((u + 0.05 * across * across) * 0.8 + n.n2(x / 6, z / 6) * 2);
      const crack = this.hot ? smoothstep(0.9, 0.97, 1 - Math.abs(n.n2(x / 3.5 + 11, z / 3.5 - 4))) : 0;
      const k = 0.75 + 0.35 * rope;
      out[o] = 0.11 * k * (1 - crack) + 1.0 * crack;
      out[o + 1] = 0.1 * k * (1 - crack) + 0.36 * crack;
      out[o + 2] = 0.1 * k * (1 - crack) + 0.08 * crack;
      return;
    }
    // Black basalt with rust-red crusts in patches; grey where the band's rock shows through.
    const rust = smoothstep(0.1, 0.5, n.n2(x / 5 + y / 7, z / 5 - y / 9)) * 0.8;
    out[o] = (0.1 + B.rock[0] * 0.08) * (1 - rust) + 0.34 * rust;
    out[o + 1] = (0.095 + B.rock[1] * 0.08) * (1 - rust) + 0.15 * rust;
    out[o + 2] = (0.095 + B.rock[2] * 0.08) * (1 - rust) + 0.08 * rust;
  }

  /** A passage from another style ends on the middle line of the nearest tube (E3). */
  portal(x: number, z: number): [number, number] {
    return this.lines.nearest(x, z);
  }

  /** Lava stalactites dripping from the roof where the flow ran high; now and then a block fallen from it. */
  props(d: Dress): void {
    const drips = propModel('lava_drips'), block = propModel('basalt_block');
    scatter(d, 2.5, 0x1a7, 2, (x, z, g, r) => {
      const roll = r(3), yaw = r(4) * Math.PI * 2;
      if (roll < 0.2) {
        const roof = roofOver(d.level, x, g + 1, z, 20);
        if (!Number.isFinite(roof) || roof - g < 4) return;
        d.solid.stamp(drips, x, roof + 0.1, z, yaw, { scale: 1 + 1.5 * r(5), lean: Math.PI });
      } else if (roll < 0.21) {
        const scale = 0.5 + 0.5 * r(5);
        d.solid.stamp(block, x, g - 0.2, z, yaw, { scale, lean: (r(6) - 0.5) * 0.5 });
        d.block(x, z, yaw, 1.5 * scale, 1.2 * scale, g, g + 1.7 * scale);
      } else return;
      d.placed();
    });
  }

  climbable(): boolean {
    return true;
  }
}
