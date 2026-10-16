/**
 * Grandma's flour and matches headless: `node tools/shot/flour-probe.mjs "<query>" <out-prefix>`
 * (build first; set CHROMIUM_PATH in the cloud and use ?gl). Gives every ability, puts the nobody by
 * the nearest rat nest away from the arrival, throws a bag of flour at the rats once they come,
 * steps back out of the cloud, flicks a match into it, and saves screenshots along the way.
 */
import { chromium } from 'playwright';
import { preview } from 'vite';
const [q, prefix] = process.argv.slice(2);
const server = await preview({ preview: { port: 5195, strictPort: false }, logLevel: 'silent' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 650 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}] ${m.text().slice(0, 300)}`); });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(server.resolvedUrls.local[0] + q);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
await page.keyboard.press('Backquote');
await page.click('#debug button:has-text("Give me all abilities")');
await page.click('#debug label:has-text("Invulnerable") input');
await page.keyboard.press('Backquote');
console.log('nest', await page.evaluate(() => {
  const g = window.__game, b = g.body;
  let best = null, bd = Infinity;
  for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) {
    const n = g.rats.nestAt(Math.floor(b.x / 36) + i, Math.floor(b.z / 36) + j);
    const d = n ? Math.hypot(n.x - b.x, n.z - b.z) : Infinity;
    if (n && d > 25 && d < bd) { bd = d; best = n; }
  }
  b.x = best.x + 6; b.z = best.z; b.y = best.y + 0.3; b.vx = b.vz = 0;
  g.cam.yaw = Math.PI / 2; g.cam.distance = 3.2; g.cam.pitch = -0.3;
  return [best.x.toFixed(1), best.z.toFixed(1), best.count];
}));
const state = () => page.evaluate(() => {
  const g = window.__game, b = g.body;
  const rats = g.rats.list.filter((r) => !r.dead);
  const near = rats.sort((a, c) => Math.hypot(a.x - b.x, a.z - b.z) - Math.hypot(c.x - b.x, c.z - b.z))[0];
  if (near) g.cam.yaw = Math.atan2(-(near.x - b.x), -(near.z - b.z));
  return { hp: b.health.toFixed(0), clouds: g.flour.clouds.length, rats: rats.map((r) => `${r.mode}${(r.blind ?? 0) > 0 ? '*' : ''}${Math.hypot(r.x - b.x, r.z - b.z).toFixed(1)}/${r.health.toFixed(0)}`).join(' ') };
});
const steps = [
  ['wait', 4000], ['wait', 4000], ['bag', 900], ['shot', 0], ['wait', 1500], ['shot', 0], ['back', 1500], ['match', 450], ['shot', 0], ['wait', 250], ['shot', 0], ['wait', 1500], ['shot', 0],
];
let n = 0;
for (const [what, ms] of steps) {
  if (what === 'bag') await page.evaluate(() => window.__game.pressKey('KeyY'));
  if (what === 'match') await page.evaluate(() => window.__game.pressKey('Mouse1'));
  if (what === 'back') await page.evaluate(() => { const g = window.__game, b = g.body, c = g.flour.clouds[0]; if (!c) return; const dx = b.x - c.x, dz = b.z - c.z, d = Math.hypot(dx, dz) || 1; b.x = c.x + (dx / d) * (c.r + 4); b.z = c.z + (dz / d) * (c.r + 4); });
  if (ms) await page.waitForTimeout(ms);
  console.log(what, JSON.stringify(await state()));
  if (what === 'shot') await page.screenshot({ path: `${prefix}-${String(n++).padStart(2, '0')}.png`, timeout: 180000 });
}
await browser.close(); await server.close();
