/**
 * The Level Lab: a free-fly viewer for the level generator (docs/design/level-generator.md §6).
 * No gameplay. Seed, depth and view come from the URL so a place can be shared as a link.
 */
import { Scene, PerspectiveCamera, Color, Fog, HemisphereLight, PointLight, Group, Timer } from 'three/webgpu';
import { createRenderer } from '../render/renderer';
import { Stage } from '../render/stage';
import { Terrain } from '../render/terrain/Terrain';
import { Level, COLOR_MODES } from '../gen/level';
import { FlyCamera } from './FlyCamera';
import { parseLabParams } from './params';

/** Fog distances: a lit survey view, and roughly what a headlamp shows. */
const FOG = { survey: [80, 900], dark: [10, 140] } as const;

export async function startLab(host: HTMLElement): Promise<void> {
  const params = parseLabParams(location.search);
  const canvas = document.createElement('canvas');
  host.appendChild(canvas);
  const { renderer, backend } = await createRenderer(canvas, { forceWebGL: params.forceWebGL });
  const level = new Level(params.seed, params.depth);

  // Lights are fixed before the warm-up: they are part of every shader's cache key.
  const scene = new Scene();
  scene.background = new Color(0x050607);
  const fog = new Fog(0x050607, FOG.survey[0], FOG.survey[1]);
  scene.fog = fog;
  scene.add(new HemisphereLight(0x9aa6b4, 0x2a2218, 0.7));
  const camera = new PerspectiveCamera(70, 1, 0.1, 4000);
  const headlamp = new PointLight(0xffe9cc, 160, 160, 1.4);
  camera.add(headlamp);
  scene.add(camera);
  camera.position.set(...(params.pos ?? level.spawn()));
  const fly = new FlyCamera(camera, canvas);
  if (params.look) [fly.yaw, fly.pitch] = [(params.look[0] * Math.PI) / 180, (params.look[1] * Math.PI) / 180];

  const stage = new Stage(renderer, scene, camera);
  await stage.warmUp();
  const rock = new Group();
  scene.add(rock);
  const terrain = new Terrain(stage, rock, params.seed, params.depth);
  terrain.colorMode = params.color;

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyV') {
      terrain.colorMode = COLOR_MODES[(COLOR_MODES.indexOf(terrain.colorMode) + 1) % COLOR_MODES.length];
      terrain.rebuild();
    } else if (e.code === 'KeyF') {
      const dark = fog.far === FOG.survey[1];
      [fog.near, fog.far] = dark ? FOG.dark : FOG.survey;
    }
  });

  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  const hud = document.getElementById('hud');
  const timer = new Timer();
  (globalThis as { __lab?: unknown }).__lab = { camera, stage, fly, terrain, level };
  renderer.setAnimationLoop(() => {
    timer.update();
    stage.frame();
    fly.update(Math.min(0.1, timer.getDelta()));
    const p = camera.position;
    terrain.update(p.x, p.y, p.z);
    const w = level.workingAt(p.x, p.z);
    const s = stage.monitor.summary();
    const t = terrain.stats;
    if (hud) hud.textContent = `Dunfinity Level Lab  ·  seed ${params.seed}  ·  depth ${params.depth} (the Quarry)  ·  ${backend}\n`
      + `pos ${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)}  ·  speed ${fly.speed.toFixed(0)} m/s  ·  floor here ${level.floorAt(p.x, p.z).toFixed(0)} m\n`
      + `working: pillars every ${w.spacing.toFixed(0)} m, ${w.pillar.toFixed(0)} m thick, ${w.height.toFixed(0)} m high${w.collapse ? `, ${(w.collapse * 100).toFixed(0)}% collapsed` : ''}\n`
      + `${t.chunks} chunks, ${(t.triangles / 1e6).toFixed(2)} M triangles${t.pending ? `, ${t.pending} to mesh` : ''}  ·  colour: ${terrain.colorMode}\n`
      + `shaders ${s.warmup} warm-up + ${s.run} later · worst ${s.worstMs.toFixed(0)} ms · ${s.violations ? `${s.violations} POLICY VIOLATIONS (shaders.report())` : 'policy ok'}`
      + `${stage.missingHooks.length ? `\nshader hooks missing: ${stage.missingHooks.join(', ')}` : ''}\n`
      + 'click: mouse look · WASD move · Space/C up/down · Shift fast · wheel speed · V colours · F fog';
    renderer.render(scene, camera);
    (globalThis as { __labReady?: boolean }).__labReady = terrain.settled;
  });
}
