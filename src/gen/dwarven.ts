/**
 * The dwarven halls style (catalog §4.1): vast rectilinear halls of carved stone, all lying the same
 * way. Each hall is an exact box, 50–90 m long and 18–40 m tall, its roof carried on two rows of
 * massive square columns (a nave, not a grid); recessed panels cut deep into its long walls. Halls
 * stand at different heights and are joined end to end by great gates and side to side by narrow
 * passages, with real stairs in them (half-metre steps). Many halls are crossed by a chasm, a sheer
 * slot dropping forty metres to the forges, with a stone bridge over it. Dark granite, gold-brown
 * inlay lines, soot.
 *
 * In plan, one hall to a cell of a grid turned the level's own way, long along u; the passages join
 * them as the grid tree does (src/gen/gridTree.ts). The field is the union of every hall, chasm,
 * panel and passage near a column (each air over its own floor and under its own roof), less the
 * columns and the bridges. A stair is exact: the steps are boxes, and the field is the distance to
 * them. Envelope (E1): the floors of the halls and passages, weighted by how far in one is, and a
 * roof over all of them that no feature leaving the list can lower.
 *
 * Pure, like every style.
 */
import { Noise, deriveSeed, hash2i, hashToFloat, smoothstep } from '@futuremagic/core';
import type { Band } from './bands';
import { Grain, grainOf } from './grainLines';
import { joined } from './gridTree';
import { unworked, type Column, type Working } from './quarry';
import { boxDist2, boxDist3 } from './shapes';
import type { Style, StyleId } from './style';

export const DWARVEN = {
  /** One hall to a cell this long (along u) and wide (along v), metres; the hall's middle strays along u by up to `jitter`. */
  cell: [120, 72] as const,
  jitter: 3,
  /** A hall's half length and half width (min, extra), its height (min, extra), metres; its floor on one of `levels` steps `step` apart. */
  long: [25, 20] as const,
  wide: [9, 6] as const,
  height: [18, 22] as const,
  levels: 5,
  step: 2.5,
  /** The nave's columns: square, this half width, this far apart, the rows this share of the half width out from the middle. */
  pillar: { half: 1.8, pitch: 11, row: 0.55 },
  /** Recessed panels in the long walls between the columns: this deep, this share of the pitch long, from this high to this share of the hall's height. */
  panel: { depth: 0.9, share: 0.55, from: 1.5, to: 0.55 },
  /** The chance of a chasm across a hall; its half width along u (min, extra), how deep under the floor, metres; the bridge's half width and thickness. */
  chasm: { chance: 0.55, half: [4, 3] as const, deep: 40, bridge: 2.5, thick: 1.5 },
  /** Gates end to end (along u) and passages side to side: half width and height, metres; the chance of a passage besides the ones that join everything. */
  gate: { half: 4, height: 9 },
  side: { half: 2.2, height: 5 },
  extra: 0.3,
  /** A stair step's rise and tread, metres. */
  stair: { rise: 0.5, tread: 0.9 },
} as const;

/** Rock further than this from a hall or passage counts as this far, metres; every feature this near is looked at. */
const FAR = 16;
/** The envelope's roof falls away outside a feature this steeply (so one leaving the list, FAR out, is under every other's). */
const FALL = 3;

/** What a dwarven column is to the code that asks about workings: dug, but not by the miners. */
const CARVED: Working = { id: 0x64776172, angle: 0, spacing: 1e9, pillar: 0, floor: 0, height: 20, collapse: 0, cavern: false, cx: 0, cz: 0 };

interface Hall {
  /** Middle (u, v), half sizes along u and v, floor, height. */
  u: number;
  v: number;
  hu: number;
  hv: number;
  floor: number;
  height: number;
  /** The chasm's middle along u and half width (0: none). */
  cu: number;
  ch: number;
}

/** A hall near a column: how far in from its walls, and how far in from the chasm's (−Infinity: none). */
interface NearHall {
  hall: Hall;
  inside: number;
  chasm: number;
}

/** A passage near a column: how far in from its sides, where along it, its length, the floors it joins, its height. */
interface NearPassage {
  inside: number;
  t: number;
  len: number;
  f0: number;
  f1: number;
  height: number;
}

interface DwarvenColumn {
  halls: NearHall[];
  passages: NearPassage[];
  /** Plan distance to the nearest column of a nave (positive outside it), and the panels' inside (−FAR: none near). */
  pillar: number;
  panel: number;
  panelHall: Hall | null;
  u: number;
  v: number;
}

export class Dwarven implements Style {
  readonly id: StyleId = 'dwarven';
  /** Dark granite on the map (M). */
  readonly mapFloor = [0.36, 0.33, 0.31] as const;
  private readonly noise: Noise;
  private readonly cells: number;
  private readonly grain: Grain;
  private readonly own = new WeakMap<Column, DwarvenColumn>();
  private readonly halls = new Map<number, Hall>();

  constructor(readonly seed: number, readonly band: Band) {
    this.noise = new Noise(deriveSeed(seed, 'dwarven', 'shape'));
    this.cells = deriveSeed(seed, 'dwarven', 'cells');
    this.grain = new Grain(grainOf(seed, 'dwarven'));
  }

  /** The hall of cell (i, j). */
  private hall(i: number, j: number): Hall {
    const key = (i + 0x8000) * 0x10000 + (j + 0x8000);
    let h = this.halls.get(key);
    if (h) return h;
    const D = DWARVEN, s = hash2i(this.cells, i, j), f = (k: number) => hashToFloat(hash2i(s, k, 5));
    const hu = D.long[0] + D.long[1] * f(0), side = f(5) < 0.5 ? -1 : 1;
    const chasm = f(4) < D.chasm.chance;
    h = {
      u: (i + 0.5) * D.cell[0] + (f(1) - 0.5) * 2 * D.jitter,
      v: (j + 0.5) * D.cell[1],
      hu,
      hv: D.wide[0] + D.wide[1] * f(2),
      floor: (Math.floor(f(3) * D.levels) - (D.levels - 1) / 2) * D.step,
      height: D.height[0] + D.height[1] * f(6),
      // (Off to one end, clear of where the side passages come in.)
      cu: 0, ch: chasm ? D.chasm.half[0] + D.chasm.half[1] * f(7) : 0,
    };
    h.cu = h.u + side * 0.65 * hu;
    if (this.halls.size > 4096) this.halls.clear();
    this.halls.set(key, h);
    return h;
  }

  column(x: number, z: number, col: Column): Column {
    const D = DWARVEN, [GU, GV] = D.cell;
    const u = this.grain.u(x, z), v = this.grain.v(x, z);
    let o = this.own.get(col);
    if (!o) { o = { halls: [], passages: [], pillar: Infinity, panel: -FAR, panelHall: null, u: 0, v: 0 }; this.own.set(col, o); }
    o.halls.length = o.passages.length = 0;
    o.pillar = Infinity; o.panel = -FAR; o.panelHall = null; o.u = u; o.v = v;
    const i0 = Math.floor(u / GU), j0 = Math.floor(v / GV);
    // The envelope: floors weighted by how near each feature is, all but its own inside it, none at FAR (and a
    // little weight on the level's own floor, so a feature coming into reach changes nothing); a roof over all of them.
    let wsum = 0.002, fsum = 0, roof = -FAR;
    const envelope = (inside: number, floor: number, top: number) => {
      const out = Math.max(0, -inside), k = Math.max(0, 1 / (out * out + 0.01) - 1 / (FAR * FAR));
      wsum += k; fsum += k * floor;
      roof = Math.max(roof, top + FALL * Math.min(0, inside));
    };
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) {
      const a = this.hall(i, j);
      const inside = -boxDist2(Math.abs(u - a.u) - a.hu, Math.abs(v - a.v) - a.hv);
      if (inside > -FAR) {
        const chasm = a.ch ? -boxDist2(Math.abs(u - a.cu) - a.ch, Math.abs(v - a.v) - a.hv) : -Infinity;
        o.halls.push({ hall: a, inside, chasm });
        envelope(inside, a.floor, a.floor + a.height);
        const p = nave(a, u, v);
        if (p < o.pillar) o.pillar = p;
      }
      // (Panels reach out past the walls: every hall of the window is asked.)
      const q = panels(a, u, v);
      if (q > o.panel) { o.panel = q; o.panelHall = a; }
      // The gate on to the next hall along u, and the passage to the next along v.
      for (let axis = 0; axis < 2; axis++) {
        if (!joined(this.cells, i, j, axis, D.extra)) continue;
        const b = axis ? this.hall(i, j + 1) : this.hall(i + 1, j);
        let n: NearPassage;
        if (axis === 0) {
          const p0 = a.u + a.hu - 1, len = b.u - b.hu + 1 - p0, t = u - p0;
          n = { inside: -boxDist2(Math.abs(t - len / 2) - len / 2, Math.abs(v - a.v) - D.gate.half), t, len, f0: a.floor, f1: b.floor, height: D.gate.height };
        } else {
          const at = (a.u + b.u) / 2, p0 = a.v + a.hv - 1, len = b.v - b.hv + 1 - p0, t = v - p0;
          n = { inside: -boxDist2(Math.abs(t - len / 2) - len / 2, Math.abs(u - at) - D.side.half), t, len, f0: a.floor, f1: b.floor, height: D.side.height };
        }
        if (n.inside <= -FAR) continue;
        o.passages.push(n);
        const ramp = rampAt(n);
        envelope(n.inside, ramp, ramp + n.height);
      }
    }
    col.floor = fsum / wsum;
    col.ceiling = Math.max(roof, col.floor + 3) + 0.5;
    let wall = -FAR;
    for (const h of o.halls) wall = Math.max(wall, h.inside);
    for (const p of o.passages) wall = Math.max(wall, p.inside);
    col.wall = wall;
    unworked(col, CARVED, 1000, 0);
    return col;
  }

  at(col: Column, _x: number, y: number, _z: number): number {
    const D = DWARVEN, o = this.own.get(col)!;
    let d = -FAR;
    for (const { hall: a, inside, chasm } of o.halls) {
      const roof = a.floor + a.height - y;
      d = Math.max(d, Math.min(inside, y - a.floor, roof));
      if (chasm > -FAR) d = Math.max(d, Math.min(chasm, y - (a.floor - D.chasm.deep), roof));
    }
    for (const p of o.passages) d = Math.max(d, Math.min(p.inside, stairs(p, y), rampAt(p) + p.height - y));
    const a = o.panelHall;
    if (a) d = Math.max(d, Math.min(o.panel, y - a.floor - D.panel.from, a.floor + a.height * D.panel.to - y));
    // Less the nave's columns and the bridges.
    d = Math.min(d, o.pillar);
    for (const { hall: b, chasm } of o.halls) {
      if (chasm <= -FAR) continue;
      const C = D.chasm;
      d = Math.min(d, boxDist3(Math.abs(o.u - b.cu) - b.ch - 1, Math.abs(y - b.floor + C.thick / 2) - C.thick / 2, Math.abs(o.v - b.v) - C.bridge));
    }
    return Math.max(d, -FAR);
  }

  color(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    const B = this.band, n = this.noise, own = this.own.get(col);
    const u = this.grain.u(x, z), v = this.grain.v(x, z);
    // The floor this point is over: the nearest hall's, or the level's.
    let floor = col.floor, deep = false;
    for (const h of own?.halls ?? []) if (h.inside > -1) { floor = h.hall.floor; deep = y < floor - 2; }
    const h = y - floor;
    // Dark granite in big dressed courses, gold-brown inlay lines every few metres up the walls and
    // along the floor, soot over the lower walls; in a chasm, the forges' red glow from below.
    const course = 0.88 + 0.12 * hashToFloat(hash2i(this.cells ^ 0x6a2, Math.floor((u + v) / 3 + Math.floor(h / 1.5) * 0.5), Math.floor(h / 1.5)));
    const grain = 0.94 + 0.06 * n.n2(x / 2.5 + y, z / 2.5 - y);
    const line = ((h % 4.5) + 4.5) % 4.5, band = ((u % 9) + 9) % 9;
    const inlay = deep ? 0 : h > 0.5 ? 1 - smoothstep(0.25, 0.5, Math.abs(line - 3)) : h < 0.3 ? 1 - smoothstep(0.3, 0.55, Math.abs(band - 4.5)) : 0;
    const soot = deep ? 0.55 : 1 - 0.35 * (1 - smoothstep(1, 6, h));
    const glow = deep ? smoothstep(-25, -40, h) : 0;
    const GOLD = [0.85, 0.58, 0.2], EMBER = [0.95, 0.3, 0.06];
    for (let c = 0; c < 3; c++) {
      const stone = (0.26 + B.rock[c] * 0.14) * course * grain * soot;
      out[o + c] = (stone * (1 - inlay) + GOLD[c] * inlay) * (1 - glow) + EMBER[c] * glow;
    }
  }

  /** A passage from another style ends in the middle of the nearest hall, clear of its chasm (E3). */
  portal(x: number, z: number): [number, number] {
    const [GU, GV] = DWARVEN.cell, u = this.grain.u(x, z), v = this.grain.v(x, z);
    const a = this.hall(Math.floor(u / GU), Math.floor(v / GV));
    return this.grain.xz(a.u, a.v);
  }

  climbable(): boolean {
    return true;
  }
}

/** Plan distance to a hall's nave: two rows of square columns along u, none over the chasm (positive outside them). */
function nave(a: Hall, u: number, v: number): number {
  const P = DWARVEN.pillar, n = Math.max(0, Math.floor((a.hu - 4) / P.pitch)), k0 = Math.round((u - a.u) / P.pitch);
  const across = Math.abs(Math.abs(v - a.v) - a.hv * P.row) - P.half;
  let d = Infinity;
  for (let k = Math.max(-n, k0 - 1); k <= Math.min(n, k0 + 1); k++) {
    const pu = a.u + k * P.pitch;
    if (!(a.ch && Math.abs(pu - a.cu) < a.ch + P.half + 2)) d = Math.min(d, boxDist2(Math.abs(u - pu) - P.half, across));
  }
  return d;
}

/** How far inside a recessed panel in a hall's long walls, between its columns (negative outside). */
function panels(a: Hall, u: number, v: number): number {
  const P = DWARVEN.panel, pitch = DWARVEN.pillar.pitch, n = Math.max(0, Math.floor((a.hu - 4) / pitch)), k0 = Math.floor((u - a.u) / pitch);
  const across = Math.abs(Math.abs(v - a.v) - a.hv - P.depth / 2) - P.depth / 2;
  let d = -FAR;
  // (Panels stand between the columns: at the half pitches; none by the chasm.)
  for (let k = Math.max(-n, k0 - 1); k <= Math.min(n - 1, k0 + 1); k++) {
    const pu = a.u + (k + 0.5) * pitch;
    if (!(a.ch && Math.abs(pu - a.cu) < a.ch + pitch * P.share)) d = Math.max(d, -boxDist2(Math.abs(u - pu) - (pitch * P.share) / 2, across));
  }
  return d;
}

/** The steps of a passage: from f0 to f1, half a metre at a time, in the middle of its length. */
function steps(p: NearPassage): { n: number; s0: number; dir: number } {
  const S = DWARVEN.stair, n = Math.round(Math.abs(p.f1 - p.f0) / S.rise);
  return { n, s0: (p.len - n * S.tread) / 2, dir: Math.sign(p.f1 - p.f0) };
}

/** A passage's floor smoothed: rising evenly over its stair (its roof follows it). */
function rampAt(p: NearPassage): number {
  const { n, s0 } = steps(p), run = n * DWARVEN.stair.tread;
  if (!n) return p.f0;
  return p.f0 + (p.f1 - p.f0) * Math.max(0, Math.min(1, (p.t - s0) / run));
}

/**
 * Signed distance from height y over a passage to its stair (positive over it), exact: the floor is
 * boxes side by side (the landings and each step), solid from below up to its own top.
 */
function stairs(p: NearPassage, y: number): number {
  const S = DWARVEN.stair, { n, s0, dir } = steps(p), t = p.t;
  if (!n) return y - p.f0;
  // The box under t, and the one each side of it for each step one could reach.
  const top = (k: number) => (k < 0 ? p.f0 : k >= n ? p.f1 : p.f0 + dir * (k + 1) * S.rise);
  const kt = Math.max(-1, Math.min(n, Math.floor((t - s0) / S.tread)));
  const over = y >= top(kt);
  let best = Infinity;
  const reach = Math.ceil(FAR / S.tread);
  for (let k = Math.max(-1, kt - reach); k <= Math.min(n, kt + reach); k++) {
    const a = k < 0 ? -Infinity : s0 + k * S.tread, b = k >= n ? Infinity : k < 0 ? s0 : s0 + (k + 1) * S.tread;
    const dt = Math.max(0, a - t, t - b), dy = over ? Math.max(0, y - top(k)) : Math.max(0, top(k) - y);
    best = Math.min(best, Math.hypot(dt, dy));
  }
  return over ? best : -best;
}
