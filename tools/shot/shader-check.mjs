/**
 * The shader policy, checked in a real browser (docs/SHADERS.md): `npm run check:shaders`
 * (after `npm run build`). Headless Chromium on the WebGL 2 backend with SwiftShader, so no GPU.
 *
 *  1. Steady state: after warm-up, flying through the Lab builds no new shader.
 *  2. Cap: eight new shader variants requested at once are built one at a time, at least 200 ms
 *     apart and at most 5 per second, each under 100 ms of blocking.
 *  3. The game: after its warm-up, the first seconds of play (figure, rats, finds, shadows) build
 *     no new shader.
 *  4. The title: the figures warm while it plays and while the character creator after New Game
 *     shows (a change of look there too), each build under the cap (the Stage's shadow warm-up marks
 *     its own); once "Go down" wakes, nothing more is built through the first seconds of play.
 *
 * `-- lab` runs only 1 and 2, `-- game` only 3, `-- title` only 4: the Shaders workflow runs them as parallel jobs.
 * `--no-cap` leaves out 2, the slowest part, when the Stage and the shader hooks are untouched.
 */
import { chromium } from 'playwright';
import { preview } from 'vite';

const server = await preview({ preview: { port: 5192, strictPort: false }, logLevel: 'silent' });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'],
});
const args = process.argv.slice(2);
const noCap = args.includes('--no-cap');
const part = args.find((a) => a !== '--no-cap') ?? 'all';
if (!['all', 'lab', 'game', 'title'].includes(part)) { console.error(`unknown part "${part}" (all, lab, game or title)`); process.exit(2); }
const problems = [];
try {
  if (part === 'all' || part === 'lab') {
    const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
    page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
    await page.goto(server.resolvedUrls.local[0] + '?lab&seed=1&gl');
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });

    const steady = await page.evaluate(async () => {
      const lab = window.__lab; const { camera } = lab;
      for (let t = 0; t < 40; t++) {
        camera.position.x += 3;
        lab.fly.yaw += 0.16;
        await new Promise((r) => setTimeout(r, 50));
      }
      const s = window.shaders.summary();
      return { built: s.run, violations: window.shaders.violations() };
    });
    console.log(`steady state: ${steady.built} shaders built after warm-up`);
    if (steady.built) problems.push(`steady state: ${steady.built} shaders built after warm-up (a material kind is missing from the warm-up, or its meshes differ from the kind)`);
    problems.push(...steady.violations);

    if (!noCap) {
      const cap = await page.evaluate(async () => {
        const { stage } = window.__lab;
        let proto = null;
        stage.scene.traverse((o) => { if (!proto && o.isMesh && o.parent !== stage.camera) proto = o; });
        const variants = [['side', 1], ['side', 2], ['flatShading', true], ['fog', false], ['alphaTest', 0.5], ['wireframe', true], ['transparent', true], ['dithering', true]];
        const before = window.shaders.events.length;
        await Promise.all(variants.map(([k, v]) => {
          const m = proto.clone();
          m.material = proto.material.clone(); // test only: the game makes materials in materials.ts
          m.material[k] = v;
          m.castShadow = false; // the variants test the cap on the material's own builds, not the shadow pass's
          return stage.add(m);
        }));
        const starts = window.shaders.events.slice(before).filter((e) => e.kind === 'node-async' || e.kind === 'node-sync');
        return { starts: starts.map((e) => ({ t: e.t, ms: e.ms, kind: e.kind })), violations: window.shaders.violations() };
      });
      const gaps = cap.starts.slice(1).map((e, i) => e.t - cap.starts[i].t);
      console.log(`cap: ${cap.starts.length} builds, gaps ${gaps.map((g) => g.toFixed(0)).join(' ')} ms, worst ${Math.max(...cap.starts.map((e) => e.ms)).toFixed(0)} ms`);
      if (cap.starts.length !== 8) problems.push(`cap: expected 8 builds, saw ${cap.starts.length}`);
      if (cap.starts.some((e) => e.kind !== 'node-async')) problems.push('cap: a build ran synchronously on the render path');
      problems.push(...cap.violations);
    }

    await page.close();
  }
  if (part === 'all' || part === 'game') {
    const game = await browser.newPage({ viewport: { width: 960, height: 600 } });
    game.on('pageerror', (e) => problems.push(`game page error: ${e.message}`));
    await game.goto(server.resolvedUrls.local[0] + '?seed=1&gl', { timeout: 120000 });
    // The village's Actors people warm every part's shadow (each figure's are its own): slow under SwiftShader.
    await game.waitForFunction(() => window.__ready === true, null, { timeout: 600000 });
    const played = await game.evaluate(async () => {
      const g = window.__game;
      for (let t = 0; t < 20; t++) { g.cam.yaw += 0.3; await new Promise((r) => setTimeout(r, 150)); }
      return { built: window.shaders.summary().run, violations: window.shaders.violations() };
    });
    console.log(`game: ${played.built} shaders built after warm-up`);
    if (played.built) problems.push(`game: ${played.built} shaders built after warm-up (something drawn differs from what was warmed: a light moved to another parent, shadow flags set per mesh, ...)`);
    problems.push(...played.violations.map((v) => `game: ${v}`));
    await game.close();
  }
  if (part === 'all' || part === 'title') {
    const title = await browser.newPage({ viewport: { width: 960, height: 600 } });
    if (process.env.THROTTLE) await (await title.context().newCDPSession(title)).send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE) });
    title.on('pageerror', (e) => problems.push(`title page error: ${e.message}`));
    await title.goto(server.resolvedUrls.local[0] + '?title&seed=1&gl&fresh', { timeout: 120000 });
    const woke = Date.now();
    // New Game wakes at once, asks the mode, then opens the character creator; the figures warm behind both, and
    // "Go down" wakes once they are warm. A change of look meanwhile builds nothing on the render path.
    await title.waitForSelector('#title .menu > button:not([disabled])', { state: 'attached', timeout: 900000 });
    await title.evaluate(() => document.querySelector('#title .menu > button').click());
    // New Game first asks how the family will play (src/app/titleScreen.ts): take the first mode.
    await title.waitForSelector('#title .ask .mode button', { state: 'attached', timeout: 60000 });
    await title.evaluate(() => document.querySelector('#title .ask .mode button').click());
    await title.waitForSelector('#creator .side', { state: 'attached', timeout: 600000 });
    await title.evaluate(() => {
      const hair = () => [...document.querySelectorAll('#creator .tabs button')].find((b) => b.dataset.tab === 'hair');
      hair()?.click();
      const styles = [...document.querySelectorAll('#creator .chips button')];
      styles.find((b) => !b.classList.contains('on'))?.click();
      // And other clothes: a dress and a cap (new garments, a rigid part on the head).
      [...document.querySelectorAll('#creator .tabs button')].find((b) => b.dataset.tab === 'clothes')?.click();
      for (const t of ['Dress', 'Cap']) [...document.querySelectorAll('#creator .chips button')].find((b) => b.textContent === t)?.click();
    });
    // Each Actors figure's body and hair warm their shadow shader one by one, each with a frame of the whole
    // scene: under SwiftShader that is minutes (on a GPU, milliseconds).
    await title.waitForSelector('#creator .go:not([disabled])', { state: 'attached', timeout: 1800000 });
    await new Promise((r) => setTimeout(r, 3000)); // the new look's rebuild
    const warm = await title.evaluate(() => {
      // The Stage's shadow warm-up builds on the render path on purpose, in cap slots, and marks them.
      const sync = window.shaders.events.filter((e) => e.kind === 'node-sync' && e.phase === 'run' && !e.what.endsWith('(shadow warm-up)'));
      return { at: window.shaders.events.length, sync: sync.length, what: sync.map((e) => `${e.what} at ${e.t.toFixed(0)} ms`) };
    });
    console.log(`title: ready to go down after ${((Date.now() - woke) / 1000).toFixed(0)} s, ${warm.sync} synchronous builds while warming`);
    if (warm.sync) problems.push(`title: ${warm.sync} shaders built synchronously on the render path while the title and the creator warmed: ${warm.what.join(', ')}`);
    await title.evaluate(() => document.querySelector('#creator .go').click());
    await title.waitForFunction(() => !document.querySelector('#title') && !document.querySelector('#creator') && window.__ready === true, null, { timeout: 600000 });
    const after = await title.evaluate(async (at) => {
      const g = window.__game;
      for (let t = 0; t < 20; t++) { g.cam.yaw += 0.3; await new Promise((r) => setTimeout(r, 150)); }
      return { built: window.shaders.events.slice(at).filter((e) => e.kind === 'node-async' || e.kind === 'node-sync').length, violations: window.shaders.violations() };
    }, warm.at);
    console.log(`title: ${after.built} shaders built after going down`);
    if (after.built) problems.push(`title: ${after.built} shaders built after going down (something play draws was not warmed under the title and the creator)`);
    problems.push(...after.violations.map((v) => `title: ${v}`));
  }
} catch (e) {
  problems.push(String(e?.stack || e));
} finally {
  await browser.close();
  await server.close();
}
console.log(problems.length ? `SHADER POLICY BROKEN\n${problems.join('\n')}` : 'shader policy: ok');
process.exit(problems.length ? 1 : 0);
