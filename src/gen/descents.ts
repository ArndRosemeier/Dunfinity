/**
 * The ways down (docs/design/level-generator.md, "Descents"): in the Quarry, old mine shafts cut
 * into the floor of intact workings, with a headframe over them and an iron ladder down one wall.
 * Their density rises with distance from where you arrived (the Territories rule, D2): near the
 * arrival there are none, far out they are common.
 *
 * Pure data. The plane is split into cells of SHAFT.cell metres; each cell holds at most one shaft,
 * kept well inside the cell, so a point only ever needs its own cell's shaft.
 */
import { deriveSeed, hash3f } from '@futuremagic/core';
import { newColumn, type QuarryField } from './quarry';

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
  /** Floor height at the rim. */
  top: number;
  bottom: number;
  /** Direction (radians, from +x towards +z) of the wall the ladder goes down. */
  ladder: number;
}

/** Where on the rim the ladder starts (x, z), standing on the floor just outside the shaft. */
export function ladderTop(s: Shaft, out: [number, number] = [0, 0]): [number, number] {
  out[0] = s.x + Math.cos(s.ladder) * (s.r + 0.5);
  out[1] = s.z + Math.sin(s.ladder) * (s.r + 0.5);
  return out;
}

export class Descents {
  private readonly seed: number;
  private readonly cells = new Map<number, Shaft | null>();
  private readonly col = newColumn();

  /** `arrival`: where a player arrives on this level (x, z), asked for lazily. */
  constructor(private readonly field: QuarryField, seed: number, depth: number, private readonly arrival: () => [number, number]) {
    this.seed = deriveSeed(seed, 'descents', depth);
  }

  /** The shaft of the cell containing (x, z), wherever in the cell (the field adds it everywhere there). */
  of(x: number, z: number): Shaft | null {
    return this.cell(Math.floor(x / SHAFT.cell), Math.floor(z / SHAFT.cell));
  }

  /** The shaft of the cell containing (x, z), if (x, z) is within `margin` metres of its rim. */
  at(x: number, z: number, margin = 0): Shaft | null {
    const s = this.of(x, z);
    return s && Math.hypot(x - s.x, z - s.z) < s.r + margin ? s : null;
  }

  /** The nearest shaft to (x, z) within `max` metres, or null. */
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

  /** Shafts whose centre lies in [x0, x1) × [z0, z1). */
  within(x0: number, z0: number, x1: number, z1: number): Shaft[] {
    const c = SHAFT.cell, out: Shaft[] = [];
    for (let j = Math.floor(z0 / c); j <= Math.floor((z1 - 1e-6) / c); j++) for (let i = Math.floor(x0 / c); i <= Math.floor((x1 - 1e-6) / c); i++) {
      const s = this.cell(i, j);
      if (s && s.x >= x0 && s.x < x1 && s.z >= z0 && s.z < z1) out.push(s);
    }
    return out;
  }

  private cell(i: number, j: number): Shaft | null {
    const key = (i + 32768) * 65536 + (j + 32768);
    let s = this.cells.get(key);
    if (s === undefined) {
      s = this.place(i, j);
      this.cells.set(key, s);
    }
    return s;
  }

  /** Whether cell (i, j) has a shaft, and where: the first of a few candidate spots that fits. */
  private place(i: number, j: number): Shaft | null {
    const c = SHAFT.cell, edge = SHAFT.radius + 12;
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
      return { x, z, r: SHAFT.radius, top, bottom: top - SHAFT.depth, ladder: hash3f(this.seed, i, j, 99) * Math.PI * 2 };
    }
    return null;
  }

  /** The floor height if a shaft fits at (x, z) of working `id`: dry, level, open floor with headroom. */
  private fits(x: number, z: number, id: number): number | null {
    const f = this.field, col = this.col;
    f.column(x, z, col);
    if (col.working.id !== id || col.working.collapse > 0) return null;
    const top = col.floor;
    if (top < f.water(x, z) + 1 || f.at(col, x, top + 6, z) < 3) return null;
    for (let a = 0; a < 8; a++) {
      const r = SHAFT.radius + 2;
      const cx = x + Math.cos((a * Math.PI) / 4) * r, cz = z + Math.sin((a * Math.PI) / 4) * r;
      f.column(cx, cz, col);
      if (col.working.id !== id || col.border < 8 || col.pillarD < 1 || col.rubble > 0.02 || Math.abs(col.floor - top) > 0.6) return null;
    }
    return top;
  }
}
