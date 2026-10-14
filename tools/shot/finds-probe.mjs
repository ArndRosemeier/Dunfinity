/**
 * Pick up a find headless: `node tools/shot/finds-probe.mjs "<query>" <out-prefix>` (build first; set
 * CHROMIUM_PATH in the cloud and use ?gl). Puts the nobody next to the nearest find on open floor,
 * saves a screenshot, picks it up as E would and saves another, and prints the pack.
 */
import { chromium } from 'playwright';
import { preview } from 'vite';
const [q, prefix] = process.argv.slice(2);
const server = await preview({ preview: { port: 5196, strictPort: false }, logLevel: 'silent' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 650 } });
page.on('console', (m) => { if (m.type() === 'error') console.log(`[${m.type()}] ${m.text().slice(0, 300)}`); });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(server.resolvedUrls.local[0] + q);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
console.log('find', await page.evaluate(() => {
  const g = window.__game, b = g.body;
  const f = g.finds.near(b.x, b.z, 200).filter((f) => f.id % 8 < 2).sort((a, c) => Math.hypot(a.x - b.x, a.z - b.z) - Math.hypot(c.x - b.x, c.z - b.z))[0];
  b.x = f.x + 0.9; b.z = f.z; b.y = f.y + 0.3; b.vx = b.vz = 0;
  g.cam.yaw = Math.PI / 2 + 0.5; g.cam.distance = 2.2; g.cam.pitch = -0.6;
  return [f.kind, f.value];
}));
await page.waitForTimeout(6000);
await page.screenshot({ path: `${prefix}-before.png` });
console.log('picked', await page.evaluate(() => window.__game.pickUp()));
await page.waitForTimeout(2500);
await page.screenshot({ path: `${prefix}-stoop.png` });
await page.waitForTimeout(8000);
await page.screenshot({ path: `${prefix}-after.png` });
console.log('pack', await page.evaluate(() => JSON.stringify(window.__game.pack.items.map((f) => [f.kind, f.value]))));
console.log((await page.textContent('#hud')).split('\n').slice(3).join(' | '));
await browser.close(); await server.close();
