/**
 * Builds merged prop geometry as plain arrays (runs in a worker): many small boxes in one indexed
 * mesh with flat normals and vertex colours, the attribute layout of the solid and glow material kinds.
 */

/** One merged mesh: positions, normals and colours (3 floats per vertex) and triangle indices. */
export interface PropMesh {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
}

/** A direction or half-axis, metres. */
export type V3 = readonly [number, number, number];
/** Linear RGB. */
export type Rgb = readonly [number, number, number];

/** Box faces: the axis a face looks along (0 u, 1 v, 2 w) and its sign. */
const FACES = [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]] as const;

export class PropBuilder {
  private p: number[] = [];
  private n: number[] = [];
  private c: number[] = [];
  private i: number[] = [];

  get empty(): boolean { return this.i.length === 0; }

  /**
   * A box centred at (x, y, z) with half-axis vectors u, v, w (any lengths, roughly at right angles
   * and right-handed: u × v points along w, or the faces wind inside out). Each face is lit by the direction of its axis.
   */
  box(x: number, y: number, z: number, u: V3, v: V3, w: V3, color: Rgb): void {
    const ax = [u, v, w];
    for (const [a, s] of FACES) {
      const n = ax[a], b = ax[(a + 1) % 3], c = ax[(a + 2) % 3];
      const len = Math.hypot(n[0], n[1], n[2]) || 1;
      const base = this.p.length / 3;
      // Corners in an order that winds counter-clockwise seen from outside (for either sign).
      const corners = s > 0 ? [[-1, -1], [1, -1], [1, 1], [-1, 1]] : [[-1, -1], [-1, 1], [1, 1], [1, -1]];
      for (const [cb, cc] of corners) {
        this.p.push(
          x + s * n[0] + cb * b[0] + cc * c[0],
          y + s * n[1] + cb * b[1] + cc * c[1],
          z + s * n[2] + cb * b[2] + cc * c[2],
        );
        this.n.push((s * n[0]) / len, (s * n[1]) / len, (s * n[2]) / len);
        this.c.push(color[0], color[1], color[2]);
      }
      this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  /** An upright box turned by `yaw` about y: half sizes along its own x (sideways), y and z (forward). */
  upright(x: number, y: number, z: number, yaw: number, hx: number, hy: number, hz: number, color: Rgb): void {
    const ca = Math.cos(yaw), sa = Math.sin(yaw);
    this.box(x, y, z, [ca * hx, 0, -sa * hx], [0, hy, 0], [sa * hz, 0, ca * hz], color);
  }

  /** A beam of square-ish section from (x0, y0, z0) to (x1, y1, z1); `side` is the horizontal half width, `up` the half height. */
  beam(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, side: number, up: number, color: Rgb): void {
    const dx = (x1 - x0) / 2, dy = (y1 - y0) / 2, dz = (z1 - z0) / 2;
    const h = Math.hypot(dx, dz) || 1;
    this.box(x0 + dx, y0 + dy, z0 + dz, [dx, dy, dz], [0, up, 0], [(-dz / h) * side, 0, (dx / h) * side], color);
  }

  /**
   * A level-ish quad facing up over [x0, x1] × [z0, z1], with its own height and colour at each
   * corner (in the order (x0, z0), (x1, z0), (x0, z1), (x1, z1)).
   */
  quad(x0: number, z0: number, x1: number, z1: number, y: readonly number[], colors: readonly Rgb[]): void {
    const base = this.p.length / 3;
    this.p.push(x0, y[0], z0, x0, y[2], z1, x1, y[3], z1, x1, y[1], z0);
    for (const k of [0, 2, 3, 1]) { this.n.push(0, 1, 0); this.c.push(colors[k][0], colors[k][1], colors[k][2]); }
    this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  build(): PropMesh | null {
    if (this.empty) return null;
    return {
      positions: new Float32Array(this.p),
      normals: new Float32Array(this.n),
      colors: new Float32Array(this.c),
      indices: new Uint32Array(this.i),
    };
  }
}
