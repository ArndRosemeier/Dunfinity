import { chromium } from 'playwright';
import { preview } from 'vite';
const [q, out, root] = process.argv.slice(2);
process.chdir(root);
const server = await preview({ root, preview: { port: 5196, strictPort: false }, logLevel: 'silent' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(server.resolvedUrls.local[0] + q);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 400000 });
console.log('nest', await page.evaluate(() => {
  const g = window.__game, b = g.body;
  let best = null, bd = Infinity;
  for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) {
    const n = g.rats.denAt(Math.floor(b.x / 36) + i, Math.floor(b.z / 36) + j);
    const d = n ? Math.hypot(n.x - b.x, n.z - b.z) : Infinity;
    if (n && d > 25 && d < bd) { bd = d; best = n; }
  }
  b.x = best.x + 4; b.z = best.z; b.y = best.y + 0.3; b.vx = b.vz = 0;
  g.cam.yaw = Math.PI / 2; g.cam.distance = 2.2; g.cam.pitch = -0.3;
  return [best.x.toFixed(1), best.z.toFixed(1), best.count];
}));
for (let i = 0; i < 3; i++) {
  await page.waitForTimeout(4000);
  const st = await page.evaluate(() => {
    const g = window.__game, b = g.body;
    const near = g.rats.list.filter((r) => !r.dead).sort((a, c) => Math.hypot(a.x - b.x, a.z - b.z) - Math.hypot(c.x - b.x, c.z - b.z))[0];
    if (near) g.cam.yaw = Math.atan2(-(near.x - b.x), -(near.z - b.z));
    return g.rats.list.map((r) => `${r.mode}${Math.hypot(r.x - b.x, r.z - b.z).toFixed(1)}`).join(' ');
  });
  console.log(i, st);
  await page.screenshot({ path: `${out}-${i}.png`, timeout: 300000 });
}
await browser.close(); await server.close();
