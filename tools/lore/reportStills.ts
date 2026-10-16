/**
 * The stills of the title screen's television report (src/lore/report.ts): grainy 1966 press
 * photographs, painted by the image model (tools/lore/muse.ts). Raw pictures go to RAW (the shared
 * folder), the game's grey, scaled-down copies to public/report/<id>.webp. Look at every one before
 * it ships: no writing may show in a picture, and the figure in the street must stay far and blurred.
 *
 *   npx tsx tools/lore/reportStills.ts [id ...]             (no ids: every still without a picture yet)
 *   npx tsx tools/lore/reportStills.ts --takes 3 id ...     (RAW/<id>-1.webp ... to choose from)
 *   npx tsx tools/lore/reportStills.ts --pick id take       (that take becomes the still)
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { REPORT } from '../../src/lore/report';
import { inBatches, paint, scaled } from './muse';

const RAW = '/mnt/project-files/dunfinity/lore/report';
const OUT = 'public/report';

/** Each still once, with what it shows. */
const STILLS = new Map(REPORT.filter((s) => s.still && s.shows).map((s) => [s.still!, s.shows!]));
STILLS.set('set', '');
/** The set it plays on (`set`: a colour photograph, kept in colour; the screen is overlaid in the game). */
const SET = 'A colour photograph, at night, of a 1960s German television set standing on a low wooden sideboard in a dim old-fashioned living room. The set is a wooden cabinet with rounded corners, a large curved grey picture tube in the middle of its front, two round knobs and a small speaker grille on the right side of the front. Seen straight from the front at the height of the screen, the set in the middle of the picture filling about half of its width. The screen is switched off: plain, dark grey glass with a faint reflection, nothing on it. The room around it is almost dark: patterned wallpaper, a doily on the set, a small framed photograph and a china figurine beside it, a standard lamp with a fringed shade off to the left giving a warm weak light. Quiet, slightly eerie. Landscape format. No text or lettering anywhere.';

function prompt(shows: string): string {
  if (!shows) return SET;
  return `A grainy black-and-white press photograph from 1966, taken in a small German town: ${shows}. Shot on a cheap camera, coarse film grain, a little out of focus, harsh contrast, slightly underexposed, like a picture printed in a tabloid newspaper. Landscape format. No text, no lettering, no signs, no captions, no watermark anywhere in the picture.`;
}

function use(id: string, raw: string): void {
  if (id === 'set') scaled(raw, `${OUT}/${id}.webp`, 1600);
  else scaled(raw, `${OUT}/${id}.webp`, 640, 'format=gray');
}

const args = process.argv.slice(2);
mkdirSync(RAW, { recursive: true });
mkdirSync(OUT, { recursive: true });
if (args[0] === '--pick') {
  copyFileSync(`${RAW}/${args[1]}-${args[2]}.webp`, `${RAW}/${args[1]}.webp`);
  use(args[1], `${RAW}/${args[1]}.webp`);
} else {
  const takes = args[0] === '--takes' ? Number(args[1]) : 0, want = takes ? args.slice(2) : args;
  const ids = [...STILLS.keys()].filter((id) => (want.length ? want.includes(id) : !existsSync(`${OUT}/${id}.webp`)));
  const todo = ids.flatMap((id) => (takes ? Array.from({ length: takes }, (_, k) => [id, k + 1] as const) : [[id, 0] as const]));
  await inBatches(todo, async ([id, take]) => {
    const raw = `${RAW}/${id}${take ? `-${take}` : ''}.webp`;
    await paint(prompt(STILLS.get(id)!), raw);
    if (take) console.log(`${id}: ${raw}`);
    else use(id, raw);
  });
}
