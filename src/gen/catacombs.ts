/**
 * The catacombs style (docs/design/level-styles.md; the crypt strata, dunfinity-plan.md §4.4):
 * a warren of narrow vaulted galleries cut into soft pale rock, their walls lined floor to vault
 * with rows of burial niches, opening here and there into round domed chapels. On a square grid
 * turned the level's own way; not every stretch of gallery was dug, so it branches, loops and
 * dead-ends. Low and close: the opposite of the rift's height and the collapse's open halls.
 *
 * In plan, galleries are segments of the grid and chapels discs at some of its nodes: exact 2D
 * distances. A gallery's roof rises from its walls into a round vault; a chapel's into a dome.
 * Niches are boxes cut into the nearest gallery's walls. Envelope (E1): the floor and the vaults.
 *
 * Pure, like every style.
 */
import { Noise, deriveSeed, hash2i, hashToFloat, smoothstep } from '@futuremagic/core';
import type { Band } from './bands';
import { unworked, type Column, type Working } from './quarry';
import type { Style, StyleId } from './style';
import { propModel } from './models';
import { scatter, type Dress } from './styleProps';

export const CATACOMBS = {
  /** Galleries run along grid lines this far apart, metres; this share of the grid's stretches was dug. */
  grid: 12,
  dug: 0.72,
  /** A gallery's half width, its walls' height and how much higher its vault rises in the middle, metres. */
  half: 1.5,
  wall: 2.7,
  vault: 1.3,
  /** Burial niches: every `pitch` metres along a wall, `width` wide, `depth` deep, in rows this high at these heights over the floor. */
  niche: { pitch: 2.4, width: 1.6, depth: 0.75, height: 0.48, rows: [0.55, 1.2, 1.85] as const },
  /** Chapels: at one grid node in `every` along each axis, with this chance; radius (min, extra) and dome over the walls (min, extra), metres. */
  chapel: { every: 5, chance: 0.6, radius: [6, 4] as const, wall: 3.2, dome: [3, 4] as const },
  /** The floor rolls by this much over this distance, metres. */
  floor: [1.5, 160] as const,
} as const;

/** Rock further than this from any gallery or chapel counts as this far, metres (those not looked at are further). */
const FAR = 8;

/** What a catacombs column is to the code that asks about workings: dug, but not by the miners. */
const CRYPT: Working = { id: 0x63727970, angle: 0, spacing: 1e9, pillar: 0, floor: 0, height: 4, collapse: 0, cavern: false, cx: 0, cz: 0 };

/** A column's own data: how far inside a gallery and a chapel, and where it is on the two nearest stretches of gallery. */
interface CryptColumn {
  gallery: number;
  chapel: number;
  /** The chapel's dome height over its walls (-Infinity inside: no chapel near). */
  dome: number;
  /** Per stretch (the two nearest): its distance, how far along its line and from its middle line, and how far in from its ends (negative: beyond them), metres. */
  dist: [number, number];
  along: [number, number];
  across: [number, number];
  ends: [number, number];
}

export class Catacombs implements Style {
  readonly id: StyleId = 'catacombs';
  /** Bone-pale on the map (M). */
  readonly mapFloor = [0.7, 0.68, 0.6] as const;
  private readonly noise: Noise;
  private readonly rough: Noise;
  private readonly cells: number;
  private readonly cos: number;
  private readonly sin: number;
  private readonly own = new WeakMap<Column, CryptColumn>();

  constructor(readonly seed: number, readonly band: Band) {
    this.noise = new Noise(deriveSeed(seed, 'catacombs', 'shape'));
    this.rough = new Noise(deriveSeed(seed, 'catacombs', 'rough'));
    this.cells = deriveSeed(seed, 'catacombs', 'cells');
    const a = hashToFloat(deriveSeed(seed, 'catacombs', 'grain')) * Math.PI;
    this.cos = Math.cos(a);
    this.sin = Math.sin(a);
  }

  /** Whether the stretch of gallery from node (i, j) one step along u (axis 0) or v (axis 1) was dug. */
  private dug(i: number, j: number, axis: number): boolean {
    return hashToFloat(hash2i(this.cells, i * 2 + axis, j)) < CATACOMBS.dug;
  }

  /** The chapel at chapel cell (a, b), if any: its node (grid units), radius and dome. */
  private chapel(a: number, b: number): { i: number; j: number; r: number; dome: number } | null {
    const C = CATACOMBS.chapel, h = hash2i(this.cells ^ 0xc4a9, a, b), f = (m: number) => hashToFloat(hash2i(h, m, 2));
    if (f(0) >= C.chance) return null;
    return { i: a * C.every + 1 + Math.floor(f(1) * (C.every - 2)), j: b * C.every + 1 + Math.floor(f(2) * (C.every - 2)), r: C.radius[0] + C.radius[1] * f(3), dome: C.dome[0] + C.dome[1] * f(4) };
  }

  column(x: number, z: number, col: Column): Column {
    const K = CATACOMBS, G = K.grid;
    const u = x * this.cos + z * this.sin, v = -x * this.sin + z * this.cos;
    let o = this.own.get(col);
    if (!o) { o = { gallery: 0, chapel: 0, dome: 0, dist: [0, 0], along: [0, 0], across: [0, 0], ends: [0, 0] }; this.own.set(col, o); }
    // The galleries round the column: stretches along u on the lines v = j G, and along v on u = i G; the two nearest kept.
    const i0 = Math.floor(u / G), j0 = Math.floor(v / G);
    o.dist[0] = o.dist[1] = Infinity;
    for (let axis = 0; axis < 2; axis++) {
      const a = axis ? v : u, b = axis ? u : v, a0 = axis ? j0 : i0, b0 = axis ? i0 : j0;
      for (let line = b0; line <= b0 + 1; line++) for (let s = a0 - 1; s <= a0 + 1; s++) {
        if (!this.dug(axis ? line : s, axis ? s : line, axis)) continue;
        const t = Math.max(s * G, Math.min((s + 1) * G, a)), d = Math.hypot(a - t, b - line * G);
        if (d >= o.dist[1]) continue;
        const k = d < o.dist[0] ? 0 : 1;
        if (k === 0) { o.dist[1] = o.dist[0]; o.along[1] = o.along[0]; o.across[1] = o.across[0]; o.ends[1] = o.ends[0]; }
        o.dist[k] = d; o.along[k] = a; o.across[k] = Math.abs(b - line * G); o.ends[k] = Math.min(a - s * G, (s + 1) * G - a);
      }
    }
    o.gallery = Math.max(K.half - o.dist[0], -FAR);
    // Chapels at nodes near.
    const C = K.chapel, ca = Math.floor(u / G / C.every), cb = Math.floor(v / G / C.every);
    o.chapel = -FAR; o.dome = 0;
    for (let b = cb - 1; b <= cb + 1; b++) for (let a = ca - 1; a <= ca + 1; a++) {
      const c = this.chapel(a, b);
      if (!c) continue;
      const inside = c.r - Math.hypot(u - c.i * G, v - c.j * G);
      if (inside > o.chapel) { o.chapel = inside; o.dome = c.dome; }
    }
    o.chapel = Math.max(o.chapel, -FAR);
    col.floor = this.noise.n2(x / K.floor[1] + 2.2, z / K.floor[1] - 5.1) * K.floor[0];
    // The envelope's roof: the higher of the vault and the dome over this column.
    col.ceiling = col.floor + Math.max(this.vault(o.gallery), this.domeAt(o.chapel, o.dome));
    col.wall = Math.max(o.gallery, o.chapel);
    unworked(col, CRYPT, 1000, 0);
    return col;
  }

  /** A gallery's roof over the floor, `inside` metres in from its wall: walls, then a round vault. */
  private vault(inside: number): number {
    const K = CATACOMBS;
    return K.wall + K.vault * Math.min(1, Math.max(0, inside) / K.half);
  }

  /** A chapel's roof over the floor, `inside` metres in from its wall. */
  private domeAt(inside: number, dome: number): number {
    return CATACOMBS.chapel.wall + Math.min(dome, Math.max(0, inside) * 0.9);
  }

  at(col: Column, x: number, y: number, z: number): number {
    const K = CATACOMBS, N = K.niche, o = this.own.get(col)!;
    const h = y - col.floor;
    // The galleries and the chapels, each up to its own roof (the envelope's ceiling, where styles meet, caps both).
    const cap = col.ceiling - y;
    let d = Math.max(Math.min(o.gallery, h, this.vault(o.gallery) - h, cap), Math.min(o.chapel, h, this.domeAt(o.chapel, o.dome) - h, cap));
    // Niches in the two nearest stretches' walls: boxes cut in, in rows; none near the stretch's ends
    // or where the other gallery is near (both are asked, so nothing jumps where the nearest changes).
    // (Held under the galleries' own distance a little way into the rock, so a stretch that drops out of the two nearest never counts.)
    const deep = 1.5 * o.gallery + 1.3;
    const row = N.rows.reduce((p, r) => (Math.abs(h - r) < Math.abs(h - p) ? r : p), N.rows[0] as number);
    for (let k = 0; k < 2; k++) {
      const a = o.along[k] - N.pitch * Math.round(o.along[k] / N.pitch);
      const qx = Math.abs(a) - N.width / 2, qy = Math.abs(h - row) - N.height / 2, qz = Math.abs(o.across[k] - K.half - N.depth / 2 + 0.05) - N.depth / 2;
      const box = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0);
      d = Math.max(d, Math.min(-box, o.dist[1 - k] - K.half - N.depth - 1.2, o.ends[k] - 0.6, -o.chapel - 0.5, deep));
    }
    // Soft tuff: a little uneven, the floor worn smooth.
    const up = smoothstep(0.2, 1, h);
    return d + this.rough.n3(x / 1.8, y / 1.8, z / 1.8) * 0.06 * up;
  }

  color(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    const B = this.band, own = this.own.get(col), h = y - col.floor, n = this.noise;
    // Pale yellowish tuff; soot from lamps high up; the niches hold bones.
    const inNiche = own && own.across[0] > CATACOMBS.half + 0.1 && own.ends[0] > 0.6 && h > 0.25 && h < 2.2 ? 1 : 0;
    const soot = smoothstep(2.2, 3.6, h) * 0.45;
    const grain = 0.92 + 0.08 * n.n2(x / 1.3 + y / 2, z / 1.3);
    if (inNiche) {
      const bone = 0.5 + 0.5 * n.n2(x * 3.1 + y * 2, z * 3.1 - y);
      const k = bone > 0.3 ? 1 : 0.35;
      out[o] = 0.78 * k; out[o + 1] = 0.74 * k; out[o + 2] = 0.62 * k;
      return;
    }
    const k = grain * (1 - soot);
    out[o] = (B.rock[0] * 1.25 + 0.12) * k;
    out[o + 1] = (B.rock[1] * 1.25 + 0.1) * k;
    out[o + 2] = (B.rock[2] * 1.15 + 0.04) * k;
  }

  /** A passage from another style ends at the dug grid node nearest (x, z) (E3). */
  portal(x: number, z: number): [number, number] {
    const G = CATACOMBS.grid, u = x * this.cos + z * this.sin, v = -x * this.sin + z * this.cos;
    const i0 = Math.round(u / G), j0 = Math.round(v / G);
    let bi = i0, bj = j0, bd = Infinity;
    for (let j = j0 - 2; j <= j0 + 2; j++) for (let i = i0 - 2; i <= i0 + 2; i++) {
      const open = this.dug(i, j, 0) || this.dug(i - 1, j, 0) || this.dug(i, j, 1) || this.dug(i, j - 1, 1);
      const d = Math.hypot(i * G - u, j * G - v);
      if (open && d < bd) { bd = d; bi = i; bj = j; }
    }
    const pu = bi * G, pv = bj * G;
    return [pu * this.cos - pv * this.sin, pu * this.sin + pv * this.cos];
  }

  /** What was left on the galleries' floors: piles of bones, a skull, burnt-down candles. */
  props(d: Dress): void {
    const pile = propModel('prop_bone_pile'), skull = propModel('prop_skull'), candles = propModel('prop_candles');
    scatter(d, 3.5, 0xb0e, 1.5, (x, z, g, r) => {
      const roll = r(3), yaw = r(4) * Math.PI * 2;
      if (roll < 0.04) { d.solid.stamp(pile, x, g - 0.03, z, yaw, { scale: 1 + 0.8 * r(5) }); d.block(x, z, yaw, 0.35, 0.35, g, g + 0.4); }
      else if (roll < 0.16) d.solid.stamp(skull, x, g - 0.01, z, yaw, { scale: 1.2 + 0.5 * r(5) });
      else if (roll < 0.22) d.solid.stamp(candles, x, g - 0.01, z, yaw, { scale: 1.3 });
      else return;
      d.placed();
    });
  }

  climbable(): boolean {
    return true;
  }
}
