/**
 * Grandma's room as Way Home shows it (public/portal/home.jpg, src/world/wayHome.ts HOME_SHOT): the
 * game in her cellar at the armchair, the nobody and the HUD hidden, the screen saved; the camera it
 * was taken with is printed, for HOME_SHOT. `npm run build`, then
 * `node tools/shot/way-home-picture.mjs [out.jpg]`.
 */
import { chromium } from 'playwright';
import { preview } from 'vite';

const out = process.argv[2] ?? 'public/portal/home.jpg';
const server = await preview({ preview: { port: 5197, strictPort: false }, logLevel: 'silent' });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error(`[page error] ${e.message}`));
await page.goto(server.resolvedUrls.local[0] + '?seed=1&gl&depth=0');
await page.waitForFunction(() => window.__ready === true && window.__game?.view.settled, null, { timeout: 1800000 });
await page.evaluate(() => {
  window.__game.nobody.root.visible = false;
  for (const e of document.body.querySelectorAll('body > *')) if (!e.querySelector('canvas') && e.tagName !== 'CANVAS') e.style.visibility = 'hidden';
});
await page.waitForTimeout(60000); // a few frames in SwiftShader
await page.locator('canvas').first().screenshot({ path: out, type: 'jpeg', quality: 85, timeout: 900000 });
console.log("HOME_SHOT", JSON.stringify(await page.evaluate(() => window.__game.shot())));
await browser.close();
await server.close();
