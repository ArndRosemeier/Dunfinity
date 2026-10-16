/**
 * The title screen in the built game, headless: wait for the set to come on, choose New Game, and see the
 * game take over (its level in, the title gone). `node tools/shot/title-probe.mjs <outdir>` (run
 * `npm run build` first).
 */
import { chromium } from 'playwright';
import { preview } from 'vite';

const out = process.argv[2] ?? '.';
const server = await preview({ preview: { port: 5193, strictPort: false }, logLevel: 'silent' });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
page.on('pageerror', (e) => console.error(`[page error] ${e.message}`));
await page.goto(server.resolvedUrls.local[0] + (process.env.QUERY ?? '?title&gl&shot=1'));
await page.waitForFunction(() => window.__ready === true, null, { timeout: 900000 });
await page.screenshot({ path: `${out}/title.png`, timeout: 900000 });
await page.waitForSelector('#title .menu > button:not([disabled])', { state: 'attached', timeout: 900000 }); // greyed out until the game is warm
await page.getByRole('button', { name: 'New Game' }).click({ force: true, timeout: 600000 }); // frames are slow in SwiftShader: no waiting for it to hold still
await page.waitForFunction(() => !document.getElementById('title') && window.__ready === true && window.__game, null, { timeout: 900000 });
console.log('game:', await page.evaluate(() => { const g = window.__game, b = g.body; return `level ${g.depth} at ${[b.x, b.y, b.z].map((v) => v.toFixed(1)).join(' ')} ${b.mode}`; }));
await page.screenshot({ path: `${out}/game.png`, timeout: 900000 });
await browser.close();
await server.close();
