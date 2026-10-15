/**
 * The debug menu in the built game, headless: open it, give all abilities, go to level 5, teleport
 * to the Foreman, with screenshots. `node tools/shot/debug-probe.mjs <outdir>` (run `npm run build` first).
 */
import { chromium } from 'playwright';
import { preview } from 'vite';

const out = process.argv[2] ?? '.';
const server = await preview({ preview: { port: 5192, strictPort: false }, logLevel: 'silent' });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.error(`[page error] ${e.message}`));
const ready = () => page.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
const settle = async () => { await page.waitForTimeout(500); await ready(); await page.waitForTimeout(15000); };
await page.goto(server.resolvedUrls.local[0] + '?seed=1&gl&fresh');
await ready();
await page.keyboard.press('Backquote');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/debug-menu.png` });
await page.click('#debug button:has-text("Give me all abilities")');
await page.click('#debug label:has-text("Invulnerable") input');
console.log('cooked:', await page.evaluate(() => JSON.stringify(window.__game.cooked.data)));
await page.click('#debug button:text-is("5")');
await settle();
console.log('depth:', await page.evaluate(() => window.__game.depth));
await page.screenshot({ path: `${out}/debug-level5.png`, timeout: 180000 });
await page.click('#debug button:has-text("Foreman")');
await settle();
const b = await page.evaluate(() => { const b = window.__game.body; return [b.x, b.y, b.z, b.health, b.invulnerable].map(String).join(' '); });
console.log('at the Foreman:', b);
await page.screenshot({ path: `${out}/debug-foreman.png`, timeout: 180000 });
console.log((await page.textContent('#hud'))?.split('\n').slice(0, 12).join('\n'));
await browser.close();
await server.close();
