/**
 * A lettering drawn as SVG markup (src/lore/scripts.ts): for the read panel and the glyph sheet.
 *
 * Pure: returns a string.
 */
import type { Lettering } from './scripts';

export interface Pen {
  /** Pixels to a unit of the lettering. */
  readonly scale: number;
  readonly colour: string;
  /** Stroke width, pixels. */
  readonly width: number;
}

/** The elements of `l` (polylines, dots, rings) with its origin at pixel (x, base), y up in the lettering. */
export function letteringSvg(l: Lettering, x: number, base: number, pen: Pen): string {
  const { scale: s, colour, width } = pen;
  const sx = (a: number) => (x + a * s).toFixed(1), sy = (b: number) => (base - b * s).toFixed(1);
  const out: string[] = [];
  for (const line of l.strokes) out.push(`<polyline points="${line.map(([a, b]) => `${sx(a)},${sy(b)}`).join(' ')}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`);
  for (const [cx, cy, r] of l.dots) out.push(`<circle cx="${sx(cx)}" cy="${sy(cy)}" r="${(r * s).toFixed(1)}" fill="${colour}"/>`);
  for (const [cx, cy, r] of l.rings) out.push(`<circle cx="${sx(cx)}" cy="${sy(cy)}" r="${(r * s).toFixed(1)}" fill="none" stroke="${colour}" stroke-width="${width * 0.8}"/>`);
  return out.join('');
}

/** How far a lettering reaches above and below its line, units: Kerf runes stand on it, Thread hangs from it. */
export function extent(l: Lettering): { top: number; bottom: number } {
  let top = 0, bottom = 0;
  for (const s of l.strokes) for (const [, y] of s) { top = Math.max(top, y); bottom = Math.min(bottom, y); }
  for (const [, y, r] of [...l.dots, ...l.rings]) { top = Math.max(top, y + r); bottom = Math.min(bottom, y - r); }
  return { top, bottom };
}

/** A whole <svg> of several letterings stacked as lines, `gap` pixels apart. */
export function letteringBlock(lines: readonly Lettering[], pen: Pen, gap: number): string {
  const pad = pen.width * 2;
  let y = pad, w = 0;
  const parts: string[] = [];
  for (const l of lines) {
    const e = extent(l);
    y += e.top * pen.scale;
    parts.push(letteringSvg(l, pad, y, pen));
    y += -e.bottom * pen.scale + gap;
    w = Math.max(w, l.width * pen.scale + 2 * pad);
  }
  const h = y - gap + pad;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w)}" height="${Math.ceil(h)}" viewBox="0 0 ${Math.ceil(w)} ${Math.ceil(h)}">${parts.join('')}</svg>`;
}
