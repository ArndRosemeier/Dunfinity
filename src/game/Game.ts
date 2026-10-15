/**
 * The game, first playable: a nobody in the Quarry. Walk, sprint, jump, climb any rock while
 * stamina lasts, swim, and mind the drops. Find a shaft (a draft gives it away) and climb down its
 * ladder to the next level, where one arrives at the foot of the ladder up. Third-person camera,
 * wheel to first person.
 */
import { Timer, Vector3 } from 'three/webgpu';
import { Level } from '../gen/level';
import { CAMP, NOTE } from '../gen/grandmasCamp';
import { Body, MOVE, type BodyInput } from '../world/traverse/body';
import { LevelView } from '../render/LevelView';
import { OrbitCamera } from '../render/camera/OrbitCamera';
import { Nobody } from '../render/humans/nobody';
import { Controls } from '../input/controls';
import { parseViewParams } from '../app/params';
import { ladderOf, ladderTop, type Shaft } from '../gen/descents';
import { LadderClimb, faceYaw, type ClimbStep } from '../render/humans/ladderClimb';
import { DRAFT_RANGE, draftLine } from './draft';
import { Fauna, type Foe } from '../creatures/fauna';
import { RatView } from '../render/creatures/ratView';
import { TouchedView } from '../render/creatures/touchedView';
import { ForemanView } from '../render/creatures/foremanView';
import type { Lamp } from '../creatures/crickets';
import { CricketView } from '../render/creatures/cricketView';
import { SlimeView } from '../render/creatures/slimeView';
import { DogView } from '../render/creatures/dogView';
import { EelView } from '../render/creatures/eelView';
import { ScavengerView } from '../render/creatures/scavengerView';
import { TallOneView } from '../render/creatures/tallOneView';
import { Hearth, hearthParts } from '../render/props/hearth';
import { Campfire, FIRE } from '../world/fire';
import { blowFrom, damage, nearestReached } from '../combat/combat';
import { Rng, angleDiff, deriveSeed } from '@futuremagic/core';
import { Finds, Pack, FINDS, type Find } from '../loot/finds';
import { FindView } from '../render/loot/findView';

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
/** Picking a find up: seconds it takes, when it is in hand; how far round the nobody finds are drawn. */
const PICKUP = { dur: 1.0, at: 0.45, shown: 30 };

export async function startGame(host: HTMLElement): Promise<void> {
  const params = parseViewParams(location.search);
  let level = new Level(params.seed, params.depth);
  const { view, canvas, backend } = await LevelView.open(host, level, { forceWebGL: params.forceWebGL });
  view.headlampPower = { survey: 40, dark: 9 };
  view.dark = !params.light; // the game is dark; ?light for the survey view
  view.carrier = new Vector3(); // the headlamp is on the nobody's forehead
  const controls = new Controls(canvas);
  const cam = new OrbitCamera(view.camera, level);
  if (params.look) [cam.yaw, cam.pitch] = [(params.look[0] * Math.PI) / 180, (params.look[1] * Math.PI) / 180];

  /** A body where one arrives on the current level (or at ?pos on the first). */
  const arrive = (pos: [number, number, number] | null = params.pos): Body => {
    const [x, , z] = pos ?? level.arrival;
    return new Body(x, pos ? pos[1] : level.groundAt(x, z) + 0.2, z);
  };
  let fauna: Fauna;
  /** Finds taken so far, per level: they stay taken for every grandchild (D13). */
  const taken = new Map<number, Set<number>>();
  let finds: Finds;
  const findsOf = (l: Level): Finds => {
    if (!taken.has(l.depth)) taken.set(l.depth, new Set());
    return new Finds(l, (i, j) => fauna.rats.denAt(i, j), taken.get(l.depth)!);
  };
  let pack = new Pack();
  const show = (l: Level) => {
    level = l;
    fauna = new Fauna(l);
    campfire = new Campfire(l, MOVE.maxHealth, MOVE.stamina);
    touchedView.level = foremanView.level = scavengerView.people.level = tallView.level = l;
    finds = findsOf(l);
    view.go(l);
    cam.level = l;
    nobody.level = l;
  };
  const nextGrandchild = (): Body => {
    if (level.depth !== params.depth) show(new Level(params.seed, params.depth)); // the next grandchild starts at the top
    return arrive();
  };
  fauna = new Fauna(level);
  /** The nobody's own fire to rest by (one at a time). */
  let campfire = new Campfire(level, MOVE.maxHealth, MOVE.stamina);
  finds = findsOf(level);
  // Built before the warm-up too: the Salt-Touched are humans, compiled with the nobody.
  const touchedView = await TouchedView.create(params.seed);
  touchedView.level = level;
  const foremanView = await ForemanView.create(params.seed);
  foremanView.level = level;
  const scavengerView = await ScavengerView.create(params.seed);
  scavengerView.people.level = level;
  const tallView = await TallOneView.create(params.seed);
  tallView.level = level;
  let body = nextGrandchild();
  cam.follow(body.x, body.y + 1.6, body.z, 1);

  // The nobody is built before the warm-up, which compiles its materials with the rest.
  const nobody = await Nobody.create(params.seed, level);
  nobody.pose(body, 0, 0);
  await view.start([nobody.root, ...touchedView.figures, ...foremanView.figures, ...scavengerView.figures, ...tallView.figures]);
  await view.stage.add(nobody.root);
  await view.stage.add(touchedView.root);
  await view.stage.add(foremanView.root);
  await view.stage.add(scavengerView.people.root);
  await view.stage.add(scavengerView.camps.root);
  await view.stage.add(tallView.root);
  const ratView = new RatView();
  await view.stage.add(ratView.root);
  const cricketView = new CricketView();
  await view.stage.add(cricketView.root);
  const slimeView = new SlimeView();
  await view.stage.add(slimeView.root);
  const dogView = new DogView();
  await view.stage.add(dogView.root);
  const eelView = new EelView();
  await view.stage.add(eelView.root);
  /** The headlamp, as the crickets see it (they scatter from it). */
  const lamp: Lamp = { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: -1, cos: Math.cos(view.headlamp.angle) };
  const lampDir = new Vector3();
  const hearth = new Hearth(hearthParts());
  hearth.root.visible = false;
  await view.stage.add(hearth.root);
  const findView = new FindView();
  await view.stage.add(findView.root);
  const shownFinds: Find[] = [];

  const input: BodyInput = { forward: 0, right: 0, yaw: 0, sprint: false, jump: false };
  const hud = document.getElementById('hud');
  const fade = document.createElement('div');
  fade.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none';
  host.appendChild(fade);
  // Getting hurt shows, in first person too: the edges of the view flash red.
  const pain = document.createElement('div');
  pain.style.cssText = 'position:fixed;inset:0;opacity:0;pointer-events:none;background:radial-gradient(ellipse at center,transparent 45%,rgba(150,0,0,0.85) 100%)';
  host.appendChild(pain);
  const timer = new Timer();
  let acc = 0;
  const climb = new LadderClimb(nobody);
  const blows = new Rng(deriveSeed(params.seed, 'blows'));
  /** The stab in progress: when it started (or -Infinity), the way it faces, whether it has landed. */
  let stabAt = -Infinity, stabYaw = 0, stabDone = true;
  /** The find being picked up, and when that began. */
  let picking: Find | null = null, pickAt = -Infinity;
  /** When the nobody last bent to read grandma's note. */
  let readAt = -Infinity;
  const pickUp = (f: Find, now: number): void => {
    picking = f;
    pickAt = now;
    body.facing = Math.atan2(-(f.x - body.x), -(f.z - body.z));
  };
  /** Everyone the knife can hit. */
  const foes = (): Foe[] => fauna.foes();
  const stab = (now: number): void => {
    stabAt = now;
    stabDone = false;
    // Turn to the nearest foe roughly where the camera looks, else where it looks.
    stabYaw = cam.yaw;
    let best = STAB.aim;
    for (const r of foes()) {
      if (r.dead) continue;
      const d = Math.hypot(r.x - body.x, r.z - body.z), yaw = Math.atan2(-(r.x - body.x), -(r.z - body.z));
      if (d < best && Math.abs(angleDiff(cam.yaw, yaw)) < STAB.aimArc && Math.abs(r.y - body.y) < 1.5) { best = d; stabYaw = yaw; }
    }
  };
  /** A line to show for a while (arriving on a level), and until when. */
  let notice = levelName(level), noticeUntil = 5;
  /** Times the Foreman's bell has rung (each ringing gets a notice). */
  let bells = 0, calls = 0, stares = 0;
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
        notice = levelName(other);
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
    view, cam, get body() { return body; }, get depth() { return level.depth; }, get climbing() { return climb.active; }, get rats() { return fauna.rats; }, get touched() { return fauna.touched; }, get crickets() { return fauna.crickets; }, get slimes() { return [fauna.lumen, fauna.murk]; }, get foreman() { return fauna.foreman; }, get dogs() { return fauna.dogs; }, get eels() { return fauna.eels; }, get scavengers() { return fauna.scavengers; }, get tall() { return fauna.tall; }, get finds() { return finds; }, get pack() { return pack; },
    /** Pick up the find in reach, as E would. */
    pickUp: () => { const f = finds.inReach(body.x, body.y, body.z); if (f) pickUp(f, timer.getElapsed()); return !!f; },
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
    if (body.dead && controls.tap('KeyR')) { body = nextGrandchild(); fauna = new Fauna(level); campfire = new Campfire(level, MOVE.maxHealth, MOVE.stamina); pack = new Pack(); picking = null; }
    const now = timer.getElapsed();
    const busy = climb.active || body.dead || body.mode !== 'walk' || picking !== null;
    if (controls.tap('Mouse0') && !busy && now - stabAt > STAB.dur) stab(now);
    const nearLadder = climb.active ? null : atLadder();
    const nearFind = busy || nearLadder || !body.grounded ? null : finds.inReach(body.x, body.y, body.z);
    const note = level.camp?.note, nearNote = !busy && !nearLadder && !nearFind && !!note && Math.hypot(note[0] - body.x, note[2] - body.z) < CAMP.reach && Math.abs(note[1] - body.y) < 1.5;
    if (controls.tap('KeyE')) {
      if (nearLadder) climbFrom(nearLadder);
      else if (nearFind) pickUp(nearFind, now);
      else if (nearNote) { readAt = now; notice = `Grandma's handwriting, young and fast:\n\n${NOTE.join('\n\n')}`; noticeUntil = now + 20; }
    }
    const kindling = campfire.kindling(now);
    if (controls.tap('KeyC') && !busy && body.grounded && kindling < 0) {
      const why = campfire.whyNot(body, body.facing, fauna.after(body), now);
      if (why) { notice = why; noticeUntil = now + 2.5; } else campfire.light(body, body.facing, now);
    }
    if (picking || now - readAt < PICKUP.dur || campfire.kindling(now) >= 0) input.forward = input.right = 0; // stooping or kneeling, not walking
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
      for (acc += dt; acc >= STEP; acc -= STEP) body.step(level, input, STEP, view.props.blockers);
      const stabbing = now - stabAt < STAB.dur;
      if (stabbing) body.facing = stabYaw;
      if (picking && now - pickAt >= PICKUP.at && !finds.taken.has(picking.id)) {
        finds.take(picking);
        pack.add(picking);
        notice = `You pick up ${FINDS[picking.kind].name}.`;
        noticeUntil = now + 3;
      }
      const reading = now - readAt < PICKUP.dur, stooping = picking !== null || reading;
      if (picking && (now - pickAt >= PICKUP.dur || body.dead)) picking = null;
      if (!stabDone && now - stabAt >= STAB.hit) {
        stabDone = true;
        const r = nearestReached(blowFrom(body, stabYaw, STAB), foes());
        if (r) damage(r, blows.range(STAB.damage[0], STAB.damage[1]), body.x, body.z, STAB.knock, 'knife');
        if (r && 'took' in r && r.took < 1) { notice = 'The knife skids off the salt on his chest.'; noticeUntil = now + 2; }
      }
      const health = body.health;
      fauna.blockers = view.props.blockers;
      view.camera.getWorldDirection(lampDir);
      if (view.carrier) [lamp.x, lamp.y, lamp.z] = [view.carrier.x, view.carrier.y, view.carrier.z];
      [lamp.dx, lamp.dy, lamp.dz] = [lampDir.x, lampDir.y, lampDir.z];
      const struck = fauna.advance(dt, body, lamp, body.facing);
      if (body.health < health) {
        // Flinch away from the nearest foe (thrown back by a pick).
        let near: Foe | undefined, nd = Infinity;
        for (const r of foes()) { const d = Math.hypot(r.x - body.x, r.z - body.z); if (!r.dead && d < nd) { nd = d; near = r; } }
        if (near) nobody.hit(body.x - near.x, body.z - near.z, struck ? 1 : 0.5);
      }
      // The knife comes out when something is after the nobody or it is used, and goes back after a while.
      const threat = fauna.after(body);
      campfire.step(body, threat, now, dt);
      const lighting = campfire.kindling(now);
      const ready = body.mode === 'walk' && !body.dead && (threat || now - stabAt < 4);
      const action = lighting >= 0 ? { id: 'harvest', t0: now - lighting, dur: FIRE.kindle } : stooping ? { id: 'pickup', t0: reading ? readAt : pickAt, dur: PICKUP.dur } : stabbing ? { id: 'swing_1h', t0: stabAt, dur: STAB.dur } : undefined;
      nobody.pose(body, dt, now, action, ready && !stooping && lighting < 0, campfire.resting && !stabbing ? 'crouch' : undefined);
      pain.style.opacity = String(body.dead ? 0 : Math.max(0, 1 - (body.time - body.hurtAt) / 0.45) * 0.8);
      if (fadeIn > 0) { fadeIn = Math.max(0, fadeIn - dt); fade.style.opacity = String(fadeIn / 0.8); }
    }

    ratView.draw(fauna.rats.list, now, body);
    touchedView.draw(fauna.touched.list, body.x, body.z, dt, now);
    foremanView.draw(fauna.foreman.list[0] ?? null, fauna.foreman.hall, dt, now);
    const rung = fauna.foreman.list[0]?.rung ?? 0;
    if (rung > bells) { notice = 'A bell rings out through the halls. Something answers it.'; noticeUntil = now + 4; }
    bells = rung;
    cricketView.draw(fauna.crickets.list, now, body);
    slimeView.lumen.draw(fauna.lumen.list, now, body);
    slimeView.murk.draw(fauna.murk.list, now, body);
    dogView.draw(fauna.dogs.list, now, body);
    eelView.draw(fauna.eels.list, now, body);
    scavengerView.draw(fauna.scavengers.list, body.x, body.z, dt, now);
    if (fauna.scavengers.calls > calls) { notice = fauna.scavengers.said; noticeUntil = now + 3.5; }
    calls = fauna.scavengers.calls;
    tallView.draw(fauna.tall.list, body.x, body.z, dt, now);
    if (fauna.tall.stares > stares) { notice = 'The Tall One looks at you, and the cold of it goes right through you.'; noticeUntil = now + 3; }
    stares = fauna.tall.stares;
    const fire = campfire.fire, lit = campfire.kindling(now);
    hearth.root.visible = !!fire;
    if (fire) { hearth.root.position.set(fire.x, fire.y, fire.z); hearth.flicker(now, lit >= 0 ? (lit / FIRE.kindle) ** 2 * 0.5 : campfire.left(now)); }
    findView.draw(finds.near(body.x, body.z, PICKUP.shown, shownFinds), now);
    nobody.shown = !cam.firstPerson;
    cam.follow(body.x, body.y + 1.6, body.z, dt);
    const lines = [fauna.bossLine(body), timer.getElapsed() < noticeUntil ? notice : ''];
    if (nearLadder) lines.push(nearLadder.up ? 'E: climb up the ladder' : 'E: climb down the ladder');
    else if (nearFind) lines.push(`E: pick up ${FINDS[nearFind.kind].name}`);
    else if (nearNote && timer.getElapsed() >= noticeUntil) lines.push('E: read the note');
    else if (campfire.resting) lines.push('Resting by the fire.');
    else if (!body.dead && !climb.active && body.grounded && body.health < MOVE.maxHealth * 0.7 && !campfire.burning(timer.getElapsed()) && !fauna.after(body)) lines.push('C: light a fire and rest');
    else if (!body.dead && !climb.active) {
      const s = level.descents.nearest(body.x, body.z, DRAFT_RANGE);
      const draft = s && draftLine(body.x, body.z, cam.yaw, s.x, s.z);
      if (draft) lines.push(draft);
    }
    lines.push(...fauna.tally());
    if (pack.items.length) lines.push(`pack: ${pack.items.length} ${pack.items.length === 1 ? 'find' : 'finds'}, worth about €${pack.worth} at the pawn shop`);
    if (hud) hud.textContent = hudText(body, backend) + `\n${view.stage.hudLine()}\n\n${lines.filter(Boolean).join('\n')}`;
    // The headlamp: above the head and a little towards where one looks (the camera, not the
    // body: standing and looking round, the figure would shade its own way).
    view.carrier!.set(body.x - Math.sin(cam.yaw) * 0.4, body.y + (body.mode === 'swim' ? 0.45 : 1.85), body.z - Math.cos(cam.yaw) * 0.4);
    view.frame(body.x, body.y, body.z, timer.getElapsed());
    (globalThis as { __ready?: boolean }).__ready = view.settled;
    controls.endFrame();
  });
}

function levelName(level: Level): string {
  return `Level ${level.depth} · ${level.band.name}`;
}

function bar(value: number, max: number): string {
  const n = Math.round((Math.max(0, value) / max) * 20);
  return '█'.repeat(n) + '░'.repeat(20 - n);
}

/** What hurt you, per cause: the HUD line, and the death line. */
const HURT: Record<string, [string, string]> = {
  rat: ['a rat bites', 'The rats got you.'],
  cricket: ['a cave cricket', 'The cave crickets got you.'],
  dog: ['a feral dog bites', 'The dogs pulled you down.'],
  eel: ['a brine eel strikes', 'Something in the water took you.'],
  lumen: ['a Lumen slime', 'The Lumen did not forgive you.'],
  murk: ['a Murk slime burns', 'The Murk swallowed you.'],
  'salt-touched': ['a Salt-Touched strikes', 'A Salt-Touched brought its pick down on you.'],
  foreman: ['the Foreman strikes', 'The Foreman brought his pick down on you.'],
  fall: ['a hard landing', 'You fell to your death.'],
};

function hudText(b: Body, backend: string): string {
  const lines = [
    `health   ${bar(b.health, MOVE.maxHealth)}  ${b.health.toFixed(0)}`,
    `stamina  ${bar(b.stamina, MOVE.stamina)}${b.mode === 'climb' ? '  climbing' : b.mode === 'swim' ? '  swimming' : ''}`,
  ];
  if (b.time - b.hurtAt < 2 && !b.dead) lines.push(`${HURT[b.lastCause]?.[0] ?? 'a hard landing'}: -${b.lastHurt.toFixed(0)}`);
  if (b.dead) lines.push('', HURT[b.lastCause]?.[1] ?? 'You fell to your death.', 'Grandma\'s knife block has another knife: press R to send the next grandchild down.');
  lines.push('', `click: mouse look, then stab · WASD move · Shift run · Space jump · walk into rock to climb · E climb a ladder or pick up · wheel zoom · F light  ·  ${backend}`);
  return lines.join('\n');
}
