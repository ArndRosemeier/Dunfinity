/**
 * The title screen, live: the game's own view, figures and creatures, on a slow descent. Shot after
 * shot (src/game/titleShots.ts) the nobody stands on a deeper level, knife in hand, looking at
 * what lives there, while the camera drifts round behind them; the shots fade through black, the
 * level's name on the black while the next one streams in. The name and the menu lie over it
 * (src/app/titleScreen.ts); the choice ends it.
 */
import { Timer, Vector3 } from 'three/webgpu';
import { lerp, smoothstep } from '@futuremagic/core';
import type { Level } from '../gen/level';
import type { LevelView } from '../render/LevelView';
import type { OrbitCamera } from '../render/camera/OrbitCamera';
import type { Nobody } from '../render/humans/nobody';
import { Fauna } from '../creatures/fauna';
import type { Lamp } from '../creatures/crickets';
import type { Fighter } from '../combat/combat';
import { Body, type BodyInput } from '../world/traverse/body';
import { TitleScreen, type TitleChoice } from '../app/titleScreen';
import { TITLE_DEPTHS, shotAt, type Shot } from './titleShots';

/**
 * Seconds: fading in, holding, fading out; the longest a level may take to stream before it is shown
 * anyway; how long the black lasts after the choice.
 */
const TIMING = { in: 1.6, hold: 14, out: 1.4, load: 30, leave: 0.8 };
/**
 * The camera over each shot: from `from` to `to` (yaw off the way the nobody looks, radians; pitch;
 * distance behind, metres), and how far left of the nobody it aims (they stand right of the menu).
 */
const MOVE = { from: { yaw: 0.75, pitch: -0.04, distance: 5.6 }, to: { yaw: -0.3, pitch: -0.2, distance: 3.4 }, aside: 1.5, eye: 1.45 };
/** The headlamp a little brighter than in play: the title is seen, not explored. */
const LAMP = { survey: 14, dark: 6 };

/** Where in its move a pinned shot holds. */
const PINNED = 0.45;

/** What the title borrows from the game: its view, camera and figure, and how it shows a level and draws what lives there. */
export interface TitleCast {
  readonly view: LevelView;
  readonly cam: OrbitCamera;
  readonly nobody: Nobody;
  readonly seed: number;
  /** A family is kept: Continue goes on with it. */
  readonly canContinue: boolean;
  /** Hold on the shot of this depth, mid-move (`?title&shot=<depth>`, for screenshots), or null for the descent. */
  readonly pinned: number | null;
  /** Stream level `l` and point every view at it. */
  look(l: Level): void;
  /** Draw everything living on the level shown, nearest (x, z). */
  drawLife(fauna: Fauna, at: { readonly x: number; readonly z: number }, dt: number, now: number): void;
}

/** Play the title until the player chooses; resolves with the screen black, the overlay gone. */
export function playTitle(host: HTMLElement, cast: TitleCast): Promise<TitleChoice> {
  const { view, cam, nobody } = cast;
  const screen = new TitleScreen(host, cast.canContinue);
  const played = view.headlampPower;
  view.headlampPower = LAMP;
  view.dark = view.dark; // the new power
  const timer = new Timer();
  const input: BodyInput = { forward: 0, right: 0, yaw: 0, sprint: false, jump: false };
  const lamp: Lamp = { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: -1, cos: Math.cos(view.headlamp.angle) };
  const dir = new Vector3();
  let next = 0, shot: Shot, body: Body, fauna: Fauna, prey: Fighter;
  /** The phase of the shot playing and when it began; when the choice was made (null: not yet). */
  let phase: 'load' | 'in' | 'hold' | 'out' = 'load', since = 0, chosenAt: number | null = null, choice: TitleChoice = 'new';
  const begin = (now: number): void => {
    shot = shotAt(cast.seed, cast.pinned ?? TITLE_DEPTHS[next++ % TITLE_DEPTHS.length]);
    cast.look(shot.level);
    fauna = new Fauna(shot.level);
    const { x, y, z, yaw } = shot.at;
    body = new Body(x, y + 0.2, z);
    body.facing = yaw;
    input.yaw = yaw;
    // What the creatures see of the nobody: someone standing there whom nothing notices or hurts.
    prey = { x, y, z, vx: 0, vz: 0, radius: 0.3, height: 1.7, dead: false, invulnerable: true, hush: 0, hurt: () => {} };
    screen.line = shot.caption;
    phase = 'load';
    since = now;
  };
  screen.chosen.then((c) => { choice = c; chosenAt = timer.getElapsed(); });
  begin(0);
  return new Promise((resolve) => {
    view.renderer.setAnimationLoop(() => {
      timer.update();
      const dt = Math.min(0.1, timer.getDelta()), now = timer.getElapsed(), t = now - since;
      if (phase === 'load' && (view.settled || t > TIMING.load)) { phase = 'in'; since = now; screen.show(); screen.line = ''; }
      else if (phase === 'in' && t > TIMING.in) { phase = 'hold'; since = now; }
      else if (phase === 'hold' && t > TIMING.hold && cast.pinned === null) { phase = 'out'; since = now; }
      else if (phase === 'out' && t > TIMING.out) begin(now);
      const u = cast.pinned !== null ? PINNED : phase === 'in' ? t / (TIMING.in + TIMING.hold + TIMING.out) : phase === 'hold' ? (TIMING.in + t) / (TIMING.in + TIMING.hold + TIMING.out) : phase === 'out' ? (TIMING.in + TIMING.hold + t) / (TIMING.in + TIMING.hold + TIMING.out) : 0;
      const black = phase === 'load' ? 1 : phase === 'in' ? 1 - smoothstep(0, TIMING.in, t) : phase === 'out' ? smoothstep(0, TIMING.out, t) : 0;
      const leaving = chosenAt === null ? 0 : Math.min(1, (now - chosenAt) / TIMING.leave);
      screen.dark = Math.max(black, leaving);
      if (leaving >= 1) {
        view.renderer.setAnimationLoop(null);
        screen.close();
        view.headlampPower = played;
        view.dark = view.dark;
        resolve(choice);
        return;
      }

      body.step(shot.level, input, dt);
      nobody.pose(body, dt, now, undefined, shot.level.depth > 0);
      view.camera.getWorldDirection(dir);
      [lamp.x, lamp.y, lamp.z, lamp.dx, lamp.dy, lamp.dz] = [body.x, body.y + 1.8, body.z, dir.x, dir.y, dir.z];
      fauna.advance(dt, prey, lamp, body.facing);
      cast.drawLife(fauna, body, dt, now);
      // The camera drifts round behind the nobody and closes in, aimed a little to their left.
      const e = smoothstep(0, 1, u), from = MOVE.from, to = MOVE.to;
      cam.yaw = shot.at.yaw + lerp(from.yaw, to.yaw, e);
      cam.pitch = lerp(from.pitch, to.pitch, e);
      cam.distance = lerp(from.distance, to.distance, e);
      const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
      cam.follow(body.x - rx * MOVE.aside, body.y + MOVE.eye, body.z - rz * MOVE.aside, phase === 'load' ? 1 : dt);
      view.carrier!.set(body.x - Math.sin(cam.yaw) * 0.4, body.y + 1.85, body.z - Math.cos(cam.yaw) * 0.4);
      view.frame(body.x, body.y, body.z, now);
      (globalThis as { __ready?: boolean }).__ready = phase === 'hold' && view.settled;
    });
  });
}
