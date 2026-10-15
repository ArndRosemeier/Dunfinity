/**
 * Parallel meandering lines across a level, all one way (its grain): the rift's faults and the
 * lava's tubes. In a frame turned by the grain angle, line k runs along u at about v = k spacing,
 * strayed by up to `jitter` and meandering by up to `meander[0]` over `meander[1]` metres.
 *
 * Pure, like every style.
 */
import { deriveSeed, hash2i, hashToFloat, type Noise } from '@futuremagic/core';

/** A style's grain on a level: the angle its frame is turned by, from the level's seed and the style's name. */
export function grainOf(seed: number, style: string): number {
  return hashToFloat(deriveSeed(seed, style, 'grain')) * Math.PI;
}

/** The frame turned by a grain angle: u along the grain, v across it (the built styles' grids, the lines below). */
export class Grain {
  readonly cos: number;
  readonly sin: number;

  constructor(grain: number) {
    this.cos = Math.cos(grain);
    this.sin = Math.sin(grain);
  }

  /** Along the grain, at (x, z). */
  u(x: number, z: number): number {
    return x * this.cos + z * this.sin;
  }

  /** Across the grain, at (x, z). */
  v(x: number, z: number): number {
    return -x * this.sin + z * this.cos;
  }

  /** The point (u, v) of the frame, as (x, z). */
  xz(u: number, v: number): [number, number] {
    return [u * this.cos - v * this.sin, u * this.sin + v * this.cos];
  }
}

export class GrainLines extends Grain {
  constructor(
    private readonly noise: Noise,
    private readonly cells: number,
    grain: number,
    readonly spacing: number,
    private readonly jitter: number,
    private readonly meander: readonly [number, number],
  ) {
    super(grain);
  }

  /** The middle of line k at u (its v). */
  line(k: number, u: number): number {
    return k * this.spacing + (hashToFloat(hash2i(this.cells, k, 1)) - 0.5) * 2 * this.jitter + this.noise.n2(u / this.meander[1], k * 7.31) * this.meander[0];
  }

  /** The point of the nearest line straight across from (x, z) (where a passage from another style ends, E3). */
  nearest(x: number, z: number): [number, number] {
    const u = this.u(x, z), v = this.v(x, z), k0 = Math.round(v / this.spacing);
    let best = v, bd = Infinity;
    for (let k = k0 - 2; k <= k0 + 2; k++) {
      const c = this.line(k, u);
      if (Math.abs(v - c) < bd) { bd = Math.abs(v - c); best = c; }
    }
    return this.xz(u, best);
  }
}
