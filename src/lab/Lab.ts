/**
 * The Level Lab: a free-fly viewer for the level generator (docs/design/level-generator.md §6).
 * No gameplay. Seed, depth and view come from the URL so a place can be shared as a link.
 */
import { Timer } from 'three/webgpu';
import { LevelView } from '../render/LevelView';
import { Level, COLOR_MODES } from '../gen/level';
import { loadModels } from '../gen/models';
import { Controls } from '../input/controls';
import { FlyCamera } from './FlyCamera';
import { parseViewParams } from '../app/params';
import { strangeLabel } from '../gen/genome';
import { lawsOf } from '../gen/laws';
import type { LoadingScreen } from '../app/loadingScreen';
import { Lineup } from '../render/humans/lineup';
import { Hands } from './hands';
import { CritterLineup } from '../render/creatures/critterLineup';
import type { CritterRole } from '../creatures/bestiary';
import { meshOf } from '../render/meshes';
import { VERTEX_COLOR_SOLID } from '../render/materials';
import { RACE_IDS, type RaceId } from '@futuremagic/humanoid';

export async function startLab(host: HTMLElement, loading: LoadingScreen): Promise<void> {
  const params = parseViewParams(location.search);
  loading.step('Laying out the level', 0.05);
  await loadModels();
  const level = new Level(params.seed, params.depth, params.style);
  const { view, canvas, backend } = await LevelView.open(host, level, { forceWebGL: params.forceWebGL });
  const { camera, stage } = view;
  view.dark = params.dark;
  camera.position.set(...(params.pos ?? level.spawn()));
  const fly = new FlyCamera(camera, new Controls(canvas));
  if (params.look) [fly.yaw, fly.pitch] = [(params.look[0] * Math.PI) / 180, (params.look[1] * Math.PI) / 180];

  // Every race side by side (?races), or one close up (?races=<race>), as skeletons with `bones` (?races=bones, ?races=<race>-bones): built before the warm-up, which compiles the humans.
  const bones = !!params.races?.endsWith('bones'), race = params.races?.replace(/-?bones$/, '');
  const one = race && (RACE_IDS as readonly string[]).includes(race) ? (race as RaceId) : undefined;
  const lineup = params.races !== null ? await Lineup.create(params.seed, one, bones) : null;
  if (lineup) {
    lineup.pool.level = level;
    lineup.stand(camera.position.x, camera.position.z, fly.yaw, one ? 1.6 : 4, (x, z) => level.groundAt(x, z));
    // One race: close up, at eye height.
    if (one) { camera.position.y = lineup.places[0].y + lineup.tallest * 0.9; fly.pitch = 0; }
  }
  // The nobody close up with a weapon ready (?hands=<weapon>), on the studio floor with &studio.
  const hands = params.hands ? await Hands.holding(params.seed, params.hands) : null;
  // Procedural creatures in a row (?critters; ?critters=<depth> that level's bestiary; ?critters=<role> three of a role).
  // In the studio (&studio) they stand on a plain floor at the spawn's height, the rock hidden.
  const studio = (params.critters !== null || !!hands) && params.studio;
  const floorY = level.groundAt(camera.position.x, camera.position.z);
  const ground = studio ? () => floorY : (x: number, z: number) => level.groundAt(x, z);
  const critters = params.critters !== null ? new CritterLineup(params.seed, critterPick(params.critters), ground, params.critters && !/^\d+$/.test(params.critters) ? 3 : 2) : null;
  const floor = studio ? meshOf((b) => b.box(camera.position.x, floorY - 0.05, camera.position.z, [60, 0, 0], [0, 0.05, 0], [0, 0, 60], [0.32, 0.3, 0.28]), VERTEX_COLOR_SOLID) : null;
  if (critters) {
    critters.pose = params.pose;
    critters.lineUp(camera.position.x, camera.position.z, fly.yaw, Math.max(0.5, critters.tallest * 1.3));
    // Look them over from a little above, unless the link names a place.
    if (!params.pos) { camera.position.y = floorY + Math.max(0.3, critters.tallest * 0.9); fly.pitch = -0.2; }
  }
  if (hands) {
    hands.level = level;
    hands.standBefore(camera.position.x, floorY, camera.position.z, fly.yaw, 1.2);
    if (!params.pos) { camera.position.y = floorY + 1.2; fly.pitch = -0.2; }
  }
  loading.step('Warming up the shaders', 0.15);
  await view.start([...(lineup ? lineup.pool.figures : []), ...(hands ? [hands.root] : []), ...(critters ? critters.roots : [])]);
  if (lineup) await stage.add(lineup.pool.root);
  if (hands) await stage.add(hands.root);
  if (critters) for (const r of critters.roots) await stage.add(r);
  if (floor) { view.worldShown = false; await stage.add(floor); }
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
  (globalThis as { __lab?: unknown }).__lab = { view, camera, stage, fly, terrain, props, level, hands };
  view.renderer.setAnimationLoop(() => {
    timer.update();
    const dt = Math.min(0.1, timer.getDelta());
    fly.update(dt);
    lineup?.pool.draw(lineup.places, camera.position.x, camera.position.z, dt, timer.getElapsed());
    hands?.poseAndFrame(camera, dt, timer.getElapsed());
    critters?.parade(dt, timer.getElapsed(), [camera.position.x, camera.position.y, camera.position.z]);
    const p = camera.position;
    const w = level.workingAt(p.x, p.z);
    const t = terrain.stats;
    if (hud) hud.textContent = `Dunfinity Level Lab  ·  seed ${params.seed}  ·  depth ${params.depth} (${level.band.name}, ${strangeLabel(params.seed, params.depth)}${lawsOf(params.seed, params.depth).map((l) => ` · ${l}`).join('')})  ·  ${backend}\n`
      + `pos ${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)}  ·  speed ${fly.speed.toFixed(0)} m/s  ·  floor here ${level.floorAt(p.x, p.z).toFixed(0)} m\n`
      + `working: pillars every ${w.spacing.toFixed(0)} m, ${w.pillar.toFixed(0)} m thick, ${w.height.toFixed(0)} m high${w.collapse ? `, ${(w.collapse * 100).toFixed(0)}% collapsed` : ''}\n`
      + `${t.chunks} chunks, ${(t.triangles / 1e6).toFixed(2)} M triangles${t.pending ? `, ${t.pending} to mesh` : ''}  ·  colour: ${terrain.colorMode}\n`
      + `props: ${props.stats.tiles} tiles, ${(props.stats.triangles / 1e3).toFixed(0)} k triangles, ${props.stats.lamps} burning lamps${props.stats.pending ? `, ${props.stats.pending} to build` : ''}\n`
      + `${stage.hudLine()}\n`
      + 'click: mouse look · WASD move · Space/C up/down · Shift fast · wheel speed · V colours · F dark';
    view.frame(p.x, p.y, p.z, timer.getElapsed(), !loading.open);
    if (loading.open) { if (view.settled || timer.getElapsed() > 30) loading.hide(); else loading.step('Carving the rock', 0.4 + 0.6 * view.streamed); }
    (globalThis as { __ready?: boolean }).__ready = view.settled && loading.gone;
  });
}



/** What `?critters=` names: a depth, a role, or '' the sampler. */
function critterPick(v: string | null): number | CritterRole | null {
  if (!v) return null;
  if (/^\d+$/.test(v)) return Number(v);
  return (CritterLineup.ROLES as readonly string[]).includes(v) ? (v as CritterRole) : null;
}
