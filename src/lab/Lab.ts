/**
 * The Level Lab: a free-fly viewer for the level generator (docs/design/level-generator.md §6).
 * No gameplay. Seed, depth and view come from the URL so a place can be shared as a link.
 */
import { Timer } from 'three/webgpu';
import { LevelView } from '../render/LevelView';
import { Level, COLOR_MODES } from '../gen/level';
import { Controls } from '../input/controls';
import { FlyCamera } from './FlyCamera';
import { parseViewParams } from '../app/params';

export async function startLab(host: HTMLElement): Promise<void> {
  const params = parseViewParams(location.search);
  const level = new Level(params.seed, params.depth, params.style);
  const { view, canvas, backend } = await LevelView.open(host, level, { forceWebGL: params.forceWebGL });
  const { camera, stage } = view;
  view.dark = params.dark;
  camera.position.set(...(params.pos ?? level.spawn()));
  const fly = new FlyCamera(camera, new Controls(canvas));
  if (params.look) [fly.yaw, fly.pitch] = [(params.look[0] * Math.PI) / 180, (params.look[1] * Math.PI) / 180];

  await view.start();
  const { terrain, props } = view;
  terrain.colorMode = params.color;

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyV') {
      terrain.colorMode = COLOR_MODES[(COLOR_MODES.indexOf(terrain.colorMode) + 1) % COLOR_MODES.length];
      terrain.rebuild();
    } else if (e.code === 'KeyF') {
      view.dark = !view.dark;
    }
  });

  const hud = document.getElementById('hud');
  const timer = new Timer();
  (globalThis as { __lab?: unknown }).__lab = { camera, stage, fly, terrain, props, level };
  view.renderer.setAnimationLoop(() => {
    timer.update();
    fly.update(Math.min(0.1, timer.getDelta()));
    const p = camera.position;
    const w = level.workingAt(p.x, p.z);
    const t = terrain.stats;
    if (hud) hud.textContent = `Dunfinity Level Lab  ·  seed ${params.seed}  ·  depth ${params.depth} (the Quarry)  ·  ${backend}\n`
      + `pos ${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)}  ·  speed ${fly.speed.toFixed(0)} m/s  ·  floor here ${level.floorAt(p.x, p.z).toFixed(0)} m\n`
      + `working: pillars every ${w.spacing.toFixed(0)} m, ${w.pillar.toFixed(0)} m thick, ${w.height.toFixed(0)} m high${w.collapse ? `, ${(w.collapse * 100).toFixed(0)}% collapsed` : ''}\n`
      + `${t.chunks} chunks, ${(t.triangles / 1e6).toFixed(2)} M triangles${t.pending ? `, ${t.pending} to mesh` : ''}  ·  colour: ${terrain.colorMode}\n`
      + `props: ${props.stats.tiles} tiles, ${(props.stats.triangles / 1e3).toFixed(0)} k triangles, ${props.stats.lamps} burning lamps${props.stats.pending ? `, ${props.stats.pending} to build` : ''}\n`
      + `${stage.hudLine()}\n`
      + 'click: mouse look · WASD move · Space/C up/down · Shift fast · wheel speed · V colours · F dark';
    view.frame(p.x, p.y, p.z, timer.getElapsed());
    (globalThis as { __ready?: boolean }).__ready = view.settled;
  });
}


