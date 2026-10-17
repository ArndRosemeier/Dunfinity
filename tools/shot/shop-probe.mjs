/**
 * Inside the shops headless: `node tools/shot/shop-probe.mjs "<query with pos and look>" <out.png> [camera distance]`
 * (build first; set CHROMIUM_PATH in the cloud and use ?gl). Pulls the camera in close (a shop is
 * small) and screenshots.
 */
import { chromium } from 'playwright';
import { preview } from 'vite';
const [q, out, dist = '1.2'] = process.argv.slice(2);
const server = await preview({ preview: { port: 5197, strictPort: false }, logLevel: 'silent' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 640 } });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(server.resolvedUrls.local[0] + q);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 900000 });
await page.evaluate((d) => { window.__game.cam.distance = Number(d); }, dist);
await page.waitForTimeout(8000);
await page.screenshot({ path: out, timeout: 600000 });
await browser.close(); await server.close();
