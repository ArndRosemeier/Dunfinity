/**
 * Singing crystals: inside a geode, now and then its crystals sing a short phrase, one crystal a
 * note, in a pentatonic scale (so any phrase is in tune with itself); a longer crystal sings lower.
 * Each crystal that sings glows in its geode's hue while it rings (src/render/humView.ts).
 *
 * Which crystals sing, when and which notes is seeded from the level: the same phrases at the same
 * places, but when one starts depends on how long one has been listening.
 */
import { Rng, deriveSeed } from '@futuremagic/core';
import type { Level } from '../gen/level';
import { Geode, HUES } from '../gen/geode';
import type { Taper } from '../gen/caveThings';

export const SING = {
  /** Crystals this near (m, to their middle) can sing to one. */
  reach: 24,
  /** Seconds between two phrases (min, max); the first comes sooner. */
  gap: [12, 30] as const,
  first: [3, 8] as const,
  /** Notes in a phrase (min, max), seconds between two notes (min, max). */
  notes: [3, 6] as const,
  step: [0.5, 1.1] as const,
  /** The scale's notes (the sound's files, low to high), and the crystal lengths (m) that sing the lowest and the highest. */
  scale: 5,
  long: 6,
  short: 1.2,
} as const;

/** A note sung now: the crystal, its geode's hue (an index into the geode's `HUES`), the note (0 lowest). */
export interface Sung {
  readonly crystal: Taper;
  readonly hue: readonly [number, number, number];
  readonly note: number;
}

/** The note a crystal `len` m long sings (0 the lowest). */
export function noteOf(len: number): number {
  const t = (SING.long - len) / (SING.long - SING.short);
  return Math.max(0, Math.min(SING.scale - 1, Math.round(t * (SING.scale - 1))));
}

export class Singing {
  private level: Level | null = null;
  private geode: Geode | null = null;
  private rng = new Rng(1);
  private wait = 0;
  /** The phrase singing now: its notes still to come, each in seconds after the one before. */
  private readonly phrase: { in: number; crystal: Taper; hue: number }[] = [];
  private readonly near: { crystal: Taper; hue: number }[] = [];

  /** Advance `dt` s for a listener at (x, y, z) on `level`; the notes sung in it go into `out`. */
  advance(level: Level, dt: number, x: number, y: number, z: number, out: Sung[] = []): Sung[] {
    out.length = 0;
    if (level !== this.level) {
      this.level = level;
      this.geode = (level.field.styles.find((s) => s instanceof Geode) as Geode | undefined) ?? null;
      this.rng = new Rng(deriveSeed(level.seed, 'singing', level.depth));
      this.wait = this.rng.range(SING.first[0], SING.first[1]);
      this.phrase.length = 0;
    }
    if (!this.geode) return out;
    if (this.phrase.length) {
      this.phrase[0].in -= dt;
      while (this.phrase.length && this.phrase[0].in <= 0) {
        const n = this.phrase.shift()!, t = n.crystal;
        out.push({ crystal: t, hue: HUES[n.hue] as unknown as [number, number, number], note: noteOf(Math.hypot(t.bx - t.ax, t.by - t.ay, t.bz - t.az)) });
        if (this.phrase.length) this.phrase[0].in += n.in;
      }
      return out;
    }
    this.wait -= dt;
    if (this.wait > 0) return out;
    this.geode.crystalsNear(x, y, z, SING.reach, this.near);
    if (!this.near.length) { this.wait = 2; return out; }
    // A phrase: a few crystals near, one after another.
    const n = this.rng.int(SING.notes[0], SING.notes[1]);
    for (let k = 0; k < n; k++) {
      const c = this.near[this.rng.int(0, this.near.length - 1)];
      this.phrase.push({ in: k ? this.rng.range(SING.step[0], SING.step[1]) : 0, crystal: c.crystal, hue: c.hue });
    }
    this.wait = this.rng.range(SING.gap[0], SING.gap[1]);
    return out;
  }
}
