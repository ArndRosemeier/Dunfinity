/**
 * The karst style (docs/design/level-styles.md; level-generator.md §3, dissolution): what water
 * dissolved out of the limestone long before anyone dug. Big domed chambers, each in its cell of a
 * jittered grid, joined by round-roofed tubes that meander a little; the walls smooth and
 * scalloped, the floors gently uneven and, where they dip under the water table, flooded sumps.
 * Nothing cut, no pillars: the opposite of the excavation's halls.
 *
 * In plan, the chambers and tubes are discs and capsules; their union (`inside`, metres in from
 * the nearest wall) is the cave's outline. Over it each one raises a roof from the floor, steeply
 * near the wall and flat in the middle (no steeper than ROOF, so the field stays near 1-Lipschitz).
 * Its envelope (E1) is the floor and that roof.
 *
 * Pure, like every style.
 */
import { Noise, deriveSeed, hash2i, hashToFloat, smoothstep } from '@futuremagic/core';
import type { Band } from './bands';
import { unworked, type Column, type Working } from './quarry';
import type { Style, StyleId } from './style';

export const KARST = {
  /** Chambers stand in cells this big, metres; this share of cells has one. */
  cell: 130,
  chance: 0.85,
  /** A chamber's radius and dome height (min, extra), metres; its floor's spread around the level's. */
  radius: [24, 40] as const,
  dome: [10, 30] as const,
  floor: 6,
  /** Tubes to the next cell along x and z, and diagonally: their chances, half widths (min, extra). */
  tube: { straight: 0.8, diagonal: 0.35, half: [4, 6] as const },
  /** The roof rises from the floor no steeper than this (rise per metre in from the wall). */
  roof: 1.15,
  /** The outline meanders: by up to this much, over this distance, metres. */
  warp: [7, 140] as const,
} as const;

/** Rock further than this from any chamber or tube counts as this far, metres (every feature nearer is in the cells looked at). */
const FAR = 60;
/** How far a passage from another style looks for a chamber to end in, metres. */
const PORTAL = 60;

/** What a karst column is to the code that asks about workings: one natural cavern, no pillar grid. */
const CAVE: Working = { id: 0x6b617273, angle: 0, spacing: 1e9, pillar: 0, floor: 0, height: 12, collapse: 0, cavern: true, cx: 0, cz: 0 };

interface Chamber {
  x: number;
  z: number;
  r: number;
  dome: number;
  floor: number;
}

export class Karst implements Style {
  readonly id: StyleId = 'karst';
  /** Pale flowstone on the map. */
  readonly mapFloor = [0.62, 0.62, 0.58] as const;
  private readonly noise: Noise;
  private readonly rough: Noise;
  private readonly cellSeed: number;
  private readonly chambers = new Map<number, Chamber | null>();

  constructor(readonly seed: number, readonly band: Band) {
    this.noise = new Noise(deriveSeed(seed, 'karst', 'shape'));
    this.rough = new Noise(deriveSeed(seed, 'karst', 'rough'));
    this.cellSeed = deriveSeed(seed, 'karst', 'chambers');
  }

  /** The chamber of cell (i, j), if it has one. */
  chamber(i: number, j: number): Chamber | null {
    const key = hash2i(this.cellSeed, i, j);
    let c = this.chambers.get(key);
    if (c === undefined) {
      const f = (k: number) => hashToFloat(hash2i(key, k, 11)), K = KARST;
      if (f(0) >= K.chance) c = null;
      else {
        const r = K.radius[0] + K.radius[1] * f(3);
        c = { x: (i + 0.2 + 0.6 * f(1)) * K.cell, z: (j + 0.2 + 0.6 * f(2)) * K.cell, r, dome: Math.min(K.dome[0] + K.dome[1] * f(4), r * K.roof * 0.9), floor: (f(5) - 0.5) * K.floor };
      }
      if (this.chambers.size > 4096) this.chambers.clear();
      this.chambers.set(key, c);
    }
    return c;
  }

  /** Whether cell (i, j)'s chamber has a tube to cell (i + di, j + dj). */
  private tube(i: number, j: number, di: number, dj: number): number {
    const h = hashToFloat(hash2i(this.cellSeed ^ 0x51ed, i * 4 + di + 1, j * 4 + dj + 1));
    return h < (di && dj ? KARST.tube.diagonal : KARST.tube.straight) ? KARST.tube.half[0] + KARST.tube.half[1] * hashToFloat(hash2i(this.cellSeed, i * 7 + di, j * 7 + dj)) : 0;
  }

  column(x: number, z: number, col: Column): Column {
    const K = KARST, n = this.noise;
    // Meander: the outline is looked up at a slowly wandering point.
    const wx = x + n.n2(x / K.warp[1] + 5.3, z / K.warp[1] - 1.7) * K.warp[0], wz = z + n.n2(x / K.warp[1] - 8.1, z / K.warp[1] + 3.9) * K.warp[0];
    const ci = Math.floor(wx / K.cell), cj = Math.floor(wz / K.cell);
    // (Features further than FAR count as FAR: the cells looked at hold every nearer one, so none drops out with a jump.)
    let inside = -FAR, roof = 0, fsum = 0, wsum = Math.exp(-FAR / 5);
    const take = (fd: number, height: number, floor: number) => {
      inside = Math.max(inside, fd);
      roof = Math.max(roof, height * smoothstep(0, height / K.roof * 1.5, fd));
      // (Over 5 m, not less: where a tube's floor meets a chamber's a few metres higher, a quicker
      // blend made floors steeper than the field's distances allow, and the floor jumped.)
      const wt = Math.exp(Math.min(fd, 6) / 5);
      fsum += wt * floor; wsum += wt;
    };
    for (let dj = -2; dj <= 1; dj++) for (let di = -2; di <= 1; di++) {
      const a = this.chamber(ci + di, cj + dj);
      if (!a) continue;
      if (di >= -1 && dj >= -1) take(a.r - Math.hypot(wx - a.x, wz - a.z), a.dome, a.floor);
      for (const [ti, tj] of [[1, 0], [0, 1], [1, 1]] as const) {
        const half = this.tube(ci + di, cj + dj, ti, tj), b = half ? this.chamber(ci + di + ti, cj + dj + tj) : null;
        if (!b) continue;
        // Along the tube: its floor runs from one chamber's to the other's, level inside each chamber.
        const ex = b.x - a.x, ez = b.z - a.z, len2 = ex * ex + ez * ez, len = Math.sqrt(len2);
        const t = Math.max(0, Math.min(1, ((wx - a.x) * ex + (wz - a.z) * ez) / len2));
        const fd = half - Math.hypot(wx - a.x - ex * t, wz - a.z - ez * t);
        const floor = a.floor + (b.floor - a.floor) * smoothstep(a.r / len, 1 - b.r / len, t);
        take(fd, half * 1.1, floor);
      }
    }
    const floor = fsum / wsum;
    col.floor = floor + n.fbm2(x / 22, z / 22, 3) * 0.5;
    col.ceiling = col.floor + roof + n.n2(x / 30, z / 30) * 0.8 * smoothstep(2, 8, roof);
    col.wall = inside;
    unworked(col, CAVE, 1000, 1);
    return col;
  }

  at(col: Column, x: number, y: number, z: number): number {
    // The roof term leans: a roof rising ROOF per metre is that much less than its height away.
    const d = Math.min(y - col.floor, (col.ceiling - y) / 1.3, col.wall);
    // Smooth, scalloped walls; the floor itself only a little uneven (walkable).
    const up = smoothstep(0.5, 2.5, y - col.floor);
    const r = this.rough.n3(x / 5, y / 5, z / 5) * 0.3 * up + this.rough.n3(x / 1.6, y / 1.6, z / 1.6) * 0.05;
    return d + r;
  }

  color(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    const B = this.band;
    // Flowstone: pale, creamy, streaked downwards; darker and damp low down.
    const streak = 0.5 + 0.5 * this.noise.n2(x / 2.2 + z / 3.1, y / 14);
    const damp = smoothstep(1.5, 0, y - col.floor) * 0.25;
    const k = (1.08 + 0.12 * streak) * (1 - damp);
    out[o] = (B.rock[0] * 1.05 + 0.04) * k;
    out[o + 1] = (B.rock[1] * 1.02 + 0.03) * k;
    out[o + 2] = (B.rock[2] * 0.95 + 0.015) * k;
  }

  /** A passage from another style ends in the chamber nearest (x, z) (E3), if one is within PORTAL metres; else at (x, z). */
  portal(x: number, z: number): [number, number] {
    const i = Math.floor(x / KARST.cell), j = Math.floor(z / KARST.cell);
    let best: [number, number] = [x, z], bd = PORTAL;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const c = this.chamber(i + di, j + dj), d = c ? Math.hypot(c.x - x, c.z - z) : Infinity;
      if (c && d < bd) { bd = d; best = [c.x, c.z]; }
    }
    return best;
  }

  climbable(): boolean {
    return true;
  }
}
