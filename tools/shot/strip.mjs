/**
 * The depth strip (docs/design/generative-depth.md §7 step 1): one seed at many depths, side by side,
 * each labelled with its level, band and strangeness, so strangeness is judged by eye.
 * `npm run strip -- <seed> [depths, default 1,11,21,41,61,100,200,500] out.png [extra query, e.g. "&gl&light"]`
 * (run `npm run build` first; in the cloud container add `&gl`). The single shots land next to the
 * sheet as `<out>-<depth>.png`. SwiftShader is slow: a deep level can take minutes, so a whole strip
 * takes a while: `SHOT_TIMEOUT=900000` gives each level longer. A level that fails is left out of the sheet.
 */
import { readFileSync } from 'node:fs';
import { strangeLabel } from '../../src/gen/genome.ts';
import { bandOf } from '../../src/gen/bands.ts';
import { lawsOf } from '../../src/gen/laws.ts';
import { parseViewParams } from '../../src/app/params.ts';
import { openShooter } from './shooter.mjs';

const args = process.argv.slice(2);
const seed = args[0];
const depthsGiven = args.length >= 3 && /^[\d,]+$/.test(args[1]);
const depths = (depthsGiven ? args[1] : '1,11,21,41,61,100,200,500').split(',').map(Number);
const out = args[depthsGiven ? 2 : 1];
const extra = args[depthsGiven ? 3 : 2] ?? '';
if (!seed || !out || !out.endsWith('.png')) {
  console.error('usage: npm run strip -- <seed> [1,11,21,...] out.png ["&gl&light"]');
  process.exit(2);
}
const n = parseViewParams(`?seed=${encodeURIComponent(seed)}`).seed; // the game's seed, text seeds hashed alike
const shooter = await openShooter();
const tiles = [];
for (const d of depths) {
  const file = out.replace(/\.png$/, `-${d}.png`);
  console.log(`level ${d}...`);
  try {
    await shooter.shoot(`?seed=${encodeURIComponent(seed)}&depth=${d}${extra}`, file);
  } catch (e) {
    shooter.failed = true;
    console.error(`  level ${d}: ${e.message.split('\n')[0]}`);
    continue;
  }
  const label = `level ${d} · ${bandOf(d).name} · ${strangeLabel(n, d)}${lawsOf(n, d).map((l) => ` · ${l}`).join('')}`;
  console.log(`  ${label}`);
  tiles.push({ label, src: `data:image/png;base64,${readFileSync(file).toString('base64')}` });
}
const html = `<body style="margin:0;background:#111;color:#eee;font:16px system-ui;display:grid;grid-template-columns:repeat(2,640px)">`
  + tiles.map((t) => `<figure style="margin:0;position:relative"><img src="${t.src}" style="width:640px;display:block">`
    + `<figcaption style="position:absolute;left:8px;bottom:8px;padding:2px 6px;background:#000b">${t.label}</figcaption></figure>`).join('')
  + '</body>';
await shooter.sheet(html, out);
console.log(`${out}: ${tiles.length} depths`);
await shooter.close();
process.exit(shooter.failed ? 1 : 0);
