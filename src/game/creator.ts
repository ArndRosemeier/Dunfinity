/**
 * The character creator (Scale's, brought over): after New Game, before the introduction, the
 * first grandchild stands in grandma's round room, lit by the lamp of whoever looks at them, and is
 * made: body, look and today's clothes in Actors' editor (src/app/creatorView.ts), on a model character of its
 * own. Each change is shown on the nobody (`Nobody.restyle`: its spare figure, compiled before it is swapped in).
 *
 * It is drawn by the game's own renderer in the game's own scene, so nothing of it is warmed apart:
 * the nobody's shaders were built before the title, and the rest of the game's go on building
 * behind it under the cap (src/render/stage.ts warmLater). "Go down" waits for those.
 */
import { Vector3 } from 'three/webgpu';
import { Rng, deriveSeed } from '@futuremagic/core';
import { nodeMaterials } from '@actors/three/webgpu';
import type { CharacterConfig } from '@actors/generator';
import { CreatorView, type Framing } from '../app/creatorView';
import { Character, HUMAN_PACK, packFetch } from '../render/actors/pack';
import { today } from '../render/actors/today';
import { personOfToday } from '../render/actors/looks';
import type { LevelView } from '../render/LevelView';
import type { Nobody } from '../render/humans/nobody';
import { CELLAR } from '../gen/cellar';

/**
 * Where they stand (in grandma's round room, by the curve of its wall, her armchair to one side)
 * and which way the one looking at them stands (across the room; not the brick cellar, where the
 * figures not yet drawn wait at the origin); the camera's field of view; the lamp's power; how far from
 * the figure the camera comes for the whole body and for the face; how fast it gets there; the
 * longest wait between rebuilds while a slider is dragged (s); the fades (s).
 */
export const CREATOR = {
  at: { x: CELLAR.room.x + 0.7, z: CELLAR.room.z - 1 },
  from: { x: CELLAR.room.x + 0.7, z: CELLAR.room.z + 3 },
  fov: 50, lamp: 6, near: 0.9, ease: 6, rebuild: 0.25, fadeIn: 0.8, fadeOut: 0.6,
  /** Where the lamp is held, from the camera (m: right, up): above and to one side, for some shape in the light. */
  hold: [-0.7, 0.6],
  /** How far from facing the camera they first stand turned (rad). */
  turned: 0.35,
} as const;

/** What the creator needs from the game. */
export interface CreatorCast {
  readonly seed: number;
  readonly view: LevelView;
  readonly nobody: Nobody;
  /** Resolves once everything play needs is compiled; "Go down" waits for it. */
  readonly ready: Promise<void>;
  /** The floor's height at (x, z). */
  floor(x: number, z: number): number;
}

/** Make the first grandchild; resolves with their look, the screen black, the overlay gone. */
export async function playCreator(host: HTMLElement, cast: CreatorCast): Promise<CharacterConfig> {
  const { view, nobody } = cast;
  const clock = (): number => performance.now() / 1000;
  let yaw = Math.atan2(CREATOR.at.x - CREATOR.from.x, CREATOR.at.z - CREATOR.from.z) - CREATOR.turned, focus: Framing = 'body', want: CharacterConfig | null = null, building = false, builtAt = 0, strangers = 0;
  // The editor's own character: never drawn, so nothing of it compiles; only people of today.
  const model = await Character.load({ pack: HUMAN_PACK, renderer: null, materials: nodeMaterials, clipLibraries: false, fetcher: packFetch, catalog: today, config: nobody.look });
  const ui = new CreatorView(host, model, {
    changed: (look) => { want = look; },
    turn: (by) => { yaw += by; },
    frame: (f) => { focus = f; },
    someoneElse: () => {
      const rng = new Rng(deriveSeed(cast.seed, 'creator', ++strangers));
      return personOfToday(rng.int(0, 1 << 30), { age: rng.range(0, 0.35), female: rng.chance(0.5) });
    },
  });
  cast.ready.then(() => ui.ready());
  // The lamp held by the one looking (not on a forehead), the camera's own field of view: uniforms, nothing compiles.
  const carrier = view.carrier, fov = view.camera.fov, power = view.headlamp.intensity;
  const lamp = new Vector3();
  view.carrier = lamp;
  view.camera.fov = CREATOR.fov;
  view.camera.updateProjectionMatrix();
  view.headlamp.intensity = CREATOR.lamp;
  const feet = new Vector3(CREATOR.at.x, cast.floor(CREATOR.at.x, CREATOR.at.z), CREATOR.at.z);
  const eye = new Vector3(), at = new Vector3(), wantEye = new Vector3(), wantAt = new Vector3(), head = new Vector3();
  const aim = (): void => {
    const tan = Math.tan((CREATOR.fov * Math.PI) / 360), aspect = view.camera.aspect, upright = aspect < 1;
    nobody.head.getWorldPosition(head);
    const tall = head.y - feet.y + 0.2;
    // Far enough for the whole body (or the face) to fit, upright screens in the half above the panel.
    const span = focus === 'face' ? 0.42 : tall * 1.18;
    const d = focus === 'face' ? CREATOR.near : Math.max(span / 2 / tan / (upright ? 0.5 : 1), span / 2 / (tan * Math.max(0.3, aspect)));
    const toward = Math.atan2(CREATOR.from.z - CREATOR.at.z, CREATOR.from.x - CREATOR.at.x);
    const cy = focus === 'face' ? head.y - 0.04 : feet.y + tall * 0.5;
    wantEye.set(feet.x + Math.cos(toward) * d, cy + d * 0.05, feet.z + Math.sin(toward) * d);
    // The figure off to the side of the panel: looking past it, to the right (or below it on an upright screen).
    const side = upright ? 0 : 0.36 * d * tan * aspect, down = upright ? 0.5 * d * tan : 0;
    wantAt.set(feet.x + Math.sin(toward) * side, cy - down, feet.z - Math.cos(toward) * side);
  };
  aim();
  eye.copy(wantEye); at.copy(wantAt);
  const start = clock();
  let last = start, chosen: CharacterConfig | null = null, chosenAt = 0;
  ui.done.then((l) => { chosen = l; chosenAt = clock(); });
  return new Promise((resolve) => {
    const pace = (): void => {
      const t = clock(), dt = Math.min(0.1, t - last);
      last = t;
      // Show the newest look, one at a time and not too often while a slider is dragged.
      const look = want;
      if (look && !building && t - builtAt > CREATOR.rebuild) {
        want = null;
        building = true;
        nobody.restyle(look, (o) => view.stage.prepare(o, { everyCaster: true })).catch((e) => console.warn('[creator] rebuild failed', e)).finally(() => { building = false; builtAt = clock(); });
      }
      nobody.puppet([feet.x, feet.y, feet.z], [0, 0, 0], yaw, 'idle', dt, t);
      aim();
      const k = 1 - Math.exp(-dt * CREATOR.ease);
      eye.lerp(wantEye, k); at.lerp(wantAt, k);
      view.camera.position.copy(eye);
      view.camera.lookAt(at);
      view.camera.updateMatrixWorld();
      lamp.set(CREATOR.hold[0], CREATOR.hold[1], 0);
      view.camera.localToWorld(lamp);
      view.frame(feet.x, feet.y, feet.z, t);
      const leaving = chosen ? Math.min(1, (t - chosenAt) / CREATOR.fadeOut) : 0;
      ui.dark = Math.max(1 - (t - start) / CREATOR.fadeIn, leaving);
      (globalThis as { __ready?: boolean }).__ready = view.settled && !chosen && t - start > CREATOR.fadeIn;
      if (chosen && leaving >= 1 && !building && !want) {
        // The camera, the lamp and its power as the game had them.
        view.carrier = carrier;
        view.camera.fov = fov;
        view.camera.updateProjectionMatrix();
        view.headlamp.intensity = power;
        ui.close();
        model.dispose();
        nobody.dropSpare();
        resolve(chosen);
        return;
      }
      requestAnimationFrame(pace);
    };
    requestAnimationFrame(pace);
  });
}
