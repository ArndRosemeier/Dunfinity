/**
 * The geode style (catalog §3.2): hollow shells in the rock, lined with crystals. Each cell of a
 * jittered grid holds one cavity, an ellipsoid 20–70 m across, flattened by a level floor of
 * crystal sand; short cracks in the rock join each to its neighbours (one to every cavity behind
 * it, so all are joined, and some more). Crystals stand in from the walls along the wall's normal,
 * longest and thickest overhead; a few big ones stand up out of the floor to climb round. One hue
 * a geode: amethyst, celestine, rose or rose. Closed and glittering: wonder rooms.
 *
 * A cavity's air is a scaled sphere's bound (1-Lipschitz); a crack is a narrow slot in plan;
 * crystals are tapered pieces, things in their geode (src/gen/caveThings.ts). Envelope (E1): a
 * rolling floor (the sand where there is a geode) and a roof over each cavity's dome.
 *
 * Pure, like every style.
 */
import { Noise, deriveSeed, hash2i, hashToFloat, smoothstep } from '@futuremagic/core';
import type { Band } from './bands';
import { joined } from './gridTree';
import { CaveThings, THING_REACH, taperDist, taperPlan, type Taper } from './caveThings';
import { unworked, type Column, type Working } from './quarry';
import type { Style, StyleId } from './style';

export const GEODE = {
  /** One geode to a cell this wide, metres; its radius in plan (min, extra) and height over radius (min, extra); its floor this much of its height under the middle. */
  cell: 110,
  radius: [10, 25] as const,
  tall: [0.55, 0.25] as const,
  sand: 0.55,
  /** Cracks between geodes: half width, height, metres; the chance of one besides those that join everything. */
  crack: { half: 1.6, height: 4.5, extra: 0.3 },
  /** Crystals per 100 m² of wall (min, extra); length (min, extra), metres, and radius to length. */
  crystals: [2, 2] as const,
  length: [1, 5] as const,
  thick: 0.22,
  /** Crystals standing out of the floor, per 100 m² of floor; their length (min, extra). */
  standing: 0.8,
  standingLength: [2, 5] as const,
  /** The floor rolls by this much over this distance, metres. */
  floor: [6, 260] as const,
} as const;

/** Rock further than this from a geode or crack counts as this far, metres. */
const FAR = 10;

/** Crystal hues, strong enough to read by torchlight (a citrine read as sandstone): amethyst, celestine, rose, emerald. */
const HUES = [[0.5, 0.15, 0.95], [0.12, 0.48, 1], [1, 0.25, 0.55], [0.1, 0.85, 0.4]] as const;

/** What a geode column is to the code that asks about workings: natural rock, no pillar grid. */
const HOLLOW: Working = { id: 0x67656f64, angle: 0, spacing: 1e9, pillar: 0, floor: 0, height: 20, collapse: 0, cavern: true, cx: 0, cz: 0 };

interface Cavity {
  /** Middle in plan, radius in plan (r) and half height (c); its middle's height and sand floor's; its hue. */
  x: number;
  z: number;
  r: number;
  c: number;
  y: number;
  floor: number;
  hue: number;
}

export class Geode implements Style {
  readonly id: StyleId = 'geode';
  /** Amethyst on the map (M). */
  readonly mapFloor = [0.62, 0.5, 0.72] as const;
  private readonly noise: Noise;
  private readonly cells: number;
  private readonly cavities = new Map<number, Cavity>();
  private readonly own = new WeakMap<Column, { list: Cavity[]; crack: number }>();
  private readonly crystals: CaveThings<Taper, Cavity>;

  constructor(readonly seed: number, readonly band: Band) {
    this.noise = new Noise(deriveSeed(seed, 'geode', 'shape'));
    this.cells = deriveSeed(seed, 'geode', 'cells');
    // (No crystal reaches out of its geode's ellipsoid, plus its own thickness.)
    this.crystals = new CaveThings({ cell: GEODE.cell, chamber: (i, j) => this.cavity(i, j) }, deriveSeed(seed, 'geode', 'crystals'), {
      make: crystalsOf, plan: taperPlan, dist: taperDist, radii: 1.05, pad: 3,
    });
  }

  /** The level's rolling floor at (x, z). */
  private base(x: number, z: number): number {
    return this.noise.n2(x / GEODE.floor[1] + 4.2, z / GEODE.floor[1] - 1.3) * GEODE.floor[0];
  }

  /** The geode of cell (i, j). */
  private cavity(i: number, j: number): Cavity {
    const key = hash2i(this.cells, i, j);
    let g = this.cavities.get(key);
    if (g) return g;
    const G = GEODE, f = (m: number) => hashToFloat(hash2i(key, m, 6));
    const r = G.radius[0] + G.radius[1] * f(0), c = r * (G.tall[0] + G.tall[1] * f(1));
    const room = G.cell / 2 - r - 6;
    const x = (i + 0.5) * G.cell + room * (2 * f(2) - 1), z = (j + 0.5) * G.cell + room * (2 * f(3) - 1);
    const floor = this.base(x, z);
    g = { x, z, r, c, y: floor + c * G.sand, floor, hue: Math.floor(f(4) * HUES.length) };
    if (this.cavities.size > 4096) this.cavities.clear();
    this.cavities.set(key, g);
    return g;
  }

  column(x: number, z: number, col: Column): Column {
    const G = GEODE, i0 = Math.floor(x / G.cell), j0 = Math.floor(z / G.cell);
    let o = this.own.get(col);
    if (!o) { o = { list: [], crack: 0 }; this.own.set(col, o); }
    o.list.length = 0; o.crack = -FAR;
    let roof = 1, floor = this.base(x, z);
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) {
      const g = this.cavity(i, j), rho = Math.hypot(x - g.x, z - g.z);
      // (Those further off are more than FAR outside: their bound says so, so leaving them out changes nothing.)
      if (rho < g.r * (1 + FAR / Math.min(g.r, g.c)) + 1) o.list.push(g);
      // The roof over the dome: above the ellipsoid everywhere, no steeper than its height over its radius.
      const t = Math.min(rho, g.r) / g.r;
      roof = Math.max(roof, g.y + g.c * (1 - 0.5 * t * t) - (g.c / g.r) * Math.max(0, rho - g.r) - floor);
      // Cracks from this cell on, to cells also looked at.
      for (let axis = 0; axis < 2; axis++) {
        const ni = axis ? i : i + 1, nj = axis ? j + 1 : j;
        if (ni > i0 + 1 || nj > j0 + 1 || !joined(this.cells, i, j, axis, G.crack.extra)) continue;
        const h = this.cavity(ni, nj), ex = h.x - g.x, ez = h.z - g.z, t2 = Math.max(0, Math.min(1, ((x - g.x) * ex + (z - g.z) * ez) / (ex * ex + ez * ez)));
        o.crack = Math.max(o.crack, G.crack.half - Math.hypot(x - g.x - ex * t2, z - g.z - ez * t2));
      }
    }
    o.crack = Math.max(o.crack, -FAR);
    roof = Math.max(roof, G.crack.height + Math.min(0, o.crack));
    col.floor = floor;
    col.ceiling = floor + roof;
    let wall = o.crack;
    for (const g of o.list) wall = Math.max(wall, this.inside(g, x, g.y, z));
    col.wall = Math.max(wall, -FAR);
    this.crystals.column(x, z, col);
    unworked(col, HOLLOW, 1000, 1);
    return col;
  }

  /** How far inside geode g's ellipsoid (a bound: 1-Lipschitz, exact on its axes). */
  private inside(g: Cavity, x: number, y: number, z: number): number {
    return (1 - Math.hypot((x - g.x) / g.r, (y - g.y) / g.c, (z - g.z) / g.r)) * Math.min(g.r, g.c);
  }

  at(col: Column, x: number, y: number, z: number): number {
    const o = this.own.get(col)!, h = y - col.floor, cap = col.ceiling - y;
    let d = Math.min(o.crack, h, GEODE.crack.height - h, cap);
    for (const g of o.list) d = Math.max(d, Math.min(Math.max(this.inside(g, x, y, z), -FAR), h, cap));
    return Math.min(Math.max(d, -FAR), this.crystals.at(col, x, y, z), THING_REACH);
  }

  color(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    const own = this.own.get(col), h = y - col.floor, n = this.noise;
    let g: Cavity | null = null, best = -Infinity;
    for (const c of own?.list ?? []) { const d = this.inside(c, x, y, z); if (d > best) { best = d; g = c; } }
    const hue = HUES[g ? g.hue : 0];
    if (g && this.crystals.nearest(col, x, y, z, 0.3)) {
      // Crystal: the geode's hue, bright, paler at the facets' glints.
      const glint = smoothstep(0.6, 0.9, n.n2(x * 2.3 + y, z * 2.3 - y));
      for (let k = 0; k < 3; k++) out[o + k] = hue[k] * (0.85 + 0.25 * glint) + 0.15 * glint;
      return;
    }
    if (h < 0.3 && g && best > -1) {
      // Crystal sand: pale, a little of the hue.
      const k = 0.85 + 0.1 * n.n2(x / 2, z / 2);
      for (let c = 0; c < 3; c++) out[o + c] = (0.62 + hue[c] * 0.2) * k;
      return;
    }
    // The shell: lined with a crust of small crystals (druse) in the hue, behind it pale agate rings, then the grey rind.
    const B = this.band, glint = smoothstep(0.55, 0.9, n.n2(x * 1.7 - y, z * 1.7 + y));
    const druse = g ? smoothstep(-0.6, -0.15, best) : 0, agate = g ? smoothstep(-2.5, -0.8, best) : 0;
    const ring = 0.5 + 0.5 * Math.sin((best + n.n2(x / 4, z / 4) * 0.6) * 9);
    for (let c = 0; c < 3; c++) {
      const rind = B.rock[c] * 0.7 + 0.08, band = 0.55 + 0.25 * ring + hue[c] * 0.12;
      const stone = rind * (1 - agate) + band * agate;
      out[o + c] = stone * (1 - druse) + (hue[c] * (0.7 + 0.3 * glint) + 0.12 * glint) * druse;
    }
  }

  /** A passage from another style ends in the middle of the nearest geode, on its sand (E3). */
  portal(x: number, z: number): [number, number] {
    const g = this.cavity(Math.floor(x / GEODE.cell), Math.floor(z / GEODE.cell));
    return [g.x, g.z];
  }

  climbable(): boolean {
    return true;
  }
}

/** The crystals of geode g: on the walls pointing in, and standing out of the sand. */
function crystalsOf(g: Cavity, f: () => number): Taper[] {
  const G = GEODE, out: Taper[] = [];
  const wall = 4 * Math.PI * ((g.r * g.r + 2 * g.r * g.c) / 3);
  const count = Math.round((G.crystals[0] + G.crystals[1] * f()) * wall / 100);
  for (let k = 0; k < count; k++) {
    // A direction from the middle, more of them upward; the wall there, and its normal.
    const a = f() * Math.PI * 2, up = Math.sqrt(f()) * 2 - 1, s = Math.sqrt(1 - up * up);
    const dx = Math.cos(a) * s, dy = up, dz = Math.sin(a) * s;
    const wy = g.y + dy * g.c;
    if (wy < g.floor + 0.5) continue; // (under the sand)
    const wx = g.x + dx * g.r, wz = g.z + dz * g.r;
    let nx = dx / g.r, ny = dy / g.c, nz = dz / g.r;
    const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    // Longer and thicker overhead.
    const len = (G.length[0] + G.length[1] * f() * f()) * (0.7 + 0.6 * smoothstep(-0.2, 0.8, up));
    const r = Math.max(0.45, len * G.thick);
    out.push({ ax: wx + nx * 1.2, ay: wy + ny * 1.2, az: wz + nz * 1.2, bx: wx - nx * len, by: wy - ny * len, bz: wz - nz * len, ra: r, rb: 0.08 });
  }
  const standing = Math.round(G.standing * Math.PI * g.r * g.r / 100);
  for (let k = 0; k < standing; k++) {
    const a = f() * Math.PI * 2, d = Math.sqrt(f()) * g.r * 0.75, x = g.x + Math.cos(a) * d, z = g.z + Math.sin(a) * d;
    const len = G.standingLength[0] + G.standingLength[1] * f(), lean = f() * 0.5, la = f() * Math.PI * 2;
    const r = Math.max(0.5, len * G.thick);
    out.push({ ax: x, ay: g.floor - 1, az: z, bx: x + Math.cos(la) * lean * len, by: g.floor + len * (1 - lean * 0.4), bz: z + Math.sin(la) * lean * len, ra: r, rb: 0.08 });
  }
  return out;
}
