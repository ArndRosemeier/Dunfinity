/**
 * The root hollows style (catalog §3.6; Arnd's "real underground biomes, at least one plant-heavy"):
 * a cave a forest grew into from above. Rounded chambers and tubes (the karst's own shape, laid out
 * by its own seed), crossed by giant roots: thick tapering trunks that come down through the
 * ceiling, writhe across the space, split and plunge into the floor; some cross low enough to walk
 * along; root tips hang from the roof. The floor is buried under root mats. Moss, soil and bark.
 *
 * Roots are chains of capsules along a curve, each a little thinner than the last. A column keeps
 * the few that pass near it, so `at` asks only those; the field never counts further than REACH
 * from rock, so a root that leaves the list changes nothing (it was further than that).
 * Envelope (E1): the cave's floor and roof.
 *
 * Pure, like every style.
 */
import { Noise, deriveSeed, smoothstep } from '@futuremagic/core';
import type { Band } from './bands';
import { CaveThings, THING_REACH, type Chamber } from './caveThings';
import { Karst } from './karst';
import type { Column } from './quarry';
import type { Style, StyleId } from './style';

export const ROOTS = {
  /** Trunk roots per 100 m² of chamber floor (min, extra); their radius where they leave the roof and where they enter the floor (min, extra), metres. */
  trunks: [1.2, 0.8] as const,
  top: [1.2, 1.4] as const,
  bottom: [0.5, 0.4] as const,
  /** The chance a trunk forks on the way down. */
  fork: 0.5,
  /** Roots that cross a chamber low down (walkable along the top), per chamber (min, extra); their height over the floor (min, extra) and radius. */
  bridges: [2, 3] as const,
  bridgeHeight: [1.5, 4] as const,
  bridgeRadius: [0.9, 0.5] as const,
  /** Root tips hanging from the roof, per chamber (min, extra), and how far down they reach (min, extra), metres. */
  tips: [6, 8] as const,
  tipLength: [3, 6] as const,
  /** Root mats on the floor: this high, this wide, metres. */
  mat: [0.35, 4] as const,
} as const;


/** Segments a curved root is made of. */
const SEGS = 4;

/** One straight piece of root: from a to b, radius ra to rb. */
interface Seg {
  ax: number; ay: number; az: number;
  bx: number; by: number; bz: number;
  ra: number; rb: number;
}

export class Roots implements Style {
  readonly id: StyleId = 'roots';
  /** Moss green on the map (M). */
  readonly mapFloor = [0.42, 0.55, 0.32] as const;
  private readonly cave: Karst;
  private readonly noise: Noise;
  private readonly roots: CaveThings<Seg>;

  constructor(readonly seed: number, readonly band: Band) {
    this.cave = new Karst(deriveSeed(seed, 'roots', 'cave'), band);
    this.noise = new Noise(deriveSeed(seed, 'roots', 'shape'));
    // (No root reaches further than 1.15 radii from its chamber's middle, plus its own thickness.)
    this.roots = new CaveThings(this.cave, deriveSeed(seed, 'roots', 'roots'), { make: rootsOf, plan, dist: rootDist, radii: 1.2, pad: ROOTS.top[0] + ROOTS.top[1] });
  }

  column(x: number, z: number, col: Column): Column {
    this.cave.column(x, z, col);
    // Root mats: low tangled humps over the floor.
    const M = ROOTS.mat, n = 1 - Math.abs(this.noise.n2(x / M[1] + 3.1, z / M[1] - 7.7));
    col.floor += M[0] * n * n;
    this.roots.column(x, z, col);
    return col;
  }

  /** How far from the nearest root near this column (positive outside them). */
  private root(col: Column, x: number, y: number, z: number): number {
    return this.roots.at(col, x, y, z);
  }
  at(col: Column, x: number, y: number, z: number): number {
    return Math.min(this.cave.at(col, x, y, z), this.root(col, x, y, z), THING_REACH);
  }

  color(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    const B = this.band, n = this.noise, h = y - col.floor;
    const patch = 0.5 + 0.5 * n.n2(x / 3.3 + y / 5, z / 3.3);
    if (this.root(col, x, y, z) < 0.35) {
      // Bark: brown, mossy where it runs low and level.
      const moss = smoothstep(4, 0.5, h) * smoothstep(0.3, 0.7, patch);
      out[o] = 0.3 * (1 - moss) + 0.2 * moss; out[o + 1] = 0.22 * (1 - moss) + 0.34 * moss; out[o + 2] = 0.14 * (1 - moss) + 0.1 * moss;
      return;
    }
    // Moss carpets the floor; damp dark soil up the walls, a green tint from the band's rock.
    const moss = smoothstep(0.6, 0.1, h) * (0.55 + 0.45 * patch);
    const k = 0.85 + 0.15 * patch;
    out[o] = ((0.2 + B.rock[0] * 0.2) * (1 - moss) + 0.18 * moss) * k;
    out[o + 1] = ((0.17 + B.rock[1] * 0.2) * (1 - moss) + 0.36 * moss) * k;
    out[o + 2] = ((0.12 + B.rock[2] * 0.15) * (1 - moss) + 0.1 * moss) * k;
  }

  /** A passage from another style ends in the nearest chamber (E3). */
  portal(x: number, z: number): [number, number] {
    return this.cave.portal(x, z);
  }

  climbable(): boolean {
    return true;
  }
}

/** The roots of chamber `c`, as straight pieces. */
function rootsOf(c: Chamber, f: () => number): Seg[] {
  const R = ROOTS, segs: Seg[] = [];
  const foot = (reach: number): [number, number] => {
    const a = f() * Math.PI * 2, d = Math.sqrt(f()) * reach * c.r;
    return [c.x + Math.cos(a) * d, c.z + Math.sin(a) * d];
  };
  const roof = c.floor + c.dome + 3, under = c.floor - 1.5;
  // A curved root from p to q bending through the side by `bend`, thinning from ra to rb.
  const curve = (p: number[], q: number[], bend: number, ra: number, rb: number) => {
    const a = f() * Math.PI * 2, mx = (p[0] + q[0]) / 2 + Math.cos(a) * bend, mz = (p[2] + q[2]) / 2 + Math.sin(a) * bend;
    const my = (p[1] + q[1]) / 2 + (f() - 0.5) * bend * 0.5;
    const at = (t: number) => [0, 1, 2].map((k) => (1 - t) * (1 - t) * p[k] + 2 * t * (1 - t) * [mx, my, mz][k] + t * t * q[k]);
    for (let s = 0; s < SEGS; s++) {
      const A = at(s / SEGS), B = at((s + 1) / SEGS);
      segs.push({ ax: A[0], ay: A[1], az: A[2], bx: B[0], by: B[1], bz: B[2], ra: ra + (rb - ra) * (s / SEGS), rb: ra + (rb - ra) * ((s + 1) / SEGS) });
    }
    return at(0.5);
  };
  const trunks = Math.round((R.trunks[0] + R.trunks[1] * f()) * c.r * c.r * Math.PI / 100);
  for (let k = 0; k < trunks; k++) {
    const [tx, tz] = foot(0.5), [bx, bz] = foot(0.75);
    const ra = R.top[0] + R.top[1] * f(), rb = R.bottom[0] + R.bottom[1] * f();
    const mid = curve([tx, roof, tz], [bx, under, bz], c.r * (0.15 + 0.25 * f()), ra, rb);
    if (f() < R.fork) {
      const [fx, fz] = foot(0.8);
      curve(mid, [fx, under, fz], c.r * 0.2 * f(), (ra + rb) / 2, rb * 0.8);
    }
  }
  const bridges = R.bridges[0] + Math.floor(f() * R.bridges[1]);
  for (let k = 0; k < bridges; k++) {
    const a = f() * Math.PI * 2, b = a + Math.PI * (0.7 + 0.6 * f()), y = c.floor + R.bridgeHeight[0] + R.bridgeHeight[1] * f();
    const reach = c.r * 1.15, r = R.bridgeRadius[0] + R.bridgeRadius[1] * f();
    curve([c.x + Math.cos(a) * reach, y + 1, c.z + Math.sin(a) * reach], [c.x + Math.cos(b) * reach, y + 1, c.z + Math.sin(b) * reach], c.r * 0.25, r, r);
  }
  const tips = R.tips[0] + Math.floor(f() * R.tips[1]);
  for (let k = 0; k < tips; k++) {
    const [tx, tz] = foot(0.55), len = R.tipLength[0] + R.tipLength[1] * f();
    curve([tx, roof, tz], [tx + (f() - 0.5) * 3, c.floor + c.dome - len, tz + (f() - 0.5) * 3], 1.5, 0.7, 0.45);
  }
  return segs;
}

/** Plan distance from (x, z) to a piece of root's outside (a lower bound on the 3D distance). */
function plan(s: Seg, x: number, z: number): number {
  const ex = s.bx - s.ax, ez = s.bz - s.az, l2 = ex * ex + ez * ez;
  const t = l2 > 1e-9 ? Math.max(0, Math.min(1, ((x - s.ax) * ex + (z - s.az) * ez) / l2)) : 0;
  return Math.hypot(x - s.ax - ex * t, z - s.az - ez * t) - Math.max(s.ra, s.rb);
}

/** Distance from a point to a piece of root: a capsule thinning from one end to the other. */
function rootDist(s: Seg, x: number, y: number, z: number): number {
  const ex = s.bx - s.ax, ey = s.by - s.ay, ez = s.bz - s.az, l2 = ex * ex + ey * ey + ez * ez;
  const t = Math.max(0, Math.min(1, ((x - s.ax) * ex + (y - s.ay) * ey + (z - s.az) * ez) / l2));
  return Math.hypot(x - s.ax - ex * t, y - s.ay - ey * t, z - s.az - ez * t) - (s.ra + (s.rb - s.ra) * t);
}
