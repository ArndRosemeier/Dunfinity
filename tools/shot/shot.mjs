/**
 * Headless screenshots of the game or the Lab (`?lab`): `npm run shot -- "<url query>" out.png [more pairs...]`.
 * Serves the production build (run `npm run build` first) and renders in Chromium with SwiftShader
 * (no GPU needed), so it works in the cloud container. Prints the page's console errors.
 */
import { chromium } from 'playwright';
import { preview } from 'vite';

const args = process.argv.slice(2);
if (args.length < 2 || args.length % 2) {
  console.error('usage: npm run shot -- "<query>" out.png [...]');
  process.exit(2);
}
const server = await preview({ preview: { port: 5191, strictPort: false }, logLevel: 'silent' });
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'],
});
let failed = false;
for (let i = 0; i < args.length; i += 2) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('console', (m) => { if (m.type() === 'error') { console.error(`[page] ${m.text()}`); } });
  page.on('pageerror', (e) => { failed = true; console.error(`[page error] ${e.message}`); });
  await page.goto(base + (args[i].startsWith('?') ? args[i] : '?' + args[i]));
  await page.waitForFunction(() => (window).__ready === true, null, { timeout: 120000 }).catch(() => { failed = true; console.error('page did not report ready'); });
  await page.screenshot({ path: args[i + 1] });
  const hud = await page.textContent('#hud');
  console.log(`${args[i + 1]}: ${hud?.split('\n')[0]}`);
  const shaders = await page.evaluate(() => ({ report: (window).shaders?.report() }));
  console.log(shaders.report ?? 'shaders: no monitor');
  await page.close();
}
await browser.close();
await server.close();
process.exit(failed ? 1 : 0);
