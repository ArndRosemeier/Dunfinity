/**
 * The game, first playable: a nobody in the Quarry. Walk, sprint, jump, climb any rock while
 * stamina lasts, swim, and mind the drops. Third-person camera, wheel to first person.
 */
import { Timer } from 'three/webgpu';
import { Level } from '../gen/level';
import { Body, MOVE, type BodyInput } from '../world/traverse/body';
import { LevelView } from '../render/LevelView';
import { OrbitCamera } from '../render/camera/OrbitCamera';
import { Figure } from '../render/figure';
import { Controls } from '../input/controls';
import { parseViewParams } from '../app/params';

/** Fixed simulation step, seconds. */
const STEP = 1 / 120;

export async function startGame(host: HTMLElement): Promise<void> {
  const params = parseViewParams(location.search);
  const level = new Level(params.seed, params.depth);
  const { view, canvas, backend } = await LevelView.open(host, level, { forceWebGL: params.forceWebGL });
  view.headlampPower = { survey: 40, dark: 9 };
  view.dark = !params.light; // the game is dark; ?light for the survey view
  const controls = new Controls(canvas);
  const cam = new OrbitCamera(view.camera, level);
  if (params.look) [cam.yaw, cam.pitch] = [(params.look[0] * Math.PI) / 180, (params.look[1] * Math.PI) / 180];

  const start = (): Body => {
    const [x, , z] = params.pos ?? level.spawn();
    return new Body(x, params.pos ? params.pos[1] : level.groundAt(x, z) + 0.2, z);
  };
  let body = start();
  cam.follow(body.x, body.y + 1.6, body.z, 1);

  await view.start();
  const figure = new Figure();
  await view.stage.add(figure.root);
  figure.head.add(view.headlamp); // the nobody carries the light
  view.headlamp.position.set(0, 0.45, -0.45); // above and ahead of the eyes, so it does not glare on the figure

  const input: BodyInput = { forward: 0, right: 0, yaw: 0, sprint: false, jump: false };
  const hud = document.getElementById('hud');
  const timer = new Timer();
  let acc = 0;
  (globalThis as { __game?: unknown }).__game = { view, cam, get body() { return body; }, level };
  view.renderer.setAnimationLoop(() => {
    timer.update();
    const dt = Math.min(0.1, timer.getDelta());
    const [mx, my] = controls.takeLook();
    cam.look(mx, my, controls.takeWheel());
    input.forward = (controls.held('KeyW') ? 1 : 0) - (controls.held('KeyS') ? 1 : 0);
    input.right = (controls.held('KeyD') ? 1 : 0) - (controls.held('KeyA') ? 1 : 0);
    input.sprint = controls.held('ShiftLeft') || controls.held('ShiftRight');
    input.yaw = cam.yaw;
    if (controls.tap('Space')) input.jump = true;
    if (controls.tap('KeyF')) view.dark = !view.dark;
    if (body.dead && controls.tap('KeyR')) body = start();
    for (acc += dt; acc >= STEP; acc -= STEP) body.step(level, input, STEP);

    figure.pose(body, dt);
    figure.shown = !cam.firstPerson;
    cam.follow(body.x, body.y + 1.6, body.z, dt);
    if (hud) hud.textContent = hudText(body, backend) + `\n${view.stage.hudLine()}`;
    view.frame(body.x, body.y, body.z, timer.getElapsed());
    (globalThis as { __ready?: boolean }).__ready = view.settled;
  });
}

function bar(value: number, max: number): string {
  const n = Math.round((Math.max(0, value) / max) * 20);
  return '█'.repeat(n) + '░'.repeat(20 - n);
}

function hudText(b: Body, backend: string): string {
  const lines = [
    `health   ${bar(b.health, MOVE.maxHealth)}  ${b.health.toFixed(0)}`,
    `stamina  ${bar(b.stamina, MOVE.stamina)}${b.mode === 'climb' ? '  climbing' : b.mode === 'swim' ? '  swimming' : ''}`,
  ];
  if (b.time - b.hurtAt < 2 && !b.dead) lines.push(`a hard landing: -${b.lastHurt.toFixed(0)}`);
  if (b.dead) lines.push('', 'You fell to your death.', 'Grandma\'s knife block has another knife: press R to send the next grandchild down.');
  lines.push('', `click: mouse look · WASD move · Shift run · Space jump · walk into rock to climb · wheel zoom · F light  ·  ${backend}`);
  return lines.join('\n');
}
