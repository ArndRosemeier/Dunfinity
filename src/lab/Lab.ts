/**
 * The Level Lab: a free-fly viewer for the level generator (docs/design/level-generator.md §6).
 * No gameplay. Seed and depth come from the URL so a level can be shared as a link.
 */
import { Scene, PerspectiveCamera, Color, Fog, HemisphereLight, Timer, BoxGeometry, Float32BufferAttribute, Mesh } from 'three/webgpu';
import { createRenderer } from '../render/renderer';
import { Stage } from '../render/stage';
import { VERTEX_COLOR_SOLID } from '../render/materials';
import { FlyCamera } from './FlyCamera';
import { parseLabParams } from './params';

export async function startLab(host: HTMLElement): Promise<void> {
  const params = parseLabParams(location.search);
  const canvas = document.createElement('canvas');
  host.appendChild(canvas);
  const { renderer, backend } = await createRenderer(canvas, { forceWebGL: params.forceWebGL });

  const scene = new Scene();
  scene.background = new Color(0x050607);
  scene.fog = new Fog(0x050607, 60, 900);
  scene.add(new HemisphereLight(0x9fb4c8, 0x1a1410, 1.2));

  const camera = new PerspectiveCamera(70, 1, 0.1, 4000);
  camera.position.set(...(params.pos ?? [0, 20, 60]));
  const fly = new FlyCamera(camera, canvas);

  const stage = new Stage(renderer, scene, camera);
  await stage.warmUp();
  for (let i = 0; i < 5; i++) void stage.add(marker(i * 30 - 60, 0, 0));

  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  const hud = document.getElementById('hud');
  const timer = new Timer();
  (globalThis as { __lab?: unknown }).__lab = { camera, stage, fly };
  renderer.setAnimationLoop(() => {
    timer.update();
    stage.frame();
    fly.update(Math.min(0.1, timer.getDelta()));
    const p = camera.position;
    const s = stage.monitor.summary();
    if (hud) hud.textContent = `Dunfinity Level Lab  ·  seed ${params.seed}  ·  depth ${params.depth}  ·  ${backend}\n`
      + `pos ${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)}  ·  speed ${fly.speed.toFixed(0)} m/s\n`
      + `shaders ${s.warmup} warm-up + ${s.run} later · worst ${s.worstMs.toFixed(0)} ms · ${s.violations ? `${s.violations} POLICY VIOLATIONS (shaders.report())` : 'policy ok'}`
      + `${stage.missingHooks.length ? `\nshader hooks missing: ${stage.missingHooks.join(', ')}` : ''}\n`
      + 'click: mouse look · WASD move · Space/C up/down · Shift fast · wheel speed';
    renderer.render(scene, camera);
    (globalThis as { __labReady?: boolean }).__labReady = true;
  });
}

/** A 10 m coloured block for scale (until the generator lands). */
function marker(x: number, y: number, z: number): Mesh {
  const g = new BoxGeometry(10, 10, 10);
  g.deleteAttribute('uv'); // the kind's attributes only, so it shares the warmed shader
  const n = g.getAttribute('position').count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set([0.55, 0.5, 0.45], i * 3);
  g.setAttribute('color', new Float32BufferAttribute(c, 3));
  const m = new Mesh(g, VERTEX_COLOR_SOLID.make());
  m.position.set(x, y + 5, z);
  return m;
}
