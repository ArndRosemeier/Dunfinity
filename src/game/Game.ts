/**
 * The game, first playable: a nobody in the Quarry. Walk, sprint, jump, climb any rock while
 * stamina lasts, swim, and mind the drops. Find a shaft (a draft gives it away) and climb down its
 * ladder to the next level. Third-person camera, wheel to first person.
 */
import { Timer } from 'three/webgpu';
import { Level } from '../gen/level';
import { Body, MOVE, type BodyInput } from '../world/traverse/body';
import { LevelView } from '../render/LevelView';
import { OrbitCamera } from '../render/camera/OrbitCamera';
import { Nobody } from '../render/humans/nobody';
import { Controls } from '../input/controls';
import { parseViewParams } from '../app/params';
import { ladderTop } from '../gen/descents';
import { DRAFT_RANGE, draftLine } from './draft';

/** Fixed simulation step, seconds. */
const STEP = 1 / 120;
/** How close to the ladder's top the nobody must stand to climb down, metres. */
const LADDER_REACH = 1.6;
/** Seconds of the fade to black (and back) on the way down. */
const FADE = 1.2;

export async function startGame(host: HTMLElement): Promise<void> {
  const params = parseViewParams(location.search);
  let level = new Level(params.seed, params.depth);
  const { view, canvas, backend } = await LevelView.open(host, level, { forceWebGL: params.forceWebGL });
  view.headlampPower = { survey: 40, dark: 9 };
  view.dark = !params.light; // the game is dark; ?light for the survey view
  const controls = new Controls(canvas);
  const cam = new OrbitCamera(view.camera, level);
  if (params.look) [cam.yaw, cam.pitch] = [(params.look[0] * Math.PI) / 180, (params.look[1] * Math.PI) / 180];

  /** A body where one arrives on the current level (or at ?pos on the first). */
  const arrive = (pos: [number, number, number] | null = params.pos): Body => {
    const [x, , z] = pos ?? level.arrival;
    return new Body(x, pos ? pos[1] : level.groundAt(x, z) + 0.2, z);
  };
  const show = (l: Level) => {
    level = l;
    view.go(l);
    cam.level = l;
    nobody.level = l;
  };
  const nextGrandchild = (): Body => {
    if (level.depth !== params.depth) show(new Level(params.seed, params.depth)); // the next grandchild starts at the top
    return arrive();
  };
  let body = nextGrandchild();
  cam.follow(body.x, body.y + 1.6, body.z, 1);

  // The nobody is built before the warm-up, which compiles its materials with the rest.
  const nobody = await Nobody.create(params.seed, level);
  nobody.pose(body, 0, 0);
  await view.start([nobody.root]);
  await view.stage.add(nobody.root);
  nobody.head.add(view.headlamp); // the nobody carries the light
  view.headlamp.position.set(0, 0.5, -0.7); // above and ahead of the eyes, so it does not glare on the figure

  const input: BodyInput = { forward: 0, right: 0, yaw: 0, sprint: false, jump: false };
  const hud = document.getElementById('hud');
  const fade = document.createElement('div');
  fade.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none';
  host.appendChild(fade);
  const timer = new Timer();
  let acc = 0;
  /** On the ladder: seconds since starting down (the fade), or -1; and whether the next level is up yet. */
  let climbing = -1, below = false;
  /** A line to show for a while (arriving on a level), and until when. */
  let notice = levelName(level.depth), noticeUntil = 5;
  const ladder: [number, number] = [0, 0];
  const atLadder = (): boolean => {
    if (body.dead || body.mode !== 'walk' || !body.grounded) return false;
    const s = level.descents.at(body.x, body.z, LADDER_REACH + 1);
    if (!s) return false;
    ladderTop(s, ladder);
    return Math.hypot(body.x - ladder[0], body.z - ladder[1]) < LADDER_REACH;
  };
  (globalThis as { __game?: unknown }).__game = { view, cam, get body() { return body; }, get depth() { return level.depth; }, descend: () => { climbing = 0; } };
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
    if (body.dead && controls.tap('KeyR')) body = nextGrandchild();
    const nearLadder = climbing < 0 && atLadder();
    if (nearLadder && controls.tap('KeyE')) climbing = 0;
    if (climbing >= 0) {
      // Down the ladder into the dark; the next level comes up out of it.
      climbing += dt;
      if (climbing >= FADE && !below) {
        const { health } = body;
        show(new Level(params.seed, level.depth + 1));
        body = arrive(null);
        body.health = health;
        below = true;
        notice = levelName(level.depth);
        noticeUntil = timer.getElapsed() + 5;
      }
      fade.style.opacity = String(climbing < FADE ? climbing / FADE : Math.max(0, 2 - climbing / FADE));
      if (climbing >= 2 * FADE) { climbing = -1; below = false; }
    } else for (acc += dt; acc >= STEP; acc -= STEP) body.step(level, input, STEP);

    nobody.pose(body, dt, timer.getElapsed());
    nobody.shown = !cam.firstPerson;
    cam.follow(body.x, body.y + 1.6, body.z, dt);
    const lines = [timer.getElapsed() < noticeUntil ? notice : ''];
    if (nearLadder) lines.push('E: climb down the ladder');
    else if (!body.dead) {
      const s = level.descents.nearest(body.x, body.z, DRAFT_RANGE);
      const draft = s && draftLine(body.x, body.z, cam.yaw, s.x, s.z);
      if (draft) lines.push(draft);
    }
    if (hud) hud.textContent = hudText(body, backend) + `\n${view.stage.hudLine()}\n\n${lines.filter(Boolean).join('\n')}`;
    view.frame(body.x, body.y, body.z, timer.getElapsed());
    (globalThis as { __ready?: boolean }).__ready = view.settled;
  });
}

function levelName(depth: number): string {
  return `Level ${depth} · The Quarry`;
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
  lines.push('', `click: mouse look · WASD move · Shift run · Space jump · walk into rock to climb · E climb down a shaft · wheel zoom · F light  ·  ${backend}`);
  return lines.join('\n');
}
