/**
 * The game, first playable: a nobody in the Quarry. Walk, sprint, jump, climb any rock while
 * stamina lasts, swim, and mind the drops. Find a shaft (a draft gives it away) and climb down its
 * ladder to the next level, where one arrives at the foot of the ladder up. Third-person camera,
 * wheel to first person.
 */
import { Timer } from 'three/webgpu';
import { Level } from '../gen/level';
import { Body, MOVE, type BodyInput } from '../world/traverse/body';
import { LevelView } from '../render/LevelView';
import { OrbitCamera } from '../render/camera/OrbitCamera';
import { Nobody } from '../render/humans/nobody';
import { Controls } from '../input/controls';
import { parseViewParams } from '../app/params';
import { ladderOf, ladderTop, type Shaft } from '../gen/descents';
import { LadderClimb, faceYaw, type ClimbStep } from '../render/humans/ladderClimb';
import { DRAFT_RANGE, draftLine } from './draft';
import { Rats, type Rat } from '../creatures/rats';
import { RatView } from '../render/creatures/ratView';
import { damage, nearestReached, type Blow } from '../combat/combat';
import { Rng, angleDiff, deriveSeed } from '@futuremagic/core';

/** Fixed simulation step, seconds. */
const STEP = 1 / 120;
/** How close to where one gets on a ladder the nobody must stand to climb it, metres. */
const LADDER_REACH = 1.6;
/** How much of the ladder is climbed on each level when going from one to the other, metres. */
const CLIMB_SHOWN = 4.5;
/**
 * A stab with the kitchen knife: seconds it takes, when it lands, its reach (beyond the nobody's
 * centre), sweep and heights, damage and knockback; and how far it turns the nobody to a rat.
 */
const STAB = { dur: 0.42, hit: 0.19, range: 0.95, arc: 0.85, low: -0.3, high: 1.3, damage: [6, 10] as const, knock: 3.5, aim: 2.4, aimArc: 1.2 };

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
  let rats: Rats;
  const show = (l: Level) => {
    level = l;
    rats = new Rats(l);
    view.go(l);
    cam.level = l;
    nobody.level = l;
  };
  const nextGrandchild = (): Body => {
    if (level.depth !== params.depth) show(new Level(params.seed, params.depth)); // the next grandchild starts at the top
    return arrive();
  };
  rats = new Rats(level);
  let body = nextGrandchild();
  cam.follow(body.x, body.y + 1.6, body.z, 1);

  // The nobody is built before the warm-up, which compiles its materials with the rest.
  const nobody = await Nobody.create(params.seed, level);
  nobody.pose(body, 0, 0);
  await view.start([nobody.root]);
  await view.stage.add(nobody.root);
  const ratView = new RatView();
  await view.stage.add(ratView.root);
  nobody.head.add(view.headlamp); // the nobody carries the light
  view.headlamp.position.set(0, 0.5, -0.7); // above and ahead of the eyes, so it does not glare on the figure

  const input: BodyInput = { forward: 0, right: 0, yaw: 0, sprint: false, jump: false };
  const hud = document.getElementById('hud');
  const fade = document.createElement('div');
  fade.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none';
  host.appendChild(fade);
  const timer = new Timer();
  let acc = 0;
  const climb = new LadderClimb(nobody);
  const blows = new Rng(deriveSeed(params.seed, 'blows'));
  /** The stab in progress: when it started (or -Infinity), the way it faces, whether it has landed. */
  let stabAt = -Infinity, stabYaw = 0, stabDone = true;
  const stab = (now: number): void => {
    stabAt = now;
    stabDone = false;
    // Turn to the nearest rat roughly where the camera looks, else where it looks.
    stabYaw = cam.yaw;
    let best = STAB.aim;
    for (const r of rats.list) {
      if (r.dead) continue;
      const d = Math.hypot(r.x - body.x, r.z - body.z), yaw = Math.atan2(-(r.x - body.x), -(r.z - body.z));
      if (d < best && Math.abs(angleDiff(cam.yaw, yaw)) < STAB.aimArc && Math.abs(r.y - body.y) < 1.5) { best = d; stabYaw = yaw; }
    }
  };
  /** A line to show for a while (arriving on a level), and until when. */
  let notice = levelName(level.depth), noticeUntil = 5;
  const ladder: [number, number] = [0, 0];
  /** The shaft whose ladder the nobody stands at (a way down or the way up), or null. */
  const atLadder = (): Shaft | null => {
    if (body.dead || body.mode !== 'walk' || !body.grounded) return null;
    const s = level.descents.at(body.x, body.z, LADDER_REACH + 3);
    if (!s) return null;
    ladderTop(s, ladder);
    return Math.hypot(body.x - ladder[0], body.z - ladder[1]) < LADDER_REACH ? s : null;
  };
  /**
   * Climb shaft s's ladder to the level below (a way down) or above (the way up): the first few
   * metres on this level, a fade while the next one streams in, the last few metres there.
   */
  const climbFrom = (s: Shaft): void => {
    const here = ladderOf(s), health = body.health;
    const other = new Level(params.seed, level.depth + (s.up ? -1 : 1));
    const steps: ClimbStep[] = [{ kind: 'walk', ladder: here }];
    if (s.up) {
      steps.push({ kind: 'foot', ladder: here, dir: 'on' }, { kind: 'climb', ladder: here, from: here.floor, to: here.floor + CLIMB_SHOWN, fade: 'out' });
    } else {
      const top = climb.rimFeet(here);
      steps.push({ kind: 'rim', ladder: here, dir: 'on' }, { kind: 'climb', ladder: here, from: top, to: top - CLIMB_SHOWN, fade: 'out' });
    }
    // Comes out at the foot of the way up below, or at the way down nearest the arrival above.
    const [ax, , az] = other.arrival;
    const to = s.up ? other.descents.nearest(ax, az, 5000) : other.ascent;
    steps.push({
      kind: 'call', then: () => {
        show(other);
        notice = levelName(other.depth);
        // Behind the climber, looking at the ladder (from above coming out of a shaft).
        if (to) [cam.yaw, cam.pitch] = [faceYaw(ladderOf(to)), s.up ? -0.55 : -0.12];
      },
    });
    steps.push({ kind: 'wait', ready: () => view.settled });
    if (to) {
      const there = ladderOf(to);
      if (s.up) {
        const top = climb.rimFeet(there);
        steps.push({ kind: 'climb', ladder: there, from: top - CLIMB_SHOWN, to: top, fade: 'in' }, { kind: 'rim', ladder: there, dir: 'off' });
      } else steps.push({ kind: 'climb', ladder: there, from: there.floor + CLIMB_SHOWN, to: there.floor, fade: 'in' }, { kind: 'foot', ladder: there, dir: 'off' });
    }
    climb.play(steps, body.x, body.y, body.z, body.facing);
    [cam.yaw, cam.pitch] = [faceYaw(here), s.up ? 0.15 : -0.45]; // behind the climber, facing the ladder
    onLanded = () => {
      const p = climb.pos;
      body = to ? new Body(p.x, p.y + 0.05, p.z) : arrive(null);
      body.health = health;
      body.facing = climb.yaw;
      noticeUntil = timer.getElapsed() + 5;
    };
  };
  /** What to do when the climb in progress ends. */
  let onLanded: (() => void) | null = null;
  /** Seconds left of a fade in from black (a climb that came out without a ladder). */
  let fadeIn = 0;
  (globalThis as { __game?: unknown }).__game = {
    view, cam, get body() { return body; }, get depth() { return level.depth; }, get climbing() { return climb.active; }, get rats() { return rats; },
    /** Stab as the mouse button would. */
    stab: () => stab(timer.getElapsed()),
    /** Climb down the nearest way down (or up the way up) from wherever the nobody is. */
    descend: (up = false) => {
      const s = up ? level.ascent : level.descents.nearest(body.x, body.z, 5000);
      if (!s) return false;
      ladderTop(s, ladder);
      body = new Body(ladder[0], s.floor + 0.05, ladder[1]);
      climbFrom(s);
      return true;
    },
  };
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
    if (body.dead && controls.tap('KeyR')) { body = nextGrandchild(); rats = new Rats(level); }
    const now = timer.getElapsed();
    if (controls.tap('Mouse0') && !climb.active && !body.dead && body.mode === 'walk' && now - stabAt > STAB.dur) stab(now);
    const nearLadder = climb.active ? null : atLadder();
    if (nearLadder && controls.tap('KeyE')) climbFrom(nearLadder);
    if (climb.active) {
      climb.advance(dt, timer.getElapsed());
      body.x = climb.pos.x; body.y = climb.pos.y; body.z = climb.pos.z;
      fade.style.opacity = String(climb.fade);
      if (!climb.active) {
        climb.stop();
        onLanded?.();
        onLanded = null;
        if (fade.style.opacity !== '0') fadeIn = 0.8;
      }
      input.jump = false;
    } else {
      for (acc += dt; acc >= STEP; acc -= STEP) body.step(level, input, STEP);
      const stabbing = now - stabAt < STAB.dur;
      if (stabbing) body.facing = stabYaw;
      if (!stabDone && now - stabAt >= STAB.hit) {
        stabDone = true;
        const blow: Blow = { x: body.x, y: body.y, z: body.z, yaw: stabYaw, range: STAB.range, arc: STAB.arc, low: STAB.low, high: STAB.high };
        const r = nearestReached(blow, rats.list);
        if (r) damage(r, blows.range(STAB.damage[0], STAB.damage[1]), body.x, body.z, STAB.knock, 'knife');
      }
      const health = body.health;
      rats.advance(dt, body);
      if (body.health < health) {
        // Flinch away from the nearest rat.
        let near: Rat | undefined, nd = Infinity;
        for (const r of rats.list) { const d = Math.hypot(r.x - body.x, r.z - body.z); if (!r.dead && d < nd) { nd = d; near = r; } }
        if (near) nobody.hit(body.x - near.x, body.z - near.z, 0.5);
      }
      // The knife comes out when rats are after the nobody or it is used, and goes back after a while.
      const threat = rats.list.some((r) => (r.mode === 'chase' || r.mode === 'bite') && Math.hypot(r.x - body.x, r.z - body.z) < 14);
      const ready = body.mode === 'walk' && !body.dead && (threat || now - stabAt < 4);
      nobody.pose(body, dt, now, stabbing ? { id: 'swing_1h', t0: stabAt, dur: STAB.dur } : undefined, ready);
      if (fadeIn > 0) { fadeIn = Math.max(0, fadeIn - dt); fade.style.opacity = String(fadeIn / 0.8); }
    }

    ratView.draw(rats.list, now);
    nobody.shown = !cam.firstPerson;
    cam.follow(body.x, body.y + 1.6, body.z, dt);
    const lines = [timer.getElapsed() < noticeUntil ? notice : ''];
    if (nearLadder) lines.push(nearLadder.up ? 'E: climb up the ladder' : 'E: climb down the ladder');
    else if (!body.dead && !climb.active) {
      const s = level.descents.nearest(body.x, body.z, DRAFT_RANGE);
      const draft = s && draftLine(body.x, body.z, cam.yaw, s.x, s.z);
      if (draft) lines.push(draft);
    }
    if (rats.killed) lines.push(`rats killed: ${rats.killed}`);
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
  if (b.time - b.hurtAt < 2 && !b.dead) lines.push(`${b.lastCause === 'rat' ? 'a rat bites' : 'a hard landing'}: -${b.lastHurt.toFixed(0)}`);
  if (b.dead) lines.push('', b.lastCause === 'rat' ? 'The rats got you.' : 'You fell to your death.', 'Grandma\'s knife block has another knife: press R to send the next grandchild down.');
  lines.push('', `click: mouse look, then stab · WASD move · Shift run · Space jump · walk into rock to climb · E climb a ladder · wheel zoom · F light  ·  ${backend}`);
  return lines.join('\n');
}
