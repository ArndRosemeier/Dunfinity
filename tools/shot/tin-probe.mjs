/**
 * Open grandma's tin headless: `node tools/shot/tin-probe.mjs "<query>" <out.png>` (build first; set
 * CHROMIUM_PATH in the cloud and use ?gl). Practises a few skills by hand, waits to rest in her salt
 * circle (start it there: pos=6.5,0.1,0.2 in the query), opens the tin (T) and saves a screenshot.
 */
import { chromium } from 'playwright';
import { preview } from 'vite';
const [q, out] = process.argv.slice(2);
const server = await preview({ preview: { port: 5198, strictPort: false }, logLevel: 'silent' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(server.resolvedUrls.local[0] + q);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 900000 });
await page.evaluate(() => {
  const p = window.__game.practice;
  for (const [s, n] of [['knife', 70], ['running', 900], ['leaping', 40], ['climbing', 130], ['flame', 9], ['footwork', 5]]) p.use(s, n);
});
for (let i = 0; i < 40; i++) {
  await page.keyboard.down('KeyT'); await page.waitForTimeout(800); await page.keyboard.up('KeyT');
  if (await page.$('#tin.open')) break;
  await page.waitForTimeout(3000);
}
// (The open tin takes T as close, so shoot it as soon as it is up; then once more at the Practice divider.)
await page.screenshot({ path: out, timeout: 600000 });
await page.evaluate(() => document.querySelector('#tin [data-practice]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
await page.waitForTimeout(500);
await page.screenshot({ path: out.replace(/\.png$/, '-practice.png'), timeout: 600000 });
console.log(await page.$$eval('#tin .skill', (e) => e.map((x) => x.textContent).join(' | ')).catch(() => 'no tin'));
await browser.close(); await server.close();
