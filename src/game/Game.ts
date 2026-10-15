/**
 * The game, first playable: a nobody in the Quarry. Walk, sprint, jump, climb any rock while
 * stamina lasts, swim, and mind the drops. Find a shaft (a draft gives it away) and climb down its
 * ladder to the next level, where one arrives at the foot of the ladder up. Third-person camera,
 * wheel to first person.
 */
import { Timer, Vector3 } from 'three/webgpu';
import { Practice, SKILLS, type Skill } from '../loot/practice';
import { readSave, writeSave, type GrandchildData } from '../persist/save';
import { Explored } from '../world/explored';
import { MapView } from '../app/mapView';
import { CELLAR } from '../gen/cellar';
import { shopDoor } from '../gen/town';
import { PAWN, sell } from '../loot/pawn';
import { GEAR, GEAR_ORDER, Gear } from '../loot/hardware';
import { notaryLetter, notaryList, type Fallen } from '../gen/notary';
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
import { NeighbourView } from '../render/humans/neighbourView';
import { Neighbour, WEBER_KEY } from '../world/neighbour';
import { TallOneView } from '../render/creatures/tallOneView';
import { Hearth, hearthParts } from '../render/props/hearth';
import { Campfire, FIRE } from '../world/fire';
import { Doors } from '../world/doors';
import { DoorView } from '../render/props/doorView';
import { blowFrom, damage, nearestReached, reach } from '../combat/combat';
import { Rng, angleDiff, deriveSeed } from '@futuremagic/core';
import { Finds, Pack, FINDS, type Find } from '../loot/finds';
import { FindView } from '../render/loot/findView';
import { Tin, type Gain } from '../loot/tin';
import { CARDS, Cooked, SALT_RINGS, card, type CardId } from '../loot/recipes';
import { DebugMenu } from '../app/debugMenu';
import { placesOn, type Place } from './debugPlaces';
import { SALT_LINE, SaltLine } from '../world/saltLine';
import { SaltLineView } from '../render/props/saltLine';
import { TinView } from '../app/tinView';
import { SaltDrift } from '../render/loot/saltDrift';
import { Thrown } from '../combat/thrown';
import { GameSounds } from '../audio/gameSounds';
import { ThrownView } from '../render/humans/thrownView';

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
/** Grandma's Tenderising (V): an overhead blow with the knife's handle, slower, wider, knocking far back; its stamina (damage: the card's). */
const POUND = { dur: 0.9, hit: 0.5, range: 1.15, arc: 1.1, low: -0.3, high: 1.3, knock: 8, aim: 2.6, aimArc: 1.2, stamina: 3 };
/** Picking a find up: seconds it takes, when it is in hand; how far round the nobody finds are drawn. */
const PICKUP = { dur: 1.0, at: 0.45, shown: 30 };
/** Throwing a knife (grandma's Second Helpings): seconds the throw takes, and when the knife leaves the hand. */
const THROWING = { dur: 0.55, release: 0.22 };
/** Grandma's Way Home: seconds with eyes shut before one is there, the last of them fading to black; salt rises every `motes` seconds. */
const WAY_HOME = { dur: 4, fade: 1, motes: 0.5 };
/** Grandma's pot lid: the block pose's length, seconds, and how far into it the lid is up (held by restarting it there). */
const BLOCK = { dur: 0.6, held: 0.25, hold: 0.4 };
/** Cooking a card at the fire: seconds the nobody stirs. */
const COOK = { dur: 2.4 };

export async function startGame(host: HTMLElement): Promise<void> {
  const params = parseViewParams(location.search);
  // Kept between visits (src/persist/save.ts), unless the URL picks a depth or a place (a test view) or asks for a fresh start.
  const q = new URLSearchParams(location.search), keep = !q.has('depth') && !q.has('pos');
  const saved = keep && !q.has('fresh') ? readSave(params.seed) : null;
  let level = new Level(params.seed, saved?.child?.depth ?? params.depth, params.style);
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
  const saltLine = new SaltLine();
  /** Finds taken so far, per level: they stay taken for every grandchild (D13). */
  const taken = new Map<number, Set<number>>(saved?.taken.map(([d, ids]) => [d, new Set(ids)]) ?? []);
  let finds: Finds;
  const findsOf = (l: Level): Finds => {
    if (!taken.has(l.depth)) taken.set(l.depth, new Set());
    return new Finds(l, (i, j) => fauna.rats.denAt(i, j), taken.get(l.depth)!);
  };
  let pack = new Pack();
  let gear = new Gear(saved?.child?.gear ?? []);
  for (const f of saved?.child?.pack ?? []) pack.add(f);
  /** Grandma's tin: the infused salt outlives every grandchild. */
  const tin = saved ? Tin.from(saved.tin) : new Tin();
  tin.deepest = Math.max(tin.deepest, level.depth);
  /** The cards this grandchild has cooked (the next one starts with none). */
  let cooked = saved?.child ? Cooked.from(saved.child.cooked) : new Cooked();
  /** What this grandchild has practised (the next one starts at none). */
  let practice = saved?.child ? Practice.from(saved.child.practice) : new Practice();
  /** What this grandchild has seen of each level (the map, M). */
  let explored = saved?.child?.explored ? Explored.from(saved.child.explored) : new Explored();
  let exploredAt = 0;
  /** Metres climbed not yet counted as practice, and the height the climb was at last frame. */
  let climbed = 0, climbY = 0, blockedAt = -Infinity;
  const show = (l: Level) => {
    level = l;
    fauna = new Fauna(l);
    saltLine.circle = null;
    campfire = new Campfire(l, MOVE.maxHealth, MOVE.stamina);
    doors = new Doors(l.doors);
    doorView.hang(doors.list);
    doors.into(view.props.blockers);
    if (l.depth === 0) view.props.blockers.set(WEBER_KEY, weber.blocker); else view.props.blockers.clear(WEBER_KEY);
    touchedView.level = foremanView.level = scavengerView.people.level = neighbourView.people.level = tallView.level = l;
    finds = findsOf(l);
    tin.deepest = Math.max(tin.deepest, l.depth);
    reached = Math.max(reached, l.depth);
    thrown.missiles.length = 0;
    view.go(l);
    cam.level = l;
    nobody.level = l;
  };
  /** Which grandchild this is (1: the first); the notary writes to each. The deepest level this one has reached. */
  let heir = saved?.heir ?? 0, reached = saved?.child?.reached ?? 0;
  /** The grandchildren who did not come back (the notary's list), and whether this one's death is on it yet. */
  const fallen: Fallen[] = [...(saved?.fallen ?? [])];
  /** Grandma's purse: euros from Ilse, kept for the family. */
  let euros = saved?.euros ?? 0, sales = 0;
  let mourned = false;
  const nextGrandchild = (): Body => {
    if (level.depth !== params.depth) show(new Level(params.seed, params.depth, params.style)); // the next grandchild starts at the top
    heir++;
    reached = level.depth;
    const b = arrive();
    // In grandma's cellar: by her armchair, facing the broken arch.
    if (level.depth === 0 && !params.pos) b.facing = cam.yaw = CELLAR.start.yaw;
    return b;
  };
  fauna = new Fauna(level);
  /** The nobody's own fire to rest by (one at a time). */
  let campfire = new Campfire(level, MOVE.maxHealth, MOVE.stamina);
  /** The doors that open and shut (grandma's house). */
  let doors = new Doors(level.doors);
  finds = findsOf(level);
  // Built before the warm-up too: the Salt-Touched are humans, compiled with the nobody.
  const touchedView = await TouchedView.create(params.seed);
  touchedView.level = level;
  const foremanView = await ForemanView.create(params.seed);
  foremanView.level = level;
  const scavengerView = await ScavengerView.create(params.seed);
  const neighbourView = await NeighbourView.create();
  const weber = new Neighbour();
  scavengerView.people.level = neighbourView.people.level = level;
  const tallView = await TallOneView.create(params.seed);
  tallView.level = level;
  /** The grandchild kept from the last visit, where they were. */
  const resume = (c: GrandchildData): Body => {
    const b = new Body(c.pos[0], c.pos[1] + 0.05, c.pos[2]);
    b.health = c.health; b.stamina = c.stamina;
    b.facing = cam.yaw = c.facing;
    return b;
  };
  let body = saved?.child ? resume(saved.child) : nextGrandchild();
  /** Keep the game (every few seconds, and when the page goes). */
  const keepGame = (): void => {
    if (!keep) return;
    const child: GrandchildData | null = body.dead ? null : {
      depth: level.depth, pos: [body.x, body.y, body.z], facing: body.facing, health: body.health, stamina: body.stamina, reached,
      cooked: cooked.data, practice: practice.data, pack: [...pack.items], gear: gear.data, explored: explored.data,
    };
    writeSave(params.seed, { v: 1, heir, tin: tin.data, taken: [...taken].map(([d, ids]) => [d, [...ids]]), child, fallen, euros });
  };
  let keptAt = 0, keptDead = false;
  addEventListener('pagehide', keepGame);
  cam.follow(body.x, body.y + 1.6, body.z, 1);

  // The nobody is built before the warm-up, which compiles its materials with the rest.
  const nobody = await Nobody.create(params.seed, level);
  // The dogs too: skinned, their shaders are their own, so they compile in the warm-up with the humans.
  const dogView = await DogView.create();
  const ratView = await RatView.create();
  nobody.pose(body, 0, 0);
  await view.start([nobody.root, ...touchedView.figures, ...foremanView.figures, ...scavengerView.figures, ...tallView.figures, ...neighbourView.people.figures, dogView.root, ratView.root]);
  await view.stage.add(nobody.root);
  await view.stage.add(touchedView.root);
  await view.stage.add(foremanView.root);
  await view.stage.add(scavengerView.people.root);
  await view.stage.add(scavengerView.camps.root);
  await view.stage.add(neighbourView.people.root);
  await view.stage.add(tallView.root);
  await view.stage.add(ratView.root);
  const cricketView = new CricketView();
  await view.stage.add(cricketView.root);
  const slimeView = new SlimeView();
  await view.stage.add(slimeView.root);
  await view.stage.add(dogView.root);
  const eelView = new EelView();
  await view.stage.add(eelView.root);
  /** The headlamp, as the crickets see it (they scatter from it). */
  const lamp: Lamp = { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: -1, cos: Math.cos(view.headlamp.angle) };
  const lampDir = new Vector3();
  const hearth = new Hearth(hearthParts());
  hearth.root.visible = false;
  await view.stage.add(hearth.root);
  const doorView = new DoorView();
  await view.stage.add(doorView.root);
  doorView.hang(doors.list);
  doors.into(view.props.blockers);
  if (level.depth === 0) view.props.blockers.set(WEBER_KEY, weber.blocker);
  const findView = new FindView();
  await view.stage.add(findView.root);
  const drift = new SaltDrift(params.seed);
  await view.stage.add(drift.root);
  /** Knives thrown (grandma's Second Helpings), and when the last throw began. */
  const thrown = new Thrown();
  const thrownView = new ThrownView();
  await view.stage.add(thrownView.root);
  let throwAt = -9, released = true, tossing: 'knife' | 'candle' = 'knife';
  /** Grandma's Salt Line, poured (one at a time; it stays on the level it was poured on). */
  const saltLineView = new SaltLineView(SALT_RINGS.map((k) => k.r));
  await view.stage.add(saltLineView.root);
  const tinView = new TinView(document.body);
  const mapView = new MapView(document.body);
  /** The debug menu (`): every ability, invulnerable, tireless, any level, anything worth checking out. */
  let debugPlaces: Place[] = [];
  /** Put the nobody down at (x, y, z) facing `yaw` on the level shown, as they were (health, stamina), fading in. */
  const putDown = (x: number, y: number, z: number, yaw: number): void => {
    const hp = body.health, st = body.stamina;
    body = new Body(x, y + 0.2, z);
    body.health = hp; body.stamina = st;
    body.facing = cam.yaw = yaw;
    picking = null;
    cam.follow(body.x, body.y + 1.6, body.z, 1);
    fadeIn = 0.5;
  };
  /** Not mid-climb, mid-way home or dead. */
  const canGo = (): boolean => !climb.active && homeTo === null && !body.dead;
  const debug = new DebugMenu(document.body, {
    allAbilities: () => {
      cooked = Cooked.from(Object.fromEntries(CARDS.map((c) => [c.id, c.cost.length])));
      gear = new Gear(GEAR_ORDER);
      return 'Every recipe card at its top rank, and all of Kemal\'s gear.';
    },
    toLevel: (d) => {
      if (!canGo()) return;
      show(new Level(params.seed, d, params.style));
      const [x, , z] = level.arrival;
      // Facing away from the ladder up, out over the level.
      const up = level.ascent, yaw = d === 0 ? CELLAR.start.yaw : up ? Math.atan2(up.x - x, up.z - z) : cam.yaw;
      putDown(x, d === 0 ? 0 : level.groundAt(x, z), z, yaw);
      say(levelName(level), 5);
      debug.refresh();
    },
    places: () => (debugPlaces = placesOn(level, fauna, body.x, body.z)),
    toPlace: (i) => {
      const p = debugPlaces[i];
      if (!p || !canGo()) return;
      putDown(p.x, p.y, p.z, p.yaw);
      say(p.name, 3);
      debug.toggle();
    },
    depth: () => level.depth,
  });
  /** The card chosen in the open tin, and when the last one was cooked (the nobody stirs the pot). */
  let tinSel: CardId = TinView.order(cooked)[0], cookAt = -9;
  /** When the last roll began (grandma's Duck card). */
  let rollAt = -9;
  /** Way Home under way: when it began, and the level it goes to (null: none). */
  let homeAt = -Infinity, homeTo: number | null = null, homeMote = 0;
  /** When the lid's block pose (re)started. */
  let blockAt = -Infinity;
  /** The last salt gained (its HUD line), and until when it shows. */
  let gainLine = '', gainUntil = 0;
  /** Salt formed at (x, y, z): it drifts into the tin, and the HUD says why. */
  const gained = (g: Gain | null, x: number, y: number, z: number, now: number): void => {
    if (!g) return;
    drift.burst(x, y, z, g.amount, now);
    sounds.play('salt_gain', null, 0.7);
    gainLine = `+${g.amount} infused salt. ${g.why}`;
    gainUntil = now + 4;
  };
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
  /** Sound effects, ambience and music (src/audio): N mutes everything, B turns the music off. */
  const sounds = new GameSounds(params.seed, import.meta.env.BASE_URL);
  await sounds.init();
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
  /** Which blow is in progress: a stab, or (grandma's Tenderising) a pound. */
  let striking: 'stab' | 'pound' = 'stab';
  const stab = (now: number, how: 'stab' | 'pound' = 'stab'): void => {
    stabAt = now;
    stabDone = false;
    striking = how;
    sounds.play(how === 'pound' ? 'throw' : 'knife_swing', null, 0.8, how === 'pound' ? 0.8 : 1);
    // Turn to the nearest foe roughly where the camera looks, else where it looks.
    stabYaw = cam.yaw;
    let best = STAB.aim;
    for (const r of foes()) {
      if (r.dead) continue;
      const d = Math.hypot(r.x - body.x, r.z - body.z), yaw = Math.atan2(-(r.x - body.x), -(r.z - body.z));
      if (d < best && Math.abs(angleDiff(cam.yaw, yaw)) < STAB.aimArc && Math.abs(r.y - body.y) < 1.5) { best = d; stabYaw = yaw; }
    }
  };
  /** Count practice of `s`; say so when it goes up a tier. */
  const practised = (s: Skill, n = 1): void => {
    const t = practice.use(s, n);
    if (t) say(`${SKILLS[s].name}, practice ${t}. ${SKILLS[s].line}`, 4);
  };
  /** A line to show for a while (arriving on a level), and until when. */
  let notice = levelName(level), noticeUntil = 5;
  /** Show `text` as the notice for `secs` seconds. */
  const say = (text: string, secs: number): void => { notice = text; noticeUntil = timer.getElapsed() + secs; };
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
    const other = new Level(params.seed, level.depth + (s.up ? -1 : 1), params.style);
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
      if (!s.up) gained(tin.reached(level.depth), body.x, body.y, body.z, timer.getElapsed());
    };
  };
  /** What to do when the climb in progress ends. */
  let onLanded: (() => void) | null = null;
  /** Seconds left of a fade in from black (a climb that came out without a ladder). */
  let fadeIn = 0;
  (globalThis as { __game?: unknown }).__game = {
    view, cam, get body() { return body; }, get depth() { return level.depth; }, get climbing() { return climb.active; }, get rats() { return fauna.rats; }, get touched() { return fauna.touched; }, get crickets() { return fauna.crickets; }, get slimes() { return [fauna.lumen, fauna.murk]; }, get foreman() { return fauna.foreman; }, get dogs() { return fauna.dogs; }, get eels() { return fauna.eels; }, get scavengers() { return fauna.scavengers; }, get tall() { return fauna.tall; }, get finds() { return finds; }, get doors() { return doors; }, get pack() { return pack; }, tin, get cooked() { return cooked; }, thrown, saltLine, debug,
    /** Pick up the find in reach, as E would. */
    pickUp: () => { const f = finds.inReach(body.x, body.y, body.z); if (f) pickUp(f, timer.getElapsed()); return !!f; },
    /** Stab as the mouse button would. */
    stab: () => stab(timer.getElapsed()),
    /** Bring the knife's handle down, as V would (grandma's Tenderising). */
    pound: () => stab(timer.getElapsed(), 'pound'),
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
    // A death goes on the notary's list (once).
    if (body.dead && !mourned) { mourned = true; fallen.push({ heir, depth: level.depth, what: HURT[body.lastCause]?.[0] ?? 'a fall' }); }
    if (!body.dead) mourned = false;
    // Keep the game every few seconds (not mid-climb or mid-way home), and at once when the grandchild dies.
    if (!climb.active && homeTo === null && (timer.getElapsed() - keptAt > 5 || body.dead !== keptDead)) { keptAt = timer.getElapsed(); keptDead = body.dead; keepGame(); }
    const [mx, my] = controls.takeLook();
    cam.look(mx, my, controls.takeWheel());
    input.forward = (controls.held('KeyW') ? 1 : 0) - (controls.held('KeyS') ? 1 : 0);
    input.right = (controls.held('KeyD') ? 1 : 0) - (controls.held('KeyA') ? 1 : 0);
    input.sprint = controls.held('ShiftLeft') || controls.held('ShiftRight');
    input.sneak = controls.held('KeyZ'); // (not Ctrl: Ctrl+W closes the tab)
    input.yaw = cam.yaw;
    if (controls.tap('Space')) input.jump = true;
    if (controls.tap('KeyF')) view.dark = !view.dark;
    if (controls.tap('KeyM')) mapView.toggle();
    if (controls.tap('KeyN')) { sounds.engine.set({ muted: !sounds.engine.settings.muted }); say(sounds.engine.settings.muted ? 'Sound off (N).' : 'Sound on (N).', 2); }
    if (controls.tap('KeyB')) { sounds.engine.set({ music: !sounds.engine.settings.music }); say(sounds.engine.settings.music ? 'Music on (B).' : 'Music off (B).', 2); }
    if (controls.tap('Backquote')) debug.toggle();
    body.invulnerable = debug.invulnerable;
    if (debug.tireless) body.stamina = MOVE.stamina;
    if (body.dead && controls.tap('KeyR')) { body = nextGrandchild(); fauna = new Fauna(level); campfire = new Campfire(level, MOVE.maxHealth, MOVE.stamina); pack = new Pack(); gear = new Gear(); cooked = new Cooked(); practice = new Practice(); explored = new Explored(); picking = null; saltLine.circle = null; }
    const now = timer.getElapsed();
    const busy = climb.active || body.dead || body.mode !== 'walk' || picking !== null;
    const knife = cooked.knife, pound = cooked.tenderising;
    const stabDur = striking === 'pound' ? POUND.dur : STAB.dur * knife.time, stabHit = striking === 'pound' ? POUND.hit : STAB.hit * knife.time;
    const canStrike = !busy && !tinView.open && !body.rolling && now - stabAt > stabDur;
    if (controls.tap('Mouse0') && canStrike) stab(now);
    // Grandma's Tenderising: V brings the knife's handle down overhead.
    if (controls.tap('KeyV') && pound && canStrike) {
      if (body.stamina < POUND.stamina) say('Too out of breath to put your back into it.', 2);
      else { body.stamina -= POUND.stamina; stab(now, 'pound'); }
    }
    // Grandma's Second Helpings: the right mouse button throws a knife.
    const every = cooked.helpings;
    const canThrow = !busy && !tinView.open && !body.rolling && released && now - throwAt > THROWING.dur;
    if (controls.tap('Mouse2') && every !== null && canThrow && now - throwAt > every) { throwAt = now; released = false; tossing = 'knife'; }
    // Grandma's Sunday Candle: G tosses a lit candle (as many burning at once as the card's rank).
    if (controls.tap('KeyG') && canThrow && thrown.candles.length < cooked.candles) { throwAt = now; released = false; tossing = 'candle'; }
    // Grandma's Duck card: Q rolls the way you are going (back, standing still).
    const duck = cooked.duck;
    if (controls.tap('KeyQ') && duck && !busy && !tinView.open && !body.rolling) {
      const f = input.forward || input.right ? input.forward : -1, rt = input.right;
      const dx = -Math.sin(cam.yaw) * f + Math.cos(cam.yaw) * rt, dz = -Math.cos(cam.yaw) * f - Math.sin(cam.yaw) * rt;
      if (body.roll(dx, dz, duck.stamina * practice.less('footwork'), duck.safe)) { rollAt = now; practised('footwork'); }
    }
    // Grandma's Way Home: H, eyes shut, nothing after you; home to her armchair, or (rank 2, from her salt circle) back down.
    if (controls.tap('KeyH') && cooked.wayHome && homeTo === null && !busy && !tinView.open) {
      const back = level.depth === 0 && cooked.wayHome >= 2 && campfire.inHaven(body);
      const why = fauna.after(body) ? 'Not with something after you.' : !body.grounded ? 'Not in mid-air.' : level.depth === 0 && !back ? (cooked.wayHome >= 2 && reached > 0 ? 'Stand in her salt circle to think of where you were.' : 'You are home.') : back && reached === 0 ? 'You have not been down yet.' : '';
      if (why) say(why, 2.5);
      else { homeAt = now; homeMote = now; homeTo = back ? reached : 0; say(back ? 'You shut your eyes and think of where you were.' : 'You shut your eyes and think of her armchair.', WAY_HOME.dur); }
    }
    // Grandma's Salt Line: L, kneeling, pours a circle of salt round you.
    const line = cooked.saltLine;
    if (controls.tap('KeyL') && line && !busy && !tinView.open && !body.rolling && homeTo === null && !saltLine.pouring(now)) {
      const why = saltLine.whyNot(level, body.x, body.z, line.r, body.grounded);
      if (why) say(why, 2.5);
      else { saltLine.pour(level, body.x, body.z, line.r, line.keeps, now); say('You kneel and pour the salt round you, in one go, no gaps.', SALT_LINE.pour); }
    }
    const nearLadder = climb.active ? null : atLadder();
    const nearFind = busy || nearLadder || !body.grounded ? null : finds.inReach(body.x, body.y, body.z);
    const writing = level.writing, note = writing?.at, nearNote = !busy && !nearLadder && !nearFind && !!note && Math.hypot(note[0] - body.x, note[2] - body.z) < CAMP.reach && Math.abs(note[1] - body.y) < 1.5;
    const atShop = (shop: 'pawn' | 'hardware') => {
      if (level.depth !== 0 || busy || nearLadder || nearFind || nearNote || !body.grounded) return false;
      const d = shopDoor(shop);
      return Math.hypot(d.x - body.x, d.z - body.z) < PAWN.reach;
    };
    const nearPawn = atShop('pawn'), nearKemal = atShop('hardware');
    const nearWeber = level.depth === 0 && !busy && !nearLadder && !nearFind && !nearNote && body.grounded && weber.canHear(body.x, body.y, body.z);
    const nearDoor = busy || nearLadder || nearFind || nearNote || !body.grounded ? null : doors.near(body.x, body.y, body.z);
    // Kemal's counter: 1, 2, 3 buy what is on it.
    if (nearKemal) GEAR_ORDER.forEach((k, i) => {
      if (!controls.tap(`Digit${i + 1}`)) return;
      const r = gear.buy(k, euros);
      if (r.euros !== euros) readAt = now; // (stooping over his counter)
      euros = r.euros;
      say(r.line, 6);
    });
    // Grandma's tin, open by the fire: choose a card, cook it.
    if (tinView.open) {
      if (controls.tap('KeyT') || controls.tap('Escape') || !campfire.resting || body.dead) tinView.hide();
      else {
        const order = TinView.order(cooked), at = order.indexOf(tinSel);
        let why: string | null = null, redraw = false;
        if (controls.tap('KeyW')) { tinSel = order[(at + order.length - 1) % order.length]; redraw = true; }
        if (controls.tap('KeyS')) { tinSel = order[(at + 1) % order.length]; redraw = true; }
        if (controls.tap('KeyE')) {
          why = cooked.cantCook(tinSel, tin, tin.deepest);
          if (!why) {
            const r = cooked.cook(tinSel, tin), c = card(tinSel), fire = campfire.fire ?? (campfire.inHaven(body) ? level.haven : null);
            cookAt = now;
            tinView.hide();
            say(r === 1 ? `${c.title}, cooked.\n${c.method}` : `${c.title}, rank ${r}.\n${c.ranks[r - 2]}`, 6);
            if (fire) drift.burst(fire.x, fire.y + 0.3, fire.z, 2, now);
          }
        }
        if (tinView.open && (redraw || why)) tinView.show(cooked, tin, tinSel, why, practice);
      }
    } else if (controls.tap('KeyT') && campfire.resting) {
      if (!cooked.has(tinSel)) tinSel = TinView.order(cooked)[0];
      tinView.show(cooked, tin, tinSel, null, practice);
    }
    if (controls.tap('KeyE')) {
      if (nearLadder) climbFrom(nearLadder);
      else if (nearFind) pickUp(nearFind, now);
      else if (nearWeber) say(weber.talk({ deepest: tin.deepest, fallen: fallen.length }, now), 7);
      else if (nearPawn && pack.items.length) {
        const r = sell(pack, sales++);
        euros += r.paid; readAt = now; // (stooping over her counter)
        sounds.play('coins');
        say(r.line, 6);
      } else if (nearDoor) {
        const line = doors.toggle(nearDoor, now);
        if (line) say(line, 4);
      } else if (nearNote) {
        const found = writing!.kind !== 'letter' && cooked.find('salt-line');
        readAt = now; say(writing!.kind === 'letter' ? notaryLetter(heir, params.seed) : `Grandma's handwriting, young and fast:\n\n${NOTE.join('\n\n')}${found ? `\n\nUnder the thermos, a card torn out of her tin: ${card('salt-line').title}. Cook it at a fire.` : ''}`, 20);
        gained(tin.camp(level.depth), note[0], note[1], note[2], now);
      }
    }
    const kindling = campfire.kindling(now);
    if (controls.tap('KeyC') && !busy && body.grounded && kindling < 0) {
      const why = campfire.whyNot(body, body.facing, fauna.after(body), now);
      if (why) say(why, 2.5); else { campfire.light(body, body.facing, now); sounds.play('fire_light'); }
    }
    const stirring = now - cookAt < COOK.dur || saltLine.pouring(now);
    if (picking || now - readAt < PICKUP.dur || campfire.kindling(now) >= 0 || tinView.open || stirring || homeTo !== null) input.forward = input.right = 0; // stooping or kneeling, not walking
    // Grandma's Pot Lid: hold X to keep it up between you and whatever it is.
    const lid = cooked.lid;
    body.lid = lid && { through: lid.through, cost: lid.cost * practice.less('guard') };
    nobody.lid = !!cooked.lid;
    body.guarding = !!cooked.lid && controls.held('KeyX') && !busy && !tinView.open && !body.rolling && homeTo === null && now - stabAt > stabDur;
    if (body.guarding) blockAt = now - blockAt > BLOCK.dur ? now : now - blockAt > BLOCK.hold ? now - BLOCK.held : blockAt;
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
      doors.step(dt, now, body.x, body.y + MOVE.stepOver, body.y + MOVE.height, body.z, MOVE.radius, view.props.blockers);
      for (acc += dt; acc >= STEP; acc -= STEP) body.step(level, input, STEP, view.props.blockers);
      // At the top of a climb: pull up over the edge (played out, then the body stands on the ledge).
      if (body.ledge) {
        climb.play([{ kind: 'ledge', ledge: body.ledge, feet: body.y }], body.x, body.y, body.z, body.facing);
        onLanded = () => body.overLedge();
      }
      const stabbing = now - stabAt < stabDur, throwing = now - throwAt < THROWING.dur;
      if (stabbing) body.facing = stabYaw;
      if (throwing || body.guarding) body.facing = cam.yaw;
      if (!released && now - throwAt >= THROWING.release) {
        released = true;
        const hx = body.x - Math.sin(cam.yaw) * 0.3, hy = body.y + 1.45, hz = body.z - Math.cos(cam.yaw) * 0.3;
        sounds.play('throw', null, 0.8, tossing === 'knife' ? 1.1 : 0.85);
        if (tossing === 'knife') thrown.throw(hx, hy, hz, cam.yaw, foes());
        else thrown.toss(hx, hy, hz, cam.yaw);
      }
      thrown.power = practice.more('throwing');
      const hit = thrown.fly(level, foes(), blows, dt);
      if (hit.length) practised('throwing', hit.length);
      const candles = thrown.candles;
      fauna.glare = candles;
      fauna.salt = saltLine.keeping(now);
      view.props.loose = new Float32Array(candles.flatMap((c) => [c.x, c.y + 0.35, c.z]));
      if (picking && now - pickAt >= PICKUP.at && !finds.taken.has(picking.id)) {
        finds.take(picking);
        sounds.play('pickup');
        pack.add(picking);
        say(`You pick up ${FINDS[picking.kind].name}.`, 3);
      }
      const reading = now - readAt < PICKUP.dur, stooping = picking !== null || reading;
      if (picking && (now - pickAt >= PICKUP.dur || body.dead)) picking = null;
      if (!stabDone && now - stabAt >= stabHit) {
        stabDone = true;
        if (striking === 'pound' && pound) {
          const b = blowFrom(body, stabYaw, POUND), near = nearestReached(b, foes());
          const struck = pound.all ? foes().filter((f) => reach(b, f)) : near ? [near] : [];
          for (const r of struck) sounds.play('pound', r);
          for (const r of struck) damage(r, blows.range(pound.damage[0], pound.damage[1]) * knife.damage * gear.edge * practice.more('knife'), body.x, body.z, POUND.knock, 'knife');
          if (struck.length) practised('knife');
        } else {
          const r = nearestReached(blowFrom(body, stabYaw, STAB), foes());
          if (r) { damage(r, blows.range(STAB.damage[0], STAB.damage[1]) * knife.damage * gear.edge * practice.more('knife'), body.x, body.z, STAB.knock, 'knife'); practised('knife'); }
          if (r) { const skid = 'took' in r && r.took < 1; sounds.play(skid ? 'pick_work' : 'pound', r, skid ? 0.6 : 0.8, skid ? 1.4 : 1.3); }
          if (r && 'took' in r && r.took < 1) say('The knife skids off the salt on his chest.', 2);
        }
      }
      const health = body.health;
      fauna.blockers = view.props.blockers;
      view.camera.getWorldDirection(lampDir);
      if (view.carrier) [lamp.x, lamp.y, lamp.z] = [view.carrier.x, view.carrier.y, view.carrier.z];
      [lamp.dx, lamp.dy, lamp.dz] = [lampDir.x, lampDir.y, lampDir.z];
      const struck = fauna.advance(dt, body, lamp, body.facing);
      for (const f of fauna.fallen()) gained(tin.killed(f.kind), f.x, f.y + 0.2, f.z, now);
      if (body.health < health) {
        // Flinch away from the nearest foe (thrown back by a pick).
        let near: Foe | undefined, nd = Infinity;
        for (const r of foes()) { const d = Math.hypot(r.x - body.x, r.z - body.z); if (!r.dead && d < nd) { nd = d; near = r; } }
        if (near) nobody.hit(body.x - near.x, body.z - near.z, struck ? 1 : 0.5);
      }
      // The knife comes out when something is after the nobody or it is used, and goes back after a while.
      const threat = fauna.after(body);
      body.climbCost = cooked.climbing * practice.less('climbing') * gear.climb;
      body.armour = gear.armour;
      // Practice: metres climbed, and blows the lid stopped.
      if (body.mode === 'climb') climbed += Math.max(0, body.y - climbY);
      climbY = body.y;
      if (climbed >= 1) { practised('climbing', Math.floor(climbed)); climbed -= Math.floor(climbed); }
      if (body.blockedAt !== blockedAt) { if (body.blockedAt > blockedAt) practised('guard'); blockedAt = body.blockedAt; }
      body.tiptoe = cooked.tiptoe;
      campfire.soup = cooked.soup;
      campfire.step(body, threat, now, dt);
      if (homeTo !== null) {
        const t = now - homeAt;
        if (threat || body.dead || body.health < health) { homeTo = null; fade.style.opacity = '0'; say('Something is coming. You cannot think of the armchair now.', 3); }
        else if (t >= WAY_HOME.dur) {
          const to = homeTo;
          homeTo = null;
          show(new Level(params.seed, to, params.style));
          const hp = body.health, st = body.stamina;
          body = arrive(null);
          body.health = hp; body.stamina = st;
          if (to === 0) body.facing = cam.yaw = CELLAR.start.yaw;
          notice = levelName(level);
          noticeUntil = now + 5;
          fadeIn = 0.8;
        } else {
          fade.style.opacity = String(Math.max(0, (t - (WAY_HOME.dur - WAY_HOME.fade)) / WAY_HOME.fade));
          // The salt in the floor rises round the nobody.
          if (now >= homeMote) { homeMote = now + WAY_HOME.motes; drift.burst(body.x, body.y + 0.05, body.z, 1, now); }
        }
      }
      const lighting = campfire.kindling(now);
      const blocking = now - blockAt < BLOCK.dur;
      const ready = body.mode === 'walk' && !body.dead && (threat || now - stabAt < 4 || blocking);
      const action = lighting >= 0 ? { id: 'harvest', t0: now - lighting, dur: FIRE.kindle } : saltLine.pouring(now) ? { id: 'harvest', t0: saltLine.circle!.at, dur: SALT_LINE.pour } : stirring ? { id: 'harvest', t0: cookAt, dur: COOK.dur } : body.rolling ? { id: 'roll', t0: rollAt, dur: MOVE.roll.dur } : throwing ? { id: 'throw', t0: throwAt, dur: THROWING.dur } : stooping ? { id: 'pickup', t0: reading ? readAt : pickAt, dur: PICKUP.dur } : stabbing ? { id: striking === 'pound' ? 'slam' : 'swing_1h', t0: stabAt, dur: stabDur } : blocking ? { id: 'block', t0: blockAt, dur: BLOCK.dur } : undefined;
      nobody.pose(body, dt, now, action, ready && !stooping && lighting < 0, (campfire.resting || homeTo !== null) && !stabbing ? 'crouch' : undefined);
      pain.style.opacity = String(body.dead ? 0 : Math.max(0, 1 - (body.time - body.hurtAt) / 0.45) * 0.8);
      if (fadeIn > 0) { fadeIn = Math.max(0, fadeIn - dt); fade.style.opacity = String(fadeIn / 0.8); }
    }

    ratView.draw(fauna.rats.list, now, body);
    touchedView.draw(fauna.touched.list, body.x, body.z, dt, now);
    foremanView.draw(fauna.foreman.list[0] ?? null, fauna.foreman.hall, dt, now);
    const rung = fauna.foreman.list[0]?.rung ?? 0;
    if (rung > bells) say('A bell rings out through the halls. Something answers it.', 4);
    bells = rung;
    cricketView.draw(fauna.crickets.list, now, body);
    slimeView.lumen.draw(fauna.lumen.list, now, body);
    slimeView.murk.draw(fauna.murk.list, now, body);
    dogView.draw(fauna.dogs.list, now, body);
    eelView.draw(fauna.eels.list, now, body);
    scavengerView.draw(fauna.scavengers.list, body.x, body.z, dt, now);
    if (fauna.scavengers.calls > calls) say(fauna.scavengers.said, 3.5);
    calls = fauna.scavengers.calls;
    tallView.draw(fauna.tall.list, body.x, body.z, dt, now);
    if (level.depth === 0) weber.turn(body.x, body.z, dt);
    neighbourView.people.draw(level.depth === 0 ? [weber] : [], body.x, body.z, dt, now);
    if (fauna.tall.stares > stares) say('The Tall One looks at you, and the cold of it goes right through you.', 3);
    stares = fauna.tall.stares;
    const fire = campfire.fire, lit = campfire.kindling(now);
    hearth.root.visible = !!fire;
    doorView.draw();
    if (fire) { hearth.root.position.set(fire.x, fire.y, fire.z); hearth.flicker(now, lit >= 0 ? (lit / FIRE.kindle) ** 2 * 0.5 : campfire.left(now)); }
    findView.draw(finds.near(body.x, body.z, PICKUP.shown, shownFinds), now);
    drift.stream(now, body.x, body.y + 1, body.z);
    thrownView.arrange(thrown.missiles, now);
    saltLineView.draw(saltLine, level, now);
    nobody.shown = !cam.firstPerson;
    cam.follow(body.x, body.y + 1.6, body.z, dt);
    // The map: mark the floor round the nobody seen, now and then; draw it while open.
    if (timer.getElapsed() - exploredAt > 0.3 && !climb.active && !body.dead) { exploredAt = timer.getElapsed(); explored.see(level, body.x, body.y, body.z); }
    mapView.draw(level, explored, body.x, body.y, body.z, cam.yaw, campfire.burning(timer.getElapsed()) ? campfire.fire : null, timer.getElapsed());
    const lines = [fauna.bossLine(body), timer.getElapsed() < noticeUntil ? notice : '', now < gainUntil ? gainLine : ''];
    if (nearLadder) lines.push(nearLadder.up ? 'E: climb up the ladder' : 'E: climb down the ladder');
    else if (nearFind) lines.push(`E: pick up ${FINDS[nearFind.kind].name}`);
    else if (nearWeber) lines.push(weber.talking(now) ? '' : 'E: call on Frau Weber');
    else if (nearKemal) lines.push(`Kemal's hardware store (purse €${euros}): ` + GEAR_ORDER.map((k, i) => `${i + 1} ${GEAR[k].name} €${GEAR[k].price}${gear.owned.has(k) ? ' (yours)' : ''}`).join(' · '));
    else if (nearPawn) lines.push(pack.items.length ? `E: sell your finds to Ilse (about €${pack.worth})` : 'Ilse\'s pawn shop. You have nothing to sell her yet.');
    else if (nearDoor) lines.push(`E: ${nearDoor.want ? 'shut' : 'open'} ${nearDoor.spec.name}`);
    else if (nearNote && timer.getElapsed() >= noticeUntil) lines.push(writing!.kind === 'letter' ? 'E: read the notary\'s letter' : 'E: read the note');
    else if (campfire.resting && !tinView.open) lines.push(`Resting ${campfire.inHaven(body) ? 'in grandma\'s salt circle' : 'by the fire'}. T: open grandma's tin (${tin.salt} salt)`);
    else if (!body.dead && !climb.active && body.grounded && body.health < MOVE.maxHealth * 0.7 && !campfire.burning(timer.getElapsed()) && !fauna.after(body)) lines.push('C: light a fire and rest');
    else if (!body.dead && !climb.active) {
      const s = level.descents.nearest(body.x, body.z, DRAFT_RANGE);
      const draft = s && draftLine(body.x, body.z, cam.yaw, s.x, s.z);
      if (draft) lines.push(draft);
    }
    if (debug.invulnerable || debug.tireless) lines.push(`debug: ${[debug.invulnerable && 'invulnerable', debug.tireless && 'tireless'].filter(Boolean).join(', ')}`);
    lines.push(...fauna.tally(), `infused salt in grandma's tin: ${tin.salt}`, euros ? `euros in grandma's purse: €${euros}` : '');
    if (pack.items.length) lines.push(`pack: ${pack.items.length} ${pack.items.length === 1 ? 'find' : 'finds'}, worth about €${pack.worth} at the pawn shop`);
    if (hud) hud.textContent = hudText(body, backend, body.dead ? notaryList(fallen, heir + 1, params.seed) : []) + `\n${view.stage.hudLine()}\n\n${lines.filter(Boolean).join('\n')}`;
    // The headlamp: above the head and a little towards where one looks (the camera, not the
    // body: standing and looking round, the figure would shade its own way).
    view.carrier!.set(body.x - Math.sin(cam.yaw) * 0.4, body.y + (body.mode === 'swim' ? 0.45 : 1.85), body.z - Math.cos(cam.yaw) * 0.4);
    view.frame(body.x, body.y, body.z, timer.getElapsed());
    view.camera.getWorldDirection(lampDir);
    const ear = view.camera.position;
    sounds.update({
      dt, body, level, fauna, doors: doors.list, fire: campfire.burning(timer.getElapsed()) ? campfire.fire : null,
      resting: campfire.resting, ladder: climb.active, ear: { x: ear.x, y: ear.y, z: ear.z, fx: lampDir.x, fy: lampDir.y, fz: lampDir.z },
    });
    (globalThis as { __ready?: boolean }).__ready = view.settled;
    controls.endFrame();
  });
}

function levelName(level: Level): string {
  return level.depth ? `Level ${level.depth} · ${level.band.name}` : level.band.name;
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

/** The HUD; `list`: the notary's list, shown on the death screen (its last line the next heir). */
function hudText(b: Body, backend: string, list: readonly string[]): string {
  const lines = [
    `health   ${bar(b.health, MOVE.maxHealth)}  ${b.health.toFixed(0)}`,
    `stamina  ${bar(b.stamina, MOVE.stamina)}${b.mode === 'climb' ? '  climbing' : b.mode === 'swim' ? '  swimming' : ''}`,
  ];
  if (b.time - b.hurtAt < 2 && !b.dead) lines.push(`${HURT[b.lastCause]?.[0] ?? 'a hard landing'}: -${b.lastHurt.toFixed(0)}`);
  if (b.dead) lines.push('', HURT[b.lastCause]?.[1] ?? 'You fell to your death.', '', 'Herr Brüggemann crosses out another name and writes another letter.', ...list.map((l) => `    ${l}`), '', 'Grandma\'s knife block has another knife: press R to send the next grandchild down.');
  lines.push('', `click: mouse look, then stab · WASD move · Shift run · Space jump · walk into rock to climb · E climb a ladder or pick up · wheel zoom · F light · M map · N sound · B music · \` debug  ·  ${backend}`);
  return lines.join('\n');
}
