/**
 * A level: the one density function and everything derived from it (docs/ARCHITECTURE.md:
 * "Is this point rock or air?"). Pure data, so it runs in workers and in headless tests.
 *
 * For now every depth uses the Quarry; the other bands of levels 1–10 replace it as they land.
 */
import { deriveSeed } from '@futuremagic/core';
import { QuarryField, newColumn, type Column, type Working } from './quarry';

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
  private readonly col = newColumn();

  constructor(readonly seed: number, readonly depth: number) {
    this.field = new QuarryField(deriveSeed(seed, 'level', depth));
  }

  /** Signed distance to rock in metres: positive in air, negative in rock. */
  sdf(x: number, y: number, z: number): number {
    return this.field.at(this.field.column(x, z, this.col), x, y, z);
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
        for (let j = 0; j < n; j++) d[i + n * (j + n * k)] = this.field.at(col, x, oy + j * step, z);
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
        if (w.collapse > 0 || w.height < above + 6 || w.spacing < minSpacing) continue;
        const f = this.floorAt(px, pz);
        if (f < this.waterAt(px, pz) + 1) continue;
        if (this.sdf(px, f + 5, pz) > 3.5 && this.sdf(px, f + above, pz) > 3) return [px, f + above, pz];
      }
    }
    return [x, this.floorAt(x, z) + above, z];
  }
}

function hueOf(id: number, out: Float32Array, o: number): void {
  const h = ((id >>> 0) % 997) / 997;
  const k = (n: number) => {
    const t = (n + h * 6) % 6;
    return 0.15 + 0.55 * Math.max(0, Math.min(1, Math.abs(t - 3) - 1));
  };
  out[o] = k(0); out[o + 1] = k(4); out[o + 2] = k(2);
}
