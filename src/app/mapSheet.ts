/**
 * What the map (M, src/app/mapView.ts) knows of the floor round the nobody, as shapes to draw: the
 * cells seen (their floor's height, water, the kind of place), the rock walls seen beside them as
 * smooth lines (never the edge of what is unseen: that only fades), where the walls' edges face, and
 * contour lines of the floor's height. Only what the grandchild has seen (src/world/explored.ts).
 */
import type { Level } from '../gen/level';
import { MAP_FLOOR } from '../gen/style';
import { EXPLORE, onStorey, type Explored } from '../world/explored';

/** A seen cell: its floor's height, whether water stands on it, and the shade of its kind of place. */
export interface MapCell {
  readonly floor: number;
  readonly water: boolean;
  readonly rgb: readonly [number, number, number];
}

/** A wall edge's middle (world x, z) and the way into the rock from it. */
export interface WallTick {
  readonly x: number;
  readonly z: number;
  readonly nx: number;
  readonly nz: number;
  /** Its grid edge, for a stable hash: cell (i, j), side 0–3. */
  readonly i: number;
  readonly j: number;
  readonly side: number;
}

/** The map's shapes over cells i0 … i0 + nx − 1, j0 … j0 + ny − 1. */
export interface Sheet {
  readonly i0: number;
  readonly j0: number;
  readonly nx: number;
  readonly ny: number;
  /** Row-major, null where unseen. */
  readonly cells: readonly (MapCell | null)[];
  /** The rock walls seen, as smooth lines of world (x, z) pairs. */
  readonly walls: readonly Float32Array[];
  readonly ticks: readonly WallTick[];
  /** Contour lines as segments (x0, z0, x1, z1 in world metres), every `MAP_SHEET.contour` metres of height. */
  readonly contours: Float32Array;
}

export const MAP_SHEET = {
  /** Height between contour lines, metres. */
  contour: 2,
  /** Smoothing passes over the walls' grid lines. */
  smooth: 2,
} as const;

/** The sides of a cell, clockwise from the top (north, −z): the step to the neighbour, and the edge's corners. */
const SIDES = [
  { di: 0, dj: -1, a: [0, 0], b: [1, 0] },
  { di: 1, dj: 0, a: [1, 0], b: [1, 1] },
  { di: 0, dj: 1, a: [1, 1], b: [0, 1] },
  { di: -1, dj: 0, a: [0, 1], b: [0, 0] },
] as const;

const vkey = (i: number, j: number) => (i + 0x100000) * 0x200000 + (j + 0x100000);

/**
 * What the map shows of a place the family knows by heart, seen or not (the village round grandma's
 * house): the cell's look, `'rock'` (a building), or null beyond it.
 */
export type Known = (x: number, z: number) => MapCell | 'rock' | null;

/**
 * The cells of one level the map has asked about, kept: seen cells' looks, and whether an unseen one
 * beside them is rock. With `known`, it shows what that knows instead of what was seen.
 */
export class MapCells {
  private readonly looks = new Map<number, MapCell | 'rock' | null>();
  private readonly rock = new Map<number, boolean>();

  constructor(readonly level: Level, private readonly known?: Known) {}

  /** Cell (i, j)'s look, if the map shows it: seen (`seen` says whether it was), or known. */
  cell(i: number, j: number, seen: boolean): MapCell | null {
    if (!seen && !this.known) return null;
    const k = vkey(i, j);
    let m = this.looks.get(k);
    if (m === undefined) {
      const level = this.level, c = EXPLORE.cell, x = (i + 0.5) * c, z = (j + 0.5) * c;
      if (this.known) m = this.known(x, z);
      else {
        const floor = level.floorAt(x, z);
        m = { floor, water: level.waterAt(x, z) > floor + 0.1, rgb: level.field.styles[level.field.regions.styleAt(x, z)].mapFloor ?? MAP_FLOOR };
      }
      this.looks.set(k, m);
    }
    return m === 'rock' ? null : m;
  }

  /** Whether unseen cell (i, j), beside a seen floor at height y, is rock (a wall seen from there), not more floor. */
  isRock(i: number, j: number, y: number): boolean {
    if (this.known) { this.cell(i, j, false); return this.looks.get(vkey(i, j)) === 'rock'; }
    const k = vkey(i, j);
    let r = this.rock.get(k);
    if (r === undefined) {
      const c = EXPLORE.cell, x = (i + 0.5) * c, z = (j + 0.5) * c;
      r = !onStorey(this.level, x, z, y) && ![[-0.3, 0], [0.3, 0], [0, -0.3], [0, 0.3]].some(([a, b]) => onStorey(this.level, x + a * c, z + b * c, y));
      this.rock.set(k, r);
    }
    return r;
  }
}

/** The sheet of what `seen` holds of `cells.level` in the box of world x0 … x1, z0 … z1. */
export function sheetOf(cells: MapCells, seen: Explored, x0: number, z0: number, x1: number, z1: number): Sheet {
  const depth = cells.level.depth, c = EXPLORE.cell;
  const i0 = Math.floor(x0 / c) - 1, j0 = Math.floor(z0 / c) - 1, nx = Math.ceil(x1 / c) + 2 - i0, ny = Math.ceil(z1 / c) + 2 - j0;
  const grid: (MapCell | null)[] = new Array(nx * ny).fill(null);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) grid[j * nx + i] = cells.cell(i0 + i, j0 + j, seen.has(depth, i0 + i, j0 + j));
  const at = (i: number, j: number) => (i >= 0 && j >= 0 && i < nx && j < ny ? grid[j * nx + i] : null);
  // The wall edges: a seen cell's side whose neighbour is unseen rock, corner to corner clockwise round the floor.
  const from = new Map<number, number[]>(), into = new Set<number>(), edges: number[][] = [], ticks: WallTick[] = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const m = grid[j * nx + i];
    if (!m) continue;
    for (let s = 0; s < 4; s++) {
      const { di, dj, a, b } = SIDES[s];
      if (at(i + di, j + dj) || !cells.isRock(i0 + i + di, j0 + j + dj, m.floor)) continue;
      const gi = i0 + i, gj = j0 + j, e = [gi + a[0], gj + a[1], gi + b[0], gj + b[1]];
      const ka = vkey(e[0], e[1]);
      if (!from.has(ka)) from.set(ka, []);
      from.get(ka)!.push(edges.length);
      into.add(vkey(e[2], e[3]));
      edges.push(e);
      ticks.push({ x: (gi + 0.5 + di * 0.5) * c, z: (gj + 0.5 + dj * 0.5) * c, nx: di, nz: dj, i: gi, j: gj, side: s });
    }
  }
  // Join the edges into lines: first those that begin where no wall leads in, then the closed loops.
  const used = new Uint8Array(edges.length), walls: Float32Array[] = [];
  const chain = (first: number) => {
    // Through the edges' middles: a staircase of cells becomes a straight slope.
    const pts: number[] = [];
    let e = first;
    for (;;) {
      used[e] = 1;
      const [ax, ay, bx, by] = edges[e];
      pts.push((ax + bx) / 2, (ay + by) / 2);
      const next = from.get(vkey(bx, by))?.find((n) => !used[n]);
      if (next === undefined) break;
      e = next;
    }
    const [ex, ey] = edges[e].slice(2), [sx, sy] = edges[first];
    const closed = pts.length > 4 && ex === sx && ey === sy;
    if (!closed) pts.unshift(sx, sy), pts.push(ex, ey);
    walls.push(smooth(pts, closed, c));
  };
  for (let e = 0; e < edges.length; e++) if (!used[e] && !into.has(vkey(edges[e][0], edges[e][1]))) chain(e);
  for (let e = 0; e < edges.length; e++) if (!used[e]) chain(e);
  return { i0, j0, nx, ny, cells: grid, walls, ticks, contours: contoursOf(grid, i0, j0, nx, ny, c) };
}

/** Grid corners (pairs) rounded into a smooth line (Chaikin's corner cutting), in world metres. */
function smooth(pts: number[], closed: boolean, c: number): Float32Array {
  let p = pts.map((v) => v * c);
  for (let k = 0; k < MAP_SHEET.smooth; k++) {
    const n = p.length / 2, out: number[] = [];
    if (!closed) out.push(p[0], p[1]);
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const ax = p[2 * i], ay = p[2 * i + 1], bx = p[(2 * i + 2) % p.length], by = p[(2 * i + 3) % p.length];
      out.push(0.75 * ax + 0.25 * bx, 0.75 * ay + 0.25 * by, 0.25 * ax + 0.75 * bx, 0.25 * ay + 0.75 * by);
    }
    if (!closed) out.push(p[p.length - 2], p[p.length - 1]);
    p = out;
  }
  if (closed) p.push(p[0], p[1]);
  return Float32Array.from(p);
}

/** Contour lines of the seen floor's height (marching squares between cell centres all seen). */
function contoursOf(grid: readonly (MapCell | null)[], i0: number, j0: number, nx: number, ny: number, c: number): Float32Array {
  const out: number[] = [], step = MAP_SHEET.contour;
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const q = [grid[j * nx + i], grid[j * nx + i + 1], grid[(j + 1) * nx + i + 1], grid[(j + 1) * nx + i]];
    if (q.some((m) => !m)) continue;
    const h = q.map((m) => m!.floor), lo = Math.ceil(Math.min(...h) / step), hi = Math.floor(Math.max(...h) / step);
    // Corners clockwise from the top left, in world metres (cell centres).
    const cx = [i, i + 1, i + 1, i].map((v) => (i0 + v + 0.5) * c), cz = [j, j, j + 1, j + 1].map((v) => (j0 + v + 0.5) * c);
    for (let l = lo; l <= hi; l++) {
      const v = l * step, cross: number[] = [];
      for (let k = 0; k < 4; k++) {
        const a = h[k] - v, b = h[(k + 1) % 4] - v;
        if ((a < 0) === (b < 0) || a === b) continue;
        const t = a / (a - b);
        cross.push(cx[k] + (cx[(k + 1) % 4] - cx[k]) * t, cz[k] + (cz[(k + 1) % 4] - cz[k]) * t);
      }
      if (cross.length >= 4) out.push(cross[0], cross[1], cross[2], cross[3]);
      if (cross.length === 8) out.push(cross[4], cross[5], cross[6], cross[7]);
    }
  }
  return Float32Array.from(out);
}
