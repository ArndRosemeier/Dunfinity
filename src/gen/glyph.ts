/**
 * The glyph-cut style (catalog §5, the second alien style; levels 61 and deeper): a level that is
 * writing. Someone cut lines of Kerf runes into the rock at a giant's scale, each rune twenty metres
 * wide and forty long, every stroke a straight-walled trench a few metres across and as tall as a
 * house. One walks the letters. The lines are ruled like a copybook (a trench along the foot of
 * each line and one along its head), and between two words a cut runs on from the head of one line
 * to the foot of the next, so every stroke can be reached. It is real writing: English spelt in
 * Kerf (src/lore/scripts.ts), so a player who knows the runes can read the level off the map.
 * Inlaid light runs down the middle of the strokes; the rest of the stone is pale and banded.
 *
 * In plan, the lines run along u in the frame turned by the level's grain angle (`Grain`), one
 * every `leading + 2` rune units across it; each line is one sentence, repeating, from a seeded
 * start. A column's field is the distance to the nearest trench's middle line (`segDist`) less the
 * trench's half width: 1-Lipschitz, walls straight up. Envelope (E1): a gently rolling floor and a
 * flat roof `height` over it.
 *
 * Pure, like every style.
 */
import { Noise, deriveSeed, hash2i, hashToFloat, smoothstep } from '@futuremagic/core';
import type { Band } from './bands';
import { STANDARD, gene, type Traits, type Tuned } from './genes';
import { unworked, type Column, type Working } from './quarry';
import { Grain, grainOf } from './grainLines';
import { rockMix } from './rockTypes';
import { putSurface, type Style, type StyleId, type Surface } from './style';
import { segDist } from './shapes';
import { scatter, type Dress } from './styleProps';
import { KERF, kerfSpell } from '../lore/scripts';

export const GLYPH = {
  /** One rune unit, metres: a rune is one unit wide and two long. */
  unit: 20,
  /** A trench's half width, metres. */
  half: 2.6,
  /** Between two runes of a word and between two words, rune units (Kerf's own gap; a word space wide enough for a cut between lines). */
  gap: 0.45,
  space: 1.8,
  /** Solid rock between the head of one line and the foot of the next, rune units. */
  leading: 1,
  /** The trenches' height, metres. */
  height: 14,
  /** The floor: rolling by this much over this distance, metres. */
  floor: [1.5, 300] as const,
  /** The inlay: lights this close to a stroke's middle line, metres, one try per `cell`; this share of them a lamp. */
  ink: { cell: 1.6, near: 0.45, lamp: 0.015 },
} as const;

/**
 * What the carvers wrote, one sentence to a line (English, spelt in Kerf by ear). Copies of copies:
 * the deep is full of halls that remember being other halls (docs/design/generative-depth.md).
 */
export const GLYPH_LINES = [
  'we cut down to find the bottom',
  'there is no bottom',
  'the salt keeps what we forget',
  'every hall is a copy of a hall',
  'turn back while you can read this',
  'we wrote this so we would not forget',
  'below the words is another sky',
  'the stone listens',
  'do not wake the deep',
  'the thread goes on',
] as const;

/**
 * The glyph-cut style's genes (src/gen/genes.ts): how one deep world's writing differs from another's.
 * Unit scales the runes (and the trenches with them, so the letters stay apart), height the
 * trenches' height, width the trenches against the runes, ink the inlay's hue (0: cyan, 0.5: violet,
 * 1: gold; past them, round again).
 */
export const GLYPH_GENES = {
  unit: gene('glyph.unit', 1, [0.85, 1.2], [0.7, 1.4]),
  height: gene('glyph.height', 1, [0.8, 1.3], [0.6, 1.8]),
  width: gene('glyph.width', 1, [0.85, 1.12], [0.7, 1.2]),
  ink: gene('glyph.ink', 0.15, [0, 0.6], [-0.5, 1.6]),
} as const;

/** Rock further than this from a trench counts as this far, metres. */
const FAR = 10;

/** What a glyph-cut column is to the code that asks about workings: cut, no pillar grid. */
const CUT: Working = { id: 0x676c7970, angle: 0, spacing: 1e9, pillar: 0, floor: 0, height: 14, collapse: 0, cavern: false, cx: 0, cz: 0 };

/** Cut and dressed by hand, no masonry. */
const CUT_SURFACE: Surface = [0.7, 0, 0, 0];

/** A word laid out in a sentence's line: where it starts and how wide it is, rune units, and its strokes (x1, y1, x2, y2 each). */
interface Word {
  x0: number;
  w: number;
  segs: number[];
}

/** A sentence laid out: its words and how long it is with the space after its last word, rune units. */
interface Line {
  words: Word[];
  period: number;
}

/** Lays a sentence out in Kerf runes, rune units (x along it, y up the line). */
export function glyphLine(text: string, gap: number, space: number): Line {
  const words: Word[] = [];
  let x = 0;
  for (const runes of kerfSpell(text)) {
    const segs: number[] = [], x0 = x;
    for (const r of runes) {
      for (const [x1, y1, x2, y2] of KERF[r]) segs.push(x + x1, y1, x + x2, y2);
      x += 1 + gap;
    }
    x -= gap;
    words.push({ x0, w: x - x0, segs });
    x += space;
  }
  return { words, period: x };
}

/** A column's own data: how far the nearest stroke's middle line is, metres. */
interface CutColumn {
  ink: number;
}

export class GlyphCut implements Style {
  readonly id: StyleId = 'glyph';
  /** Pale stone, cut clean (src/gen/rockTypes.ts). */
  readonly rocks = rockMix({ marble: 0.5, limestone: 0.3, granite: 0.2 });
  /** The pale stone's shade on the map (M). */
  readonly mapFloor = [0.66, 0.66, 0.7] as const;
  /** GLYPH as this level's genes read it, and the inlay's colour. */
  readonly L: Tuned<typeof GLYPH>;
  readonly inkColour: [number, number, number];
  private readonly noise: Noise;
  private readonly cells: number;
  private readonly grain: Grain;
  private readonly lines: Line[];
  private readonly own = new WeakMap<Column, CutColumn>();

  constructor(readonly seed: number, readonly band: Band, traits: Traits = STANDARD) {
    const G = GLYPH_GENES, unit = GLYPH.unit * traits(G.unit);
    this.L = { ...GLYPH, unit, half: (GLYPH.half * unit * traits(G.width)) / GLYPH.unit, height: GLYPH.height * traits(G.height) };
    this.inkColour = inkOf(traits(G.ink));
    this.noise = new Noise(deriveSeed(seed, 'glyph', 'shape'));
    this.cells = deriveSeed(seed, 'glyph', 'cells');
    this.grain = new Grain(grainOf(seed, 'glyph'));
    this.lines = GLYPH_LINES.map((t) => glyphLine(t, GLYPH.gap, GLYPH.space));
  }

  /** Line j's sentence and where it starts along u, rune units. */
  private row(j: number): [Line, number] {
    const line = this.lines[(hash2i(this.cells, j, 1) >>> 0) % this.lines.length];
    return [line, hashToFloat(hash2i(this.cells, j, 2)) * line.period];
  }

  /**
   * At (u, v) in the grain's frame, metres: how far the nearest trench's middle line is, and the
   * nearest stroke's (a rune's, not a ruled line's or a cut between lines). Only line j can be
   * nearer than its own ruled lines: a stroke of the next or the last line lies beyond them.
   */
  plan(u: number, v: number): [number, number] {
    const L = this.L, S = L.unit, P = 2 + L.leading, U = u / S, V = v / S;
    const j = Math.floor(V / P), y = V - j * P;
    let d = Math.min(Math.abs(y), Math.abs(y - 2), Math.abs(y - P)), ink = Infinity;
    const [line, off] = this.row(j), reach = (FAR + L.half) / S + 1;
    const lu = (((U - off) % line.period) + line.period) % line.period;
    for (const x of [lu - line.period, lu, lu + line.period]) {
      for (const w of line.words) {
        // The cut on to the next line, in the space after the word.
        const m = w.x0 + w.w + L.space / 2;
        if (Math.abs(x - m) < reach) d = Math.min(d, segDist(x, y, m, 2, m, P));
        if (x < w.x0 - reach || x > w.x0 + w.w + reach || y > 2 + reach) continue;
        const s = w.segs;
        for (let i = 0; i < s.length; i += 4) ink = Math.min(ink, segDist(x, y, s[i], s[i + 1], s[i + 2], s[i + 3]));
      }
    }
    return [Math.min(d, ink) * S, ink * S];
  }

  column(x: number, z: number, col: Column): Column {
    const L = this.L;
    let o = this.own.get(col);
    if (!o) { o = { ink: 0 }; this.own.set(col, o); }
    const [d, ink] = this.plan(this.grain.u(x, z), this.grain.v(x, z));
    o.ink = ink;
    col.floor = this.noise.n2(x / L.floor[1] + 3.1, z / L.floor[1] - 1.7) * L.floor[0];
    col.ceiling = col.floor + L.height;
    col.wall = Math.max(L.half - d, -FAR);
    unworked(col, CUT, 1000, 0);
    return col;
  }

  at(col: Column, _x: number, y: number, _z: number): number {
    return Math.min(col.wall, y - col.floor, col.ceiling - y);
  }

  color(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    const n = this.noise, h = y - col.floor, own = this.own.get(col);
    // Pale grey-violet stone, banded by fine cut grooves every 1.2 m up the walls.
    const k = 0.9 + 0.12 * n.n2(x / 9 + y / 14, z / 9 - y / 11);
    const band = smoothstep(0.86, 0.97, Math.abs(Math.cos((h / 1.2) * Math.PI)));
    const grey = (0.5 - 0.22 * band * smoothstep(0.4, 1.2, h)) * k;
    out[o] = grey * 0.95;
    out[o + 1] = grey * 0.94;
    out[o + 2] = grey * 1.04;
    // The strokes' floors stained with their inlay's colour, fading up the walls.
    const inked = own ? smoothstep(this.L.half, this.L.half * 0.4, own.ink) * smoothstep(2, 0.1, h) * 0.45 : 0;
    for (let i = 0; i < 3; i++) out[o + i] += (this.inkColour[i] * 0.5 - out[o + i]) * inked;
  }

  surface(_col: Column, _x: number, _y: number, _z: number, out: Float32Array, o: number): void {
    putSurface(CUT_SURFACE, out, o);
  }

  /** A passage from another style ends on the nearest ruled line (E3): they run the whole level long. */
  portal(x: number, z: number): [number, number] {
    const S = this.L.unit, P = 2 + this.L.leading, u = this.grain.u(x, z), V = this.grain.v(x, z) / S;
    const j = Math.floor(V / P), y = V - j * P;
    const to = [0, 2, P].reduce((a, b) => (Math.abs(y - b) < Math.abs(y - a) ? b : a));
    return this.grain.xz(u, (j * P + to) * S);
  }

  /** Light inlaid down the middle of the runes' strokes; now and then a lamp of it. */
  props(d: Dress): void {
    const I = this.L.ink, c = this.inkColour;
    scatter(d, I.cell, 0x91f, 1, (x, z, g, r) => {
      if (this.plan(this.grain.u(x, z), this.grain.v(x, z))[1] > I.near) return;
      d.glow.ellipsoid(x, g + 0.02, z, 0.32, 0.05, 0.32, c, 6);
      if (r(3) < I.lamp) d.light(x, g + 0.6, z);
      d.placed();
    });
  }

  climbable(): boolean {
    return false;
  }
}

/** The inlay's colour at hue t (0 cyan, 0.5 violet, 1 gold, round again), 0–1 RGB. */
function inkOf(t: number): [number, number, number] {
  const stops = [[0.3, 0.95, 0.9], [0.7, 0.45, 1], [1, 0.8, 0.35], [0.3, 0.95, 0.9]];
  const w = ((t % 1.5) + 1.5) % 1.5, s = (w / 1.5) * 3, i = Math.min(2, Math.floor(s)), f = s - i, p = stops[i], q = stops[i + 1];
  return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, p[2] + (q[2] - p[2]) * f];
}
