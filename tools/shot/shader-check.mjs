/**
 * The shader policy, checked in a real browser (docs/SHADERS.md): `npm run check:shaders`
 * (after `npm run build`). Headless Chromium on the WebGL 2 backend with SwiftShader, so no GPU.
 *
 *  1. Steady state: after warm-up, flying through the Lab builds no new shader.
 *  2. Cap: eight new shader variants requested at once are built one at a time, at least 200 ms
 *     apart and at most 5 per second, each under 100 ms of blocking.
 */
import { chromium } from 'playwright';
import { preview } from 'vite';

const server = await preview({ preview: { port: 5192, strictPort: false }, logLevel: 'silent' });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'],
});
const problems = [];
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  await page.goto(server.resolvedUrls.local[0] + '?seed=1&gl');
  await page.waitForFunction(() => window.__labReady === true, null, { timeout: 120000 });

  const steady = await page.evaluate(async () => {
    const { camera } = window.__lab;
    for (let t = 0; t < 40; t++) {
      camera.position.x += 3;
      camera.rotation.y += 0.16;
      await new Promise((r) => setTimeout(r, 50));
    }
    const s = window.shaders.summary();
    return { built: s.run, violations: window.shaders.violations() };
  });
  console.log(`steady state: ${steady.built} shaders built after warm-up`);
  if (steady.built) problems.push(`steady state: ${steady.built} shaders built after warm-up (a material kind is missing from the warm-up, or its meshes differ from the kind)`);
  problems.push(...steady.violations);

  const cap = await page.evaluate(async () => {
    const { stage } = window.__lab;
    const proto = stage.scene.children.find((o) => o.isMesh);
    const variants = [['side', 1], ['side', 2], ['flatShading', true], ['fog', false], ['alphaTest', 0.5], ['wireframe', true], ['transparent', true], ['dithering', true]];
    const before = window.shaders.events.length;
    await Promise.all(variants.map(([k, v]) => {
      const m = proto.clone();
      m.material = proto.material.clone(); // test only: the game makes materials in materials.ts
      m.material[k] = v;
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
} catch (e) {
  problems.push(String(e?.stack || e));
} finally {
  await browser.close();
  await server.close();
}
console.log(problems.length ? `SHADER POLICY BROKEN\n${problems.join('\n')}` : 'shader policy: ok');
process.exit(problems.length ? 1 : 0);
