/**
 * Watch the nobody swing each weapon headless: `node tools/shot/weapons-probe.mjs "<query>" <out-prefix>`
 * (build first; set CHROMIUM_PATH in the cloud and use ?gl). For each weapon it puts it in the hand,
 * slows the clock, swings (the left button, the pointer faked captured), stops the clock near the
 * top of the swing and saves a screenshot from above and behind.
 */
import { chromium } from 'playwright';
import { preview } from 'vite';
const [q, prefix] = process.argv.slice(2);
const server = await preview({ preview: { port: 5198, strictPort: false }, logLevel: 'silent' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 640 } });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(server.resolvedUrls.local[0] + q);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 900000 });
await page.evaluate(() => {
  Object.defineProperty(document, 'pointerLockElement', { get: () => window.__lock ?? null, configurable: true });
});
/** Press the left button on every canvas, each in turn faked as the one holding the pointer. */
const swing = () => page.evaluate(() => {
  for (const c of document.querySelectorAll('canvas')) { window.__lock = c; c.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })); }
  window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
});
const SLOW = 0.05;
// Seconds of game clock into the swing for each shot: near the top, and at the blow.
const AT = { 'kitchen-knife': [0.12], hatchet: [0.26], pick: [0.45], crowbar: [0.18] };
for (const [kind, ats] of Object.entries(AT)) {
  for (const [n, at] of ats.entries()) {
    await page.evaluate(([kind, slow]) => {
      const g = window.__game;
      if (kind === 'kitchen-knife') g.kit.off('main'); else g.kit.put({ kind, quality: 'sound' });
      g.timescale = 1;
      g.cam.distance = 3.4; g.cam.pitch = -0.55;
      return slow;
    }, [kind, SLOW]);
    await page.waitForTimeout(4000); // dressed, and the last swing over
    await page.evaluate((slow) => { window.__game.timescale = slow; }, SLOW);
    const t0 = Date.now();
    await swing();
    const wait = (at / SLOW) * 1000 - (Date.now() - t0);
    if (wait > 0) await page.waitForTimeout(wait);
    await page.evaluate(() => { window.__game.timescale = 0; });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${prefix}-${kind}-${n}.png`, timeout: 600000 });
    console.log(kind, n, 'hand', await page.evaluate(() => window.__game.kit.hand.kind));
  }
}
await browser.close(); await server.close();
