/**
 * A shop's counter (or the pack) open headless: `node tools/shot/counter-probe.mjs "<query with pos at a counter>" <out.png> [key] [panel]`
 * (build first; set CHROMIUM_PATH in the cloud and use ?gl). Puts a few finds, a spare hatchet and
 * found gear in the pack and €80 in the purse, presses `key` (E: step up to the counter; I: the
 * pack) and screenshots once `panel` (#shop, #pack) is open.
 */
import { chromium } from 'playwright';
import { preview } from 'vite';
const [q, out, key = 'KeyE', panel = '#shop'] = process.argv.slice(2);
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
  g.pack.stow({ kind: 'hobnail-boots', quality: 'fine', of: 'leap' });
  g.pack.stow({ kind: 'barbara-medal', quality: 'worn' });
  g.pack.stow({ kind: 'knee-pads', quality: 'sound' });
});
await page.waitForTimeout(1500);
await page.evaluate((k) => window.__game.pressKey(k), key);
await page.waitForFunction((p) => document.querySelector(`${p}.open`), panel, { timeout: 300000 });
await page.waitForTimeout(8000); // (the frame grows its salt)
await page.screenshot({ path: out, timeout: 600000 });
await browser.close(); await server.close();
