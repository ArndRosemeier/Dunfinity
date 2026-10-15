/**
 * Swimming, headless: find deep water near where one arrives, put the nobody in it, and report how
 * high the head rides over the water line, treading and swimming, with screenshots.
 * `node tools/shot/swim-probe.mjs <outdir> [query]` (run `npm run build` first).
 */
import { chromium } from 'playwright';
import { preview } from 'vite';

const out = process.argv[2] ?? '.';
const query = process.argv[3] ?? '?seed=1&gl&depth=1&light&pos=-779,-2.4,1363';
const server = await preview({ preview: { port: 5193, strictPort: false }, logLevel: 'silent' });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.error(`[page error] ${e.message}`));
await page.goto(server.resolvedUrls.local[0] + query + '&fresh');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
// The animator alone, at the origin, many frames: how high the head is over the feet in each pose.
console.log(await page.evaluate(() => {
  const h = window.__game.nobody.human, head = h.socket('head'), V = head.position.constructor;
  const pose = (move, v) => {
    for (let i = 0; i < 240; i++) { h.update({ pos: [0, 0, 0], vel: [v, 0, 0], yaw: 0, anim: { move } }, 1 / 60, i / 60, null); }
    h.object.updateMatrixWorld(true);
    const ys = []; h.object.traverse((o) => { if (o.isBone) ys.push(o.getWorldPosition(new V()).y); });
    return `${move} at ${v} m/s: head ${head.getWorldPosition(new V()).y.toFixed(2)}, bones ${Math.min(...ys).toFixed(2)}..${Math.max(...ys).toFixed(2)}`;
  };
  return [`height ${h.height.toFixed(3)}`, pose('idle', 0), pose('swim', 0), pose('swim', 1), pose('swim', 2.4)].join('\n');
}));
await page.waitForTimeout(3000);
console.log('standing:', await page.evaluate(() => { const g = window.__game, h = g.nobody.human.socket('head'); return (h.getWorldPosition(new h.position.constructor()).y - g.body.y).toFixed(2) + ' head over feet'; }));
const spot = await page.evaluate(() => {
  const g = window.__game, l = g.nobody.level, b = g.body;
  let best = null;
  for (let r = 0; r < 120 && !best; r += 2) {
    for (let a = 0; a < 64; a++) {
      const x = b.x + Math.cos((a / 64) * 6.283) * r, z = b.z + Math.sin((a / 64) * 6.283) * r;
      const w = l.waterAt(x, z);
      if (w - l.floorAt(x, z) > 1.8 && l.sdf(x, w - 1, z) > 0.4 && l.sdf(x, w + 0.6, z) > 0.4) { best = [x, w, z]; break; }
    }
  }
  if (best) { let open = 0, yaw = 0;
    for (let a = 0; a < 32; a++) { const t = (a / 32) * 6.283; let r = 0; while (r < 20 && l.waterAt(best[0] - Math.sin(t) * r, best[2] - Math.cos(t) * r) - l.floorAt(best[0] - Math.sin(t) * r, best[2] - Math.cos(t) * r) > 1.6) r += 0.5; if (r > open) { open = r; yaw = t; } }
    g.cam.yaw = yaw; g.cam.pitch = -0.3; b.x = best[0]; b.y = best[1] - 1.4; b.z = best[2]; b.vx = b.vy = b.vz = 0; }
  return best;
});
console.log('deep water at', spot);
if (!spot) process.exit(1);
const measure = (label) => page.evaluate((label) => {
  const g = window.__game, b = g.body, head = g.nobody.human.socket('head');
  const v = head.getWorldPosition(new head.position.constructor());
  const w = g.nobody.level.waterAt(b.x, b.z);
  return `${label}: mode ${b.mode}, speed ${Math.hypot(b.vx, b.vz).toFixed(2)}, feet ${(b.y - w).toFixed(2)}, head ${(v.y - w).toFixed(2)} (metres over the water line), head over feet ${(v.y - b.y).toFixed(2)}`;
}, label);
await page.waitForTimeout(4000);
console.log(await measure('treading'));
await page.screenshot({ path: `${out}/swim-tread.png`, timeout: 180000 });
await page.keyboard.down('KeyW');
await page.waitForTimeout(2500);
console.log(await measure('swimming'));
await page.screenshot({ path: `${out}/swim-crawl.png`, timeout: 180000 });
await page.keyboard.up('KeyW');
await browser.close();
await server.close();
