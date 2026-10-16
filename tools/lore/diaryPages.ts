/**
 * Grandma's diary pages in her own hand (docs/design/grandmas-diary.md): each page of
 * src/lore/diary.ts painted by an image model as a photographed notebook page. The pages she tore
 * out are in her young, fast hand in blue fountain pen; the pages kept in the book are in her
 * careful old hand in black ballpoint. Raw pictures go to RAW (the shared folder), and the game's
 * scaled-down copies to public/diary/<id>.webp. Needs OPEN_ROUTER_KEY and ffmpeg. Read every
 * picture against its text before it ships: the model sometimes writes a word twice where a line
 * wraps, so for a long page paint a few takes and pick the one that reads right.
 *
 *   npx tsx tools/lore/diaryPages.ts [id ...]                  (no ids: every page without a picture yet)
 *   npx tsx tools/lore/diaryPages.ts --takes 3 id ...          (RAW/<id>-1.webp ... to choose from)
 *   npx tsx tools/lore/diaryPages.ts --pick id take            (that take becomes the page's picture)
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { PAGES, pageId, type DiaryPage } from '../../src/lore/diary';

const RAW = '/mnt/project-files/dunfinity/lore/diary';
const OUT = 'public/diary';
const MODEL = 'meta/muse-image';
/** Pictures asked for at once (the API turns away many more). */
const AT_ONCE = 4;

function prompt(p: DiaryPage): string {
  const young = p.depth !== null;
  const page = young
    ? 'A single page torn out of a small 1960s pocket diary, lined paper yellowed with age, photographed flat from above on dark stone, filling most of the frame. The left edge is ragged where it was ripped out of the book, a fold crease across the middle, a little grey salt dust on it.'
    : `A single page of a small pocket diary still bound in its book, lined paper yellowed with age, photographed flat from above, filling the whole frame. The binding is at the left edge. Clean, kept indoors.`;
  const hand = young
    ? 'Handwritten in blue fountain-pen ink by a young woman in a hurry: fast, slanted cursive, but every word legible.'
    : p.date === '2026'
      ? 'Handwritten in black ballpoint by a very old woman: careful upright cursive, shaky, pressing hard, every word legible.'
      : 'Handwritten in black ballpoint by an older woman: careful, upright, neat cursive, every word legible.';
  return `${page} ${hand} At the top, underlined, the date "${p.date}". Below it the full text, every word spelled exactly as given, nothing added, nothing crossed out: "${p.text}" No other writing anywhere on the page, no printed text, no page numbers.`;
}

async function paint(p: DiaryPage, take = 0): Promise<void> {
  const id = pageId(p), raw = `${RAW}/${id}${take ? `-${take}` : ''}.webp`;
  const r = await fetch('https://openrouter.ai/api/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPEN_ROUTER_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt: prompt(p) }),
  });
  if (!r.ok) throw new Error(`${id}: ${r.status} ${await r.text()}`);
  const j = (await r.json()) as { data: { b64_json: string }[] };
  writeFileSync(raw, Buffer.from(j.data[0].b64_json, 'base64'));
  if (take) console.log(`${id}: ${raw}`);
  else use(id, raw);
}

/** The game's copy of a raw picture: 720 px wide, a small webp. */
function use(id: string, raw: string): void {
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', raw, '-vf', 'scale=720:-2', '-quality', '72', `${OUT}/${id}.webp`]);
  console.log(`${id}: ${raw} -> ${OUT}/${id}.webp`);
}

const args = process.argv.slice(2);
mkdirSync(RAW, { recursive: true });
mkdirSync(OUT, { recursive: true });
if (args[0] === '--pick') {
  copyFileSync(`${RAW}/${args[1]}-${args[2]}.webp`, `${RAW}/${args[1]}.webp`);
  use(args[1], `${RAW}/${args[1]}.webp`);
} else {
  const takes = args[0] === '--takes' ? Number(args[1]) : 0, want = takes ? args.slice(2) : args;
  const todo = PAGES.filter((p) => (want.length ? want.includes(pageId(p)) : !existsSync(`${OUT}/${pageId(p)}.webp`)))
    .flatMap((p) => (takes ? Array.from({ length: takes }, (_, k) => [p, k + 1] as const) : [[p, 0] as const]));
  for (let i = 0; i < todo.length; i += AT_ONCE) await Promise.all(todo.slice(i, i + AT_ONCE).map(([p, t]) => paint(p, t)));
}
