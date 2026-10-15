/**
 * A level: the one density function and everything derived from it (docs/ARCHITECTURE.md:
 * "Is this point rock or air?"). Pure data, so it runs in workers and in headless tests.
 *
 * Which kind of place a depth is (the Quarry, the Salt Works...) is its band (src/gen/bands.ts).
 */
import { deriveSeed } from '@futuremagic/core';
import { bandOf, type Band } from './bands';
import { QuarryField, newColumn, type Column, type Working } from './quarry';
import { Descents, findAscent, ladderTop, type Shaft } from './descents';

export type ColorMode = 'rock' | 'working' | 'lod';
export const COLOR_MODES: readonly ColorMode[] = ['rock', 'working', 'lod'];

export interface Grid {
  /** Samples per axis (cells + 1). */
  n: number;
  /** Signed distances, x fastest, then y, then z. */
  d: Float32Array;
}

/** A sampled grid plus its columns (x fastest, then z), for colouring without re-evaluating. */
export interface SampledGrid extends Grid {
  ox: number;
  oz: number;
  step: number;
  columns: Column[];
}

export class Level {
  readonly field: QuarryField;
  /** What kind of place this level is. */
  readonly band: Band;
  /** The ways down to the next level (shafts). */
  readonly descents: Descents;
  private readonly col = newColumn();
  private arrival_: [number, number, number] | null = null;
  private ascent_: Shaft | null | undefined;

  constructor(readonly seed: number, readonly depth: number) {
    this.band = bandOf(depth);
    this.field = new QuarryField(deriveSeed(seed, 'level', depth), this.band);
    this.descents = new Descents(this.field, seed, depth, () => [this.arrival[0], this.arrival[2]], () => this.ascent);
  }

  /** The way up, where one arrives from the level above (null on the first level, or if no pillar there will do). */
  get ascent(): Shaft | null {
    if (this.ascent_ === undefined) {
      this.ascent_ = null;
      // In the arrival hall, else in one further out.
      for (let k = 0; k < 6 && this.depth > 1 && !this.ascent_; k++) {
        const [x, , z] = this.spawn(k ? Math.cos(k) * 300 : 0, k ? Math.sin(k) * 300 : 0);
        this.ascent_ = findAscent(this.field, x, z);
      }
    }
    return this.ascent_;
  }

  /**
   * Where a player arrives on this level: at the foot of the way up below the first level, else
   * (and at the start) `spawn()` near the origin.
   */
  get arrival(): [number, number, number] {
    if (!this.arrival_) {
      const a = this.ascent;
      if (a) {
        const [x, z] = ladderTop(a);
        this.arrival_ = [x, a.floor, z];
      } else this.arrival_ = this.spawn();
    }
    return this.arrival_;
  }

  /** Signed distance to rock in metres: positive in air, negative in rock. */
  sdf(x: number, y: number, z: number): number {
    const d = this.field.at(this.field.column(x, z, this.col), x, y, z);
    const s = this.descents.of(x, z);
    return s ? shaftAir(s, d, x, y, z) : d;
  }

  /**
   * Which way the rock faces at (x, y, z): the field's gradient, normalised (pointing into the air),
   * written into `out`. From four samples on a tetrahedron, `e` metres apart.
   */
  normal(x: number, y: number, z: number, out: [number, number, number], e = 0.05): [number, number, number] {
    const a = this.sdf(x + e, y - e, z - e), b = this.sdf(x - e, y - e, z + e);
    const c = this.sdf(x - e, y + e, z - e), d = this.sdf(x + e, y + e, z + e);
    const nx = a - b - c + d, ny = -a - b + c + d, nz = -a + b - c + d;
    const len = Math.hypot(nx, ny, nz) || 1;
    out[0] = nx / len; out[1] = ny / len; out[2] = nz / len;
    return out;
  }

  /**
   * How far a ray from (x, y, z) along the unit direction (dx, dy, dz) travels before it reaches rock
   * (sphere tracing the field), up to `max` metres. Stops `skin` metres short of the surface.
   */
  trace(x: number, y: number, z: number, dx: number, dy: number, dz: number, max: number, skin = 0.05): number {
    let t = 0;
    for (let i = 0; i < 96 && t < max; i++) {
      const d = this.sdf(x + dx * t, y + dy * t, z + dz * t);
      if (d < skin) return Math.max(0, t - skin);
      t += Math.max(d * 0.8, 0.02); // the field is only nearly 1-Lipschitz
    }
    return Math.min(t, max);
  }

  workingAt(x: number, z: number): Working {
    return this.field.workingAt(x, z);
  }

  /** Floor height under column (x, z) of the working there (ignores pillars). */
  floorAt(x: number, z: number): number {
    return this.field.column(x, z, this.col).floor;
  }

  /** The y-independent part of the field at column (x, z): working, floor, pillars, border, rubble. Reused: copy what you keep. */
  columnAt(x: number, z: number): Column {
    return this.field.column(x, z, this.col);
  }

  /**
   * Height of the rock surface under (x, z) on open floor, roughness included (where props stand).
   * Starts at the floor and steps along the field, at most a metre; under a pillar or a wall the answer means little.
   */
  /** Is (x, z) dry ground, its floor `margin` metres or more above the water? */
  dry(x: number, z: number, margin: number): boolean {
    return this.groundAt(x, z) > this.waterAt(x, z) + margin;
  }

  groundAt(x: number, z: number): number {
    const f = this.floorAt(x, z);
    let y = f;
    for (let i = 0; i < 3; i++) {
      const d = this.sdf(x, y, z);
      if (Math.abs(d) < 0.01) break;
      y = Math.min(f + 1, Math.max(f - 1, y - d)); // roughness is under half a metre
    }
    return y;
  }

  /** Height of the water surface at (x, z): wherever the ground is lower, there is water. */
  waterAt(x: number, z: number): number {
    return this.field.water(x, z);
  }

  /** Sample an n×n×n grid starting at origin with spacing `step` (one column pass per (x, z)). */
  sampleGrid(ox: number, oy: number, oz: number, step: number, n: number): SampledGrid {
    const d = new Float32Array(n * n * n);
    const columns: Column[] = new Array(n * n);
    for (let k = 0; k < n; k++) {
      const z = oz + k * step;
      for (let i = 0; i < n; i++) {
        const x = ox + i * step;
        const col = this.field.column(x, z, newColumn());
        columns[i + n * k] = col;
        const s = this.descents.of(x, z);
        for (let j = 0; j < n; j++) {
          const y = oy + j * step, f = this.field.at(col, x, y, z);
          d[i + n * (j + n * k)] = s ? shaftAir(s, f, x, y, z) : f;
        }
      }
    }
    return { n, d, ox, oz, step, columns };
  }

  /** Vertex colours (linear RGB) for mesh positions inside a sampled grid, from its nearest columns. */
  colors(grid: SampledGrid, positions: Float32Array, mode: ColorMode, lod: number): Float32Array {
    const out = new Float32Array(positions.length);
    const { n, ox, oz, step, columns } = grid;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i], y = positions[i + 1], z = positions[i + 2];
      const ci = Math.min(n - 1, Math.max(0, Math.round((x - ox) / step)));
      const ck = Math.min(n - 1, Math.max(0, Math.round((z - oz) / step)));
      const col = columns[ci + n * ck];
      if (mode === 'rock') this.field.color(col, x, y, z, out, i);
      else if (mode === 'working') hueOf(col.working.id, out, i);
      else hueOf(lod * 0x9e3779b9, out, i);
    }
    return out;
  }

  /** A good place to start: in the air of a hall, `above` metres over the floor, near (x, z). */
  spawn(x = 0, z = 0, above = 12): [number, number, number] {
    // First look for a grand hall (wide pillar spacing), then for any intact, roomy one.
    for (const minSpacing of [30, 0]) for (let r = 0; r < 1500; r += 5) {
      for (let a = 0; a < 16; a++) {
        const px = x + Math.cos(a * 0.39) * r, pz = z + Math.sin(a * 0.39) * r;
        const w = this.workingAt(px, pz);
        if (w.collapse > 0 || w.cavern || w.height < above + 6 || w.spacing < minSpacing) continue;
        const f = this.floorAt(px, pz);
        if (f < this.waterAt(px, pz) + 1) continue;
        // (The field without shafts: the shafts are placed from the arrival, which is found here.)
        const col = this.field.column(px, pz, this.col);
        if (this.field.at(col, px, f + 5, pz) > 3.5 && this.field.at(col, px, f + above, pz) > 3) return [px, f + above, pz];
      }
    }
    return [x, this.floorAt(x, z) + above, z];
  }
}

/** The field `d` with shaft s's air added: a cylinder from its bottom up through the floor. */
function shaftAir(s: Shaft, d: number, x: number, y: number, z: number): number {
  return Math.max(d, Math.min(s.r - Math.hypot(x - s.x, z - s.z), y - s.bottom, s.top + 2 - y));
}

function hueOf(id: number, out: Float32Array, o: number): void {
  const h = ((id >>> 0) % 997) / 997;
  const k = (n: number) => {
    const t = (n + h * 6) % 6;
    return 0.15 + 0.55 * Math.max(0, Math.min(1, Math.abs(t - 3) - 1));
  };
  out[o] = k(0); out[o + 1] = k(4); out[o + 2] = k(2);
}
