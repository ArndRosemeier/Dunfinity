/**
 * Meet the rats headless: `node tools/shot/rat-probe.mjs "<query>" <out-prefix>` (build first; set
 * CHROMIUM_PATH in the cloud and use ?gl). Puts the nobody a few metres from the nearest rat nest
 * away from the arrival, lets the rats come, stabs at them and saves screenshots along the way.
 */
import { chromium } from 'playwright';
import { preview } from 'vite';
const [q, prefix] = process.argv.slice(2);
const server = await preview({ preview: { port: 5194, strictPort: false }, logLevel: 'silent' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 650 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}] ${m.text().slice(0, 300)}`); });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(server.resolvedUrls.local[0] + q);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
console.log('nest', await page.evaluate(() => {
  const g = window.__game, b = g.body;
  let best = null, bd = Infinity;
  for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) {
    const n = g.rats.nestAt(Math.floor(b.x / 36) + i, Math.floor(b.z / 36) + j);
    const d = n ? Math.hypot(n.x - b.x, n.z - b.z) : Infinity;
    if (n && d > 25 && d < bd) { bd = d; best = n; }
  }
  b.x = best.x + 3; b.z = best.z; b.y = best.y + 0.3; b.vx = b.vz = 0;
  g.cam.yaw = Math.PI / 2; g.cam.distance = 2.6; g.cam.pitch = -0.35;
  return [best.x.toFixed(1), best.z.toFixed(1), best.count];
}));
for (let i = 0; i < 24; i++) {
  await page.waitForTimeout(2500);
  const st = await page.evaluate((i) => {
    const g = window.__game, b = g.body;
    const near = g.rats.list.filter((r) => !r.dead).sort((a, c) => Math.hypot(a.x - b.x, a.z - b.z) - Math.hypot(c.x - b.x, c.z - b.z))[0];
    if (near) g.cam.yaw = Math.atan2(-(near.x - b.x), -(near.z - b.z));
    if (i >= 6 && i % 2 === 0) g.stab();
    return { hp: b.health.toFixed(0), at: [b.x.toFixed(1), b.y.toFixed(1), b.z.toFixed(1)], killed: g.rats.killed, rats: g.rats.list.filter((r) => r.mode === 'chase' || r.mode === 'bite').map((r) => `${r.mode[0]}${Math.hypot(r.x - b.x, r.z - b.z).toFixed(1)}/${(r.y - b.y).toFixed(1)}`).join(' ') };
  }, i);
  console.log(i, JSON.stringify(st));
  if (i % 2 === 1) await page.screenshot({ path: `${prefix}-${String(i).padStart(2, '0')}.png` });
}
await browser.close(); await server.close();
