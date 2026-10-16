/**
 * The introduction in the built game, headless: the prologue's shots (seeking to a time in each), then
 * Escape into play, the first steps card, and a step ticked. `node tools/shot/intro-probe.mjs <outdir> [t,t,...]`
 * (run `npm run build` first; in the cloud container set CHROMIUM_PATH, see CLAUDE.md).
 */
import { chromium } from 'playwright';
import { preview } from 'vite';

const out = process.argv[2] ?? '.', times = (process.argv[3] ?? '4,13,22,31,40').split(',').map(Number);
const server = await preview({ preview: { port: 5193, strictPort: false }, logLevel: 'silent' });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.error(`[page error] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') console.error(`[page] ${m.text()}`); });
const ready = () => page.waitForFunction(() => window.__ready === true, null, { timeout: 600000 });
await page.goto(server.resolvedUrls.local[0] + '?intro&gl');
await ready();
for (const t of times) {
  await page.evaluate((t) => { window.__game.prologue.t = t; }, t);
  await page.waitForTimeout(1500);
  await ready();
  await page.waitForTimeout(4000);
  const f = await page.evaluate(() => { const p = window.__game.prologue; return p && { t: p.t.toFixed(1), ...p.frame() }; });
  console.log(`t=${t}:`, JSON.stringify(f));
  await page.screenshot({ path: `${out}/prologue-${t}.png`, timeout: 300000 });
}
await page.keyboard.press('Escape');
await page.waitForTimeout(2500);
await ready();
await page.waitForTimeout(3000);
await page.screenshot({ path: `${out}/steps-start.png`, timeout: 300000 });
// Read the letter: put the nobody at the side table and press E.
await page.evaluate(() => { const b = window.__game.body; b.x = 5.6; b.z = 0.6; });
await page.waitForTimeout(1500);
await page.keyboard.press('KeyE');
await page.waitForTimeout(2500);
console.log('steps:', await page.evaluate(() => JSON.stringify(window.__game.steps.data)));
await page.screenshot({ path: `${out}/steps-letter.png`, timeout: 300000 });
await browser.close();
await server.close();
