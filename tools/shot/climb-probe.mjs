/**
 * Watch a ladder climb headless: `node tools/shot/climb-probe.mjs "<query>" <out-prefix> [up]` (build first;
 * set CHROMIUM_PATH in the cloud and use ?gl). Starts the climb down the nearest way down (or up the way
 * up with `up`) and saves a screenshot every few seconds until the climb ends. SwiftShader is slow:
 * the game runs at a fraction of real time, so a climb takes a couple of minutes.
 */
import { chromium } from 'playwright';
import { preview } from 'vite';
const [q, prefix, up] = process.argv.slice(2);
const server = await preview({ preview: { port: 5193, strictPort: false }, logLevel: 'silent' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 650 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}] ${m.text().slice(0, 300)}`); });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(server.resolvedUrls.local[0] + q);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
const start = await page.evaluate(() => window.__game.depth);
console.log("started", await page.evaluate((u) => window.__game.descend(u === 'up'), up));
for (let i = 0; i < 70; i++) {
  await page.waitForTimeout(3500);
  const st = await page.evaluate(() => { const g = window.__game; return { d: g.depth, c: g.climbing, y: g.body.y.toFixed(1), x: g.body.x.toFixed(1), z: g.body.z.toFixed(1) }; });
  console.log(i, JSON.stringify(st));
  if (i % 3 === 0 || st.d !== start) await page.screenshot({ path: `${prefix}-${String(i).padStart(2, "0")}.png` });
  if (!st.c && i > 2) break;
}
const hud = await page.textContent('#hud');
console.log(hud.split('\n').slice(3, 9).join(' | '));
await browser.close(); await server.close();
