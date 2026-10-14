/**
 * What the quarrymen left behind (layer 3 of the generator, docs/design/level-generator.md §3):
 * narrow-gauge rails down the aisles between pillars, ore carts, lamps on posts and on pillar faces,
 * and site shacks at quiet crossings. Pure data, in tiles of PROP_TILE metres, so it runs in a worker.
 *
 * Everything hangs off the working's pillar grid: aisles run along u = k·s and v = k·s. A tile only
 * places what sits inside it, and every decision is a hash of the working and grid position, so
 * tiles agree with each other and a seed always gives the same quarry.
 */
import { deriveSeed, hash3i, hashToFloat } from '@futuremagic/core';
import type { Level } from './level';
import type { Working } from './quarry';
import type { Shaft } from './descents';
import { PropBuilder, type PropMesh, type Rgb } from './propMesh';

/** Tile size, metres. */
export const PROP_TILE = 64;

export interface PropTile {
  /** Wood, iron, glass: lit like the rock. */
  solid: PropMesh | null;
  /** Burning lamps and lit windows: they glow. */
  glow: PropMesh | null;
  /** Standing water, where the ground lies below the water table. */
  water: PropMesh | null;
  /** Burning lamps, x, y, z each: where the level's lights go. */
  lamps: Float32Array;
  counts: { sleepers: number; carts: number; lamps: number; lit: number; shacks: number; wet: number; shafts: number };
}

/** Sleeper spacing along a track, metres. */
const STEP = 0.7;
/** A track shorter than this many sleepers is not laid. */
const MIN_RUN = 10;
/** Half the rail gauge, metres. */
const GAUGE = 0.3;
/** Water surface cell, metres; wet cells in a row merge into runs of up to WATER_RUN cells. */
const WATER_CELL = 2;
const WATER_RUN = 4;
/** Cells whose floor is up to this far above the water still carry the surface, so it reaches under the shore rock, metres. */
const SHORE = 1;

const WOOD: Rgb = [0.2, 0.13, 0.075];
const RUST: Rgb = [0.13, 0.065, 0.04];
const IRON: Rgb = [0.06, 0.055, 0.05];
const TAR: Rgb = [0.05, 0.045, 0.04];
const GLASS: Rgb = [0.09, 0.085, 0.07];
const FLAME: Rgb = [1.0, 0.72, 0.4];
const LOAD: Rgb = [0.4, 0.37, 0.31];
const SHALLOW: Rgb = [0.2, 0.21, 0.18];
const DEEP: Rgb = [0.015, 0.03, 0.035];

export function quarryProps(level: Level, tx: number, tz: number): PropTile {
  return new TileBuilder(level, tx, tz).build();
}

class TileBuilder {
  private readonly solid = new PropBuilder();
  private readonly glow = new PropBuilder();
  private readonly water = new PropBuilder();
  private readonly lamps: number[] = [];
  private readonly counts = { sleepers: 0, carts: 0, lamps: 0, lit: 0, shacks: 0, wet: 0, shafts: 0 };
  private readonly seed: number;
  private readonly x0: number;
  private readonly z0: number;

  constructor(private readonly level: Level, tx: number, tz: number) {
    this.seed = deriveSeed(level.seed, 'props', level.depth);
    this.x0 = tx * PROP_TILE;
    this.z0 = tz * PROP_TILE;
  }

  build(): PropTile {
    const workings = this.workings();
    if (workings.some((w) => w.floor < 0)) this.flood();
    for (const sh of this.level.descents.within(this.x0, this.z0, this.x0 + PROP_TILE, this.z0 + PROP_TILE)) this.shaft(sh);
    for (const w of workings) {
      if (w.collapse > 0) continue; // nobody works a collapsed working any more
      const [umin, umax, vmin, vmax] = this.gridBounds(w);
      const s = w.spacing;
      for (let k = Math.floor(umin / s); k <= Math.ceil(umax / s); k++) if (this.hasRail(w, 0, k)) this.track(w, 0, k, vmin, vmax);
      for (let k = Math.floor(vmin / s); k <= Math.ceil(vmax / s); k++) if (this.hasRail(w, 1, k)) this.track(w, 1, k, umin, umax);
      for (let iu = Math.floor(umin / s) - 1; iu <= Math.ceil(umax / s); iu++) {
        for (let iv = Math.floor(vmin / s) - 1; iv <= Math.ceil(vmax / s); iv++) {
          this.pillarLamp(w, iu, iv);
          this.shack(w, iu, iv);
        }
      }
    }
    return { solid: this.solid.build(), glow: this.glow.build(), water: this.water.build(), lamps: new Float32Array(this.lamps), counts: this.counts };
  }

  /** Is (x, z) dry ground, `margin` metres above the water? */
  private dry(x: number, z: number, margin: number): boolean {
    return this.level.groundAt(x, z) > this.level.waterAt(x, z) + margin;
  }

  /** The water surface: cells whose floor lies below the table, merged into runs along x. */
  private flood(): void {
    const n = PROP_TILE / WATER_CELL;
    for (let j = 0; j < n; j++) {
      const z0 = this.z0 + j * WATER_CELL, z1 = z0 + WATER_CELL;
      let start = -1;
      let depth = 0;
      for (let i = 0; i <= n; i++) {
        let d = -Infinity;
        if (i < n) {
          const cx = this.x0 + (i + 0.5) * WATER_CELL, cz = z0 + WATER_CELL / 2;
          d = this.level.waterAt(cx, cz) - this.level.columnAt(cx, cz).floor;
        }
        const wet = d > -SHORE; // a cell just above the shore still carries the surface, under the rock
        if (start >= 0 && (!wet || i - start === WATER_RUN)) {
          const x0 = this.x0 + start * WATER_CELL, x1 = this.x0 + i * WATER_CELL;
          if (depth > 0) {
            const corners = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]];
            this.water.quad(x0, z0, x1, z1, corners.map(([x, z]) => this.level.waterAt(x, z)), corners.map(([x, z]) => this.waterColor(x, z)));
            this.counts.wet += i - start;
          }
          start = -1;
        }
        if (!wet) continue;
        if (start < 0) { start = i; depth = d; } else depth = Math.max(depth, d);
      }
    }
  }

  /** Water colour by depth: shallow water shows the pale floor, deep water is nearly black. */
  private waterColor(x: number, z: number): Rgb {
    const k = Math.min(1, Math.max(0, (this.level.waterAt(x, z) - this.level.columnAt(x, z).floor) / 2));
    return [SHALLOW[0] + (DEEP[0] - SHALLOW[0]) * k, SHALLOW[1] + (DEEP[1] - SHALLOW[1]) * k, SHALLOW[2] + (DEEP[2] - SHALLOW[2]) * k];
  }

  private inTile(x: number, z: number): boolean {
    return x >= this.x0 && x < this.x0 + PROP_TILE && z >= this.z0 && z < this.z0 + PROP_TILE;
  }

  /** The workings that reach into this tile. */
  private workings(): Working[] {
    const found = new Map<number, Working>();
    for (let j = 0; j <= 8; j++) for (let i = 0; i <= 8; i++) {
      const w = this.level.workingAt(this.x0 + (i * PROP_TILE) / 8, this.z0 + (j * PROP_TILE) / 8);
      found.set(w.id, w);
    }
    return [...found.values()];
  }

  /** The tile's extent in w's grid coordinates: [umin, umax, vmin, vmax]. */
  private gridBounds(w: Working): [number, number, number, number] {
    const b: [number, number, number, number] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const [x, z] of [[this.x0, this.z0], [this.x0 + PROP_TILE, this.z0], [this.x0, this.z0 + PROP_TILE], [this.x0 + PROP_TILE, this.z0 + PROP_TILE]]) {
      const [u, v] = this.level.field.toGrid(w, x, z);
      b[0] = Math.min(b[0], u); b[1] = Math.max(b[1], u); b[2] = Math.min(b[2], v); b[3] = Math.max(b[3], v);
    }
    return b;
  }

  /** A per-decision random number for working w. */
  private roll(w: Working, a: number, b: number, c: number): number {
    return hashToFloat(hash3i(this.seed ^ w.id, a, b, c));
  }

  /** Whether aisle k (dir 0: u = k·s, running along v; dir 1: v = k·s, running along u) has a track. */
  private hasRail(w: Working, dir: number, k: number): boolean {
    return this.roll(w, dir, k, 0) < 0.14;
  }

  /** World position of point t along aisle k, and the aisle's world direction. */
  private aisle(w: Working, dir: number, k: number, t: number): [number, number, number, number] {
    const at = k * w.spacing;
    const [x, z] = dir === 0 ? this.level.field.fromGrid(w, at, t) : this.level.field.fromGrid(w, t, at);
    const [x1, z1] = dir === 0 ? this.level.field.fromGrid(w, at, t + 1) : this.level.field.fromGrid(w, t + 1, at);
    return [x, z, x1 - x, z1 - z];
  }

  /** Can a track lie at (x, z) of working w: open, level floor with headroom, clear of pillars and borders. */
  private trackable(w: Working, x: number, z: number): boolean {
    const col = this.level.columnAt(x, z);
    if (col.working.id !== w.id || col.border < 5 || col.collapse > 0 || col.rubble > 0.02 || col.pillarD < 1.3) return false;
    if (this.level.descents.at(x, z, 2)) return false;
    return col.floor > this.level.waterAt(x, z) + 0.25 && this.level.sdf(x, col.floor + 1.8, z) > 1.2;
  }

  /** Lay the track along aisle k: sleepers, rails, and the carts and lamps along it. */
  private track(w: Working, dir: number, k: number, tmin: number, tmax: number): void {
    const ok = memo((i) => {
      const [x, z] = this.aisle(w, dir, k, i * STEP);
      return this.trackable(w, x, z);
    });
    // A point is laid if it is part of a run of at least MIN_RUN trackable points.
    const laid = (i: number) => {
      if (!ok(i)) return false;
      let n = 1;
      for (let j = i - 1; n < MIN_RUN && ok(j); j--) n++;
      for (let j = i + 1; n < MIN_RUN && ok(j); j++) n++;
      return n >= MIN_RUN;
    };
    const groundOf = memo((i) => {
      const [x, z] = this.aisle(w, dir, k, i * STEP);
      return this.level.groundAt(x, z);
    });
    for (let i = Math.floor(tmin / STEP) - 1; i <= Math.ceil(tmax / STEP) + 1; i++) {
      const [x, z, fx, fz] = this.aisle(w, dir, k, i * STEP);
      if (!this.inTile(x, z) || !laid(i)) continue;
      const g = groundOf(i);
      const yaw = Math.atan2(fx, fz);
      const px = fz, pz = -fx; // across the track
      const shade = 0.75 + 0.5 * this.roll(w, 10 + dir, k, i);
      this.solid.upright(x, g + 0.1, z, yaw, 0.6, 0.06, 0.1, [WOOD[0] * shade, WOOD[1] * shade, WOOD[2] * shade]);
      this.counts.sleepers++;
      if (laid(i + 1)) {
        const [x1, z1] = this.aisle(w, dir, k, (i + 1) * STEP);
        const g1 = groundOf(i + 1);
        for (const sd of [-GAUGE, GAUGE]) this.solid.beam(x + px * sd, g + 0.22, z + pz * sd, x1 + px * sd, g1 + 0.22, z1 + pz * sd, 0.03, 0.045, RUST);
      }
      const r = this.roll(w, 20 + dir, k, i);
      if (r < 1 / 140 && laid(i - 3) && laid(i + 3)) this.cart(x, g, z, yaw, r * 140);
      else if (r > 1 - 1 / 26) {
        const side = r > 1 - 1 / 52 ? 1.15 : -1.15;
        this.post(w, x + px * side, z + pz * side, -px * Math.sign(side), -pz * Math.sign(side), this.roll(w, 30 + dir, k, i));
      }
    }
  }

  /** An ore cart on the rails, sometimes still loaded. */
  private cart(x: number, g: number, z: number, yaw: number, r: number): void {
    const ca = Math.cos(yaw), sa = Math.sin(yaw);
    const at = (side: number, fwd: number): [number, number] => [x + ca * side + sa * fwd, z - sa * side + ca * fwd];
    for (const sd of [-0.42, 0.42]) for (const fw of [-0.45, 0.45]) {
      const [wx, wz] = at(sd, fw);
      this.solid.upright(wx, g + 0.42, wz, yaw, 0.05, 0.17, 0.17, IRON);
    }
    this.solid.upright(x, g + 1.0, z, yaw, 0.52, 0.42, 0.82, RUST);
    if (r < 0.6) this.solid.upright(x, g + 1.4, z, yaw, 0.46, 0.06, 0.74, LOAD);
    this.counts.carts++;
  }

  /** A lamp post beside a track at (x, z), its arm reaching along (dx, dz) over the track. */
  private post(w: Working, x: number, z: number, dx: number, dz: number, r: number): void {
    const col = this.level.columnAt(x, z);
    if (col.working.id !== w.id || col.pillarD < 0.4 || this.level.descents.at(x, z, 1)) return;
    const g = this.level.groundAt(x, z);
    if (this.level.sdf(x, g + 1.5, z) < 0.4 || !this.dry(x, z, 0.1)) return;
    this.solid.upright(x, g + 1.25, z, 0, 0.05, 1.25, 0.05, IRON);
    const ax = x + dx * 0.55, az = z + dz * 0.55;
    this.solid.beam(x, g + 2.45, z, ax, g + 2.45, az, 0.03, 0.03, IRON);
    this.lamp(ax, g + 2.3, az, r < 0.45);
  }

  /** A lamp on a bracket on one face of a whole pillar. */
  private pillarLamp(w: Working, iu: number, iv: number): void {
    const r = this.roll(w, 40, iu, iv);
    if (r > 0.12) return;
    const s = w.spacing, half = w.pillar / 2;
    const face = Math.floor(this.roll(w, 41, iu, iv) * 4);
    const du = face === 0 ? 1 : face === 1 ? -1 : 0, dv = face === 2 ? 1 : face === 3 ? -1 : 0;
    const field = this.level.field;
    const [x, z] = field.fromGrid(w, (iu + 0.5) * s + du * (half + 0.05), (iv + 0.5) * s + dv * (half + 0.05));
    if (!this.inTile(x, z) || field.pillarAt(w, iu, iv) !== 'whole') return;
    const [ox, oz] = field.fromGrid(w, (iu + 0.5) * s + du * (half + 0.6), (iv + 0.5) * s + dv * (half + 0.6));
    const col = this.level.columnAt(ox, oz);
    if (col.working.id !== w.id || col.rubble > 0.05 || this.level.descents.at(ox, oz, 1)) return;
    const g = this.level.groundAt(ox, oz);
    if (this.level.sdf(ox, g + 3, oz) < 0.3 || !this.dry(ox, oz, 0.1)) return;
    this.solid.beam(x, g + 3.3, z, ox, g + 3.3, oz, 0.03, 0.03, IRON);
    this.lamp(ox, g + 3.15, oz, r < 0.06);
  }

  /** A lamp housing with its bulb below; a burning one glows and becomes a light. */
  private lamp(x: number, y: number, z: number, lit: boolean): void {
    this.solid.upright(x, y + 0.06, z, 0, 0.1, 0.05, 0.1, IRON);
    (lit ? this.glow : this.solid).upright(x, y - 0.06, z, 0, 0.065, 0.07, 0.065, lit ? FLAME : GLASS);
    this.counts.lamps++;
    if (!lit) return;
    this.counts.lit++;
    this.lamps.push(x, y - 0.25, z);
  }

  /**
   * A mine shaft (src/gen/descents.ts): a timber headframe over it with a pulley and a burning lamp,
   * a railing round the rim with a gap at the ladder, and the iron ladder down the wall.
   */
  private shaft(sh: Shaft): void {
    const { x, z, r, top } = sh;
    const frame: Rgb = [WOOD[0] * 0.8, WOOD[1] * 0.8, WOOD[2] * 0.8];
    // Headframe: four legs leaning in to a square top, cross beams, a pulley wheel on top.
    const H = 7, base = r + 0.7, head = 1.1;
    const legs: [number, number, number, number][] = [];
    for (let k = 0; k < 4; k++) {
      const a = sh.ladder + Math.PI / 4 + (k * Math.PI) / 2;
      legs.push([x + Math.cos(a) * base, z + Math.sin(a) * base, x + Math.cos(a) * head, z + Math.sin(a) * head]);
    }
    for (const [bx, bz, tx, tz] of legs) this.solid.beam(bx, top, bz, tx, top + H, tz, 0.14, 0.14, frame);
    for (let k = 0; k < 4; k++) {
      const [, , ax, az] = legs[k], [, , bx, bz] = legs[(k + 1) % 4];
      this.solid.beam(ax, top + H, az, bx, top + H, bz, 0.1, 0.12, frame);
      const [lx, lz] = [legs[k][0] * 0.55 + legs[k][2] * 0.45, legs[k][1] * 0.55 + legs[k][3] * 0.45];
      const [mx, mz] = [legs[(k + 1) % 4][0] * 0.55 + legs[(k + 1) % 4][2] * 0.45, legs[(k + 1) % 4][1] * 0.55 + legs[(k + 1) % 4][3] * 0.45];
      this.solid.beam(lx, top + H * 0.45, lz, mx, top + H * 0.45, mz, 0.08, 0.1, frame);
    }
    const ca = Math.cos(sh.ladder), sa = Math.sin(sh.ladder);
    this.solid.box(x, top + H + 0.75, z, [ca * 0.06, 0, sa * 0.06], [0, 0.7, 0], [-sa * 0.7, 0, ca * 0.7], IRON); // pulley wheel
    this.solid.upright(x, top + (H + 6.75) / 2 - 6, z, 0, 0.015, (H + 6.75) / 2, 0.015, RUST); // the rope, hanging into the dark
    this.lamp(x + ca * 0.9, top + H - 0.3, z + sa * 0.9, true);
    // Railing: posts round the rim and two rails between them, open where the ladder is.
    const n = 12, rr = r + 0.35;
    for (let k = 0; k < n; k++) {
      const a0 = sh.ladder + ((k + 0.5) * Math.PI * 2) / n, a1 = sh.ladder + ((k + 1.5) * Math.PI * 2) / n;
      const px = x + Math.cos(a0) * rr, pz = z + Math.sin(a0) * rr;
      this.solid.upright(px, top + 0.55, pz, a0, 0.05, 0.55, 0.05, frame);
      if (k === n - 1) continue; // the gap at the ladder
      const qx = x + Math.cos(a1) * rr, qz = z + Math.sin(a1) * rr;
      for (const h of [0.5, 1.0]) this.solid.beam(px, top + h, pz, qx, top + h, qz, 0.03, 0.03, frame);
    }
    // The ladder: two stiles and rungs down the wall, from the rim into the dark.
    const lx = x + ca * (r - 0.12), lz = z + sa * (r - 0.12);
    const sx = -sa * 0.25, sz = ca * 0.25;
    for (const sd of [-1, 1]) this.solid.upright(lx + sx * sd, top - 6.5, lz + sz * sd, 0, 0.025, 7.5, 0.025, RUST);
    for (let k = 0; k < 50; k++) {
      const y = top + 0.6 - k * 0.3;
      this.solid.beam(lx - sx, y, lz - sz, lx + sx, y, lz + sz, 0.015, 0.015, RUST);
    }
    this.counts.shafts++;
  }

  /** A site shack at aisle crossing (iu·s, iv·s), where no track runs. */
  private shack(w: Working, iu: number, iv: number): void {
    const s = w.spacing;
    if (s - w.pillar < 7.5 || this.hasRail(w, 0, iu) || this.hasRail(w, 1, iv) || this.roll(w, 50, iu, iv) > 0.07) return;
    const field = this.level.field;
    const [x, z] = field.fromGrid(w, iu * s, iv * s);
    if (!this.inTile(x, z) || this.level.descents.at(x, z, 6)) return;
    // Square to the pillar grid (its +v is yaw = angle), the door to any of the four aisles.
    const yaw = w.angle + Math.floor(this.roll(w, 51, iu, iv) * 4) * (Math.PI / 2);
    const ca = Math.cos(yaw), sa = Math.sin(yaw);
    const at = (side: number, fwd: number): [number, number] => [x + ca * side + sa * fwd, z - sa * side + ca * fwd];
    let g = Infinity;
    for (const [sd, fw] of [[0, 0], [-2.5, -2], [2.5, -2], [-2.5, 2], [2.5, 2]]) {
      const [cx, cz] = at(sd, fw);
      const col = this.level.columnAt(cx, cz);
      if (col.working.id !== w.id || col.pillarD < 0.5 || col.border < 6 || col.rubble > 0.03) return;
      g = Math.min(g, this.level.groundAt(cx, cz));
      if (g < this.level.waterAt(cx, cz) + 0.2) return;
    }
    if (this.level.sdf(x, g + 3.6, z) < 1.2) return;
    const tint = 0.8 + 0.4 * this.roll(w, 52, iu, iv);
    this.solid.upright(x, g + 1.2, z, yaw, 2.2, 1.4, 1.6, [WOOD[0] * tint * 1.2, WOOD[1] * tint * 1.15, WOOD[2] * tint]);
    // Corner posts and a beam under the eaves, darker than the boards.
    const frame: Rgb = [WOOD[0] * 0.6, WOOD[1] * 0.6, WOOD[2] * 0.6];
    for (const [sd, fw] of [[-2.2, -1.6], [2.2, -1.6], [-2.2, 1.6], [2.2, 1.6]]) {
      const [px, pz] = at(sd, fw);
      this.solid.upright(px, g + 1.2, pz, yaw, 0.1, 1.42, 0.1, frame);
    }
    this.solid.upright(x, g + 2.45, z, yaw, 2.26, 0.1, 1.66, frame);
    this.solid.upright(x, g + 2.68, z, yaw, 2.5, 0.08, 1.9, TAR);
    const [dx, dz] = at(0.6, 1.61);
    this.solid.upright(dx, g + 0.95, dz, yaw, 0.45, 0.95, 0.03, TAR);
    const lit = this.roll(w, 53, iu, iv) < 0.6;
    const [wx, wz] = at(2.21, 0);
    (lit ? this.glow : this.solid).upright(wx, g + 1.55, wz, yaw, 0.02, 0.28, 0.4, lit ? [FLAME[0] * 0.7, FLAME[1] * 0.6, FLAME[2] * 0.5] : GLASS);
    const [lx, lz] = at(-0.6, 1.75);
    this.lamp(lx, g + 2.25, lz, lit);
    for (let c = 0; c < 3; c++) {
      if (this.roll(w, 54 + c, iu, iv) < 0.4) continue;
      const size = 0.28 + 0.2 * this.roll(w, 57 + c, iu, iv);
      const [cx, cz] = at(-2.2 - 0.4 - size - c * 0.1, -1.2 + c * 1.1);
      if (this.level.sdf(cx, this.level.groundAt(cx, cz) + 0.5, cz) < 0.6 || !this.dry(cx, cz, 0.05)) continue;
      this.solid.upright(cx, this.level.groundAt(cx, cz) + size, cz, yaw + this.roll(w, 60 + c, iu, iv), size, size, size, [WOOD[0] * 1.4, WOOD[1] * 1.3, WOOD[2] * 1.1]);
    }
    this.counts.shacks++;
  }
}

/** f, remembering its answer for each integer it was asked about. */
function memo<T>(f: (i: number) => T): (i: number) => T {
  const seen = new Map<number, T>();
  return (i) => {
    if (!seen.has(i)) seen.set(i, f(i));
    return seen.get(i) as T;
  };
}
