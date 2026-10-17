/**
 * Close-ups of the nobody's right fist round each held weapon, headless, in the Lab's hands view
 * (src/lab/hands.ts): `node tools/shot/grip-probe.mjs <out-prefix> [weapon,...]` (build first; set
 * CHROMIUM_PATH in the cloud). For each weapon: the fist held ready from the side, the front and the
 * outside, then the whole arm at moments of its swing (src/combat/combat.ts MOVES), from the side.
 */
import { chromium } from 'playwright';
import { preview } from 'vite';
const [prefix, only] = process.argv.slice(2);
const SWINGS = { knife: ['swing_1h', 0.42, [0.25, 0.45, 0.7]], hatchet: ['swing_1h', 0.72, [0.32, 0.55]], pick: ['mine', 1.05, [0.42, 0.62]], crowbar: ['swing_1h', 0.6, [0.28, 0.52]] };
const VIEWS = [['side', Math.PI / 2, 0.3, 0.03], ['front', 0.3, 0.3, 0.05], ['outside', -Math.PI / 2 - 0.5, 0.3, 0.04]];
const server = await preview({ preview: { port: 5199, strictPort: false }, logLevel: 'silent' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'] });
for (const [kind, [id, dur, ats]] of Object.entries(SWINGS)) {
  if (only && !only.split(',').includes(kind)) continue;
  const page = await browser.newPage({ viewport: { width: 560, height: 560 } });
  page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
  await page.goto(`${server.resolvedUrls.local[0]}?lab&gl&studio&dark&hands=${kind}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 900000 });
  await page.addStyleTag({ content: "#hud, .version, button { display: none !important }" });
  const shot = async (name, view, act) => {
    await page.evaluate(([view, act]) => { const h = window.__lab.hands; h.view = view; h.act = act; }, [view, act]);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${prefix}-${kind}-${name}.png`, timeout: 600000 });
  };
  for (const [name, yaw, dist, up] of VIEWS) await shot(`ready-${name}`, { yaw, dist, up }, null);
  for (const [i, at] of ats.entries()) await shot(`swing${i}`, { yaw: Math.PI / 2, dist: 1.1, up: 0.1 }, { id, dur, at: at * dur });
  console.log('done', kind);
  await page.close();
}
await browser.close(); await server.close();
