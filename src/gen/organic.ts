/**
 * The organic style (catalog §5, the first alien style; levels 61 and deeper): the inside of
 * something alive, or that once was. Long gullets run side by side down the level's grain, ringed
 * every few metres like a windpipe, and between each two of them swollen bladders open, round
 * chambers that join one gullet to the next. Wet flesh in reds and purples, paler on the rings,
 * threaded with dark veins; pustules on the walls glow a sickly yellow, and the bright ones light
 * the flesh round them.
 *
 * In plan, each gullet is a meandering line along u in a frame turned by the level's grain angle
 * (`GrainLines`); a column keeps the two nearest, and the bladders of the strips beside it. The
 * rings narrow a gullet's radius by a smooth pulse along u, gently enough to keep the field near
 * 1-Lipschitz. Envelope (E1): a rolling floor, and a roof over the gullets' and bladders' round
 * roofs (`roundRoof`).
 *
 * Pure, like every style.
 */
import { Noise, deriveSeed, hash2i, hashToFloat, smoothstep } from '@futuremagic/core';
import type { Band } from './bands';
import { STANDARD, gene, type Traits, type Tuned } from './genes';
import { unworked, type Column, type Working } from './quarry';
import { GrainLines, grainOf } from './grainLines';
import { rockMix } from './rockTypes';
import { putSurface, type Style, type StyleId, type Surface } from './style';
import { roundRoof } from './shapes';
import { scatter, type Dress } from './styleProps';

export const ORGANIC = {
  /** Gullets lie this far apart, metres, each strayed by up to `jitter`, meandering by up to `meander[0]` over `meander[1]` metres. */
  spacing: 36,
  jitter: 2,
  meander: [4, 140] as const,
  /** A gullet's radius (min, extra), swelling and narrowing slowly along it; its middle stands this much of its radius over the floor. */
  radius: [3.6, 2.4] as const,
  middle: 0.62,
  /** The rings: one every `pitch` metres along a gullet, narrowing it by `depth` of its radius at the ring. */
  ring: { pitch: 6, depth: 0.2 },
  /** Bladders between two gullets: one per cell this long along them with this chance; radius half the gap between the gullets plus (min, extra), so it opens into both, and between `least` and `most`; the middle at this much of the radius over the floor. */
  bladder: { cell: 90, chance: 0.6, radius: [-1, 4] as const, least: 10, most: 22, middle: 0.4 },
  /** The floor: rolling by this much over this distance, metres. */
  floor: [5, 240] as const,
  /** Pustules: the share of wall spots with a cluster of them, and the share of clusters bright enough to light the flesh. */
  pustules: { chance: 0.05, bright: 0.3 },
} as const;

/**
 * The organic style's genes (src/gen/genes.ts): how one deep world's living tunnels differ from
 * another's. Radius scales how wide its gullets are, pitch how far apart its rings; rings is how
 * deep they bite, bladders how many chambers open between the gullets, flesh the hue (0: red, 1:
 * violet; past them, bruised greens).
 */
export const ORGANIC_GENES = {
  radius: gene('organic.radius', 1, [0.85, 1.2], [0.7, 1.4]),
  pitch: gene('organic.pitch', 1, [0.85, 1.2], [0.7, 1.5]),
  rings: gene('organic.rings', ORGANIC.ring.depth, [0.14, 0.24], [0.05, 0.28]),
  bladders: gene('organic.bladders', ORGANIC.bladder.chance, [0.45, 0.75], [0.25, 0.95]),
  flesh: gene('organic.flesh', 0.3, [0, 0.7], [-0.6, 1.6]),
} as const;

/** Rock further than this from a gullet or bladder counts as this far, metres. */
const FAR = 10;

/** What an organic column is to the code that asks about workings: natural, no pillar grid. */
const GUT: Working = { id: 0x6f726761, angle: 0, spacing: 1e9, pillar: 0, floor: 0, height: 14, collapse: 0, cavern: true, cx: 0, cz: 0 };

/** Wet and smooth (src/gen/style.ts `Surface`). */
const WET: Surface = [0, 0, 1, 0];

/** The pustules' sickly glow. */
const PUS = [0.95, 0.85, 0.25] as const;

/** A column's own data: the two nearest gullets (distance across, radius at this u), and the bladders near it. */
interface GutColumn {
  across: [number, number];
  r: [number, number];
  /** The ring pulse here, 0 between rings to 1 on one. */
  ring: number;
  /** Bladders near the column: plan distance from each middle, and its radius. */
  bd: number[];
  br: number[];
}

/** A bladder: its middle in plan and its radius. */
interface Bladder {
  x: number;
  z: number;
  r: number;
}

export class Organic implements Style {
  readonly id: StyleId = 'organic';
  /** Pale veined stone under the flesh's colours (src/gen/rockTypes.ts). */
  readonly rocks = rockMix({ marble: 0.6, limestone: 0.25, shale: 0.15 });
  /** Raw red on the map (M). */
  readonly mapFloor = [0.62, 0.24, 0.28] as const;
  /** ORGANIC as this level's genes read it, and its flesh hue. */
  readonly O: Tuned<typeof ORGANIC>;
  readonly flesh: number;
  private readonly noise: Noise;
  private readonly cells: number;
  private readonly lines: GrainLines;
  private readonly own = new WeakMap<Column, GutColumn>();
  private readonly bladders = new Map<number, Bladder | null>();

  constructor(readonly seed: number, readonly band: Band, traits: Traits = STANDARD) {
    const G = ORGANIC_GENES, r = traits(G.radius);
    this.O = {
      ...ORGANIC,
      radius: [ORGANIC.radius[0] * r, ORGANIC.radius[1] * r],
      ring: { pitch: ORGANIC.ring.pitch * traits(G.pitch), depth: traits(G.rings) },
      bladder: { ...ORGANIC.bladder, chance: traits(G.bladders) },
    };
    this.flesh = traits(G.flesh);
    this.noise = new Noise(deriveSeed(seed, 'organic', 'shape'));
    this.cells = deriveSeed(seed, 'organic', 'cells');
    this.lines = new GrainLines(this.noise, this.cells, grainOf(seed, 'organic'), this.O.spacing, this.O.jitter, this.O.meander);
  }

  /** Gullet k's radius at u, before its rings. */
  private radius(k: number, u: number): number {
    return this.O.radius[0] + this.O.radius[1] * (0.5 + 0.5 * this.noise.n2(u / 90, k * 4.7 - 30));
  }

  /** The bladder between gullets k and k + 1 in cell c along them, if there is one. */
  private bladder(k: number, c: number): Bladder | null {
    const key = hash2i(this.cells ^ 0xb1ad, k, c);
    let b = this.bladders.get(key);
    if (b === undefined) {
      const B = this.O.bladder, f = (m: number) => hashToFloat(hash2i(key, m, 6));
      b = null;
      if (f(0) < B.chance) {
        const u = (c + 0.2 + 0.6 * f(1)) * B.cell, va = this.lines.line(k, u), vb = this.lines.line(k + 1, u);
        const [x, z] = this.lines.xz(u, (va + vb) / 2);
        b = { x, z, r: Math.min(B.most, Math.max(B.least, (vb - va) / 2 + B.radius[0] + B.radius[1] * f(2))) };
      }
      if (this.bladders.size > 4096) this.bladders.clear();
      this.bladders.set(key, b);
    }
    return b;
  }

  column(x: number, z: number, col: Column): Column {
    const O = this.O, n = this.noise;
    const u = this.lines.u(x, z), v = this.lines.v(x, z);
    let o = this.own.get(col);
    if (!o) { o = { across: [0, 0], r: [0, 0], ring: 0, bd: [], br: [] }; this.own.set(col, o); }
    // The two nearest gullets (the jitter and meander never let one pass its neighbour), and the one below v.
    const k0 = Math.round(v / O.spacing);
    let a = 0, da = Infinity, b = 0, db = Infinity, lo = k0 - 2;
    for (let k = k0 - 2; k <= k0 + 2; k++) {
      const c = this.lines.line(k, u), d = Math.abs(v - c);
      if (c <= v) lo = k;
      if (d < da) { b = a; db = da; a = k; da = d; } else if (d < db) { b = k; db = d; }
    }
    col.floor = n.n2(x / O.floor[1] - 4.4, z / O.floor[1] + 2.9) * O.floor[0];
    // The rings: a smooth pulse along u, sharpest on the ring.
    const c = 0.5 + 0.5 * Math.cos((u / O.ring.pitch) * Math.PI * 2);
    o.ring = c * c;
    let roof = 1, wall = -FAR;
    const ks = [a, b];
    for (let i = 0; i < 2; i++) {
      const r = this.radius(ks[i], u);
      o.across[i] = i ? db : da; o.r[i] = r;
      roof = Math.max(roof, roundRoof(r * O.middle, r, o.across[i]));
      wall = Math.max(wall, r - o.across[i]);
    }
    // The bladders of the strips near this one. Each lifts the roof (its own falls to the floor's within
    // 2.4 radii, 53 m at most; one in a strip not looked at is at least two whole gaps and a half, 60 m,
    // away), and counts in the field within FAR of its outside (beyond, its rock counts as FAR anyway).
    o.bd.length = 0; o.br.length = 0;
    const B = O.bladder, ci = Math.floor(u / B.cell);
    for (let k = lo - 2; k <= lo + 2; k++) for (let cc = ci - 1; cc <= ci + 1; cc++) {
      const bl = this.bladder(k, cc);
      if (!bl) continue;
      const d = Math.hypot(x - bl.x, z - bl.z);
      roof = Math.max(roof, roundRoof(bl.r * B.middle, bl.r, d));
      if (d > bl.r + FAR) continue;
      o.bd.push(d); o.br.push(bl.r);
      wall = Math.max(wall, bl.r - d);
    }
    col.ceiling = col.floor + roof;
    col.wall = wall;
    unworked(col, GUT, 1000, 1);
    return col;
  }

  at(col: Column, _x: number, y: number, _z: number): number {
    const O = this.O, o = this.own.get(col)!, h = y - col.floor, cap = col.ceiling - y;
    let d = -FAR;
    for (let i = 0; i < 2; i++) {
      // The round gullet narrowed at its rings, cut flat at the floor.
      const r = o.r[i] * (1 - O.ring.depth * o.ring);
      d = Math.max(d, Math.min(Math.max(r - Math.hypot(o.across[i], h - o.r[i] * O.middle), -FAR), h, cap));
    }
    for (let i = 0; i < o.bd.length; i++) {
      const r = o.br[i];
      d = Math.max(d, Math.min(Math.max(r - Math.hypot(o.bd[i], h - r * O.bladder.middle), -FAR), h, cap));
    }
    return d;
  }

  /** The flesh's own colour at hue t (0 red, 1 violet; beyond, bruised greens), linear RGB. */
  private hue(t: number, out: Float32Array, o: number, k: number): void {
    const w = ((t % 2) + 2) % 2;
    // Red → violet → bruised green → red, round the wheel.
    const stops = [[0.62, 0.12, 0.13], [0.42, 0.12, 0.38], [0.3, 0.36, 0.14], [0.62, 0.12, 0.13]];
    const s = (w / 2) * 3, i = Math.min(2, Math.floor(s)), f = s - i, p = stops[i], q = stops[i + 1];
    out[o] = (p[0] + (q[0] - p[0]) * f) * k;
    out[o + 1] = (p[1] + (q[1] - p[1]) * f) * k;
    out[o + 2] = (p[2] + (q[2] - p[2]) * f) * k;
  }

  color(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    const n = this.noise, own = this.own.get(col), h = y - col.floor;
    const k = 0.85 + 0.25 * n.n2(x / 6 + y / 9, z / 6 - y / 7);
    this.hue(this.flesh + 0.15 * n.n2(x / 40, z / 40), out, o, k);
    // Paler on the rings, wet and darker underfoot, dark veins branching over it all.
    const ring = own ? own.ring : 0;
    const pale = 0.45 * ring * smoothstep(0.3, 1.2, h);
    const vein = smoothstep(0.86, 0.97, 1 - Math.abs(n.n2(x / 2.6 + y / 4, z / 2.6 - y / 5)));
    const wet = smoothstep(0.6, 0.05, h) * 0.35;
    for (let i = 0; i < 3; i++) {
      const c = out[o + i] + (0.92 - out[o + i]) * pale;
      out[o + i] = c * (1 - wet) * (1 - 0.7 * vein) + [0.22, 0.02, 0.05][i] * vein * 0.6;
    }
  }

  surface(_col: Column, _x: number, _y: number, _z: number, out: Float32Array, o: number): void {
    putSurface(WET, out, o);
  }

  /** A passage from another style ends on the middle line of the nearest gullet (E3). */
  portal(x: number, z: number): [number, number] {
    return this.lines.nearest(x, z);
  }

  /** Clusters of glowing pustules low on the walls, the bright ones lighting the flesh round them. */
  props(d: Dress): void {
    const P = this.O.pustules;
    scatter(d, 2, 0x0a6, 0.5, (x, z, g, r) => {
      if (r(3) >= P.chance) return;
      let lit = r(4) < P.bright;
      for (let t = 0; t < 5; t++) {
        const px = x + (r(5 + t) - 0.5) * 1.4, pz = z + (r(10 + t) - 0.5) * 1.4, s = 0.12 + 0.18 * r(15 + t);
        d.glow.ellipsoid(px, g + s * 0.5, pz, s, s * 0.8, s, PUS, 6);
        if (lit) { d.light(px, g + 0.8, pz); lit = false; }
      }
      d.placed();
    });
  }

  climbable(): boolean {
    return true;
  }
}
