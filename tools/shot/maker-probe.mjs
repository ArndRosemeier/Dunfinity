/**
 * The debug menu's creature maker in the built game, headless: open the menu, randomize and spawn a
 * few creatures in front of you, a shot of each (the menu open, its sliders showing). `node
 * tools/shot/maker-probe.mjs <outdir> [rolls] [query]` (run `npm run build` first).
 */
import { chromium } from 'playwright';
import { preview } from 'vite';

const out = process.argv[2] ?? '.', rolls = Number(process.argv[3] ?? 3), query = process.argv[4] ?? '?seed=1&gl&fresh';
const server = await preview({ preview: { port: 5193, strictPort: false }, logLevel: 'silent' });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
page.on('pageerror', (e) => console.error(`[page error] ${e.message}`));
await page.goto(server.resolvedUrls.local[0] + query);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 600000 });
await page.keyboard.press('Backquote');
await page.waitForTimeout(300);
// (A title or intro on top can take the key: then open it by hand.)
if (!(await page.evaluate(() => document.querySelector('#debug')?.classList.contains('open')))) {
  console.log('the key did not open the menu; opening it by hand');
  await page.evaluate(() => document.querySelector('#debug').classList.add('open'));
}
console.log(await page.evaluate(() => { const d = document.querySelector('#debug'); const r = d.getBoundingClientRect(); return `#debug ${d.className} ${getComputedStyle(d).display} ${r.width}x${r.height}; title ${!!document.querySelector('#title.open, .title.open')}`; }));
await page.screenshot({ path: `${out}/maker-start.png`, timeout: 300000 });
// (Clicked from inside the page: SwiftShader's slow frames never let an element count as stable.)
const press = (sel, text) => page.evaluate(([sel, text]) => [...document.querySelectorAll(sel)].find((e) => !text || e.textContent === text).click(), [sel, text]);
await press('#debug details summary');
for (let k = 0; k < rolls; k++) {
  await press('#debug .maker button', 'Randomize');
  await press('#debug .maker button', 'Spawn');
  await page.waitForTimeout(8000);
  console.log(`${k}:`, await page.textContent('#debug .said'));
  await page.screenshot({ path: `${out}/maker-${k}.png`, timeout: 300000 });
}
await browser.close();
await server.close();
