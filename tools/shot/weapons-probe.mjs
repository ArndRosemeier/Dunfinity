/**
 * Look at the nobody swinging each weapon headless: `node tools/shot/weapons-probe.mjs "<query>" <out-prefix>`
 * (build first; set CHROMIUM_PATH in the cloud and use ?gl). For each weapon it puts it in the hand and
 * holds the nobody's pose at two moments of its swing (the wind-up and the blow; the swing is held
 * by giving the figure that action every frame, not by clicking), seen from the side.
 */
import { chromium } from 'playwright';
import { preview } from 'vite';
const [q, prefix] = process.argv.slice(2);
const server = await preview({ preview: { port: 5198, strictPort: false }, logLevel: 'silent' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 640 } });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(server.resolvedUrls.local[0] + q);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 900000 });
// Each weapon: the action and length of its swing (src/combat/combat.ts MOVES), and the shares of it to hold.
const SWINGS = { 'kitchen-knife': ['swing_1h', 0.42, [0.25, 0.45]], hatchet: ['swing_1h', 0.72, [0.32, 0.55]], pick: ['mine', 1.05, [0.42, 0.62]], crowbar: ['swing_1h', 0.6, [0.28, 0.52]] };
await page.evaluate(() => {
  const n = window.__game.nobody, pose = n.pose.bind(n);
  n.pose = (b, dt, time, action, combat, move) => {
    const a = window.__act;
    return a ? pose(b, dt, time, { id: a.id, t0: time - a.at, dur: a.dur }, true, move) : pose(b, dt, time, action, combat, move);
  };
});
for (const [kind, [id, dur, ats]] of Object.entries(SWINGS)) {
  await page.evaluate((kind) => {
    const g = window.__game;
    if (kind === 'kitchen-knife') g.kit.off('main'); else g.kit.put({ kind, quality: 'sound' });
    g.cam.distance = 3; g.cam.pitch = -0.2; g.cam.yaw = g.body.facing + Math.PI / 2;
  }, kind);
  for (const [n, at] of ats.entries()) {
    await page.evaluate(([id, dur, at]) => { window.__act = { id, dur, at: at * dur }; }, [id, dur, at]);
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${prefix}-${kind}-${n}.png`, timeout: 600000 });
    console.log(kind, n, await page.evaluate(() => window.__game.nobody.human.animator.lastAction?.id));
  }
}
await browser.close(); await server.close();
