/**
 * The dungeon rooms style (docs/design/level-styles.md; catalog §2.5): built rooms of dressed
 * stone, joined by short corridors. One room to a cell of a jittered grid turned the level's own
 * way: small cells, guard rooms, long pillared halls and vaulted great rooms. Corridors run in
 * three straight legs from room to room (a dog-leg at the cells' border); one corridor from every
 * room keeps it all joined (a spanning tree), and more make loops. Floors differ from room to
 * room by a few steps' height, the corridors ramping between. Crisp and square: the opposite of
 * every natural style.
 *
 * In plan, rooms and corridors are exact rectangles; the field is their union up to each one's
 * roof. Envelope (E1): the floor and the rooms' ceilings.
 *
 * Pure, like every style.
 */
import { deriveSeed, hash2i, hashToFloat, smoothstep } from '@futuremagic/core';
import type { Band } from './bands';
import { Grain, grainOf } from './grainLines';
import { joined } from './gridTree';
import { unworked, type Column, type Working } from './quarry';
import type { Style, StyleId } from './style';
import { boxDist2 } from './shapes';

export const DUNGEON = {
  /** One room to a cell this wide, metres, kept this far in from the cell's border. */
  cell: 26,
  margin: 3,
  /** A corridor's half width and height, metres; the chance of a corridor besides the ones that join everything. */
  corridor: { half: 1.3, height: 3, extra: 0.35 },
  /** Room floors stand on one of `levels` steps this high (around the level's own floor). */
  step: 0.6,
  levels: 4,
  /** Pillars in a hall: square, this half width, this far apart along the hall. */
  pillar: { half: 0.7, pitch: 4.5 },
} as const;

/** Kinds of room: chance, half sizes (min, extra) along their long and short side, wall height (min, extra), vault over the walls, pillars. */
const KINDS = [
  { chance: 0.3, long: [2, 1.5], short: [2, 1], wall: [3, 0], vault: 0, pillars: false },
  { chance: 0.35, long: [4, 2], short: [4, 1.5], wall: [3.5, 1], vault: 0, pillars: false },
  { chance: 0.2, long: [8, 2], short: [5, 1.5], wall: [5, 1], vault: 0, pillars: true },
  { chance: 0.15, long: [7, 2], short: [7, 1], wall: [4.5, 0.5], vault: 2.5, pillars: false },
] as const;

/** Rock further than this from any room or corridor counts as this far, metres (those not looked at are further). */
const FAR = 6;
/** Rooms further than this give a column's floor nothing (all looked-at rooms are nearer), metres. */
const REACH = 20;

/** What a dungeon column is to the code that asks about workings: dug, but not by the miners. */
const BUILT: Working = { id: 0x64756e67, angle: 0, spacing: 1e9, pillar: 0, floor: 0, height: 4, collapse: 0, cavern: false, cx: 0, cz: 0 };

interface Room {
  /** Middle (u, v), half sizes along u and v, floor offset, wall height, vault, pillars along u (1) or v (2) or none (0). */
  u: number;
  v: number;
  hu: number;
  hv: number;
  floor: number;
  wall: number;
  vault: number;
  pillars: number;
}

/** A column's own data: how far inside each room near (up to 9) and their roofs, and how far inside a corridor. */
interface DungeonColumn {
  n: number;
  inside: Float64Array;
  wall: Float64Array;
  vault: Float64Array;
  span: Float64Array;
  /** The pillars' plan distance where a hall is near (Infinity: none). */
  pillar: number;
  corridor: number;
}

export class Dungeon implements Style {
  readonly id: StyleId = 'dungeon';
  /** Grey on the map (M). */
  readonly mapFloor = [0.56, 0.56, 0.6] as const;
  private readonly cells: number;
  private readonly grain: Grain;
  private readonly own = new WeakMap<Column, DungeonColumn>();
  private readonly rooms = new Map<number, Room>();

  constructor(readonly seed: number, readonly band: Band) {
    this.cells = deriveSeed(seed, 'dungeon', 'cells');
    this.grain = new Grain(grainOf(seed, 'dungeon'));
  }

  /** The room in cell (i, j). */
  private room(i: number, j: number): Room {
    const key = (i & 0xffff) * 0x10000 + (j & 0xffff);
    let r = this.rooms.get(key);
    if (r) return r;
    const D = DUNGEON, h = hash2i(this.cells, i, j), f = (m: number) => hashToFloat(hash2i(h, m, 3));
    let pick = f(0), kind = KINDS[0] as (typeof KINDS)[number];
    for (const k of KINDS) { kind = k; if ((pick -= k.chance) < 0) break; }
    const long = kind.long[0] + kind.long[1] * f(1), short = kind.short[0] + kind.short[1] * f(2);
    const alongU = f(3) < 0.5, hu = alongU ? long : short, hv = alongU ? short : long;
    const room = (half: number, t: number) => (D.cell / 2 - D.margin - half) * (2 * t - 1);
    r = {
      u: (i + 0.5) * D.cell + room(hu, f(4)),
      v: (j + 0.5) * D.cell + room(hv, f(5)),
      hu, hv,
      floor: (Math.floor(f(6) * D.levels) - (D.levels - 1) / 2) * D.step,
      wall: kind.wall[0] + kind.wall[1] * f(7),
      vault: kind.vault,
      pillars: kind.pillars ? (alongU ? 1 : 2) : 0,
    };
    if (this.rooms.size > 4096) this.rooms.clear();
    this.rooms.set(key, r);
    return r;
  }

  /** How far inside the corridor from room a to room b (along `axis`), dog-legging at the cells' border at `mid`. */
  private corridor(a: Room, b: Room, axis: number, mid: number, u: number, v: number): number {
    const H = DUNGEON.corridor.half;
    const [pa, qa, pb, qb, p, q] = axis ? [a.v, a.u, b.v, b.u, v, u] : [a.u, a.v, b.u, b.v, u, v];
    return Math.max(
      inBox(p, q, pa, mid, qa, qa, H),
      inBox(p, q, mid, mid, qa, qb, H),
      inBox(p, q, mid, pb, qb, qb, H),
    );
  }

  column(x: number, z: number, col: Column): Column {
    const D = DUNGEON, G = D.cell;
    const u = this.grain.u(x, z), v = this.grain.v(x, z);
    let o = this.own.get(col);
    if (!o) {
      o = { n: 0, inside: new Float64Array(9), wall: new Float64Array(9), vault: new Float64Array(9), span: new Float64Array(9), pillar: Infinity, corridor: 0 };
      this.own.set(col, o);
    }
    const i0 = Math.floor(u / G), j0 = Math.floor(v / G);
    o.n = 0; o.pillar = Infinity; o.corridor = -FAR;
    let wSum = 0.002, fSum = 0, roof: number = D.corridor.height;
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) {
      const r = this.room(i, j);
      const inside = inBox(u, v, r.u - r.hu, r.u + r.hu, r.v - r.hv, r.v + r.hv, 0), out = Math.max(0, -inside);
      // The floor: each room's own, the gaps between ramping from one to the next.
      const w = Math.max(0, 1 / (out * out + 0.01) - 1 / (REACH * REACH));
      wSum += w; fSum += w * r.floor;
      if (inside > -FAR) {
        const k = o.n++;
        o.inside[k] = inside; o.wall[k] = r.wall; o.vault[k] = r.vault; o.span[k] = Math.min(r.hu, r.hv);
        // The envelope's roof: the room's own over it, falling away outside to the corridors' height where the room drops from the window.
        roof = Math.max(roof, this.top(r.wall, r.vault, Math.min(r.hu, r.hv), inside) + (r.wall - D.corridor.height) / FAR * Math.min(0, inside));
        if (r.pillars) o.pillar = Math.min(o.pillar, pillars(r, u, v));
      }
      // The corridors from this cell on along u and v, where the cell beyond is looked at too.
      for (let axis = 0; axis < 2; axis++) {
        const ni = axis ? i : i + 1, nj = axis ? j + 1 : j;
        if (ni > i0 + 1 || nj > j0 + 1 || !joined(this.cells, i, j, axis, D.corridor.extra)) continue;
        const mid = (axis ? nj : ni) * G + (hashToFloat(hash2i(this.cells ^ 0xd06, i * 2 + axis, j)) - 0.5) * 2 * (D.margin - D.corridor.half);
        o.corridor = Math.max(o.corridor, this.corridor(r, this.room(ni, nj), axis, mid, u, v));
      }
    }
    o.corridor = Math.max(o.corridor, -FAR);
    col.floor = fSum / wSum;
    col.ceiling = col.floor + roof;
    let wall = o.corridor;
    for (let k = 0; k < o.n; k++) wall = Math.max(wall, o.inside[k]);
    col.wall = Math.max(wall, -FAR);
    unworked(col, BUILT, 1000, 0);
    return col;
  }

  /** A room's roof over its floor, `inside` metres in from its wall: flat, or a vault rising to the middle. */
  private top(wall: number, vault: number, span: number, inside: number): number {
    const t = 1 - Math.min(1, Math.max(0, inside) / span);
    return wall + vault * (1 - t * t);
  }

  at(col: Column, _x: number, y: number, _z: number): number {
    const o = this.own.get(col)!, h = y - col.floor, cap = col.ceiling - y;
    let d = Math.min(o.corridor, h, DUNGEON.corridor.height - h, cap);
    for (let k = 0; k < o.n; k++) {
      const top = this.top(o.wall[k], o.vault[k], o.span[k], o.inside[k]);
      d = Math.max(d, Math.min(o.inside[k], h, top - h, cap));
    }
    return Math.min(d, o.pillar);
  }

  /** Dressed blocks in metre courses, big flagstones underfoot. */
  surface(_col: Column, _x: number, _y: number, _z: number, out: Float32Array, o: number): void {
    out[o] = 0; out[o + 1] = 1; out[o + 2] = 0; out[o + 3] = 1;
  }

  color(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    const B = this.band, h = y - col.floor;
    const u = this.grain.u(x, z), v = this.grain.v(x, z);
    // Big dressed blocks in courses, each course half a block along from the last, and big flagstones:
    // each its own shade (the rock is meshed a metre apart, so finer joints would not show).
    const row = Math.floor(h / 1), a = (u + v) / 2 + row * 0.5;
    const k = h < 0.08
      ? 0.78 + 0.22 * hashToFloat(hash2i(this.cells, Math.floor(u / 2), Math.floor(v / 2)))
      : 0.8 + 0.2 * hashToFloat(hash2i(this.cells ^ 0xb10c, Math.floor(a), row));
    const soot = 1 - smoothstep(3, 6, h) * 0.3;
    out[o] = (0.42 + B.rock[0] * 0.25) * k * soot;
    out[o + 1] = (0.42 + B.rock[1] * 0.25) * k * soot;
    out[o + 2] = (0.45 + B.rock[2] * 0.25) * k * soot;
  }

  /** A passage from another style ends in the middle of the nearest room (E3). */
  portal(x: number, z: number): [number, number] {
    const G = DUNGEON.cell, u = this.grain.u(x, z), v = this.grain.v(x, z);
    const r = this.room(Math.floor(u / G), Math.floor(v / G));
    return this.grain.xz(r.u, r.v);
  }

  climbable(): boolean {
    return true;
  }
}

/** How far inside the box from p0 to p1 along p and q0 to q1 along q, grown by `half` (negative outside): exact. */
function inBox(p: number, q: number, p0: number, p1: number, q0: number, q1: number, half: number): number {
  const dp = Math.abs(p - (p0 + p1) / 2) - Math.abs(p1 - p0) / 2 - half;
  const dq = Math.abs(q - (q0 + q1) / 2) - Math.abs(q1 - q0) / 2 - half;
  return -boxDist2(dp, dq);
}

/** Plan distance to a hall's two rows of square pillars (positive outside them). */
function pillars(r: Room, u: number, v: number): number {
  const P = DUNGEON.pillar, [a, b, ha, hb] = r.pillars === 1 ? [u - r.u, v - r.v, r.hu, r.hv] : [v - r.v, u - r.u, r.hv, r.hu];
  const n = Math.max(0, Math.floor((ha - 2) / P.pitch));
  const da = Math.abs(a - P.pitch * Math.max(-n, Math.min(n, Math.round(a / P.pitch)))) - P.half;
  const db = Math.abs(Math.abs(b) - hb * 0.45) - P.half;
  return boxDist2(da, db);
}
