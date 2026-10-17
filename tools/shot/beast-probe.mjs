/**
 * Look at the rats or dogs headless: `node tools/shot/beast-probe.mjs "<query>" <rats|dogs|townRats|townDogs> <out-prefix>`
 * (build first; set CHROMIUM_PATH in the cloud and use ?gl). Puts the nobody a few metres from the
 * nearest den of that kind, the camera on the nearest one, and saves a few screenshots.
 */
import { chromium } from 'playwright';
import { preview } from 'vite';
const [q, kind, prefix] = process.argv.slice(2);
const server = await preview({ preview: { port: 5195, strictPort: false }, logLevel: 'silent' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 650 } });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(server.resolvedUrls.local[0] + q);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 600000 });
console.log('den', await page.evaluate((kind) => {
  const g = window.__game, b = g.body, pop = g[kind];
  const d = pop.nearestDen(b.x, b.z, 8);
  b.x = d.x + 4; b.z = d.z; b.y = d.y + 0.3; b.vx = b.vz = 0;
  g.cam.yaw = Math.PI / 2; g.cam.distance = 2.2; g.cam.pitch = -0.25;
  return [d.x.toFixed(1), d.y.toFixed(1), d.z.toFixed(1)];
}, kind));
for (let i = 0; i < 3; i++) {
  await page.waitForTimeout(4000);
  console.log(i, await page.evaluate((kind) => {
    const g = window.__game, b = g.body;
    const near = g[kind].list.filter((r) => !r.dead).sort((a, c) => Math.hypot(a.x - b.x, a.z - b.z) - Math.hypot(c.x - b.x, c.z - b.z))[0];
    if (near) g.cam.yaw = Math.atan2(-(near.x - b.x), -(near.z - b.z));
    return near ? `${near.mode} ${Math.hypot(near.x - b.x, near.z - b.z).toFixed(1)} m; hp ${b.health.toFixed(0)}` : 'none';
  }, kind));
  await page.screenshot({ path: `${prefix}-${i}.png`, timeout: 300000 });
}
await browser.close(); await server.close();
