/**
 * The glyph sheet (docs/design/lore.md §4): both scripts, every glyph with its letter, and a few
 * inscriptions, drawn from the same data the game uses (src/lore/scripts.ts). Writes an SVG, and a
 * PNG when a Chromium is at hand (CHROMIUM_PATH).
 *
 *   npx tsx tools/lore/sheet.ts out.svg [out.png]
 */
import { writeFileSync } from 'node:fs';
import { KERF, THREAD, THREAD_VOWELS, kerf, thread, type Lettering } from '../../src/lore/scripts';
import { letteringSvg } from '../../src/lore/svg';

const W = 1600;
const INK = '#2b2118', GOLD = '#a8792c', PAPER = '#efe6d2', SOFT = '#7a6a55';
const parts: string[] = [];
let y = 0;

/** Draw a lettering at (x, y) in pixels, `s` pixels to a unit, y up in the lettering. */
const draw = (l: Lettering, x: number, base: number, scale: number, colour: string, width: number) => parts.push(letteringSvg(l, x, base, { scale, colour, width }));
const text = (x: number, ty: number, t: string, size: number, colour = INK, anchor = 'start', style = '') =>
  parts.push(`<text x="${x}" y="${ty}" font-family="Georgia, serif" font-size="${size}" fill="${colour}" text-anchor="${anchor}" ${style}>${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`);

// Title.
y += 70; text(60, y, 'Kerf runes and Thread script', 40);
y += 34; text(60, y, 'The dwarves cut, the elves hang. Both spell English by ear, so every inscription in the dungeon can be read.', 20, SOFT, 'start', 'font-style="italic"');

// Kerf.
y += 70; text(60, y, 'Kerf runes (dwarven)', 28, GOLD);
y += 26; text(60, y, 'Straight cuts only, never a level one: a cut along the bedding splits the stone. No C, Q or X; TH is one rune.', 17, SOFT);
const runes = Object.keys(KERF), perRow = 12, cellW = (W - 120) / perRow;
for (let i = 0; i < runes.length; i++) {
  const col = i % perRow, row = Math.floor(i / perRow);
  const cx = 60 + col * cellW + cellW / 2, top = y + 40 + row * 170;
  draw(kerf(runes[i] === 'th' ? 'th' : runes[i]), cx - 22, top + 92, 44, INK, 5);
  text(cx, top + 130, runes[i].toUpperCase(), 20, SOFT, 'middle');
}
y += 40 + Math.ceil(runes.length / perRow) * 170;

// Thread.
y += 30; text(60, y, 'Thread script (elven)', 28, GOLD);
y += 26; text(60, y, 'One unbroken thread, letters hung beneath it, vowels marked above the letter they follow (or a short drop). CH is said SH.', 17, SOFT);
const hangs = Object.keys(THREAD), tw = (W - 120) / 10;
for (let i = 0; i < hangs.length; i++) {
  const col = i % 10, row = Math.floor(i / 10);
  const cx = 60 + col * tw + tw / 2, top = y + 50 + row * 150;
  draw(thread(hangs[i] === 'th' || hangs[i] === 'sh' ? hangs[i] : hangs[i]), cx - 30, top + 20, 60, INK, 4);
  text(cx, top + 108, hangs[i].toUpperCase(), 20, SOFT, 'middle');
}
y += 50 + Math.ceil(hangs.length / 10) * 150;
const vw = (W - 120) / 10;
THREAD_VOWELS.forEach((v, i) => {
  const cx = 60 + i * vw + vw / 2, top = y - 30;
  draw(thread(v), cx - 30, top + 50, 60, INK, 4);
  text(cx, top + 132, `${v.toUpperCase()} (alone)`, 18, SOFT, 'middle');
});
THREAD_VOWELS.forEach((v, i) => {
  const cx = 60 + (i + 5) * vw + vw / 2, top = y - 30;
  draw(thread(`t${v}`), cx - 30, top + 50, 60, INK, 4);
  text(cx, top + 132, `T${v.toUpperCase()}`, 18, SOFT, 'middle');
});
y += 120;

// Inscriptions.
y += 40; text(60, y, 'As they would stand in the dungeon', 28, GOLD);
const lines: [string, 'kerf' | 'thread', string][] = [
  ['forty fathoms to the fire', 'kerf', 'Bridge parapet over a forge chasm, Old Halls (Kerf, gold inlay)'],
  ['we dig down to the first fire', 'kerf', 'Hall frieze, the diggers\' account'],
  ['keep the door and let them sleep', 'thread', 'Round grandma\'s salt circle in the cellar; she copied it without knowing what it said'],
  ['they are only going home', 'thread', 'Along a vault rib, the keepers\' account'],
];
for (const [t, script, where] of lines) {
  const l = script === 'kerf' ? kerf(t) : thread(t);
  const s = Math.min(script === 'kerf' ? 26 : 34, (W - 120) / l.width);
  y += script === 'kerf' ? 40 + 2 * s : 40 + s * 0.6;
  draw(l, 60, y, s, script === 'kerf' ? GOLD : INK, script === 'kerf' ? 4 : 3);
  y += script === 'kerf' ? 30 : 30 + s * 1.0;
  text(60, y, `"${t}"  ${where}`, 17, SOFT, 'start', 'font-style="italic"');
}
y += 50;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}"><rect width="100%" height="100%" fill="${PAPER}"/>${parts.join('')}</svg>`;
const [out, png] = process.argv.slice(2);
writeFileSync(out ?? 'glyphs.svg', svg);
if (png) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  const page = await browser.newPage({ viewport: { width: W, height: Math.ceil(y) } });
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  await page.screenshot({ path: png });
  await browser.close();
}
