/**
 * Writing in the old scripts on a level (docs/design/lore.md §4.3): where an inscription is, how it
 * lies, and what it says. The first is the ring of Thread script round grandma's salt circle in the
 * cellar: a keeping ward she copied from somewhere deep, without knowing what it said. Its letters
 * hang inwards, so it reads from her armchair.
 *
 * Pure data; `inscribeRing` lays an inscription's strokes into prop geometry.
 */
import { letter, thread, type Lettering } from '../lore/scripts';
import type { Script } from '../lore/key';
import { CELLAR } from './cellar';
import type { PropBuilder, Rgb } from './propMesh';

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

export interface Inscription {
  /** Stable across loads (the key remembers which were read). */
  readonly id: string;
  readonly script: Script;
  readonly text: string;
  /** What one sees on reading it, before any of it can be made out. */
  readonly where: string;
  readonly place: RingPlace;
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

/** How far from an inscription's line one can stand to read it, metres. */
export const READ_REACH = 0.8;

/** Whether one at (x, y, z) can read `ins`. */
export function canRead(ins: Inscription, x: number, y: number, z: number): boolean {
  const p = ins.place;
  return Math.abs(Math.hypot(x - p.x, z - p.z) - p.r) < READ_REACH && Math.abs(y - p.y) < 1.5;
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

/** Lay `ins` into `b`: each stroke as thin flat strips on the floor `width` metres wide, dots as small squares, rings as strips round. */
export function inscribeRing(b: PropBuilder, ins: Inscription, width: number, colour: Rgb): void {
  const p = ins.place, l = letteringOf(ins), y = p.y + 0.005, up = 0.004;
  const strip = (u0: number, v0: number, u1: number, v1: number) => {
    const [x0, z0] = onRing(p, u0, v0), [x1, z1] = onRing(p, u1, v1);
    b.beam(x0, y, z0, x1, y, z1, width / 2, up, colour);
  };
  for (const s of l.strokes) for (let i = 1; i < s.length; i++) strip(s[i - 1][0], s[i - 1][1], s[i][0], s[i][1]);
  for (const [u, v, r] of l.dots) {
    const [x, z] = onRing(p, u, v), h = r * p.scale;
    b.upright(x, y, z, 0, h, up, h, colour);
  }
  for (const [u, v, r] of l.rings) {
    const n = 8;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
      strip(u + Math.cos(a0) * r, v + Math.sin(a0) * r, u + Math.cos(a1) * r, v + Math.sin(a1) * r);
    }
  }
}
