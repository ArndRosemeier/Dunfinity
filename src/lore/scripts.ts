/**
 * The two old scripts of the Old Halls (docs/design/lore.md §4): the dwarves' Kerf runes and the
 * elves' Thread script. Both are real writing: an inscription is an English sentence spelled in
 * them, so a player who sits down with a notebook can read the dungeon (and grandma's key helps).
 *
 * - **Kerf runes** are cut with a chisel: straight strokes only, and never a level one (a cut along
 *   the bedding splits the stone). One rune per sound, set on a stave, two units tall and one wide.
 *   No C, Q or X: the dwarves spell by ear (k, s, kw, ks), and TH is a rune of its own.
 * - **Thread script** hangs from one unbroken line, the thread, drawn first along whatever it is
 *   written on (a rib, a rim). Consonants hang below it as curves; a vowel is a mark above the
 *   consonant it follows, or above a short drop (the carrier) when no consonant comes before it.
 *   No C, Q or X either, and CH is said soft (SH).
 *
 * Everything here is data and pure layout: a line of text becomes polylines and dots in the text's
 * own units (x along the line, y up), which a sheet draws as SVG and the game as inlay or ribbons.
 *
 * Pure.
 */

/** A point in a glyph's or a line's units: x along the line, y up. */
export type Pt = readonly [number, number];

/** Text laid out in a script: strokes (polylines), dots and rings (centre and radius), and how long it is. */
export interface Lettering {
  readonly strokes: readonly (readonly Pt[])[];
  readonly dots: readonly (readonly [number, number, number])[];
  readonly rings: readonly (readonly [number, number, number])[];
  readonly width: number;
  /** Where each glyph starts along the line and which letter (or letters) it writes, for teaching and tests. */
  readonly glyphs: readonly { readonly x: number; readonly letter: string }[];
}

// ---------------------------------------------------------------------------------------------
// Kerf runes

/** Strokes of each rune, as segments (x1, y1, x2, y2) in a box one wide and two tall. */
type Segs = readonly (readonly [number, number, number, number])[];
const STAVE = [0.5, 0, 0.5, 2] as const;

export const KERF: Readonly<Record<string, Segs>> = {
  a: [STAVE, [0.5, 2, 1, 1.5], [0.5, 1.5, 1, 1]],
  b: [STAVE, [0.5, 2, 1, 1.5], [1, 1.5, 0.5, 1], [0.5, 1, 1, 0.5], [1, 0.5, 0.5, 0]],
  d: [[0, 0, 0, 2], [1, 0, 1, 2], [0, 2, 1, 0], [0, 0, 1, 2]],
  e: [[0, 0, 0, 2], [0, 2, 0.5, 1.5], [0.5, 1.5, 1, 2], [1, 2, 1, 0]],
  f: [STAVE, [0.5, 1.5, 1, 2], [0.5, 1, 1, 1.5]],
  g: [[0, 2, 1, 0], [0, 0, 1, 2]],
  h: [[0, 0, 0, 2], [1, 0, 1, 2], [0, 1.5, 1, 0.5]],
  i: [STAVE],
  j: [STAVE, [0.5, 0, 0, 0.5]],
  k: [STAVE, [0.5, 1, 1, 2], [0.5, 1, 1, 0]],
  l: [STAVE, [0.5, 2, 1, 1.5]],
  m: [[0, 0, 0, 2], [1, 0, 1, 2], [0, 2, 1, 1], [1, 2, 0, 1]],
  n: [STAVE, [0, 1.5, 1, 0.5]],
  o: [STAVE, [0.5, 1.5, 0, 1], [0, 1, 0.5, 0.5], [0.5, 1.5, 1, 1], [1, 1, 0.5, 0.5]],
  p: [STAVE, [0.5, 2, 1, 1.5], [0.5, 0, 1, 0.5]],
  r: [STAVE, [0.5, 2, 1, 1.5], [1, 1.5, 0.5, 1], [0.5, 1, 1, 0]],
  s: [[0, 2, 0, 1.3], [0, 1.3, 1, 0.7], [1, 0.7, 1, 0]],
  t: [STAVE, [0.5, 2, 0, 1.5], [0.5, 2, 1, 1.5]],
  u: [[0, 0, 0, 2], [0, 2, 1, 1.5], [1, 1.5, 1, 0]],
  v: [STAVE, [0.5, 0, 0, 0.5], [0.5, 0, 1, 0.5]],
  w: [STAVE, [0.5, 2, 1, 1.5], [1, 1.5, 0.5, 1]],
  y: [STAVE, [0, 2, 0.5, 1.5], [1, 2, 0.5, 1.5]],
  z: [STAVE, [0, 1.5, 0.5, 1], [0.5, 1, 0, 0.5]],
  th: [STAVE, [0.5, 1.5, 1, 1], [1, 1, 0.5, 0.5]],
};

/** How the dwarves spell an English word: by ear, one rune per sound (c, q, x go; th is one rune). */
export function kerfSpell(text: string): string[][] {
  return words(text).map((w) => {
    const s = w.replace(/c(?=[eiy])/g, 's').replace(/ck/g, 'k').replace(/qu/g, 'kw').replace(/q/g, 'k').replace(/x/g, 'ks').replace(/c/g, 'k');
    const out: string[] = [];
    for (let i = 0; i < s.length; i++) {
      if (s[i] === 't' && s[i + 1] === 'h') { out.push('th'); i++; } else if (KERF[s[i]]) out.push(s[i]);
    }
    return out;
  }).filter((w) => w.length);
}

const KERF_GAP = 0.45;
const KERF_SPACE = 1.1;

/** A line of Kerf runes: each word's runes side by side, words parted by two short notches. */
export function kerf(text: string): Lettering {
  const strokes: Pt[][] = [], glyphs: { x: number; letter: string }[] = [];
  let x = 0;
  kerfSpell(text).forEach((word, w) => {
    if (w) {
      // The word mark: two short cuts on the line's middle.
      const m = x - KERF_GAP + KERF_SPACE / 2;
      strokes.push([[m, 1.25], [m, 1.05]], [[m, 0.95], [m, 0.75]]);
      x += KERF_SPACE - KERF_GAP;
    }
    for (const r of word) {
      glyphs.push({ x, letter: r });
      for (const [x1, y1, x2, y2] of KERF[r]) strokes.push([[x + x1, y1], [x + x2, y2]]);
      x += 1 + KERF_GAP;
    }
  });
  return { strokes, dots: [], rings: [], width: Math.max(0, x - KERF_GAP), glyphs };
}

// ---------------------------------------------------------------------------------------------
// Thread script

/**
 * Each consonant's curves, hanging below the thread (y = 0) in a box one wide and one deep, written
 * as a path (M x y, L x y, C x1 y1 x2 y2 x y; y measured downwards), plus dots and rings (cx, cy, r).
 */
interface Hang { readonly path: string; readonly dots?: readonly (readonly [number, number, number])[]; readonly rings?: readonly (readonly [number, number, number])[] }

export const THREAD: Readonly<Record<string, Hang>> = {
  b: { path: 'M0.2 0 C0.2 0.75 0.8 0.75 0.8 0.4 C0.8 0.12 0.45 0.15 0.45 0.42' },
  d: { path: 'M0.45 0 L0.45 0.6 C0.45 0.95 0.9 0.95 0.9 0.62' },
  f: { path: 'M0.15 0 C0.3 0.45 0.7 0.45 0.85 0' },
  g: { path: 'M0.55 0 C0.55 0.45 0.12 0.45 0.12 0.72 C0.12 1 0.62 1 0.75 0.8' },
  h: { path: 'M0.3 0 L0.3 0.8 M0.7 0 L0.7 0.45' },
  j: { path: 'M0.6 0 L0.6 0.7 C0.6 1 0.2 1 0.2 0.72' },
  k: { path: 'M0.45 0 L0.45 0.92 M0.45 0.42 C0.78 0.42 0.88 0.66 0.84 0.9' },
  l: { path: 'M0.6 0 C0.6 0.6 0.3 0.78 0.18 0.92' },
  m: { path: 'M0.08 0 C0.08 0.5 0.5 0.5 0.5 0 C0.5 0.5 0.92 0.5 0.92 0' },
  n: { path: 'M0.4 0 C0.4 0.6 0.7 0.78 0.82 0.92' },
  p: { path: 'M0.3 0 L0.3 0.95 M0.3 0.15 C0.88 0.15 0.88 0.58 0.3 0.58' },
  r: { path: 'M0.5 0 C0.15 0.3 0.85 0.5 0.5 0.85' },
  s: { path: 'M0.22 0 C0.22 0.4 0.8 0.3 0.8 0.6 C0.8 0.92 0.3 0.92 0.25 0.7' },
  t: { path: 'M0.5 0 L0.5 0.62', dots: [[0.5, 0.82, 0.11]] },
  v: { path: 'M0.12 0 C0.35 0.95 0.65 0.95 0.88 0' },
  w: { path: 'M0.1 0 C0.3 0.95 0.7 0.95 0.9 0 M0.5 0 L0.5 0.42' },
  y: { path: 'M0.5 0 L0.5 0.5', rings: [[0.5, 0.7, 0.2]] },
  z: { path: 'M0.3 0 C0.92 0.18 0.92 0.5 0.42 0.55 C0.92 0.6 0.92 0.97 0.3 0.97' },
  th: { path: 'M0.5 0 L0.5 0.92 M0.5 0.52 C0.2 0.52 0.14 0.32 0.2 0.2 M0.5 0.52 C0.8 0.52 0.86 0.32 0.8 0.2' },
  sh: { path: 'M0.18 0 C0.18 0.42 0.82 0.42 0.82 0 M0.5 0.32 L0.5 0.92' },
};

/** The vowel marks above the thread (y measured upwards), and the carrier that holds one with no consonant before it. */
const VOWEL: Readonly<Record<string, Hang>> = {
  a: { path: '', dots: [[0.5, 0.26, 0.09]] },
  e: { path: 'M0.34 0.14 L0.66 0.4' },
  i: { path: '', dots: [[0.33, 0.26, 0.08], [0.67, 0.26, 0.08]] },
  o: { path: '', rings: [[0.5, 0.27, 0.12]] },
  u: { path: 'M0.28 0.4 C0.34 0.1 0.66 0.1 0.72 0.4' },
};
const CARRIER: Hang = { path: 'M0.5 0 L0.5 0.38' };
export const THREAD_VOWELS = Object.keys(VOWEL);

/** How the elves spell an English word: consonant syllables, each a consonant (or none) and the vowels after it. */
export function threadSpell(text: string): { c: string | null; v: string[] }[][] {
  return words(text).map((w) => {
    const s = w.replace(/ch/g, '§').replace(/c(?=[eiy])/g, 's').replace(/ck/g, 'k').replace(/qu/g, 'kw').replace(/q/g, 'k').replace(/x/g, 'ks').replace(/c/g, 'k');
    const out: { c: string | null; v: string[] }[] = [];
    for (let i = 0; i < s.length; i++) {
      const two = s.slice(i, i + 2);
      if (two === 'th' || two === 'sh') { out.push({ c: two, v: [] }); i++; continue; }
      if (s[i] === '§') { out.push({ c: 'sh', v: [] }); continue; }
      if (VOWEL[s[i]]) {
        // A vowel sits on the consonant before it; a second vowel, or one opening the word, gets a carrier.
        const last = out[out.length - 1];
        if (last && last.v.length === 0 && last.c) last.v.push(s[i]); else out.push({ c: null, v: [s[i]] });
        continue;
      }
      if (THREAD[s[i]]) out.push({ c: s[i], v: [] });
    }
    return out;
  }).filter((w) => w.length);
}

const THREAD_ADVANCE = 1.05;
const THREAD_SPACE = 0.9;
/** How finely a curve is cut into a polyline (segments per cubic). */
const CURVE_STEPS = 10;

/**
 * A line of Thread script: the thread along each word (curled up at its ends), the consonants hung
 * under it, the vowel marks above. y = 0 is the thread; consonants reach down to about −1.
 */
export function thread(text: string): Lettering {
  const strokes: Pt[][] = [], dots: [number, number, number][] = [], rings: [number, number, number][] = [], glyphs: { x: number; letter: string }[] = [];
  let x = 0;
  threadSpell(text).forEach((word, w) => {
    if (w) x += THREAD_SPACE;
    const start = x;
    for (const syl of word) {
      glyphs.push({ x, letter: (syl.c ?? '') + syl.v.join('') });
      hang(syl.c ? THREAD[syl.c] : CARRIER, x, -1, strokes, dots, rings);
      for (const v of syl.v) hang(VOWEL[v], x, 1, strokes, dots, rings);
      x += THREAD_ADVANCE;
    }
    // The thread itself, with a small curl up at each end of the word.
    const a = start - 0.05, b = x - THREAD_ADVANCE + 1.05;
    strokes.push([...curl(a, -1), [a, 0], [b, 0], ...curl(b, 1)]);
  });
  return { strokes, dots, rings, width: Math.max(0, x), glyphs };
}

/** A small curl rising off the thread's end at `x`, turning away (`dir` −1: left end, 1: right end); for the left end, listed from its tip to the thread. */
function curl(x: number, dir: -1 | 1): Pt[] {
  const pts: Pt[] = [];
  for (let i = 1; i <= 6; i++) {
    const t = (i / 6) * Math.PI * 0.9;
    pts.push([x + dir * 0.16 * Math.sin(t), 0.16 - 0.16 * Math.cos(t)]);
  }
  return dir < 0 ? pts.reverse() : pts;
}

/** Put a glyph's path, dots and rings at `x`, its y scaled by `sy` (−1: hung below the thread, 1: above). */
function hang(h: Hang, x: number, sy: number, strokes: Pt[][], dots: [number, number, number][], rings: [number, number, number][]): void {
  for (const line of parsePath(h.path)) strokes.push(line.map(([px, py]) => [x + px, sy * py] as const));
  for (const [cx, cy, r] of h.dots ?? []) dots.push([x + cx, sy * cy, r]);
  for (const [cx, cy, r] of h.rings ?? []) rings.push([x + cx, sy * cy, r]);
}

/** Parse the small path language (M, L, C) into polylines. */
export function parsePath(d: string): Pt[][] {
  const tok = d.replace(/([MLC])/g, ' $1 ').trim().split(/[\s,]+/).filter(Boolean);
  const lines: Pt[][] = [];
  let cur: Pt[] = [], i = 0;
  const num = () => Number(tok[i++]);
  while (i < tok.length) {
    const c = tok[i++];
    if (c === 'M') { if (cur.length > 1) lines.push(cur); cur = [[num(), num()]]; } else if (c === 'L') cur.push([num(), num()]);
    else if (c === 'C') {
      const [x0, y0] = cur[cur.length - 1], x1 = num(), y1 = num(), x2 = num(), y2 = num(), x3 = num(), y3 = num();
      for (let s = 1; s <= CURVE_STEPS; s++) {
        const t = s / CURVE_STEPS, u = 1 - t;
        cur.push([u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]);
      }
    } else throw new Error(`path: unknown command ${c}`);
  }
  if (cur.length > 1) lines.push(cur);
  return lines;
}

/** The words of a text, lower case, letters only. */
function words(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
}
