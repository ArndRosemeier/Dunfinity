/**
 * Kemal's flashlight headless: `node tools/shot/torch-probe.mjs "<query>" <out-prefix>` (build first;
 * set CHROMIUM_PATH in the cloud and use ?gl). Puts a flashlight in the off hand, screenshots the
 * dark with the headlamp only, presses L (again, after a wait, until the beam is on) and screenshots the beam.
 */
import { chromium } from 'playwright';
import { preview } from 'vite';
const [q, prefix] = process.argv.slice(2);
const server = await preview({ preview: { port: 5196, strictPort: false }, logLevel: 'silent' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 640 } });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(server.resolvedUrls.local[0] + q);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 900000 });
await page.evaluate(() => { const g = window.__game; g.kit.put({ kind: 'flashlight', quality: 'sound' }); g.cam.distance = 2.5; g.cam.pitch = -0.08; });
await page.waitForTimeout(5000);
await page.screenshot({ path: `${prefix}-off.png`, timeout: 600000 });
// (Each press toggles it, and a frame takes seconds here: press once and wait out a few frames before trying again.)
for (let i = 0; i < 6 && !(await page.evaluate(() => window.__game.view.torch)); i++) { await page.keyboard.press('KeyL'); await page.waitForTimeout(30000); }
console.log('torch', await page.evaluate(() => window.__game.view.torch));
await page.waitForTimeout(5000);
await page.screenshot({ path: `${prefix}-on.png`, timeout: 600000 });
await browser.close(); await server.close();
