/**
 * The goblin warrens style (catalog §4.2): a tangled honeycomb of small dug burrows, all round, all
 * crooked. Low round tunnels, three or four metres high, run from knot to knot of a jittered
 * lattice, most knots swelling into a small round den; a second storey of burrows lies over the
 * first, offset from it, and steep ramps and climbing shafts join the two. No grain, no straight
 * line, no big space: the lowest headroom and the most ways round of any style. Soft rock dug by
 * hand, scratched and sooty; the dens strewn with bones and stolen things, a cook fire in some.
 *
 * Each tunnel is a capsule between two knots, flattened at the floor (its floor runs straight from
 * one knot's floor to the other's); each knot a sphere, flattened the same. The plan distances are
 * taken in the column, so the field per height is exact in plan and a bound in height (the ramps'
 * slope is held under 0.55, which keeps it under 1.2). Envelope (E1): the lower storey's floors
 * weighted by how near each is, and a roof over both storeys.
 *
 * Pure, like every style.
 */
import { Noise, deriveSeed, hash3i, hashToFloat, smoothstep } from '@futuremagic/core';
import { dryAbove, type Band } from './bands';
import { Envelope } from './envelope';
import { propModel } from './models';
import { unworked, type Column, type Working } from './quarry';
import { rockMix } from './rockTypes';
import type { Style, StyleId } from './style';
import { scatter, type Dress } from './styleProps';

export const GOBLIN = {
  /** One knot to a cell this wide, metres, strayed by up to this much of a cell each way. */
  cell: 16,
  jitter: 0.25,
  /** A tunnel's radius (min, extra), metres; its floor is flattened this much of the radius under its middle. */
  radius: [1.7, 0.7] as const,
  flat: 0.65,
  /** The chances of a tunnel to the next knot along x and along z, and on to a diagonal one. */
  link: 0.8,
  diagonal: 0.2,
  /** A knot's swelling: the radius of a plain one, metres; the chance it is a den, and a den's radius (min, extra). */
  knot: 2.3,
  den: { chance: 0.45, radius: [3, 1.6] as const },
  /** The upper storey: the chance of a knot, how far over the lower one its floor is (min, extra), the chance of each link. */
  upper: { chance: 0.5, over: [6.5, 2] as const, link: 0.65 },
  /** The steepest a ramp between the storeys may be; the chance of a climbing shaft from an upper knot down, and its radius. */
  slope: 0.55,
  shaft: { chance: 0.3, radius: 1.3 },
  /** The lower floor: rolling by this much over this distance, up from clear of the water; each knot strays up or down by up to `stray`. */
  roll: [3, 220] as const,
  stray: 1,
  /** In the dens: the chances of a cook fire, and of a bone pile, a skull, a stolen box or barrel, a rope or a bucket per 3 m. */
  fire: 0.45,
  things: { bones: 0.07, skull: 0.06, box: 0.05, rope: 0.04 },
} as const;

/** Rock further than this from a burrow counts as this far, metres; every one this near is looked at. */
const FAR = 8;
const FIRE = [1, 0.5, 0.2] as const;

/** What a warren column is to the code that asks about workings: dug, but not by the miners. */
const DUG: Working = { id: 0x676f626c, angle: 0, spacing: 1e9, pillar: 0, floor: 0, height: 4, collapse: 0, cavern: true, cx: 0, cz: 0 };

interface Knot {
  x: number;
  z: number;
  /** Its floor, and its swelling's radius. */
  floor: number;
  r: number;
}

/** A burrow near a column: plan distance from its middle line; its floor and radius there; how its middle stands over its floor; whether a shaft (no flat floor, straight up). */
interface Near {
  d: number;
  floor: number;
  r: number;
  mid: number;
  /** A shaft's top (its floor is its bottom), or NaN. */
  top: number;
}

/** A knot's swelling or a shaft: where, its floor, radius, how its middle stands over its floor, a shaft's top (else NaN), whether of the lower storey. */
interface Ball {
  x: number;
  z: number;
  floor: number;
  r: number;
  mid: number;
  top: number;
  lower: boolean;
}

/** A tunnel: from (x, z) by (ex, ez), its floor rising by df; 1 / its plan length squared; radius; whether of the lower storey. */
interface Seg {
  x: number;
  z: number;
  floor: number;
  ex: number;
  ez: number;
  df: number;
  inv: number;
  r: number;
  lower: boolean;
}

/** The burrows starting in one cell, and the plan box beyond which none of them is near. */
interface Burrows {
  balls: Ball[];
  segs: Seg[];
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export class Goblin implements Style {
  readonly id: StyleId = 'goblin';
  /** The rock it is dug through (src/gen/rockTypes.ts): soft, crumbling. */
  readonly rocks = rockMix({ sandstone: 0.45, shale: 0.35, limestone: 0.2 });
  /** Dirt brown on the map (M). */
  readonly mapFloor = [0.42, 0.34, 0.24] as const;
  private readonly noise: Noise;
  private readonly rough: Noise;
  private readonly cells: number;
  private readonly own = new WeakMap<Column, Near[]>();
  /** Knots already made, by cell (each column asks for some forty, mostly the same as its neighbour's). */
  private readonly knots = new Map<number, [Knot, Knot | null]>();
  private readonly cache = new Map<number, Burrows>();

  constructor(readonly seed: number, readonly band: Band) {
    this.noise = new Noise(deriveSeed(seed, 'goblin', 'shape'));
    this.rough = new Noise(deriveSeed(seed, 'goblin', 'rough'));
    this.cells = deriveSeed(seed, 'goblin', 'cells');
  }

  private f(i: number, j: number, layer: number, m: number): number {
    return hashToFloat(hash3i(this.cells, i, j, layer * 16 + m));
  }

  /** The lower storey's knot in cell (i, j) and the upper's over it (or null), made once. */
  private knot(i: number, j: number): [Knot, Knot | null] {
    const key = (i & 0xffff) * 0x10000 + (j & 0xffff);
    let k = this.knots.get(key);
    if (!k) {
      if (this.knots.size > 4096) this.knots.clear();
      const a = this.low(i, j);
      this.knots.set(key, (k = [a, this.high(i, j, a)]));
    }
    return k;
  }

  /** The burrows that start in cell (i, j): its knots' swellings and shafts, its tunnels on to the next cells', made once. */
  private burrows(i: number, j: number): Burrows {
    const key = (i & 0xffff) * 0x10000 + (j & 0xffff);
    let c = this.cache.get(key);
    if (c) return c;
    if (this.cache.size > 4096) this.cache.clear();
    const G = GOBLIN, [a, h] = this.knot(i, j), low = (i: number, j: number) => this.knot(i, j)[0];
    c = { balls: [], segs: [], x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
    const grow = (x: number, z: number, r: number) => {
      c!.x0 = Math.min(c!.x0, x - r - FAR); c!.x1 = Math.max(c!.x1, x + r + FAR);
      c!.z0 = Math.min(c!.z0, z - r - FAR); c!.z1 = Math.max(c!.z1, z + r + FAR);
    };
    const ball = (k: Knot, floor: number, r: number, mid: number, top: number, lower: boolean) => {
      c!.balls.push({ x: k.x, z: k.z, floor, r, mid, top, lower });
      grow(k.x, k.z, r);
    };
    const seg = (p: Knot, q: Knot, r: number, lower: boolean) => {
      const ex = q.x - p.x, ez = q.z - p.z;
      c!.segs.push({ x: p.x, z: p.z, floor: p.floor, ex, ez, df: q.floor - p.floor, inv: 1 / (ex * ex + ez * ez), r, lower });
      grow(p.x, p.z, r); grow(q.x, q.z, r);
    };
    ball(a, a.floor, a.r, a.r * 0.35, NaN, true);
    for (let e = 0; e < 4; e++) {
      const di = e === 1 ? 0 : 1, dj = e === 0 ? 0 : e === 3 ? -1 : 1;
      const r0 = this.tunnel(i, j, 0, e);
      if (r0) seg(a, low(i + di, j + dj), r0, true);
      if (!h || e > 1) continue;
      const b = this.knot(i + di, j + dj)[1], r1 = this.tunnel(i, j, 1, e);
      if (b && r1) seg(h, b, r1, false);
    }
    if (!h) return (this.cache.set(key, c), c);
    ball(h, h.floor, h.r, h.r * 0.35, NaN, false);
    // Down to the lower storey: a ramp to the first neighbour's knot it can reach no steeper than `slope`, else a shaft straight down; now and then a shaft as well.
    const fr = (m: number) => this.f(i, j, 1, 24 + m);
    let ramp = false;
    for (let k = 0; k < 8 && !ramp; k++) {
      const w = (k + Math.floor(fr(0) * 8)) % 8, di = [1, 1, 0, -1, -1, -1, 0, 1][w], dj = [0, 1, 1, 1, 0, -1, -1, -1][w];
      const b = low(i + di, j + dj);
      if (h.floor - b.floor > G.slope * Math.hypot(b.x - h.x, b.z - h.z)) continue;
      seg(h, b, G.radius[0] + G.radius[1] * fr(1), false);
      ramp = true;
    }
    if (!ramp || fr(2) < G.shaft.chance) {
      // A shaft from the upper knot straight down to the lower storey's floor, and a short tunnel from its foot to the lower knot.
      ball(h, a.floor + G.shaft.radius, G.shaft.radius, 0, h.floor + G.shaft.radius, false);
      seg(a, { x: h.x, z: h.z, floor: a.floor, r: 0 }, G.radius[0], true);
    }
    this.cache.set(key, c);
    return c;
  }

  /** The lower storey's knot in cell (i, j): there is always one. */
  private low(i: number, j: number): Knot {
    const G = GOBLIN, S = G.cell, f = (m: number) => this.f(i, j, 0, m);
    const x = (i + 0.5 + (f(0) - 0.5) * 2 * G.jitter) * S, z = (j + 0.5 + (f(1) - 0.5) * 2 * G.jitter) * S;
    const floor = dryAbove(this.band) + 1 + (1 + this.noise.n2(x / G.roll[1], z / G.roll[1])) * G.roll[0] + (f(2) - 0.5) * 2 * G.stray;
    const r = f(3) < G.den.chance ? G.den.radius[0] + G.den.radius[1] * f(4) : G.knot;
    return { x, z, floor, r };
  }

  /** The upper storey's knot in cell (i, j) over the lower one `under`, or null. */
  private high(i: number, j: number, under: Knot): Knot | null {
    const G = GOBLIN, S = G.cell, f = (m: number) => this.f(i, j, 1, m);
    if (f(0) >= G.upper.chance) return null;
    const x = (i + 0.5 + (f(1) - 0.5) * 2 * G.jitter) * S, z = (j + 0.5 + (f(2) - 0.5) * 2 * G.jitter) * S;
    return { x, z, floor: under.floor + G.upper.over[0] + G.upper.over[1] * f(3), r: G.knot };
  }

  /** The radius of the tunnel from cell (i, j) in direction e (0: +x, 1: +z, 2: +x+z, 3: +x−z) on a storey, and whether there is one. */
  private tunnel(i: number, j: number, layer: number, e: number): number {
    const G = GOBLIN, f = (m: number) => this.f(i, j, layer, 8 + e * 2 + m);
    const chance = e < 2 ? (layer ? G.upper.link : G.link) : layer ? 0 : G.diagonal;
    return f(0) < chance ? G.radius[0] + G.radius[1] * f(1) : 0;
  }

  column(x: number, z: number, col: Column): Column {
    const G = GOBLIN, S = G.cell;
    let near = this.own.get(col);
    if (!near) { near = []; this.own.set(col, near); }
    near.length = 0;
    const env = new Envelope(FAR);
    let roof = -Infinity;
    const add = (n: Near, lower: boolean) => {
      near.push(n);
      const inside = n.r * 0.75 - n.d, top = Number.isNaN(n.top) ? n.floor + n.mid + n.r : n.top;
      if (lower) env.add(inside, n.floor, top);
      else roof = Math.max(roof, top + 3 * Math.min(0, inside));
    };
    const ci = Math.floor(x / S), cj = Math.floor(z / S);
    // (A tunnel starts in its cell and runs to a neighbour's: every one that reaches here starts in one of these.)
    for (let i = ci - 2; i <= ci + 2; i++) for (let j = cj - 2; j <= cj + 2; j++) {
      const c = this.burrows(i, j);
      if (x < c.x0 || x > c.x1 || z < c.z0 || z > c.z1) continue;
      for (const b of c.balls) {
        const d = Math.hypot(x - b.x, z - b.z);
        if (d < b.r + FAR) add({ d, floor: b.floor, r: b.r, mid: b.mid, top: b.top }, b.lower);
      }
      for (const g of c.segs) {
        const t = Math.max(0, Math.min(1, ((x - g.x) * g.ex + (z - g.z) * g.ez) * g.inv)), d = Math.hypot(x - g.x - g.ex * t, z - g.z - g.ez * t);
        if (d < g.r + FAR) add({ d, floor: g.floor + g.df * t, r: g.r, mid: g.r * G.flat, top: NaN }, g.lower);
      }
    }
    col.floor = env.floor();
    col.ceiling = Math.max(env.ceiling(), roof + 0.5);
    let wall = -FAR;
    for (const n of near) wall = Math.max(wall, n.r * 0.75 - n.d);
    col.wall = wall;
    unworked(col, DUG, 1000, 1);
    return col;
  }

  at(col: Column, x: number, y: number, z: number): number {
    const near = this.own.get(col)!;
    // Dug by hand: the walls lumpy, the floors trodden flat.
    const rough = this.rough.n3(x / 3, y / 3, z / 3) * 0.1;
    let d = -FAR;
    for (const n of near) {
      if (Number.isNaN(n.top)) {
        const air = Math.min(n.r - Math.hypot(n.d, y - n.floor - n.mid) + rough, y - n.floor);
        d = Math.max(d, air);
      } else {
        d = Math.max(d, n.r - Math.hypot(n.d, Math.max(0, y - n.top, n.floor - y)) + rough);
      }
    }
    return Math.max(d, -FAR);
  }

  color(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    const B = this.band, n = this.noise, near = this.own.get(col);
    // The floor and the roof of the burrow nearest here.
    let floor = col.floor, top = col.ceiling, best = Infinity;
    if (near) for (const b of near) {
      const t = Number.isNaN(b.top) ? b.floor + b.mid + b.r : b.top, e = b.d - b.r;
      if (y > b.floor - 0.5 && y < t + 0.5 && e < best) { best = e; floor = b.floor; top = t; }
    }
    const h = y - floor;
    // Ochre-brown dug earth and soft rock, scratched across in bands; soot over the dens' roofs; a dark trodden floor.
    const grain = 0.88 + 0.12 * n.n2(x / 2 + y * 0.5, z / 2 - y * 0.5);
    const scratch = 0.92 + 0.08 * Math.sin((x + z) * 3.1 + y * 5 + n.n2(x / 4, z / 4) * 4);
    const soot = smoothstep(1.2, 0.2, top - y) * 0.6;
    const trod = 1 - smoothstep(0.05, 0.35, h);
    const WALL = [0.42, 0.33, 0.22], FLOOR = [0.2, 0.16, 0.12], SOOT = [0.07, 0.06, 0.05];
    for (let c = 0; c < 3; c++) {
      const wall = ((WALL[c] + B.rock[c] * 0.06) * grain * scratch) * (1 - soot) + SOOT[c] * soot;
      out[o + c] = wall * (1 - trod) + FLOOR[c] * grain * trod;
    }
  }

  /** The den of cell (i, j) of the lower storey (its middle, floor and radius; whether it has a cook fire), or null where the knot is a plain one: where the goblins live (src/creatures/goblins.ts). */
  den(i: number, j: number): { x: number; z: number; floor: number; r: number; fire: boolean } | null {
    const k = this.low(i, j);
    return k.r > GOBLIN.knot ? { x: k.x, z: k.z, floor: k.floor, r: k.r, fire: this.f(i, j, 2, 0) < GOBLIN.fire } : null;
  }

  /** A passage from another style ends in the lower storey's nearest knot (E3). */
  portal(x: number, z: number): [number, number] {
    const S = GOBLIN.cell, k = this.low(Math.floor(x / S), Math.floor(z / S));
    return [k.x, k.z];
  }

  climbable(): boolean {
    return true;
  }

  /** In the dens, a cook fire now and then; about the burrows, bones and skulls and the things goblins steal. */
  props(d: Dress): void {
    const G = GOBLIN, T = G.things, S = G.cell;
    const bones = propModel('prop_bone_pile'), skull = propModel('prop_skull'), crate = propModel('prop_crate'), barrel = propModel('prop_barrel');
    const rope = propModel('prop_rope_coil'), bucket = propModel('prop_bucket');
    for (let i = Math.floor(d.x0 / S); i <= Math.floor((d.x0 + d.size) / S); i++) for (let j = Math.floor(d.z0 / S); j <= Math.floor((d.z0 + d.size) / S); j++) {
      const k = this.low(i, j);
      const den = this.den(i, j);
      if (!den?.fire || !d.mine(k.x, k.z)) continue;
      const g = d.level.groundAt(k.x, k.z);
      if (!Number.isFinite(g) || g < d.level.waterAt(k.x, k.z) + 0.02) continue;
      d.glow.ellipsoid(k.x, g + 0.12, k.z, 0.45, 0.14, 0.45, FIRE, 8);
      d.light(k.x, g + 0.9, k.z);
      d.block(k.x, k.z, 0, 0.5, 0.5, g, g + 0.4);
      d.placed();
    }
    scatter(d, 3, 0x90b, 1.5, (x, z, g, r) => {
      const roll = r(3), yaw = r(4) * Math.PI * 2;
      let at = 0;
      if (roll < (at += T.bones)) d.solid.stamp(bones, x, g, z, yaw, { scale: 0.8 + 0.5 * r(5) });
      else if (roll < (at += T.skull)) d.solid.stamp(skull, x, g, z, yaw);
      else if (roll < (at += T.box)) {
        d.solid.stamp(r(5) < 0.5 ? crate : barrel, x, g, z, yaw);
        d.block(x, z, yaw, 0.45, 0.45, g, g + 0.9);
      } else if (roll < (at += T.rope)) d.solid.stamp(r(5) < 0.5 ? rope : bucket, x, g, z, yaw);
      else return;
      d.placed();
    });
  }
}
