/**
 * Tab targeting headless: `node tools/shot/target-probe.mjs "<query>" <out-prefix>` (build first; set
 * CHROMIUM_PATH in the cloud and use ?gl). Puts the nobody by a rat nest away from the arrival,
 * looks at the nearest rat, presses Tab and says what it picked, how many foes are near and how
 * many of them are seen; saves a screenshot.
 */
import { chromium } from 'playwright';
import { preview } from 'vite';
const [q, prefix] = process.argv.slice(2);
const server = await preview({ preview: { port: 5195, strictPort: false }, logLevel: 'silent' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 650 } });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(server.resolvedUrls.local[0] + q);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 1500000 });
await page.evaluate(() => {
  const g = window.__game, b = g.body;
  let best = null, bd = Infinity;
  for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) {
    const n = g.rats.nestAt(Math.floor(b.x / 36) + i, Math.floor(b.z / 36) + j);
    const d = n ? Math.hypot(n.x - b.x, n.z - b.z) : Infinity;
    if (n && d > 25 && d < bd) { bd = d; best = n; }
  }
  b.x = best.x + 4; b.z = best.z; b.y = best.y + 0.3; b.vx = b.vz = 0;
  g.cam.distance = 2.6; g.cam.pitch = -0.3;
});
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(1500);
  const st = await page.evaluate(() => {
    const g = window.__game, b = g.body;
    const near = g.rats.list.filter((r) => !r.dead).sort((a, c) => Math.hypot(a.x - b.x, a.z - b.z) - Math.hypot(c.x - b.x, c.z - b.z))[0];
    if (near) g.cam.yaw = Math.atan2(-(near.x - b.x), -(near.z - b.z));
    return { rat: near ? Math.hypot(near.x - b.x, near.z - b.z).toFixed(1) : null };
  });
  await page.waitForTimeout(100);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(100);
  const got = await page.evaluate(() => {
    const g = window.__game, b = g.body, t = g.target;
    const near = g.rats.list.filter((r) => !r.dead).sort((a, c) => Math.hypot(a.x - b.x, a.z - b.z) - Math.hypot(c.x - b.x, c.z - b.z))[0];
    const all = g.foes().filter((f) => !f.dead && Math.hypot(f.x - b.x, f.z - b.z) < 22 && Math.abs(f.y - b.y) < 8);
    return { picked: t ? `${t.constructor.name} ${Math.hypot(t.x - b.x, t.z - b.z).toFixed(1)} m` : null, isNearestRat: t === near, near22: all.length, seen: g.inView().length };
  });
  console.log(i, JSON.stringify({ ...st, ...got }));
  if (i === 2) await page.screenshot({ path: `${prefix}.png` });
}
await browser.close(); await server.close();
