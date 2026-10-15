/**
 * Writing in the old scripts on a level (docs/design/lore.md §4.3): where an inscription is, how it
 * lies, and what it says. The first is the ring of Thread script round grandma's salt circle in the
 * cellar: a keeping ward she copied from somewhere deep, without knowing what it said. Its letters
 * hang inwards, so it reads from her armchair.
 *
 * Pure data; `inscribe` lays an inscription's strokes into prop geometry.
 */
import { letter, thread, type Lettering } from '../lore/scripts';
import type { Script } from '../lore/key';
import { CELLAR } from './cellar';
import type { PropBuilder, Rgb, V3 } from './propMesh';

/** Writing laid round a circle on the floor: its line at radius `r` round (x, z), starting at angle `from`, `scale` metres to a unit. */
export interface RingPlace {
  readonly kind: 'ring';
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly r: number;
  readonly scale: number;
  readonly from: number;
}

/** Writing on an upright face: its line starts at (x, y, z) and runs along (rx, rz), the face looking out along (nx, nz); `scale` metres to a unit. */
export interface WallPlace {
  readonly kind: 'wall';
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rx: number;
  readonly rz: number;
  readonly nx: number;
  readonly nz: number;
  readonly scale: number;
}

export interface Inscription {
  /** Stable across loads (the key remembers which were read). */
  readonly id: string;
  readonly script: Script;
  readonly text: string;
  /** What one sees on reading it, before any of it can be made out. */
  readonly where: string;
  readonly place: RingPlace | WallPlace;
}

/** Grandma's ward round the salt circle. */
export const CELLAR_WARD = 'here the world is thin keep the door and let them sleep';

/** The ring of the ward: its thread this far out from the salt circle's middle, the letters filling all but this much of the way round. */
const WARD = { r: 1.48, gap: 0.06 };

/** The inscriptions on the level at `depth` (for now only the cellar has one). */
export function inscriptionsAt(depth: number): readonly Inscription[] {
  if (depth !== 0) return [];
  const c = CELLAR.circle, l = thread(CELLAR_WARD);
  return [{
    id: 'cellar-ward', script: 'thread', text: CELLAR_WARD,
    where: 'Round her circle, traced in the same blue salt, a line of marks hanging from a thread. Not letters you know. She made every stroke with care.',
    place: { kind: 'ring', x: c.x, y: 0, z: c.z, r: WARD.r, scale: (2 * Math.PI * WARD.r * (1 - WARD.gap)) / l.width, from: Math.PI },
  }];
}

/** How far from an inscription's line one can stand to read it, metres: round a ring on the floor, and in front of a face (writing on a wall is big, and often high). */
export const READ_REACH = { ring: 0.8, wall: 4 };

/** Whether one at (x, y, z) can read `ins`. */
export function canRead(ins: Inscription, x: number, y: number, z: number): boolean {
  const p = ins.place;
  if (p.kind === 'ring') return Math.abs(Math.hypot(x - p.x, z - p.z) - p.r) < READ_REACH.ring && Math.abs(y - p.y) < 1.5;
  // In front of the face, within reach of its middle, and not far above or below it.
  const half = (letteringOf(ins).width * p.scale) / 2, mx = p.x + p.rx * half, mz = p.z + p.rz * half;
  const out = (x - mx) * p.nx + (z - mz) * p.nz;
  return out > 0.2 && Math.hypot(x - mx, z - mz) < READ_REACH.wall && y > p.y - 11 && y < p.y + 2;
}

/**
 * A line of `text` across an upright face, centred on (x, y, z) and looking out along (ox, oz): as
 * large as `scale` metres to a unit, smaller if it would not fit in `half` metres either side.
 */
export function acrossFace(id: string, script: Script, text: string, where: string, x: number, y: number, z: number, ox: number, oz: number, half: number, scale: number): Inscription {
  const l = letter(script, text), s = Math.min(scale, (2 * half) / l.width), w = (l.width * s) / 2;
  let lo = Infinity, hi = -Infinity;
  for (const st of l.strokes) for (const [, v] of st) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  // Running to the right as one faces it: (oz, -ox).
  return { id, script, text, where, place: { kind: 'wall', x: x - oz * w, y: y - ((lo + hi) / 2) * s, z: z + ox * w, rx: oz, rz: -ox, nx: ox, nz: oz, scale: s } };
}

/** The lettering of an inscription. */
export function letteringOf(ins: Inscription): Lettering {
  return letter(ins.script, ins.text);
}

/** Where a point of the lettering (u along the line, v up from it) lies on a ring: u runs round it the way the angle grows, v outwards. */
export function onRing(p: RingPlace, u: number, v: number): [number, number] {
  const a = p.from + (u * p.scale) / p.r, r = p.r + v * p.scale;
  return [p.x + Math.cos(a) * r, p.z + Math.sin(a) * r];
}

/** A point of the lettering in the world, and which way its face looks. */
function placer(p: RingPlace | WallPlace): { point: (u: number, v: number) => V3; normal: V3 } {
  if (p.kind === 'ring') return { point: (u, v) => { const [x, z] = onRing(p, u, v); return [x, p.y, z]; }, normal: [0, 1, 0] };
  return { point: (u, v) => [p.x + p.rx * u * p.scale, p.y + v * p.scale, p.z + p.rz * u * p.scale], normal: [p.nx, 0, p.nz] };
}

/**
 * Lay `ins` into `b`: each stroke as thin strips `width` metres wide standing `depth` proud of its
 * face (inlay, salt, or the dark of a cut), dots as small squares, rings as strips round.
 */
export function inscribe(b: PropBuilder, ins: Inscription, width: number, depth: number, colour: Rgb): void {
  const { point, normal: n } = placer(ins.place), l = letteringOf(ins), scale = ins.place.scale;
  const lift = (q: V3, k: number): V3 => [q[0] + n[0] * k, q[1] + n[1] * k, q[2] + n[2] * k];
  const strip = (a: V3, c: V3, w: number) => {
    const u: V3 = [(c[0] - a[0]) / 2, (c[1] - a[1]) / 2, (c[2] - a[2]) / 2];
    // Across the stroke, in the face: u × n, as long as half the width.
    const x = [u[1] * n[2] - u[2] * n[1], u[2] * n[0] - u[0] * n[2], u[0] * n[1] - u[1] * n[0]], xl = Math.hypot(x[0], x[1], x[2]);
    if (xl < 1e-9) return;
    const k = w / 2 / xl, m = lift([(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2], depth / 2);
    b.box(m[0], m[1], m[2], u, [n[0] * depth / 2, n[1] * depth / 2, n[2] * depth / 2], [x[0] * k, x[1] * k, x[2] * k], colour);
  };
  // Each segment runs on past its ends by half the width, so joints and stroke ends close.
  const seg = (u0: number, v0: number, u1: number, v1: number) => {
    const len = Math.hypot(u1 - u0, v1 - v0) * scale;
    if (len < 1e-6) return;
    const e = width / 2 / len;
    strip(point(u0 - (u1 - u0) * e, v0 - (v1 - v0) * e), point(u1 + (u1 - u0) * e, v1 + (v1 - v0) * e), width);
  };
  for (const s of l.strokes) for (let i = 1; i < s.length; i++) seg(s[i - 1][0], s[i - 1][1], s[i][0], s[i][1]);
  for (const [u, v, r] of l.dots) {
    seg(u - r, v, u + r, v);
    seg(u, v - r, u, v + r);
  }
  for (const [u, v, r] of l.rings) {
    const N = 8;
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2;
      seg(u + Math.cos(a0) * r, v + Math.sin(a0) * r, u + Math.cos(a1) * r, v + Math.sin(a1) * r);
    }
  }
}
