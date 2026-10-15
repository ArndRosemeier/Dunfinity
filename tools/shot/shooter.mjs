/**
 * The one way the shot tools open the game headless: serves the production build (run `npm run build`
 * first) and renders in Chromium with SwiftShader (no GPU needed), so it works in the cloud container.
 * `shoot(query, out)` waits for the page to report ready (plus `SHOT_WAIT` ms), saves a screenshot and
 * returns the HUD's first line and the shader report; it prints the page's console errors.
 */
import { chromium } from 'playwright';
import { preview } from 'vite';

export async function openShooter() {
  const server = await preview({ preview: { port: 5191, strictPort: false }, logLevel: 'silent' });
  const base = server.resolvedUrls.local[0];
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'],
  });
  const shooter = {
    failed: false,
    async shoot(query, out) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      page.on('console', (m) => { if (m.type() === 'error') { console.error(`[page] ${m.text()}`); } });
      page.on('pageerror', (e) => { shooter.failed = true; console.error(`[page error] ${e.message}`); });
      await page.goto(base + (query.startsWith('?') ? query : '?' + query));
      await page.waitForFunction(() => (window).__ready === true, null, { timeout: 300000 }).catch(() => { shooter.failed = true; console.error('page did not report ready'); });
      await page.waitForTimeout(Number(process.env.SHOT_WAIT ?? 0));
      await page.screenshot({ path: out, timeout: 240000 });
      const hud = (await page.textContent('#hud'))?.split('\n')[0];
      const shaders = (await page.evaluate(() => ({ report: (window).shaders?.report() }))).report ?? 'shaders: no monitor';
      await page.close();
      return { hud, shaders };
    },
    /** A page of plain HTML, screenshot whole (the strip's contact sheet). */
    async sheet(html, out) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.setContent(html, { waitUntil: 'load' });
      await page.screenshot({ path: out, fullPage: true });
      await page.close();
    },
    async close() {
      await browser.close();
      await server.close();
    },
  };
  return shooter;
}
