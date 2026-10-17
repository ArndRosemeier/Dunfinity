/**
 * A shop's counter open headless: `node tools/shot/counter-probe.mjs "<query with pos at a counter>" <out.png>`
 * (build first; set CHROMIUM_PATH in the cloud and use ?gl). Puts a few finds, a spare hatchet and
 * €80 in the purse, steps up to the counter (E) and screenshots.
 */
import { chromium } from 'playwright';
import { preview } from 'vite';
const [q, out] = process.argv.slice(2);
const server = await preview({ preview: { port: 5198, strictPort: false }, logLevel: 'silent' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(server.resolvedUrls.local[0] + q);
await page.waitForFunction(() => window.__game?.body && window.__ready === true, null, { timeout: 900000 });
await page.evaluate(() => {
  const g = window.__game;
  g.euros = 80;
  for (const [id, kind, value] of [[9001, 'coin', 4], [9002, 'lamp', 18], [9003, 'watch', 35]]) g.pack.add({ id, kind, x: 0, y: 0, z: 0, yaw: 0, value });
  g.pack.stow({ kind: 'hatchet', quality: 'sound' });
});
await page.waitForTimeout(1500);
await page.evaluate(() => window.__game.pressKey('KeyE'));
await page.waitForFunction(() => document.querySelector('#shop.open'), null, { timeout: 300000 });
await page.waitForTimeout(8000); // (the frame grows its salt)
await page.screenshot({ path: out, timeout: 600000 });
await browser.close(); await server.close();
