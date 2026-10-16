/**
 * Look into the pack headless: `node tools/shot/pack-probe.mjs "<query>" <out-prefix>` (build first;
 * set CHROMIUM_PATH in the cloud and use ?gl). Fills the pack with the nearest finds, opens it (I),
 * saves a screenshot, leaves the first find on the floor (S nine times, E) and saves another.
 */
import { chromium } from 'playwright';
import { preview } from 'vite';
const [q, prefix] = process.argv.slice(2);
const server = await preview({ preview: { port: 5197, strictPort: false }, logLevel: 'silent' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(server.resolvedUrls.local[0] + q);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 900000 });
console.log('filled', await page.evaluate(() => {
  const g = window.__game, b = g.body;
  const near = g.finds.near(b.x, b.z, 400).sort((a, c) => Math.hypot(a.x - b.x, a.z - b.z) - Math.hypot(c.x - b.x, c.z - b.z));
  g.kit.put({ kind: 'miners-helmet', quality: 'sound' });
  g.pack.stow({ kind: 'work-gloves', quality: 'worn' });
  for (const f of near) if (!g.pack.full) { g.finds.take(f); g.pack.add(f); }
  return g.pack.items.length;
}));
const tap = async (k) => { await page.keyboard.down(k); await page.waitForTimeout(1500); await page.keyboard.up(k); await page.waitForTimeout(1500); };
await tap('KeyI');
await page.waitForTimeout(20000);
await page.screenshot({ path: `${prefix}-open.png`, timeout: 600000 });
for (let i = 0; i < 9; i++) await tap('KeyS'); // round to the first find
await tap('KeyE');
await page.waitForTimeout(20000);
await page.screenshot({ path: `${prefix}-used.png`, timeout: 600000 });
console.log('pack', await page.evaluate(() => window.__game.pack.items.length));
console.log((await page.textContent('#hud')).split('\n').slice(3).join(' | '));
await browser.close(); await server.close();
