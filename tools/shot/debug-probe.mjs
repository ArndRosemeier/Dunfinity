/**
 * The debug menu in the built game, headless: open it, invulnerable, copy the position, teleport
 * into a level style, then paste the copied position back. `node tools/shot/debug-probe.mjs <outdir> [style]`
 * (run `npm run build` first).
 */
import { chromium } from 'playwright';
import { preview } from 'vite';

const out = process.argv[2] ?? '.', style = process.argv[3] ?? 'karst';
const server = await preview({ preview: { port: 5192, strictPort: false }, logLevel: 'silent' });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await context.grantPermissions(['clipboard-read', 'clipboard-write']);
const page = await context.newPage();
page.on('pageerror', (e) => console.error(`[page error] ${e.message}`));
const ready = () => page.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
const settle = async () => { await page.waitForTimeout(500); await ready(); await page.waitForTimeout(15000); };
const where = () => page.evaluate(() => { const g = window.__game, b = g.body; return `level ${g.depth} at ${[b.x, b.y, b.z].map((v) => v.toFixed(1)).join(' ')} ${b.mode} health ${b.health}`; });
await page.goto(server.resolvedUrls.local[0] + '?seed=1&gl&fresh');
await ready();
await page.keyboard.press('Backquote');
await page.waitForTimeout(300);
await page.click('#debug label:has-text("Invulnerable") input');
await page.click('#debug button:has-text("Copy position")');
await page.waitForTimeout(300);
const copied = await page.evaluate(() => navigator.clipboard.readText());
console.log('copied:\n' + copied);
await page.screenshot({ path: `${out}/debug-menu.png`, timeout: 180000 });
await page.click(`#debug button:text-is("${style}")`);
await settle();
console.log(`after ${style}:`, await where());
console.log((await page.textContent('#hud'))?.split('\n').filter((l) => /Level|style|debug/.test(l)).join(' | '));
await page.screenshot({ path: `${out}/debug-${style}.png`, timeout: 180000 });
await page.keyboard.press('Backquote');
await page.fill('#debug input[type=text]', copied);
await page.click('#debug button:has-text("Go there")');
await settle();
console.log('pasted back:', await where(), '·', await page.textContent('#debug .said'));
await browser.close();
await server.close();
