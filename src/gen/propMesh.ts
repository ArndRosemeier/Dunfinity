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

  /** A round tube of radius r from (x0, y0, z0) to (x1, y1, z1), open at the ends, `seg` sides: pipes, rims. */
  tube(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, r: number, color: Rgb, seg = 10): void {
    const ax = x1 - x0, ay = y1 - y0, az = z1 - z0, len = Math.hypot(ax, ay, az) || 1;
    const tx = ax / len, ty = ay / len, tz = az / len;
    // Two directions across the tube: away from whichever world axis is least along it.
    let ux = 0, uy = 0, uz = 0;
    if (Math.abs(ty) < 0.9) { ux = tz; uz = -tx; } else { uy = -tz; uz = ty; }
    const ul = Math.hypot(ux, uy, uz);
    ux /= ul; uy /= ul; uz /= ul;
    const vx = ty * uz - tz * uy, vy = tz * ux - tx * uz, vz = tx * uy - ty * ux;
    const base = this.p.length / 3;
    for (const [px, py, pz] of [[x0, y0, z0], [x1, y1, z1]]) {
      for (let k = 0; k <= seg; k++) {
        const th = (k / seg) * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
        const nx = ux * c + vx * sn, ny = uy * c + vy * sn, nz = uz * c + vz * sn;
        this.p.push(px + nx * r, py + ny * r, pz + nz * r);
        this.n.push(nx, ny, nz);
        this.c.push(color[0], color[1], color[2]);
      }
    }
    for (let k = 0; k < seg; k++) {
      const a = base + k, b = a + seg + 1;
      this.i.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }

  /**
   * A smooth ellipsoid centred at (x, y, z) with radii (rx, ry, rz) along x, y, z, tilted by `pitch`
   * about x (nose down for positive pitch): `seg` around, `seg / 2` rings. For creatures and round things.
   */
  ellipsoid(x: number, y: number, z: number, rx: number, ry: number, rz: number, color: Rgb, seg = 10, pitch = 0): void {
    const base = this.p.length / 3, rings = Math.max(2, seg >> 1);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    for (let v = 0; v <= rings; v++) {
      const ph = (v / rings) * Math.PI, sy = Math.cos(ph), sr = Math.sin(ph);
      for (let u = 0; u <= seg; u++) {
        const th = (u / seg) * Math.PI * 2, ux = Math.cos(th) * sr, uz = Math.sin(th) * sr;
        const px = ux * rx, py = sy * ry, pz = uz * rz;
        let nx = ux / rx, ny = sy / ry, nz = uz / rz;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;
        // Pitch about x: y and z turn.
        this.p.push(x + px, y + py * cp - pz * sp, z + py * sp + pz * cp);
        this.n.push(nx, ny * cp - nz * sp, ny * sp + nz * cp);
        this.c.push(color[0], color[1], color[2]);
      }
    }
    for (let v = 0; v < rings; v++) for (let u = 0; u < seg; u++) {
      const a = base + v * (seg + 1) + u, b = a + seg + 1;
      this.i.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }

  /**
   * An upright cylinder centred at (x, y, z), radius r, half height hy, with caps; `bulge` swells
   * the middle (a barrel: 0.15), `taper` narrows the bottom (a bucket: 0.2). `seg` sides.
   */
  cylinder(x: number, y: number, z: number, r: number, hy: number, color: Rgb, seg = 10, bulge = 0, taper = 0): void {
    const rings = bulge > 0 ? 4 : 1;
    const base = this.p.length / 3;
    const radius = (t: number) => r * (1 + bulge * Math.sin(t * Math.PI)) * (1 - taper * (1 - t));
    for (let v = 0; v <= rings; v++) {
      const t = v / rings, rr = radius(t), slope = (radius(Math.min(1, t + 0.01)) - radius(Math.max(0, t - 0.01))) / (0.02 * 2 * hy);
      for (let u = 0; u <= seg; u++) {
        const th = (u / seg) * Math.PI * 2, cx = Math.cos(th), cz = Math.sin(th);
        const nl = Math.hypot(1, slope);
        this.p.push(x + cx * rr, y - hy + t * 2 * hy, z + cz * rr);
        this.n.push(cx / nl, -slope / nl, cz / nl);
        this.c.push(color[0], color[1], color[2]);
      }
    }
    for (let v = 0; v < rings; v++) for (let u = 0; u < seg; u++) {
      const a = base + v * (seg + 1) + u, b = a + seg + 1;
      this.i.push(a, b, a + 1, a + 1, b, b + 1);
    }
    // Caps: a fan at each end.
    for (const [end, t] of [[1, 1], [-1, 0]] as const) {
      const centre = this.p.length / 3, rr = radius(t), cy = y - hy + t * 2 * hy;
      this.p.push(x, cy, z); this.n.push(0, end, 0); this.c.push(color[0], color[1], color[2]);
      for (let u = 0; u <= seg; u++) {
        const th = (u / seg) * Math.PI * 2;
        this.p.push(x + Math.cos(th) * rr, cy, z + Math.sin(th) * rr); this.n.push(0, end, 0); this.c.push(color[0], color[1], color[2]);
      }
      for (let u = 0; u < seg; u++) {
        if (end > 0) this.i.push(centre, centre + 2 + u, centre + 1 + u);
        else this.i.push(centre, centre + 1 + u, centre + 2 + u);
      }
    }
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

  /**
   * A ribbon between two polylines `a` and `b` (same length, at least 2 points), one quad per step,
   * facing along `normals` (one per step), coloured per step.
   */
  ribbon(a: readonly V3[], b: readonly V3[], normals: readonly V3[], colors: readonly Rgb[]): void {
    const base = this.p.length / 3;
    for (let k = 0; k < a.length; k++) {
      for (const q of [a[k], b[k]]) {
        this.p.push(q[0], q[1], q[2]);
        this.n.push(normals[k][0], normals[k][1], normals[k][2]);
        this.c.push(colors[k][0], colors[k][1], colors[k][2]);
      }
      if (k > 0) {
        const i = base + 2 * k;
        this.i.push(i - 2, i, i + 1, i - 2, i + 1, i - 1);
      }
    }
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

/**
 * The frame at (x, z) turned by `yaw` (as `PropBuilder.upright`): a point `side` across and `fwd`
 * ahead in it (ahead is (sin yaw, cos yaw)), in world x, z.
 */
export function local(x: number, z: number, yaw: number): (side: number, fwd: number) => [number, number] {
  const ca = Math.cos(yaw), sa = Math.sin(yaw);
  return (side, fwd) => [x + ca * side + sa * fwd, z - sa * side + ca * fwd];
}
