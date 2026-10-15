/**
 * The collapse style (docs/design/level-styles.md; level-generator.md §3, collapse): huge chambers
 * whose roofs came down. Each chamber is a cell of a jittered Voronoi grid (src/gen/voronoi.ts),
 * domed, walled off from its neighbours by thick rock that is broken through in places and always
 * once between any two (a breach). Where slabs fell, the dome has angular scars reaching higher
 * into the rock, and under each scar the floor heaps up into a hill of breakdown: tilted blocks of
 * every size, a few standing on end. Chaotic and hilly, the opposite of the excavation's level
 * floors and the karst's smooth tubes.
 *
 * Domes, breaches and scars are plan shapes (2D distances) raised to a height; blocks are exact
 * boxes. So the field stays near 1-Lipschitz. Its envelope (E1) is the hilly floor and the dome.
 *
 * Pure, like every style.
 */
import { Noise, deriveSeed, hash2i, hashToFloat, smoothstep } from '@futuremagic/core';
import type { Band } from './bands';
import { unworked, type Column, type Working } from './quarry';
import type { Style, StyleId } from './style';
import { blendShare, newNear, voronoiNear, type Near } from './voronoi';

export const COLLAPSE = {
  /** Chambers: Voronoi cells this big, metres, their feature points straying this much (0..1). */
  size: 240,
  jitter: 0.7,
  /** Half the thickness of the rock between chambers (base, and how much it wanders). */
  wall: [8, 12] as const,
  /** A chamber's dome (min, extra) and its floor's spread, metres; floors and domes blend over `blend` metres at a border. */
  dome: [34, 40] as const,
  floor: 8,
  blend: 30,
  /** The dome rises from the wall no steeper than this. */
  roof: 1.1,
  /** Scars where slabs fell: one per cell this big with this chance, if at least `inner` metres inside a chamber; half sides (min, extra), how much higher they reach (min, extra). Under each, a pile this high (min, extra) and this wide. */
  scar: { cell: 34, chance: 0.5, inner: 18, half: [5, 7] as const, rise: [6, 10] as const, pile: [5, 7] as const, spread: 40 },
  /** Blocks: one per cell this big with this chance (more on the piles), each a box of these half sides (min, extra), sunk this share of its height; this share stands on end. None within `clear` metres of a chamber's middle (where passages end). */
  block: { cell: 10, chance: [0.2, 0.6] as const, half: [1.2, 2.8] as const, height: [0.8, 2] as const, sink: 0.45, monolith: 0.07, clear: 10 },
} as const;

/** What a collapse column is to the code that asks about workings: natural rock, no pillar grid. */
const FALLEN: Working = { id: 0x636f6c6c, angle: 0, spacing: 1e9, pillar: 0, floor: 0, height: 40, collapse: 1, cavern: true, cx: 0, cz: 0 };

interface Scar {
  x: number;
  z: number;
  cos: number;
  sin: number;
  hx: number;
  hz: number;
  /** Its prism of air: from `bottom` up to `top`, metres. */
  bottom: number;
  top: number;
  pile: number;
}

interface Block {
  x: number;
  y: number;
  z: number;
  /** Yaw and tilt, as cosines and sines. */
  cy: number;
  sy: number;
  ct: number;
  st: number;
  hx: number;
  hy: number;
  hz: number;
}

/** A chamber's plan at a point: how far inside its open space, the floor and dome there (blended). */
interface Plan {
  inside: number;
  floor: number;
  dome: number;
}

/** A column's own data: the scars and blocks near it, and its distance into each scar in plan. */
interface FallenColumn {
  scars: Scar[];
  scarD: number[];
  blocks: Block[];
}

const MAX_CACHE = 8192;
/** No block reaches further than this from its cell into the next, nor higher than BLOCK_TOP over the floor, metres; so one in a cell not looked at is at least BLOCK_FAR off. */
const BLOCK_FAR = 5.5;
const BLOCK_TOP = 8;
/** A passage from another style ends this far inside a chamber's open space, metres. */
const PORTAL = 12;

const newPlan = (): Plan => ({ inside: 0, floor: 0, dome: 0 });

export class Collapse implements Style {
  readonly id: StyleId = 'collapse';
  /** Pale broken stone on the map (M). */
  readonly mapFloor = [0.66, 0.6, 0.52] as const;
  private readonly noise: Noise;
  private readonly rough: Noise;
  private readonly cells: number;
  private readonly near: Near = newNear();
  private readonly colPlan = newPlan();
  private readonly scarCache = new Map<number, Scar | null>();
  private readonly blockCache = new Map<number, Block | null>();
  private readonly own = new WeakMap<Column, FallenColumn>();

  constructor(readonly seed: number, readonly band: Band) {
    this.noise = new Noise(deriveSeed(seed, 'collapse', 'shape'));
    this.rough = new Noise(deriveSeed(seed, 'collapse', 'rough'));
    this.cells = deriveSeed(seed, 'collapse', 'cells');
  }

  /** The chambers' plan at (x, z), into `p` (the chamber's middle, metres, into `mid` if given). */
  private chambers(x: number, z: number, p: Plan = newPlan(), mid?: number[]): Plan {
    const C = COLLAPSE, n = this.near;
    voronoiNear(this.cells, x / C.size, z / C.size, C.size, C.jitter, C.blend, n);
    const floorOf = (id: number) => (hashToFloat(hash2i(id, 1, 5)) - 0.5) * C.floor;
    const domeOf = (id: number) => C.dome[0] + C.dome[1] * hashToFloat(hash2i(id, 2, 5));
    let wsum = 1, floor = floorOf(n.id), dome = domeOf(n.id);
    for (let i = 0; i < n.count; i++) {
      const k = blendShare(n.blends[i], C.blend);
      wsum += k; floor += k * floorOf(n.ids[i]); dome += k * domeOf(n.ids[i]);
    }
    // Half the rock between chambers: where the noise thins it below nothing, it is broken through.
    const wall = C.wall[0] + C.wall[1] * this.noise.n2(x / 80 + 1.3, z / 80 - 6.2);
    if (mid) { mid[0] = n.px * C.size; mid[1] = n.pz * C.size; }
    p.inside = n.border - wall;
    p.floor = floor / wsum;
    p.dome = dome / wsum;
    return p;
  }

  /** The scar of cell (i, j), if it has one. */
  private scar(i: number, j: number): Scar | null {
    const S = COLLAPSE.scar, key = hash2i(this.cells ^ 0x5ca5, i, j);
    let s = this.scarCache.get(key);
    if (s === undefined) {
      s = null;
      const f = (m: number) => hashToFloat(hash2i(key, m, 3));
      if (f(0) < S.chance) {
        const x = (i + 0.25 + 0.5 * f(1)) * S.cell, z = (j + 0.25 + 0.5 * f(2)) * S.cell, p = this.chambers(x, z);
        if (p.inside >= S.inner) {
          const a = f(3) * Math.PI;
          s = { x, z, cos: Math.cos(a), sin: Math.sin(a), hx: S.half[0] + S.half[1] * f(4), hz: S.half[0] + S.half[1] * f(5), bottom: p.floor + 4, top: p.floor + p.dome + S.rise[0] + S.rise[1] * f(6), pile: S.pile[0] + S.pile[1] * f(7) };
        }
      }
      if (this.scarCache.size > MAX_CACHE) this.scarCache.clear();
      this.scarCache.set(key, s);
    }
    return s;
  }

  /** How high the breakdown is heaped at (x, z), metres. */
  private piles(x: number, z: number): number {
    const S = COLLAPSE.scar, i0 = Math.floor(x / S.cell), j0 = Math.floor(z / S.cell);
    let h = 0;
    for (let j = j0 - 2; j <= j0 + 2; j++) for (let i = i0 - 2; i <= i0 + 2; i++) {
      const s = this.scar(i, j);
      if (s) h += s.pile * smoothstep(S.spread, 0, Math.hypot(x - s.x, z - s.z));
    }
    return h;
  }

  /** The floor at (x, z): the chamber's, with the piles on it. */
  private groundOf(x: number, z: number, p: Plan): number {
    return p.floor + this.piles(x, z) + this.noise.fbm2(x / 18, z / 18, 2) * 0.4;
  }

  /** The block of cell (i, j), if it has one. */
  private block(i: number, j: number): Block | null {
    const B = COLLAPSE.block, key = hash2i(this.cells ^ 0xb10c, i, j);
    let b = this.blockCache.get(key);
    if (b === undefined) {
      b = null;
      const f = (m: number) => hashToFloat(hash2i(key, m, 4));
      const x = (i + 0.2 + 0.6 * f(1)) * B.cell, z = (j + 0.2 + 0.6 * f(2)) * B.cell;
      const pile = this.piles(x, z), chance = B.chance[0] + B.chance[1] * Math.min(1, pile / (COLLAPSE.scar.pile[0] + COLLAPSE.scar.pile[1]));
      if (f(0) < chance) {
        const mid = [0, 0], p = this.chambers(x, z, newPlan(), mid);
        const middle = Math.hypot(x - mid[0], z - mid[1]);
        if (p.inside >= 5 && middle > B.clear) {
          const up = f(3) < B.monolith, yaw = f(4) * Math.PI, tilt = up ? (f(5) - 0.5) * 0.25 : (f(5) - 0.5) * 1.1;
          const hx = up ? 0.8 + 0.6 * f(6) : B.half[0] + B.half[1] * f(6);
          const hz = up ? 0.8 + 0.6 * f(7) : B.half[0] + B.half[1] * f(7);
          const hy = up ? 3 + 3 * f(8) : B.height[0] + B.height[1] * f(8);
          const floor = this.groundOf(x, z, p);
          b = { x, y: floor + hy * (1 - 2 * B.sink), z, cy: Math.cos(yaw), sy: Math.sin(yaw), ct: Math.cos(tilt), st: Math.sin(tilt), hx, hy, hz };
        }
      }
      if (this.blockCache.size > MAX_CACHE) this.blockCache.clear();
      this.blockCache.set(key, b);
    }
    return b;
  }

  column(x: number, z: number, col: Column): Column {
    const C = COLLAPSE, p = this.chambers(x, z, this.colPlan);
    const inside = p.inside, floor = this.groundOf(x, z, p), base = p.floor;
    let o = this.own.get(col);
    if (!o) { o = { scars: [], scarD: [], blocks: [] }; this.own.set(col, o); }
    o.scars.length = 0; o.scarD.length = 0; o.blocks.length = 0;
    const S = C.scar, si = Math.floor(x / S.cell), sj = Math.floor(z / S.cell);
    // (Five by five cells: a scar not looked at is so far off it never counts.)
    for (let j = sj - 2; j <= sj + 2; j++) for (let i = si - 2; i <= si + 2; i++) {
      const s = this.scar(i, j);
      if (!s) continue;
      const dx = x - s.x, dz = z - s.z, u = Math.abs(dx * s.cos + dz * s.sin) - s.hx, v = Math.abs(-dx * s.sin + dz * s.cos) - s.hz;
      o.scars.push(s);
      o.scarD.push(-(Math.hypot(Math.max(u, 0), Math.max(v, 0)) + Math.min(Math.max(u, v), 0)));
    }
    const B = C.block, bi = Math.floor(x / B.cell), bj = Math.floor(z / B.cell);
    for (let j = bj - 1; j <= bj + 1; j++) for (let i = bi - 1; i <= bi + 1; i++) {
      const b = this.block(i, j);
      if (b) o.blocks.push(b);
    }
    col.floor = floor;
    col.ceiling = base + Math.min(p.dome, Math.max(0, inside) * C.roof);
    col.wall = inside;
    unworked(col, FALLEN, 1000, 1);
    col.rubble = Math.min(1, (floor - base) / 3);
    return col;
  }

  at(col: Column, x: number, y: number, z: number): number {
    const o = this.own.get(col)!;
    // The dome (its roof term leans, as the karst's does), and the scars above it.
    let d = Math.min(y - col.floor, (col.ceiling - y) / 1.3, col.wall);
    for (let i = 0; i < o.scars.length; i++) {
      const s = o.scars[i];
      d = Math.max(d, Math.min(o.scarD[i], s.top - y, y - s.bottom, col.wall));
    }
    // Rough, broken rock.
    const up = smoothstep(0.5, 2.5, y - col.floor);
    d += this.rough.n3(x / 4, y / 4, z / 4) * 0.35 * up + this.rough.n3(x / 1.4, y / 1.4, z / 1.4) * 0.07;
    // The fallen blocks: crisp, freshly broken. (A block not looked at is at least BLOCK_FAR off,
    // and none stands higher than BLOCK_TOP over the floor: the field never claims more room than that.)
    return Math.min(d, this.blocks(o, x, y, z), Math.max(BLOCK_FAR, y - col.floor - BLOCK_TOP));
  }

  /** Distance to the nearest fallen block (Infinity: none near). */
  private blocks(o: FallenColumn, x: number, y: number, z: number): number {
    let d = Infinity;
    for (const b of o.blocks) {
      const dx = x - b.x, dy = y - b.y, dz = z - b.z;
      const u = dx * b.cy + dz * b.sy, w = -dx * b.sy + dz * b.cy;
      const v = dy * b.ct - w * b.st, t = dy * b.st + w * b.ct;
      const qx = Math.abs(u) - b.hx, qy = Math.abs(v) - b.hy, qz = Math.abs(t) - b.hz;
      d = Math.min(d, Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0));
    }
    return d;
  }

  color(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    const B = this.band, own = this.own.get(col);
    // Fresh breaks (the blocks, and the scars above the old dome) are pale; the rest dusty and dark.
    const fresh = Math.max(own && this.blocks(own, x, y, z) < 0.4 ? 1 : 0, smoothstep(col.ceiling - 2, col.ceiling + 2, y));
    const grime = 0.5 + 0.5 * this.noise.n2(x / 7, z / 7 + y / 11);
    const k = (0.82 + 0.12 * grime) * (1 - fresh) + 1.25 * fresh;
    out[o] = B.rock[0] * k + B.dust[0] * (1 - fresh) * 0.4;
    out[o + 1] = B.rock[1] * k + B.dust[1] * (1 - fresh) * 0.4;
    out[o + 2] = B.rock[2] * k + B.dust[2] * (1 - fresh) * 0.4;
  }

  /** A passage from another style ends where open chamber floor begins on the way from (x, z) to its chamber's middle (E3). */
  portal(x: number, z: number): [number, number] {
    const mid = [0, 0], p = newPlan();
    this.chambers(x, z, p, mid);
    const dx = mid[0] - x, dz = mid[1] - z, len = Math.hypot(dx, dz);
    for (let t = 0; t < len; t += 4) {
      const px = x + (dx * t) / len, pz = z + (dz * t) / len;
      if (this.chambers(px, pz, p).inside >= PORTAL) return [px, pz];
    }
    return [mid[0], mid[1]];
  }

  climbable(): boolean {
    return true;
  }
}
