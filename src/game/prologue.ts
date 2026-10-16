/**
 * The prologue after New Game (the introduction): a few shots in the game itself, the town at night
 * and grandma's house and cellar, with captions that set up the story (docs/design/lore.md,
 * grandmas-diary.md). The nobody walks up the street, opens her front door, and is found in her
 * cellar by the armchair, where play begins. Captions advance on their own; a click hurries the
 * next one, Escape skips the lot.
 *
 * Pure: the shots are data; `Prologue` keeps time and says which caption shows, where the camera is
 * and how black the screen is; `Walk` steers the nobody along a shot's way.
 */
import { CELLAR } from '../gen/cellar';
import { TOWN } from '../gen/town';

/** A point in the world, metres. */
export type P3 = readonly [number, number, number];

/** What the nobody does in a shot: walk to a point (x, z), or open a door of grandma's house (by its `DoorSpec.kind`) and wait while it swings. */
export type Act = { readonly to: readonly [number, number] } | { readonly open: string };

export interface Shot {
  /** The captions over it, in order (the shot lasts as long as they take to read). */
  readonly lines: readonly string[];
  /** Where the camera is at the start and the end of the shot (eased between). */
  readonly eye: readonly [P3, P3];
  /** What it looks at, start and end; null: the nobody's head. */
  readonly at: readonly [P3, P3] | null;
  /** Where the nobody stands at the start of the shot (x, z) and which way it faces. */
  readonly stand: { readonly x: number; readonly z: number; readonly yaw: number };
  /** What the nobody does during the shot. */
  readonly acts: readonly Act[];
  /** Fades out to black at its end (the next shot is somewhere else). */
  readonly cut: boolean;
}

/** Timing, seconds: a caption's time to read (base + per character), the fades, the black before it all. */
export const PACE = { base: 2.4, perChar: 0.052, fade: 0.9, lead: 0.6, linger: 0.35 } as const;

/** Walking speed in the prologue: a share of a full walk (a stroll). */
export const STROLL = 0.33;

const G = TOWN.ground, S = CELLAR.start;

export const SHOTS: readonly Shot[] = [
  {
    // The street at night, from down the hill: the nobody walks up it to grandma's door.
    lines: [
      'Your grandmother, Grete Hollmann, died this year. She was eighty-six.',
      'Nobody in the family had seen her in thirty years. She was difficult, they said. She would not let anyone into her cellar.',
    ],
    eye: [[-20.6, G + 5, 29], [-20, G + 2.9, 13.5]],
    at: null,
    stand: { x: -18.6, z: 18, yaw: 0 },
    acts: [{ to: [-18.6, 1.4] }],
    cut: false,
  },
  {
    // At her front door: it opens, and the nobody goes in.
    lines: [
      'Then a letter came from a notary. The house was yours, with its contents, the cellar included.',
      'No job worth the name, no money, no plan: a nobody. You came to have a look.',
    ],
    eye: [[-21.4, G + 2.5, -4.6], [-20.9, G + 2.1, -3.3]],
    at: [[-16, G + 1.6, 0], [-15.4, G + 1.5, 0]],
    stand: { x: -18.6, z: 1.4, yaw: -Math.PI / 2 },
    acts: [{ to: [-16.6, 0] }, { open: 'front' }, { to: [-12.6, 0] }],
    cut: true,
  },
  {
    // Her cellar, at its far end: the armchair in the salt circle, and the broken arch.
    lines: [
      'Her cellar goes on further than a cellar should. At its end, in a small round room: her armchair, a ring of salt glowing faintly blue, her tin on the chair.',
      'And behind the chair, the arch she bricked up, broken open. Cold air comes up through it.',
    ],
    eye: [[1.6, 1.75, 0.25], [3.3, 1.45, 0.05]],
    at: [[8.6, 1.05, -0.2], [9.4, 1.0, 0]],
    stand: { x: S.x, z: S.z, yaw: S.yaw },
    // A step aside towards her side table (the letter), out of the arch's way, short of the circle.
    acts: [{ to: [5.3, 0.6] }],
    cut: false,
  },
];

/** Seconds to read `line`. */
export function readTime(line: string): number {
  return PACE.base + PACE.perChar * line.length;
}

const ease = (t: number) => t * t * (3 - 2 * t);

/** What the prologue shows at a moment. */
export interface Frame {
  /** Index of the shot, and of its caption (-1: none yet, in the lead). */
  readonly shot: number;
  readonly line: number;
  /** 0 … 1 through the shot (the camera's way). */
  readonly through: number;
  /** How opaque the caption is (0 … 1), and the black over everything. */
  readonly caption: number;
  readonly black: number;
}

export class Prologue {
  /** Seconds into the prologue (only counting while the world is ready to be seen). */
  t = 0;
  private readonly starts: number[] = [];
  readonly length: number;
  /** Skipped (Escape) or played out. */
  done = false;

  constructor(readonly shots: readonly Shot[] = SHOTS) {
    let t = PACE.lead;
    for (const s of shots) {
      for (const l of s.lines) { this.starts.push(t); t += readTime(l); }
    }
    this.starts.push(t);
    this.length = t + PACE.linger;
  }

  /** Where caption k (counted over all shots) starts. */
  private lineAt(k: number): number { return this.starts[k]; }

  /** The first caption of shot i, counted over all shots. */
  private first(i: number): number {
    let k = 0;
    for (let j = 0; j < i; j++) k += this.shots[j].lines.length;
    return k;
  }

  /** When shot i starts and ends. */
  span(i: number): [number, number] {
    const a = i === 0 ? 0 : this.lineAt(this.first(i)), b = this.lineAt(this.first(i + 1));
    return [a, i === this.shots.length - 1 ? this.length : b];
  }

  advance(dt: number): void {
    if (this.done) return;
    this.t += dt;
    if (this.t >= this.length) this.done = true;
  }

  /** Hurry on to the next caption (a click). */
  next(): void {
    const k = this.starts.findIndex((s) => s > this.t + 1e-6);
    if (k < 0 || k >= this.starts.length - 1) { this.done = true; return; }
    this.t = this.starts[k];
  }

  skip(): void { this.done = true; }

  /** The shot showing now. */
  get shot(): number {
    for (let i = this.shots.length - 1; i >= 0; i--) if (this.t >= this.span(i)[0]) return i;
    return 0;
  }

  frame(): Frame {
    const i = this.shot, [a, b] = this.span(i), t = this.t;
    let k = -1;
    for (let j = 0; j < this.starts.length - 1; j++) if (t >= this.starts[j]) k = j;
    const line = k - this.first(i);
    // A caption fades in over its first moment and out over its last.
    const c0 = k >= 0 ? this.starts[k] : 0, c1 = k >= 0 ? this.starts[k + 1] : 0;
    const caption = k < 0 || line < 0 ? 0 : Math.max(0, Math.min(1, (t - c0) / 0.45, (c1 - t) / 0.45));
    // Black in the lead, fading up; down again before a cut, up after it; down at the very end.
    const prev = i > 0 && this.shots[i - 1].cut, here = this.shots[i].cut || i === this.shots.length - 1;
    let black = 0;
    if (i === 0) black = Math.max(black, 1 - Math.max(0, t - PACE.lead * 0.5) / PACE.fade);
    if (prev) black = Math.max(black, 1 - (t - a) / PACE.fade);
    if (here && i !== this.shots.length - 1) black = Math.max(black, 1 - (b - t) / PACE.fade);
    return { shot: i, line, through: ease(Math.max(0, Math.min(1, (t - a) / Math.max(1e-6, b - a)))), caption, black: Math.max(0, Math.min(1, black)) };
  }

  /** The camera's eye and target in shot i, `through` it; `head`: the nobody's head (for shots that look at it). */
  camera(i: number, through: number, head: P3): { eye: P3; at: P3 } {
    const s = this.shots[i], m = (p: readonly [P3, P3]): P3 => [0, 1, 2].map((j) => p[0][j] + (p[1][j] - p[0][j]) * through) as unknown as P3;
    return { eye: m(s.eye), at: s.at ? m(s.at) : head };
  }
}

/** What a walk wants of the body this frame. */
export interface Stride {
  /** -1 … 1, and the way to go (radians, as `BodyInput.yaw`). */
  readonly forward: number;
  readonly yaw: number;
  /** A door to open now (its kind), once. */
  readonly open: string | null;
}

/** Steers the nobody through a shot's acts. */
export class Walk {
  private k = 0;
  private waitUntil = 0;

  constructor(readonly acts: readonly Act[]) {}

  get finished(): boolean { return this.k >= this.acts.length; }

  /** The stride for a body at (x, z) at time `now`. */
  stride(x: number, z: number, now: number): Stride {
    const still = { forward: 0, yaw: 0, open: null };
    if (now < this.waitUntil) return still;
    const a = this.acts[this.k];
    if (!a) return still;
    if ('open' in a) {
      this.k++;
      this.waitUntil = now + 0.8;
      return { ...still, open: a.open };
    }
    const dx = a.to[0] - x, dz = a.to[1] - z, d = Math.hypot(dx, dz);
    if (d < 0.35) { this.k++; return still; }
    // forward is (-sin yaw, -cos yaw): the yaw that points at (dx, dz).
    return { forward: STROLL * Math.min(1, d / 0.8 + 0.4), yaw: Math.atan2(-dx, -dz), open: null };
  }
}
