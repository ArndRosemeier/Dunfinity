/**
 * The things one cannot walk through that are not rock: the props (carts, shacks, crates, barrels,
 * railings, big stones...). Each is an upright box turned about y, from its foot to its top. Pure:
 * the generator lists them per props tile (`PropTile.blockers`), whoever streams the tiles adds and
 * drops them here, and bodies and creatures ask.
 *
 * A box is 8 numbers: centre x, z, half sizes along its own x and z, cos and sin of its yaw (as
 * `PropBuilder.upright`: its x axis is (cos, 0, −sin)), bottom and top.
 */
export const BLOCKER_STRIDE = 8;

export class Blockers {
  private readonly lists = new Map<string, Float32Array>();
  /** Coarse grid of the boxes (cell → flat indices into `all`), rebuilt when lists change. */
  private readonly grid = new Map<number, number[]>();
  private all: Float32Array[] = [];
  private dirty = false;

  /** Add (or replace) the boxes listed under `key` (a props tile). */
  set(key: string, boxes: Float32Array): void {
    if (boxes.length) this.lists.set(key, boxes); else this.lists.delete(key);
    this.dirty = true;
  }

  clear(key: string): void {
    if (this.lists.delete(key)) this.dirty = true;
  }

  /** How many boxes there are. */
  get count(): number {
    let n = 0;
    for (const l of this.lists.values()) n += l.length / BLOCKER_STRIDE;
    return n;
  }

  /**
   * Push a circle of radius r at (x, z), spanning heights y0..y1, out of every box it overlaps.
   * Writes the push into `out` ([dx, dz]); returns whether there was one.
   */
  pushOut(x: number, z: number, r: number, y0: number, y1: number, out: [number, number]): boolean {
    out[0] = 0; out[1] = 0;
    let hit = false;
    this.each(x, z, r, (b, k) => {
      if (b[k + 6] >= y1 || b[k + 7] <= y0) return;
      const p = closest(b, k, x + out[0], z + out[1], r);
      if (!p) return;
      out[0] += p[0]; out[1] += p[1];
      hit = true;
    });
    return hit;
  }

  /** Does a circle of radius r at (x, z), spanning heights y0..y1, overlap any box? */
  hits(x: number, z: number, r: number, y0: number, y1: number): boolean {
    let hit = false;
    this.each(x, z, r, (b, k) => {
      if (!hit && b[k + 6] < y1 && b[k + 7] > y0 && closest(b, k, x, z, r)) hit = true;
    });
    return hit;
  }

  /**
   * How far from (x, y, z) along the unit direction (dx, dy, dz), up to `max`, one stays `skin` clear
   * of every box (as `Level.trace` for the rock): where a camera behind someone has to stop.
   */
  trace(x: number, y: number, z: number, dx: number, dy: number, dz: number, max: number, skin = 0.05): number {
    let t = max;
    this.each(x + dx * max / 2, z + dz * max / 2, max / 2 + skin, (b, k) => {
      // Kept `skin` out of each box; from right by one (inside that margin), out of the box itself.
      const e = enter(b, k, x, y, z, dx, dy, dz, skin);
      const hit = e >= 0 ? e : enter(b, k, x, y, z, dx, dy, dz, 0) - skin;
      if (hit >= -skin && hit < t) t = Math.max(0, hit);
    });
    return t;
  }

  private each(x: number, z: number, r: number, f: (b: Float32Array, k: number) => void): void {
    if (this.dirty) this.index();
    const seen = new Set<number>();
    for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) {
      for (const id of this.grid.get(cellKey(i, j)) ?? []) {
        if (seen.has(id)) continue;
        seen.add(id);
        f(this.all[id >> 16], (id & 0xffff) * BLOCKER_STRIDE);
      }
    }
  }

  private index(): void {
    this.dirty = false;
    this.grid.clear();
    this.all = [...this.lists.values()];
    this.all.forEach((b, li) => {
      for (let n = 0; n * BLOCKER_STRIDE < b.length; n++) {
        const k = n * BLOCKER_STRIDE, ext = Math.hypot(b[k + 2], b[k + 3]);
        for (let j = Math.floor((b[k + 1] - ext) / CELL); j <= Math.floor((b[k + 1] + ext) / CELL); j++) for (let i = Math.floor((b[k] - ext) / CELL); i <= Math.floor((b[k] + ext) / CELL); i++) {
          const key = cellKey(i, j);
          let l = this.grid.get(key);
          if (!l) this.grid.set(key, (l = []));
          l.push((li << 16) | n);
        }
      }
    });
  }
}

/** Grid cell size for the lookup, metres. */
const CELL = 4;
const cellKey = (i: number, j: number) => (i + 32768) * 65536 + (j + 32768);

/**
 * Where the ray from (x, y, z) along (dx, dy, dz) enters box k grown by `grow` on every side; −1
 * when it misses it or starts inside it.
 */
function enter(b: Float32Array, k: number, x: number, y: number, z: number, dx: number, dy: number, dz: number, grow: number): number {
  const ox = x - b[k], oz = z - b[k + 1], c = b[k + 4], s = b[k + 5];
  const lo = [ox * c - oz * s, y - (b[k + 6] + b[k + 7]) / 2, ox * s + oz * c];
  const ld = [dx * c - dz * s, dy, dx * s + dz * c];
  const half = [b[k + 2] + grow, (b[k + 7] - b[k + 6]) / 2 + grow, b[k + 3] + grow];
  let t0 = -Infinity, t1 = Infinity;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(ld[a]) < 1e-9) { if (Math.abs(lo[a]) > half[a]) return -1; continue; }
    const ta = (-half[a] - lo[a]) / ld[a], tb = (half[a] - lo[a]) / ld[a];
    t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
  }
  return t0 <= t1 && t0 >= 0 ? t0 : -1;
}

const _p: [number, number] = [0, 0];
/** The push out of box k for a circle at (x, z) of radius r, or null when they do not overlap. */
function closest(b: Float32Array, k: number, x: number, z: number, r: number): [number, number] | null {
  const dx = x - b[k], dz = z - b[k + 1], hx = b[k + 2], hz = b[k + 3], c = b[k + 4], s = b[k + 5];
  // Into the box's frame: its x axis is (c, −s), its z axis (s, c).
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  const qx = Math.max(-hx, Math.min(hx, lx)), qz = Math.max(-hz, Math.min(hz, lz));
  let ox = lx - qx, oz = lz - qz;
  const d = Math.hypot(ox, oz);
  if (d >= r) return null;
  let push: number;
  if (d > 1e-6) { push = r - d; ox /= d; oz /= d; }
  else {
    // The centre is inside: out by the nearest side.
    const px = hx - Math.abs(lx), pz = hz - Math.abs(lz);
    if (px < pz) { ox = Math.sign(lx) || 1; oz = 0; push = px + r; } else { ox = 0; oz = Math.sign(lz) || 1; push = pz + r; }
  }
  // Back to the world: x axis (c, −s), z axis (s, c).
  _p[0] = (ox * c + oz * s) * push;
  _p[1] = (-ox * s + oz * c) * push;
  return _p;
}
