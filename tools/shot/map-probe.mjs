/**
 * Look at the map headless: `node tools/shot/map-probe.mjs "<query>" <out-prefix> [steps]` (build first;
 * set CHROMIUM_PATH in the cloud and use ?gl). Wanders `steps` × 2 m round the nobody marking the floor
 * seen (`__game.explore`), opens the map (M) and saves `<prefix>-near.png`, then farther out (−) `<prefix>-far.png`.
 */
import { chromium } from 'playwright';
import { preview } from 'vite';
const [q, prefix, steps = '300'] = process.argv.slice(2);
const server = await preview({ preview: { port: 5198, strictPort: false }, logLevel: 'silent' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(server.resolvedUrls.local[0] + q);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 900000 });
await page.evaluate((n) => { for (let k = 0; k < 4; k++) window.__game.explore(n / 4, k); }, Number(steps));
const tap = async (k) => { await page.keyboard.down(k); await page.waitForTimeout(1500); await page.keyboard.up(k); };
const wait = Number(process.env.SHOT_WAIT ?? 40000);
await tap('KeyM');
await page.waitForTimeout(wait);
await page.screenshot({ path: `${prefix}-near.png`, timeout: 600000 });
await tap('Minus');
await page.waitForTimeout(wait);
await page.screenshot({ path: `${prefix}-far.png`, timeout: 600000 });
await browser.close(); await server.close();
