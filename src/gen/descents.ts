/**
 * The ways down (docs/design/level-generator.md, "Descents"): in the Quarry, old mine shafts cut
 * into the floor of intact workings, with a headframe over them and an iron ladder down one wall.
 * Their density rises with distance from where you arrived (the Territories rule, D2): near the
 * arrival there are none, far out they are common.
 *
 * Below the first level, you arrive at the foot of the way back up: a ladder up the side of a pillar
 * and through a shaft in the ceiling (the bottom of the shaft you came down).
 *
 * Pure data. The plane is split into cells of SHAFT.cell metres; each cell holds at most one shaft,
 * kept well inside the cell, so a point only ever needs its own cell's shaft (or the way up).
 */
import { deriveSeed, hash3f } from '@futuremagic/core';
import { newColumn, type QuarryField } from './quarry';
import { CellMemo } from './cellMemo';
import { owns } from './style';

export const SHAFT = {
  /** Shaft radius, metres. */
  radius: 2.2,
  /** From the floor to the shaft's bottom, metres: a fall in is fatal. */
  depth: 40,
  /** Cell size, metres. */
  cell: 260,
  /** No shafts closer than this to the arrival, metres. */
  quiet: 220,
  /** Distance over which the chance of a shaft per cell rises to its maximum, metres. */
  ramp: 900,
  /** Chance of a shaft in a cell right outside the quiet zone, and far out. */
  near: 0.15,
  far: 0.75,
} as const;

export interface Shaft {
  x: number;
  z: number;
  r: number;
  /** Air from `bottom` up to `top` + 2 (a way down: `top` is the floor at its rim). */
  top: number;
  bottom: number;
  /** Direction (radians, from +x towards +z) of the wall the ladder is on. */
  ladder: number;
  /** The way up (into the ceiling, its ladder down a pillar), rather than a way down. */
  up: boolean;
  /** The floor where one gets on or off the ladder: at the rim (= top) or at the foot. */
  floor: number;
}

/** Rung spacing of every ladder, metres. */
export const RUNG = 0.3;

/**
 * A ladder on a wall, as a climber needs it: the line of the rungs, which way the wall is, where
 * the rungs are, and the floor one gets on or off at (over the rim at its top, or at its foot).
 */
export interface Ladder {
  /** The rungs' middle line (x, z). */
  x: number;
  z: number;
  /** Unit vector from the climbing side into the wall. */
  nx: number;
  nz: number;
  /** Rung heights: the lowest and the highest (a multiple of RUNG apart). */
  lo: number;
  hi: number;
  /** The floor where one gets on or off: at the rim over the top (a way down) or at the foot (a way up). */
  floor: number;
  /** Half the width between the stiles. */
  halfWidth: number;
  /** Got on and off over a rim at the top (true), or at the foot (false). */
  rim: boolean;
}

/** A shaft's ladder. Down a way down from the rim (50 rungs); up the pillar and the shaft of a way up. */
export function ladderOf(s: Shaft): Ladder {
  const nx = Math.cos(s.ladder), nz = Math.sin(s.ladder);
  const off = s.up ? ASCENT.standoff : 0.12;
  const x = s.x + nx * (s.r - off), z = s.z + nz * (s.r - off);
  if (!s.up) return { x, z, nx, nz, lo: s.top + 0.6 - 49 * RUNG, hi: s.top + 0.6, floor: s.top, halfWidth: 0.25, rim: true };
  return { x, z, nx, nz, lo: s.floor + RUNG, hi: s.floor + RUNG * Math.floor((s.top - s.floor) / RUNG), floor: s.floor, halfWidth: 0.25, rim: false };
}

/** Where one stands on the floor to get on the ladder (x, z): outside the rim, or at the foot. */
export function ladderTop(s: Shaft, out: [number, number] = [0, 0]): [number, number] {
  const l = ladderOf(s), d = s.up ? -0.75 : 0.62; // (a way down: half a metre outside the rim)
  out[0] = l.x + l.nx * d;
  out[1] = l.z + l.nz * d;
  return out;
}

/** The way up: shaft radius, how far its ladder stands off the pillar, its air above the ceiling. */
export const ASCENT = { radius: 1.5, standoff: 0.45, above: 24 } as const;

export class Descents {
  private readonly seed: number;
  private readonly cells = new CellMemo<Shaft | null>((i, j) => this.place(i, j));
  private readonly col = newColumn();

  /**
   * `arrival`: where a player arrives on this level (x, z); `ascent`: the way up there (null on the
   * first level). Both asked for lazily. `only`: the one way down there is (the cellar's old shaft).
   */
  constructor(private readonly field: QuarryField, seed: number, depth: number, private readonly arrival: () => [number, number], private readonly ascent: () => Shaft | null, private readonly only?: Shaft) {
    this.seed = deriveSeed(seed, 'descents', depth);
  }

  /** The way up (null on the first level). */
  get up(): Shaft | null { return this.ascent(); }

  /** The shaft at (x, z): the way up if near it, else the shaft of the cell (the field adds it everywhere there). */
  of(x: number, z: number): Shaft | null {
    const a = this.ascent();
    if (a && Math.abs(x - a.x) < a.r + 1 && Math.abs(z - a.z) < a.r + 1) return a;
    return this.cell(Math.floor(x / SHAFT.cell), Math.floor(z / SHAFT.cell));
  }

  /** The shaft of the cell containing (x, z), if (x, z) is within `margin` metres of its rim. */
  at(x: number, z: number, margin = 0): Shaft | null {
    const s = this.of(x, z);
    return s && Math.hypot(x - s.x, z - s.z) < s.r + margin ? s : null;
  }

  /** The nearest way down to (x, z) within `max` metres, or null. */
  nearest(x: number, z: number, max: number): Shaft | null {
    const c = SHAFT.cell, n = Math.ceil(max / c);
    const cx = Math.floor(x / c), cz = Math.floor(z / c);
    let best: Shaft | null = null, bd = max;
    for (let j = cz - n; j <= cz + n; j++) for (let i = cx - n; i <= cx + n; i++) {
      const s = this.cell(i, j);
      const d = s ? Math.hypot(s.x - x, s.z - z) : Infinity;
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  /** Shafts (the way up included) whose centre lies in [x0, x1) × [z0, z1). */
  within(x0: number, z0: number, x1: number, z1: number): Shaft[] {
    const c = SHAFT.cell, out: Shaft[] = [];
    const a = this.ascent();
    if (a && a.x >= x0 && a.x < x1 && a.z >= z0 && a.z < z1) out.push(a);
    for (let j = Math.floor(z0 / c); j <= Math.floor((z1 - 1e-6) / c); j++) for (let i = Math.floor(x0 / c); i <= Math.floor((x1 - 1e-6) / c); i++) {
      const s = this.cell(i, j);
      if (s && s.x >= x0 && s.x < x1 && s.z >= z0 && s.z < z1) out.push(s);
    }
    return out;
  }

  private cell(i: number, j: number): Shaft | null {
    return this.cells.at(i, j);
  }

  /** Whether cell (i, j) has a shaft, and where: the first of a few candidate spots that fits. */
  private place(i: number, j: number): Shaft | null {
    const c = SHAFT.cell, edge = SHAFT.radius + 12, o = this.only;
    if (o) return Math.floor(o.x / c) === i && Math.floor(o.z / c) === j ? o : null;
    const [ax, az] = this.arrival();
    const d = Math.hypot((i + 0.5) * c - ax, (j + 0.5) * c - az);
    if (d < SHAFT.quiet) return null;
    const p = SHAFT.near + (SHAFT.far - SHAFT.near) * Math.min(1, (d - SHAFT.quiet) / SHAFT.ramp);
    if (hash3f(this.seed, i, j, 0) > p) return null;
    for (let k = 0; k < 8; k++) {
      const px = i * c + edge + hash3f(this.seed, i, j, 1 + 2 * k) * (c - 2 * edge);
      const pz = j * c + edge + hash3f(this.seed, i, j, 2 + 2 * k) * (c - 2 * edge);
      // Snap to the nearest aisle crossing of the working there: the widest open floor.
      const w = this.field.workingAt(px, pz);
      const [u, v] = this.field.toGrid(w, px, pz);
      const [x, z] = this.field.fromGrid(w, Math.round(u / w.spacing) * w.spacing, Math.round(v / w.spacing) * w.spacing);
      if (x < i * c + edge || x >= (i + 1) * c - edge || z < j * c + edge || z >= (j + 1) * c - edge) continue;
      const top = this.fits(x, z, w.id);
      if (top === null) continue;
      return { x, z, r: SHAFT.radius, top, bottom: top - SHAFT.depth, ladder: hash3f(this.seed, i, j, 99) * Math.PI * 2, up: false, floor: top };
    }
    return null;
  }

  /** The floor height if a shaft fits at (x, z) of working `id`: dry, level, open floor with headroom. */
  private fits(x: number, z: number, id: number): number | null {
    const f = this.field, col = this.col;
    f.column(x, z, col);
    if (col.working.id !== id || col.working.collapse > 0 || !owns(f, x, z)) return null;
    const top = col.floor;
    if (top < f.water(x, z) + 1 || f.at(col, x, top + 6, z) < 3) return null;
    for (let a = 0; a < 8; a++) {
      const r = SHAFT.radius + 2;
      const cx = x + Math.cos((a * Math.PI) / 4) * r, cz = z + Math.sin((a * Math.PI) / 4) * r;
      f.column(cx, cz, col);
      if (col.working.id !== id || !owns(f, cx, cz) || col.border < 8 || col.pillarD < 1 || col.rubble > 0.02 || Math.abs(col.floor - top) > 0.6) return null;
    }
    return top;
  }
}

/**
 * The way up near (hx, hz), the hall where one arrives: a ladder up the side of the nearest whole
 * pillar facing the hall, into a shaft through the ceiling. Null if no pillar there will do.
 */
export function findAscent(field: QuarryField, hx: number, hz: number): Shaft | null {
  const w = field.workingAt(hx, hz), s = w.spacing, half = w.pillar / 2;
  const [u, v] = field.toGrid(w, hx, hz);
  const iu0 = Math.floor(u / s), iv0 = Math.floor(v / s);
  const col = newColumn();
  const cands: [number, number, number][] = [];
  for (let dv = -5; dv <= 5; dv++) for (let du = -5; du <= 5; du++) {
    const iu = iu0 + du, iv = iv0 + dv;
    cands.push([Math.hypot((iu + 0.5) * s - u, (iv + 0.5) * s - v), iu, iv]);
  }
  cands.sort((a, b) => a[0] - b[0]);
  for (const [, iu, iv] of cands) {
    if (field.pillarAt(w, iu, iv) !== 'whole') continue;
    const cu = (iu + 0.5) * s, cv = (iv + 0.5) * s;
    // The face looking towards the hall point.
    const du = u - cu, dv = v - cv;
    const [fu, fv] = Math.abs(du) > Math.abs(dv) ? [cu + Math.sign(du) * half, cv] : [cu, cv + Math.sign(dv) * half];
    const [cx, cz] = field.fromGrid(w, cu, cv), [fx, fz] = field.fromGrid(w, fu, fv);
    const n = Math.hypot(cx - fx, cz - fz) || 1, nx = (cx - fx) / n, nz = (cz - fz) / n; // into the pillar
    // The floor at the foot: open, at most a puddle.
    const footX = fx - nx * 1.2, footZ = fz - nz * 1.2;
    field.column(footX, footZ, col);
    if (col.working.id !== w.id || col.collapse > 0.2 || col.rubble > 0.05 || col.floor < field.water(footX, footZ) - 0.4 || !owns(field, footX, footZ)) continue; // (a puddle will do)
    const floor = col.floor;
    field.column(fx - nx * 0.6, fz - nz * 0.6, col);
    const ceiling = col.ceiling;
    if (ceiling - floor > 80) continue;
    // Room to climb in front of the face all the way up, and the face right behind the rungs.
    let fits = true;
    for (let y = floor + 0.5; y < ceiling - 1 && fits; y += 1.5) {
      const ax = fx - nx * (ASCENT.standoff + 0.4), az = fz - nz * (ASCENT.standoff + 0.4);
      fits = field.at(field.column(ax, az, col), ax, y, az) > 0.45 && field.at(field.column(fx + nx * 0.2, fz + nz * 0.2, col), fx + nx * 0.2, y, fz + nz * 0.2) < 0.1;
    }
    if (!fits) continue;
    const r = ASCENT.radius;
    return { x: fx - nx * r, z: fz - nz * r, r, top: ceiling + ASCENT.above, bottom: ceiling - 2, ladder: Math.atan2(nz, nx), up: true, floor };
  }
  return null;
}
