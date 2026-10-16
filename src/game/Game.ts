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
import { ReadView } from '../app/readView';
import { DiaryView } from '../app/diaryView';
import { GRANDMA_KERF, Key } from '../lore/key';
import { letter, breakLines } from '../lore/scripts';
import { canRead } from '../gen/inscriptions';
import { CELLAR } from '../gen/cellar';
import { shopDoor } from '../gen/town';
import { PAWN, sell } from '../loot/pawn';
import { GEAR, GEAR_ORDER, buyGear, hasGear, kitFromGear } from '../loot/hardware';
import { Kit, isItem, packRows, rummage } from '../loot/items';
import { fallenAt, heirName, notaryLetter, notaryList, type Fallen } from '../gen/notary';
import { DeathView, DEATH, NEXT } from '../app/deathView';
import { deathLine, hurtLine, runEnd } from './runEnd';
import { Level } from '../gen/level';
import { CAMP, NOTE, RUBBING } from '../gen/grandmasCamp';
import { Body, MOVE, type BodyInput } from '../world/traverse/body';
import { LevelView } from '../render/LevelView';
import { OrbitCamera } from '../render/camera/OrbitCamera';
import { Nobody } from '../render/humans/nobody';
import { Controls } from '../input/controls';
import { Bindings, keyLabel } from '../input/bindings';
import { readGraphicsSettings, readKeySettings, writeGraphicsSettings, writeKeySettings } from '../persist/settings';
import { QUALITY_NOTES } from '../render/quality';
import { SettingsView } from '../app/settingsView';
import { parseViewParams, titleWanted } from '../app/params';
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
import { ShroomView } from '../render/creatures/shroomView';
import { DogView } from '../render/creatures/dogView';
import { HerdView } from '../render/creatures/herdView';
import { Rigged } from '../render/creatures/rigged';
import { EelView } from '../render/creatures/eelView';
import { ScavengerView } from '../render/creatures/scavengerView';
import { GoblinView } from '../render/creatures/goblinView';
import { GhostView } from '../render/creatures/ghostView';
import { NeighbourView } from '../render/humans/neighbourView';
import { Neighbour, WEBER_KEY } from '../world/neighbour';
import { Stranger, STRANGER_KEY } from '../world/stranger';
import { Grandma, GRANDMA, GLIMPSES, NAMES_NEAR, RING_SIGHT } from '../world/grandma';
import { TallOneView } from '../render/creatures/tallOneView';
import { Hearth, hearthParts } from '../render/props/hearth';
import { Campfire, FIRE } from '../world/fire';
import { Doors } from '../world/doors';
import { DoorView } from '../render/props/doorView';
import { PROPS_RADIUS } from '../render/props/Props';
import { PROP_TILE } from '../gen/propGrid';
import { STAB, blowFrom, damage, nearestReached, reach } from '../combat/combat';
import { Rng, angleDiff, deriveSeed } from '@futuremagic/core';
import { Finds, Pack, FINDS, PACK, type Find } from '../loot/finds';
import { FindView } from '../render/loot/findView';
import { Tin, type Gain } from '../loot/tin';
import { CARDS, Cooked, SALT_RINGS, card, type CardId } from '../loot/recipes';
import { DebugMenu } from '../app/debugMenu';
import { DEBUG_STYLES, depthWithStyle, placesOn, styleSpot, type Place } from './debugPlaces';
import type { StyleId } from '../gen/style';
import { positionReport, readPosition } from './report';
import { VERSION } from '../app/whatsNew';
import { playTitle } from './title';
import { levelName } from './titleShots';
import { SALT_LINE, SaltLine } from '../world/saltLine';
import { SaltLineView } from '../render/props/saltLine';
import { growthAt, setGrowth } from '../app/growth';
import { TinView } from '../app/tinView';
import { PackView } from '../app/packView';
import { SpellView } from '../render/spells';
import { SnapdragonView } from '../render/snapdragons';
import { Snapdragons } from '../combat/snapdragon';
import { Horseradish } from '../combat/horseradish';
import { HorseradishView } from '../render/horseradish';
import { SaltDrift } from '../render/loot/saltDrift';
import { WispView } from '../render/creatures/wispView';
import { Wisps } from '../creatures/wisps';
import { THROW, Thrown } from '../combat/thrown';
import { FLOUR, Flour } from '../combat/flour';
import { GameSounds } from '../audio/gameSounds';
import { ThrownView } from '../render/humans/thrownView';
import { AbilityBar, type SlotState } from '../app/abilityBar';
import { ABILITIES, FIXED_KEYS, KEY_ACTIONS, MainBar, SLOT_KEYS, barOf, passivesOf, useOf, type Ability } from './abilities';
import { TargetMark } from '../app/targetMark';
import { Hud, keysOf } from '../app/hud';
import { LetterView } from '../app/letterView';
import { PauseMenu } from '../app/pauseMenu';
import { pageId } from '../lore/diary';
import { candidates, keeps, nextTarget, yawTo } from './target';
import { Prologue, Walk } from './prologue';
import { FirstSteps, type StepId } from './firstSteps';
import { PrologueView } from '../app/prologueView';
import { StepsView } from '../app/stepsView';
import type { LoadingScreen } from '../app/loadingScreen';
import { heard, tipOf, type DripLook } from '../gen/drips';
import { ThinPlaces } from '../world/thinPlaces';
import { ThinView } from '../render/thinView';

/** Fixed simulation step, seconds. */
const STEP = 1 / 120;
/** How close to where one gets on a ladder the nobody must stand to climb it, metres. */
const LADDER_REACH = 1.6;
/** How much of the ladder is climbed on each level when going from one to the other, metres. */
const CLIMB_SHOWN = 4.5;
/** Living stalagmites' drops are heard this close (m). */
const DRIP_HEARD = 22;
/** Grandma's Tenderising (V): an overhead blow with the knife's handle, slower, wider, knocking far back; its stamina (damage: the card's). */
/** Grandma's salt-magic: Stove Flame's sweep and stamina, Cold Larder's, Rolling Pin's (how far, how much and how often: the card's); how long the nobody's cast pose lasts. */
const FLAME = { arc: 0.45, low: -0.3, high: 2, knock: 2, stamina: 3 };
const LARDER = { stamina: 3, every: 8 };
const PIN = { arc: 0.75, low: -0.3, high: 2, damage: [2, 4] as const, stamina: 2.5, every: 3 };
const CAST = { dur: 0.5, glints: 8 };
/** Grandma's Snapdragons (U): the stamina a seed costs (what the plant does and how often: the card's). */
const SEED = { stamina: 2 };
/** Grandma's Horseradish: the stamina a root costs; how often the earth it throws up is drawn, per second (what it does and how often: the card's). */
const ROOTING = { stamina: 2, crumbs: 10 };
/** Grandma's Flour Bag (Y): the stamina a bag costs; her Matchstick (middle mouse): how far off its aim may be from where one looks for a cloud to flick it at, radians. */
const FLOURING = { stamina: 2, arc: 0.6 };
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
/** Arriving on a level: the screen stays black (and the world still) until its rock is on screen, at most `cap` seconds. */
const ARRIVE = { cap: 30 };

export async function startGame(host: HTMLElement, loading: LoadingScreen): Promise<void> {
  const params = parseViewParams(location.search);
  loading.step('Laying out the level', 0.03);
  // Kept between visits (src/persist/save.ts), unless the URL picks a depth or a place (a test view) or asks for a fresh start.
  const q = new URLSearchParams(location.search), keep = !q.has('depth') && !q.has('pos');
  const saved = keep && !q.has('fresh') ? readSave(params.seed) : null;
  let level = new Level(params.seed, saved?.child?.depth ?? params.depth, params.style);
  setGrowth(growthAt(level.depth));
  const { view, canvas, backend } = await LevelView.open(host, level, { forceWebGL: params.forceWebGL });
  loading.step('Dressing the figures', 0.08);
  view.headlampPower = { survey: 14, dark: 3.5 };
  view.dark = !params.light; // the game is dark; ?light for the survey view
  view.carrier = new Vector3(); // the headlamp is on the nobody's forehead
  let graphics = readGraphicsSettings();
  view.quality = graphics.quality;
  // Reduced motion: the interface's own animations keep still under this class (as under prefers-reduced-motion).
  document.documentElement.classList.toggle('ui-still', graphics.still);
  const controls = new Controls(canvas);
  /** The player's own keys (the settings): the game asks for an action by its own key, the controls answer with the key moved onto it. */
  const bindings = new Bindings(KEY_ACTIONS.map((a) => a.key), FIXED_KEYS, readKeySettings());
  controls.bind(bindings);
  /** What the key for `action` is called now. */
  const keyName = (action: string): string => keyLabel(bindings.keyOf(action));
  const cam = new OrbitCamera(view.camera, level);
  if (params.look) [cam.yaw, cam.pitch] = [(params.look[0] * Math.PI) / 180, (params.look[1] * Math.PI) / 180];

  /** A body where one arrives on the current level (or at ?pos on the first). */
  const arrive = (pos: [number, number, number] | null = params.pos): Body => {
    const [x, , z] = pos ?? level.arrival;
    return new Body(x, pos ? pos[1] : level.groundAt(x, z) + 0.2, z);
  };
  let fauna: Fauna;
  /** The lights rising out of the glowing rock (src/creatures/wisps.ts). */
  let wisps: Wisps;
  /** Glimpses of other worlds opening in the air (src/world/thinPlaces.ts). */
  let thin: ThinPlaces;
  const saltLine = new SaltLine();
  /** Finds taken so far, per level: they stay taken for every grandchild (D13). */
  const taken = new Map<number, Set<number>>(saved?.taken.map(([d, ids]) => [d, new Set(ids)]) ?? []);
  let finds: Finds;
  const findsOf = (l: Level): Finds => {
    if (!taken.has(l.depth)) taken.set(l.depth, new Set());
    return new Finds(l, (i, j) => fauna.rats.denAt(i, j), taken.get(l.depth)!);
  };
  let pack = new Pack();
  /** What the grandchild wears and holds (src/loot/items.ts; an older save: what they bought at Kemal's). */
  let kit = saved?.child?.kit ? new Kit(saved.child.kit) : kitFromGear(saved?.child?.gear ?? []);
  for (const f of saved?.child?.pack ?? []) pack.add(f);
  for (const it of saved?.child?.spare ?? []) if (isItem(it)) pack.stow(it);
  /** Grandma's tin: the infused salt outlives every grandchild. */
  let tin = saved ? Tin.from(saved.tin) : new Tin();
  tin.deepest = Math.max(tin.deepest, level.depth);
  /** The cards this grandchild has cooked (the next one starts with none). */
  let cooked = saved?.child ? Cooked.from(saved.child.cooked) : new Cooked();
  /** This grandchild's main bar: the cards used through 1–8. */
  let mainBar = MainBar.from(saved?.child?.bar, cooked);
  /** What this grandchild has practised (the next one starts at none). */
  let practice = saved?.child ? Practice.from(saved.child.practice) : new Practice();
  /** What this grandchild has seen of each level (the map, M). */
  let explored = saved?.child?.explored ? Explored.from(saved.child.explored) : new Explored();
  let exploredAt = 0;
  /** Metres climbed not yet counted as practice, and the height the climb was at last frame. */
  let climbed = 0, climbY = 0, blockedAt = -Infinity;
  /** Waiting for a level's rock to stream in (since `arrivedAt`, seconds): the screen is black and nothing moves. */
  let arriving = false, arrivedAt = 0;
  /** The level's own animals on screen (made before the warm-up, below). */
  let herdView: HerdView | null = null;
  const show = (l: Level) => {
    // Back up from below into her cellar: grandma may have a word.
    if (l.depth === 0 && level.depth > 0) grandma.arrive(heir);
    below = null;
    level = l;
    setGrowth(growthAt(l.depth));
    arriving = true;
    arrivedAt = performance.now() / 1000;
    fauna = new Fauna(l);
    wisps = new Wisps(l);
    thin = new ThinPlaces(l);
    herdView?.stock(l, fauna.critters.species);
    saltLine.circle = null;
    campfire = new Campfire(l, MOVE.maxHealth, MOVE.stamina);
    doors = new Doors(l.doors);
    doorsMet = '';
    doorView.hang(doors.list);
    doors.into(view.props.blockers);
    if (l.depth === 0) view.props.blockers.set(WEBER_KEY, weber.blocker); else view.props.blockers.clear(WEBER_KEY);
    if (strangerHere()) view.props.blockers.set(STRANGER_KEY, stranger.blocker); else view.props.blockers.clear(STRANGER_KEY);
    finds = findsOf(l);
    tin.deepest = Math.max(tin.deepest, l.depth);
    reached = Math.max(reached, l.depth);
    thrown.missiles.length = 0; thrown.sown.length = 0; thrown.burst.length = 0; garden.plants.length = 0; radish.roots.length = 0; flour.clouds.length = 0;
    look(l);
  };
  /** Stream level l and point every view at it (the title looks at levels this way too). */
  const look = (l: Level): void => {
    touchedView.level = foremanView.level = scavengerView.people.level = goblinView.level = ghostView.level = neighbourView.people.level = strangerView.people.level = grandmaView.people.level = tallView.level = l;
    view.go(l);
    Rigged.kinOn(params.seed, l.depth);
    cam.level = l;
    nobody.level = l;
  };
  /** Which grandchild this is (1: the first); the notary writes to each. The deepest level this one has reached. */
  let key = new Key(saved?.key);
  let heir = saved?.heir ?? 0, reached = saved?.child?.reached ?? 0;
  /** The grandchildren who did not come back (the notary's list), and whether this one's death is on it yet. */
  const fallen: Fallen[] = [...(saved?.fallen ?? [])];
  /** Grandma's purse: euros from Ilse, kept for the family. */
  let euros = saved?.euros ?? 0, sales = 0;
  let mourned = false;
  /**
   * The introduction (src/game/prologue.ts, src/game/firstSteps.ts): a new family met on a plain
   * load (or ?intro) sees the prologue and then the first steps; a family kept from before the list,
   * or any test view, does not.
   */
  const introduce = q.has('intro') || (keep && !saved && !['seed', 'depth', 'pos', 'style'].some((k) => q.has(k)));
  let steps = FirstSteps.from(introduce ? [] : saved?.steps ?? true);
  /** The salt in the tin when this grandchild took it up (the death screen says what they added). */
  let saltAtStart = saved?.child?.saltAtStart ?? tin.salt;
  const nextGrandchild = (): Body => {
    if (level.depth !== params.depth) show(new Level(params.seed, params.depth, params.style)); // the next grandchild starts at the top
    heir++;
    reached = level.depth;
    if (level.depth === 0) grandma.arrive(heir);
    const b = arrive();
    // In grandma's cellar: by her armchair, facing the broken arch.
    if (level.depth === 0 && !params.pos) b.facing = cam.yaw = CELLAR.start.yaw;
    return b;
  };
  /** A new family (New Game over a kept one): everything kept is forgotten, the first grandchild goes down. */
  const freshFamily = (): void => {
    taken.clear();
    tin = new Tin(); key = new Key();
    pack = new Pack(); kit = new Kit(); cooked = new Cooked(); mainBar = new MainBar(); practice = new Practice(); explored = new Explored();
    heir = 0; reached = 0; euros = 0; sales = 0; saltAtStart = 0;
    fallen.length = 0;
    body = nextGrandchild();
    finds = findsOf(level);
  };
  fauna = new Fauna(level);
  wisps = new Wisps(level);
  thin = new ThinPlaces(level);
  /** The nobody's own fire to rest by (one at a time). */
  let campfire = new Campfire(level, MOVE.maxHealth, MOVE.stamina);
  /** The doors that open and shut (grandma's house). */
  let doors = new Doors(level.doors);
  /** The props tile the sheds' doors were last met from (the nobody's), so they are met once per tile walked into. */
  let doorsMet = '';
  /** Hang the doors of the sheds round the nobody, as far as the props show (new ones shut). */
  const meetDoors = () => {
    const tile = `${Math.floor(body.x / PROP_TILE)},${Math.floor(body.z / PROP_TILE)}`;
    if (tile === doorsMet) return;
    doorsMet = tile;
    const r = PROPS_RADIUS, fresh = doors.meet(level.sheds.standingIn(body.x - r, body.z - r, body.x + r, body.z + r).map((s) => s.door));
    if (!fresh.length) return;
    doorView.hangMore(fresh);
    doors.into(view.props.blockers);
  };
  /** The shed the nobody is in, if any. */
  const shedOf = () => level.sheds.holding(body.x, body.z, body.y);
  finds = findsOf(level);
  // Built before the warm-up too: the Salt-Touched are humans, compiled with the nobody.
  const touchedView = await TouchedView.create(params.seed);
  touchedView.level = level;
  const foremanView = await ForemanView.create(params.seed);
  foremanView.level = level;
  const scavengerView = await ScavengerView.create(params.seed);
  const goblinView = await GoblinView.create(params.seed);
  goblinView.level = level;
  const ghostView = await GhostView.create(params.seed);
  ghostView.level = level;
  const neighbourView = await NeighbourView.create();
  const grandmaView = await NeighbourView.grandma();
  /** Grandma's ghost, keeping the circle in the round room. */
  const grandma = new Grandma();
  /** Her ghost below, at one of her few moments there (src/world/grandma.ts GLIMPSES), while it lasts. */
  let below: Grandma | null = null;
  const strangerView = await NeighbourView.stranger(params.seed);
  const stranger = new Stranger();
  /** The stranger at Ilse's is in the town once the family has been below level 10. */
  const strangerHere = (): boolean => level.depth === 0 && Stranger.here({ deepest: tin.deepest, fallen: fallen.length });
  const weber = new Neighbour();
  scavengerView.people.level = neighbourView.people.level = strangerView.people.level = grandmaView.people.level = level;
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
      cooked: cooked.data, bar: mainBar.data, practice: practice.data, pack: [...pack.items], spare: [...pack.spare], kit: kit.data, explored: explored.data, saltAtStart,
    };
    writeSave(params.seed, { v: 1, heir, tin: tin.data, taken: [...taken].map(([d, ids]) => [d, [...ids]]), child, fallen, euros, key: key.data, steps: steps.data });
  };
  let keptAt = 0, keptDead = false;
  addEventListener('pagehide', keepGame);
  cam.follow(body.x, body.y + 1.6, body.z, 1);

  // The nobody is built before the warm-up, which compiles its materials with the rest.
  const nobody = await Nobody.create(params.seed, level);
  // The dogs too: skinned, their shaders are their own, so they compile in the warm-up with the humans.
  const dogView = await DogView.create();
  const ratView = await RatView.create();
  const cricketView = await CricketView.create();
  const slimeView = await SlimeView.create();
  const eelView = await EelView.create();
  const shroomView = await ShroomView.create();
  // The level's own animals: one stand-in through the warm-up builds the shaders every species draws with.
  const herd = new HerdView(view.stage);
  herdView = herd;
  Rigged.kinOn(params.seed, level.depth);
  nobody.pose(body, 0, 0);
  loading.step('Warming up the shaders', 0.3);
  await view.start([nobody.root, ...touchedView.figures, ...foremanView.figures, ...scavengerView.figures, ...goblinView.figures, ...ghostView.figures, ...tallView.figures, ...neighbourView.people.figures, ...strangerView.people.figures, ...grandmaView.people.figures, dogView.root, ratView.root, cricketView.root, slimeView.root, eelView.root, shroomView.root, herd.warmUp]);
  cam.blockers = view.props.blockers;
  await view.stage.add(nobody.root);
  await view.stage.add(touchedView.root);
  await view.stage.add(foremanView.root);
  await view.stage.add(scavengerView.people.root);
  await view.stage.add(scavengerView.camps.root);
  await view.stage.add(goblinView.root);
  for (const r of ghostView.roots) await view.stage.add(r);
  await view.stage.add(neighbourView.people.root);
  await view.stage.add(strangerView.people.root);
  await view.stage.add(grandmaView.people.root);
  await view.stage.add(tallView.root);
  await view.stage.add(ratView.root);
  await view.stage.add(cricketView.root);
  await view.stage.add(slimeView.root);
  await view.stage.add(dogView.root);
  await view.stage.add(eelView.root);
  await view.stage.add(shroomView.root);
  await view.stage.add(shroomView.spores.root);
  herd.stock(level, fauna.critters.species);
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
  if (strangerHere()) view.props.blockers.set(STRANGER_KEY, stranger.blocker);
  const findView = new FindView();
  await view.stage.add(findView.root);
  const drift = new SaltDrift(params.seed);
  const thinView = new ThinView();
  await view.stage.add(thinView.mesh);
  await view.stage.add(drift.root);
  const wispView = new WispView(view.lamps);
  await view.stage.add(wispView.root);
  const spells = new SpellView(params.seed);
  await view.stage.add(spells.root);
  /** Grandma's salt-magic: when each was last cast, and the last cast (its pose, and which way it went). */
  /** The last sprung jump seen (Spring in Your Step: its puff of salt). */
  let sprangSeen = -Infinity;
  let flameAt = -Infinity, larderAt = -Infinity, pinAt = -Infinity, castAt = -Infinity, castYaw = 0, casting: 'flame' | 'larder' | 'pin' | 'root' = 'flame';
  /** Knives thrown (grandma's Second Helpings), and when the last throw began. */
  const thrown = new Thrown();
  const thrownView = new ThrownView();
  await view.stage.add(thrownView.root);
  let throwAt = -9, released = true, tossing: 'knife' | 'candle' | 'seed' | 'flour' | 'match' = 'knife';
  /** Grandma's flour, hanging where her bags burst (Flour Bag), and when the last bag and the last match went. */
  const flour = new Flour();
  let flourAt = -Infinity, matchAt = -Infinity;
  /** Grandma's Snapdragons: the plants come up from seeds, and when the last seed was tossed. */
  const garden = new Snapdragons();
  const gardenView = new SnapdragonView();
  await view.stage.add(gardenView.root);
  let seedAt = -Infinity;
  /** Grandma's Horseradish: the roots tunnelling and biting, and when the last was set. */
  const radish = new Horseradish();
  const radishView = new HorseradishView();
  await view.stage.add(radishView.root);
  let radishAt = -Infinity;
  /** Grandma's Salt Line, poured (one at a time; it stays on the level it was poured on). */
  const saltLineView = new SaltLineView(SALT_RINGS.map((k) => k.r));
  await view.stage.add(saltLineView.root);
  const tinView = new TinView(document.body);
  /** The pack open (I), and the find chosen in it. */
  const packView = new PackView(document.body);
  let packSel = 0;
  const readView = new ReadView(document.body);
  const diaryView = new DiaryView(document.body);
  const mapView = new MapView(document.body);
  // The main bar: a click uses a slot (a held one, the lid, stays held until the next click).
  const abilityBar = new AbilityBar(document.body, (i) => {
    const a = barOf(mainBar)[i];
    if (!a) return;
    if (a.hold) controls.latch(a.key, !controls.isLatched(a.key));
    else controls.press(a.key);
  }, (i, id) => tinView.ask({ kind: 'slot', i, id }), keyName);
  /** At Kemal's counter (last frame): 1, 2, 3 buy there, not use the bar. */
  let atCounter = false;
  /** The Tab target (none: blows turn to the nearest foe where the camera looks), and its health when picked. */
  let target: Foe | null = null, targetFull = 1;
  const targetMark = new TargetMark(document.body);
  const hudView = new Hud(document.body);
  hudView.keys(keysOf(keyName));
  const letterView = new LetterView(document.body);
  /** The pause menu: Escape once the mouse is free (not the Escape that freed it), or its button; the game's clock stands still while it is open. */
  const goOn = (): void => { pause.hide(); canvas.requestPointerLock?.(); };
  const pause = new PauseMenu(document.body, {
    resume: goOn, paused: (on) => timer.setTimescale(on ? 0 : 1), keys: () => keysOf(keyName),
    settings: () => { pause.hide(); settingsView.toggle(); },
  });
  let freedAt = -Infinity;
  document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement) pause.hide(); else freedAt = performance.now(); });
  /** Whether this grandchild has been below the cellar (the help card shows until then). */
  let beenDown = level.depth > 0;
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
      for (const a of ABILITIES) mainBar.slotIn(a.card);
      kit = kitFromGear(GEAR_ORDER);
      return 'Every recipe card at its top rank, and all of Kemal\'s gear.';
    },
    toLevel: (d) => {
      if (!canGo()) return;
      show(new Level(params.seed, d, params.style));
      const [x, , z] = level.arrival;
      // Facing away from the ladder up, out over the level.
      const up = level.ascent, yaw = d === 0 ? CELLAR.start.yaw : up ? Math.atan2(up.x - x, up.z - z) : cam.yaw;
      putDown(x, d === 0 ? 0 : level.groundAt(x, z), z, yaw);
      announce(level);
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
    position: () => positionReport(VERSION, location.origin + location.pathname, level, body, { yaw: cam.yaw, pitch: cam.pitch, distance: cam.distance }, view.props.blockers),
    goTo: (text) => {
      const p = readPosition(text);
      if (!p?.pos) return 'No position in that (it needs the link with ?pos=).';
      if (p.seed !== params.seed) { location.search = /\?\S*/.exec(text)![0]; return 'Another seed: loading it.'; }
      if (!canGo()) return 'Not now (climbing, going home or dead).';
      if (p.depth !== level.depth || p.style !== level.style) show(new Level(params.seed, p.depth, p.style));
      const yaw = p.look ? (p.look[0] * Math.PI) / 180 : cam.yaw;
      putDown(p.pos[0], p.pos[1] - 0.2, p.pos[2], yaw);
      if (p.look) cam.pitch = (p.look[1] * Math.PI) / 180;
      debug.refresh();
      return `There: level ${p.depth}, ${p.pos.map((v) => v.toFixed(1)).join(' ')}.`;
    },
    styles: DEBUG_STYLES,
    toStyle: (s) => {
      if (!canGo()) return;
      const id = s as StyleId;
      // Here, else on the nearest level that has it, else on a level all of it (as ?style= makes).
      let p = level.depth > 0 ? styleSpot(level, id, body.x, body.z) : null;
      const d = p ? level.depth : depthWithStyle(params.seed, Math.max(1, level.depth), id);
      if (!p && d !== null) { show(new Level(params.seed, d, params.style)); p = styleSpot(level, id, level.arrival[0], level.arrival[2]); }
      if (!p) { show(new Level(params.seed, Math.max(1, level.depth), id)); p = styleSpot(level, id, level.arrival[0], level.arrival[2]); }
      const [ax, , az] = level.arrival;
      if (p) putDown(p.x, p.y, p.z, p.yaw); else putDown(ax, level.groundAt(ax, az), az, cam.yaw);
      say(`${levelName(level)}\n${p ? p.name : `no ${id} found: at the arrival`}`, 5);
    },
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
  const fade = document.createElement('div');
  fade.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none';
  host.appendChild(fade);
  // While a level streams in behind the black: a quiet line, so a long wait does not look like a hang.
  const fadeLine = document.createElement('div');
  fadeLine.style.cssText = 'position:absolute;left:0;right:0;bottom:18%;text-align:center;color:var(--ui-ink-faint);font:13px/1.4 var(--ui-font);letter-spacing:0.06em;opacity:0;transition:opacity 0.4s';
  fadeLine.textContent = 'The rock takes shape';
  fade.appendChild(fadeLine);
  // Getting hurt shows, in first person too: the edges of the view flash red.
  const pain = document.createElement('div');
  pain.style.cssText = 'position:fixed;inset:0;opacity:0;pointer-events:none;background:radial-gradient(ellipse at center,transparent 45%,rgba(150,0,0,0.85) 100%)';
  host.appendChild(pain);
  /** Sound effects, ambience and music (src/audio): N mutes everything, B turns the music off. */
  const sounds = new GameSounds(params.seed, import.meta.env.BASE_URL);
  const settingsView = new SettingsView(document.body, {
    sound: () => sounds.engine.settings,
    setSound: (s) => sounds.engine.set(s),
    actions: KEY_ACTIONS,
    bindings,
    keysChanged: () => { writeKeySettings(bindings.data); controls.bind(bindings); hudView.keys(keysOf(keyName)); },
    qualityNow: () => view.quality,
    setQuality: (q) => { view.quality = q; graphics = { ...graphics, quality: q }; writeGraphicsSettings(graphics); },
    still: () => graphics.still,
    setStill: (on) => { graphics = { ...graphics, still: on }; writeGraphicsSettings(graphics); document.documentElement.classList.toggle('ui-still', on); },
    qualityNotes: QUALITY_NOTES,
    opened: (open) => { controls.paused = open; },
  });
  loading.step('Tuning the sounds', 0.6);
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
    // Turn to the Tab target if it is in reach; else to the nearest foe roughly where the camera looks, else where it looks.
    stabYaw = cam.yaw;
    if (target && Math.hypot(target.x - body.x, target.z - body.z) < STAB.aim && Math.abs(target.y - body.y) < 1.5) { stabYaw = yawTo(target, body.x, body.z); return; }
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
  let notice = '', noticeUntil = 0;
  /** Show `text` as the notice for `secs` seconds. */
  const say = (text: string, secs: number): void => { notice = text; noticeUntil = timer.getElapsed() + secs; };
  /** The level's name as one arrives on it. */
  const announce = (l: Level, secs = 5): void => {
    if (l.depth > 0) beenDown = true;
    hudView.banner(l.depth ? `Level ${l.depth}` : '', l.band.name, timer.getElapsed(), secs);
  };
  announce(level);
  /** Times the Foreman's bell has rung (each ringing gets a notice). */
  let bells = 0, calls = 0, stares = 0, spoken = 0;
  /** A goblin's jab landed: it takes the best thing in the pack (src/creatures/goblins.ts); it drops where the goblin dies. */
  const snatch = (): Find | null => {
    if (!pack.items.length) return null;
    const best = pack.items.reduce((a, b) => (b.value > a.value ? b : a));
    pack.items.splice(pack.items.indexOf(best), 1);
    say(`A goblin snatches ${FINDS[best.kind].name} from your pack and runs!`, 3.5);
    return best;
  };
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
      announce(level);
      if (!s.up) gained(tin.reached(level.depth), body.x, body.y, body.z, timer.getElapsed());
    };
  };
  /** What to do when the climb in progress ends. */
  let onLanded: (() => void) | null = null;
  /** Seconds left of a fade in from black (a climb that came out without a ladder). */
  let fadeIn = 0;
  /** The clock at the last frame, and a look to reuse, for the living stalagmites' drops. */
  let dripThen = 0;
  const dripSeen: DripLook = { height: 0, radius: 0, sunk: 0, drip: 0, wet: 0, t: 0 };
  (globalThis as { __game?: unknown }).__game = {
    view, cam, get body() { return body; }, get nobody() { return nobody; }, get depth() { return level.depth; }, get climbing() { return climb.active; }, get rats() { return fauna.rats; }, get touched() { return fauna.touched; }, get crickets() { return fauna.crickets; }, get slimes() { return [fauna.lumen, fauna.murk]; }, get foreman() { return fauna.foreman; }, get dogs() { return fauna.dogs; }, get eels() { return fauna.eels; }, get scavengers() { return fauna.scavengers; }, get tall() { return fauna.tall; }, get toadstools() { return fauna.toadstools; }, get puffcaps() { return fauna.puffcaps; }, get finds() { return finds; }, get wisps() { return wisps; }, get thin() { return thin; }, get doors() { return doors; }, get pack() { return pack; }, get kit() { return kit; }, tin, get cooked() { return cooked; }, thrown, garden, radish, flour, saltLine, debug,
    /** The introduction: the prologue playing (null: none), and the first steps. */
    get prologue() { return prologue; }, get steps() { return steps; },
    /** Grandma's ghost in the round room. */
    grandma,
    /** Pick up the find in reach, as E would. */
    pickUp: () => { const f = finds.inReach(body.x, body.y, body.z); if (f) pickUp(f, timer.getElapsed()); return !!f; },
    /** Dress the creatures as the kin of another depth (a look at them without going down). */
    kinOn: (depth: number) => Rigged.kinOn(params.seed, depth),
    /** Stab as the mouse button would. */
    stab: () => stab(timer.getElapsed()),
    /** Press a key (an action's own key, 'Mouse1'…) for the next frame, as the bar's click does. */
    pressKey: (key: string) => controls.press(key),
    /** Bring the knife's handle down, as V would (grandma's Tenderising). */
    pound: () => stab(timer.getElapsed(), 'pound'),
    /** Wander about `steps` × 2 m on the floor from the nobody, marking it seen as walking there would (the map probe). */
    explore: (steps = 400, salt = 0) => {
      const rng = new Rng(deriveSeed(params.seed, 'explore', salt));
      let x = body.x, z = body.z, a = rng.range(0, Math.PI * 2);
      for (let s = 0; s < steps; s++) {
        a += rng.range(-0.5, 0.5);
        for (let t = 0; t < 8; t++) {
          const nx = x + Math.cos(a) * 2, nz = z + Math.sin(a) * 2, g = level.groundAt(nx, nz);
          if (Math.abs(g - level.groundAt(x, z)) < 1.5 && level.sdf(nx, g + 1, nz) > 0.3) { x = nx; z = nz; break; }
          a += rng.range(1, 2.5);
        }
        if (s % 3 === 0) explored.see(level, x, level.groundAt(x, z), z);
      }
    },
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
  /** A first step done: ticked off with a pencil. */
  const tick = (id: StepId): void => { if (steps.tick(id)) sounds.play('pencil_tick', null, 0.8); };
  const stepsView = new StepsView(document.body);
  /** The prologue playing (null: none), the shot the nobody was put into last, and its walk. */
  let prologue: Prologue | null = null, prologueShot = -1, walk = new Walk([]);
  const prologueView = new PrologueView(document.body, () => { prologue?.next(); sounds.play('paper', null, 0.5); });
  /** Start the introduction: the prologue, then the first steps from the top (a new family). */
  const beginIntro = (): void => {
    prologue = new Prologue();
    prologueShot = -1;
    steps = new FirstSteps();
    prologueView.roll();
  };
  /** The prologue played out or skipped: the nobody by grandma's armchair, the camera behind, play begins. */
  const endPrologue = (): void => {
    // Played to the end, the nobody stays where the last shot left it; skipped, by the armchair.
    const played = prologue!.t >= prologue!.span(prologue!.shots.length - 1)[0];
    prologue = null;
    prologueView.lift();
    if (!played) body = arrive(null);
    body.facing = cam.yaw = CELLAR.start.yaw;
    cam.pitch = -0.2;
    acc = 0;
    cam.follow(body.x, body.y + 1.6, body.z, 1);
    say(levelName(level), 5);
  };
  /** A frame of the prologue: the nobody walks its shot, the camera keeps to the shot's way, the captions show. */
  const prologueFrame = (dt: number, now: number): void => {
    const p = prologue!;
    controls.takeLook(); controls.takeWheel();
    if (controls.tap('Escape')) p.skip();
    else if (controls.tap('Space') || controls.tap('Enter')) { p.next(); sounds.play('paper', null, 0.5); }
    // Time stands while the place is still streaming in (behind the black).
    if (view.settled) p.advance(dt);
    if (p.done) { endPrologue(); return; }
    const f = p.frame(), shot = p.shots[f.shot];
    if (f.shot !== prologueShot) {
      prologueShot = f.shot;
      const st = shot.stand;
      body = new Body(st.x, level.groundAt(st.x, st.z) + 0.05, st.z);
      body.facing = st.yaw;
      walk = new Walk(shot.acts);
      // A page turns with each shot; the cold from the broken arch comes with the last.
      if (f.shot > 0) sounds.play(f.shot === p.shots.length - 1 ? 'draft' : 'paper', null, 0.6);
    }
    const stride = walk.stride(body.x, body.z, now);
    const door = stride.open && doors.list.find((d) => d.spec.kind === stride.open);
    if (door && !door.want) doors.toggle(door, now);
    Object.assign(input, { forward: stride.forward, right: 0, yaw: stride.yaw, sprint: false, jump: false, sneak: false });
    doors.step(dt, now, body.x, body.y + MOVE.stepOver, body.y + MOVE.height, body.z, MOVE.radius, view.props.blockers);
    for (acc += dt; acc >= STEP; acc -= STEP) body.step(level, input, STEP, view.props.blockers);
    nobody.pose(body, dt, now);
    doorView.draw();
    const c = p.camera(f.shot, f.through, [body.x, body.y + 1.45, body.z]);
    view.camera.position.set(c.eye[0], c.eye[1], c.eye[2]);
    view.camera.lookAt(c.at[0], c.at[1], c.at[2]);
    prologueView.showFrame(f.line >= 0 ? shot.lines[f.line] : '', f.caption, f.black);
    view.carrier!.set(body.x, body.y + 1.85, body.z);
    view.frame(body.x, body.y, body.z, now);
    view.camera.getWorldDirection(lampDir);
    const ear = view.camera.position;
    sounds.update({
      dt, body, level, fauna, doors: doors.list, fire: null, resting: false, ladder: false,
      ear: { x: ear.x, y: ear.y, z: ear.z, fx: lampDir.x, fy: lampDir.y, fz: lampDir.z },
    });
    (globalThis as { __ready?: boolean }).__ready = view.settled;
    controls.endFrame();
  };
  const titled = titleWanted(location.search);
  if (introduce && !titled) beginIntro(); // under the title, New Game begins it
  const deathView = new DeathView(document.body);
  /** When this grandchild died, and when the next was asked for (null: not yet); the camera's distance before death pulled it back. */
  let diedAt = 0, nextAt: number | null = null, before = cam.distance;
  /** The grandchild has died: on the notary's list (once), the camera pulled back to see them fall, the sheet laid out. */
  const mourn = (): void => {
    mourned = true;
    diedAt = timer.getElapsed();
    const f: Fallen = { heir, depth: level.depth, what: hurtLine(body.lastCause) };
    const earlier = notaryList(fallen, heir, params.seed).slice(0, -1);
    fallen.push(f);
    deathView.layOut({
      how: deathLine(body.lastCause), before: earlier, name: heirName(heir, params.seed), where: fallenAt(f), next: heirName(heir + 1, params.seed),
      end: runEnd({ tin, saltAtStart, key: key.data, euros, taken: [...taken.values()].reduce((n, ids) => n + ids.size, 0), pack, cooked, practice, kit }),
    });
    before = cam.distance;
    cam.distance = Math.max(cam.distance, 3.5);
    tinView.hide(); packView.hide(); readView.hide(); diaryView.hide();
    target = null;
    document.exitPointerLock?.();
  };
  /** The next grandchild, in the cellar, with nothing but what the family keeps. */
  const sendNextDown = (): void => {
    body = nextGrandchild();
    fauna = new Fauna(level); thin = new ThinPlaces(level); campfire = new Campfire(level, MOVE.maxHealth, MOVE.stamina);
    pack = new Pack(); kit = new Kit(); cooked = new Cooked(); mainBar = new MainBar(); practice = new Practice(); explored = new Explored();
    picking = null; saltLine.circle = null; homeTo = null; thrown.missiles.length = 0; thrown.sown.length = 0; thrown.burst.length = 0; garden.plants.length = 0; radish.roots.length = 0; flour.clouds.length = 0;
    tinSel = TinView.order(cooked)[0];
    saltAtStart = tin.salt;
    cam.distance = before;
    cam.follow(body.x, body.y + 1.6, body.z, 1);
    announce(level, NEXT.letter + 5);
    keepGame();
  };

  /** Draw everything living on the level shown (the nearest of each kind to `at`). */
  const drawLife = (f: Fauna, at: { readonly x: number; readonly y: number; readonly z: number }, dt: number, now: number): void => {
    ratView.draw(f.rats.list, now, at);
    touchedView.draw(f.touched.list, at.x, at.z, dt, now);
    foremanView.draw(f.foreman.list[0] ?? null, f.foreman.hall, dt, now);
    cricketView.draw(f.crickets.list, now, at);
    slimeView.lumen.draw(f.lumen.list, now, at);
    slimeView.murk.draw(f.murk.list, now, at);
    dogView.draw(f.dogs.list, now, at);
    eelView.draw(f.eels.list, now, at);
    shroomView.toadstools.draw(f.toadstools.list, now, at);
    shroomView.puffcaps.draw(f.puffcaps.list, now, at);
    shroomView.spores.draw(f.puffcaps.spores, now);
    scavengerView.draw(f.scavengers.list, at.x, at.z, dt, now);
    goblinView.draw(f.goblins.list, at.x, at.z, dt, now);
    ghostView.draw(f.ghosts.list, at.x, at.z, dt, now);
    tallView.draw(f.tall.list, at.x, at.z, dt, now);
    herd.drawHerds(f.critters.list, { x: at.x, y: at.y + 1.6, z: at.z }, dt, now);
  };

  // The title screen (plain visits; a link with a seed, depth, place or style goes straight in): it
  // plays on this view, then hands over in the black, on the game's own level.
  if (titled) {
    const choice = await playTitle(host, { view, cam, nobody, seed: params.seed, canContinue: !!saved, shown: () => { if (loading.open) loading.hide(); }, pinned: q.has('shot') ? Math.max(0, Number(q.get('shot')) || 0) : null, look, drawLife });
    if (choice === 'new' && saved) freshFamily();
    if (choice === 'new') beginIntro(); // the introduction (src/game/prologue.ts) for every new family
    look(level);
    fauna = new Fauna(level);
    wisps = new Wisps(level);
    thin = new ThinPlaces(level);
    cam.yaw = body.facing; cam.pitch = -0.25; cam.distance = 4;
    cam.follow(body.x, body.y + 1.6, body.z, 1);
    fade.style.opacity = '1'; // the game's level streams in behind the black (arriving, below)
    controls.takeLook(); controls.takeWheel(); controls.endFrame();
    timer.update();
    noticeUntil = timer.getElapsed() + 5;
  }
  // The first level streams in behind the loading screen, as any later one behind the black.
  arriving = true;
  arrivedAt = performance.now() / 1000;
  view.renderer.setAnimationLoop(() => {
    timer.update();
    // (Only when nothing else is open that Escape would close: then it is theirs.)
    const others = tinView.open || packView.open || readView.open || diaryView.open || letterView.open || mapView.open || debug.open || settingsView.open || body.dead || !!prologue || !!document.querySelector('#whatsnew.open');
    if (!others && !document.pointerLockElement && performance.now() - freedAt > 300 && controls.tap('Escape')) {
      if (pause.open) goOn();
      else pause.showMenu();
    }
    if (pause.open) { view.frame(body.x, body.y, body.z, timer.getElapsed()); controls.endFrame(); return; }
    const dt = Math.min(0.1, timer.getDelta());
    if (arriving && (view.settled || performance.now() / 1000 - arrivedAt > ARRIVE.cap)) {
      arriving = false;
      if (!climb.active) fadeIn = 0.8; // a climb fades in by itself
      if (loading.open) { loading.hide(); fadeIn = 0; fade.style.opacity = '0'; }
    }
    if (arriving && loading.open) loading.step('Carving the rock', 0.65 + 0.35 * view.streamed);
    if (prologue) { prologueFrame(dt, timer.getElapsed()); return; }
    // A death goes on the notary's list (once).
    if (body.dead && !mourned) mourn();
    if (!body.dead) mourned = false;
    // The death screen plays out; then (R, or its button) to black, who the letter is for, and the next grandchild in the cellar.
    if (nextAt !== null) {
      const t = timer.getElapsed() - nextAt;
      if (body.dead) {
        fade.style.opacity = String(Math.max(DEATH.dark, Math.min(1, t / NEXT.black)));
        if (t >= NEXT.black) { sendNextDown(); deathView.letterFor(`Some weeks later, a letter comes for ${heirName(heir, params.seed)}.`); }
      } else if (t >= NEXT.black + NEXT.letter) { deathView.letterFor(null); nextAt = null; fadeIn = 0.8; }
      else fade.style.opacity = '1';
    } else if (body.dead) {
      fade.style.opacity = String(deathView.playOut(timer.getElapsed() - diedAt));
      if (deathView.ready && (controls.tap('KeyR') || deathView.takeAsked())) { nextAt = timer.getElapsed(); deathView.putAway(); }
    }
    // Keep the game every few seconds (not mid-climb or mid-way home), and at once when the grandchild dies.
    if (!climb.active && homeTo === null && (timer.getElapsed() - keptAt > 5 || body.dead !== keptDead)) { keptAt = timer.getElapsed(); keptDead = body.dead; keepGame(); }
    const [mx, my] = controls.takeLook();
    // With the map open the wheel brings it nearer or farther, not the camera.
    const wheel = controls.takeWheel();
    if (mapView.open && wheel) mapView.zoomBy(-Math.sign(wheel));
    cam.look(mx, my, mapView.open ? 0 : wheel);
    input.forward = (controls.held('KeyW') ? 1 : 0) - (controls.held('KeyS') ? 1 : 0);
    input.right = (controls.held('KeyD') ? 1 : 0) - (controls.held('KeyA') ? 1 : 0);
    input.sprint = controls.held('ShiftLeft') || controls.held('ShiftRight');
    input.sneak = controls.held('KeyZ'); // (not Ctrl: Ctrl+W closes the tab)
    input.yaw = cam.yaw;
    if (controls.tap('Space')) input.jump = true;
    if (controls.tap('KeyF')) view.dark = !view.dark;
    if (controls.tap('KeyM') || (mapView.open && controls.tap('Escape'))) mapView.toggle(level.depth ? `Level ${level.depth} · ${level.band.name}` : level.band.name);
    // Grandma's diary, from the tin: open anywhere, J or Escape to close.
    if (diaryView.open && (controls.tap('KeyJ') || controls.tap('Escape'))) diaryView.hide();
    else if (controls.tap('KeyJ') && !tinView.open) { diaryView.show((d) => tin.hasPage(d)); tick('diary'); }
    if (controls.tap('KeyN')) { sounds.engine.set({ muted: !sounds.engine.settings.muted }); say(`Sound ${sounds.engine.settings.muted ? 'off' : 'on'} (${keyName('KeyN')}).`, 2); }
    if (controls.tap('KeyB')) { sounds.engine.set({ music: !sounds.engine.settings.music }); say(`Music ${sounds.engine.settings.music ? 'on' : 'off'} (${keyName('KeyB')}).`, 2); }
    if (controls.tap('KeyO')) settingsView.toggle();
    if (controls.tap('Backquote')) debug.toggle();
    // The bar's slots answer to 1–8 (not at Kemal's counter, nor with the tin open: there they buy, or put a card in a slot); a dead grandchild holds nothing.
    const bar = barOf(mainBar);
    controls.alias(atCounter || tinView.open ? [] : bar.flatMap((a, i) => (a ? [[SLOT_KEYS[i], a.key] as const] : [])));
    if (body.dead) for (const a of ABILITIES) controls.latch(a.key, false);
    /** Rummaging in the tin or the pack: no blows, no casting, no walking off. */
    const handsBusy = tinView.open || packView.open;
    // Tab targeting: Tab picks (and then goes round) the foes near where the camera looks; Escape lets go.
    if (controls.tap('Tab') && !body.dead) {
      target = nextTarget(foes(), target, body.x, body.y, body.z, cam.yaw);
      targetFull = target ? Math.max(1, target.health) : 1;
    }
    if (target && (!keeps(target, body.x, body.z) || body.dead || (!handsBusy && controls.held('Escape')))) target = null;
    body.invulnerable = debug.invulnerable;
    if (debug.tireless) body.stamina = MOVE.stamina;
    const now = timer.getElapsed();
    const busy = climb.active || body.dead || body.mode !== 'walk' || picking !== null;
    const knife = cooked.knife, pound = cooked.tenderising;
    const stabDur = striking === 'pound' ? POUND.dur : STAB.dur * knife.time, stabHit = striking === 'pound' ? POUND.hit : STAB.hit * knife.time;
    const canStrike = !busy && !handsBusy && !body.rolling && now - stabAt > stabDur;
    if (controls.tap('Mouse0') && canStrike) stab(now);
    // Grandma's Tenderising (its slot on the bar) brings the knife's handle down overhead.
    if (controls.tap(useOf('tenderising')) && pound && canStrike) {
      if (body.stamina < POUND.stamina) say('Too out of breath to put your back into it.', 2);
      else { body.stamina -= POUND.stamina; stab(now, 'pound'); }
    }
    // Grandma's Second Helpings: its slot throws a knife.
    const every = cooked.helpings;
    const canThrow = !busy && !handsBusy && !body.rolling && released && now - throwAt > THROWING.dur;
    if (controls.tap(useOf('helpings')) && every !== null && canThrow && now - throwAt > every) { throwAt = now; released = false; tossing = 'knife'; }
    // Grandma's Sunday Candle: its slot tosses a lit candle (as many burning at once as the card's rank).
    if (controls.tap(useOf('candle')) && canThrow && thrown.candles.length < cooked.candles) { throwAt = now; released = false; tossing = 'candle'; }
    // Grandma's Snapdragons: its slot tosses a seed that comes up where it lands and bites whatever is near, you too.
    const snap = cooked.snapdragon;
    if (controls.tap(useOf('snapdragon')) && snap && canThrow && now - seedAt > snap.between) {
      if (body.stamina < SEED.stamina) say('Too out of breath to throw it far enough.', 2);
      else { body.stamina -= SEED.stamina; seedAt = throwAt = now; released = false; tossing = 'seed'; }
    }
    // Grandma's Flour Bag throws a bag that bursts into a cloud; her Matchstick flicks a match at the nearest cloud.
    const bag = cooked.flour, match = cooked.match;
    if (controls.tap(useOf('flour-bag')) && bag && canThrow && now - flourAt > bag.every) {
      if (body.stamina < FLOURING.stamina) say('Too out of breath to throw it hard enough.', 2);
      else { body.stamina -= FLOURING.stamina; flourAt = throwAt = now; released = false; tossing = 'flour'; }
    }
    if (controls.tap(useOf('matchstick')) && match && canThrow && now - matchAt > match.every) { matchAt = throwAt = now; released = false; tossing = 'match'; }
    // Grandma's Duck card rolls the way you are going (back, standing still).
    const duck = cooked.duck;
    if (controls.tap(useOf('duck')) && duck && !busy && !handsBusy && !body.rolling) {
      const f = input.forward || input.right ? input.forward : -1, rt = input.right;
      const dx = -Math.sin(cam.yaw) * f + Math.cos(cam.yaw) * rt, dz = -Math.cos(cam.yaw) * f - Math.sin(cam.yaw) * rt;
      if (body.roll(dx, dz, duck.stamina * practice.less('footwork'), duck.safe)) { rollAt = now; practised('footwork'); }
    }
    // Grandma's Way Home: eyes shut, nothing after you; home to her armchair, or (rank 2, from her salt circle) back down.
    if (controls.tap(useOf('way-home')) && cooked.wayHome && homeTo === null && !busy && !handsBusy) {
      const back = level.depth === 0 && cooked.wayHome >= 2 && campfire.inHaven(body);
      const why = fauna.after(body) ? 'Not with something after you.' : !body.grounded ? 'Not in mid-air.' : level.depth === 0 && !back ? (cooked.wayHome >= 2 && reached > 0 ? 'Stand in her salt circle to think of where you were.' : 'You are home.') : back && reached === 0 ? 'You have not been down yet.' : '';
      if (why) say(why, 2.5);
      else { homeAt = now; homeMote = now; homeTo = back ? reached : 0; say(back ? 'You shut your eyes and think of where you were.' : 'You shut your eyes and think of her armchair.', WAY_HOME.dur); }
    }
    // Grandma's salt-magic (Fire & Frost, Force): a gout of flame, the larder's cold round you, a shove; at the Tab target, if any.
    const canCast = !busy && !handsBusy && !body.rolling && homeTo === null;
    const cast = (kind: typeof casting, stamina: number, out: string): boolean => {
      if (body.stamina < stamina) { say(out, 2); return false; }
      body.stamina -= stamina;
      castAt = now; casting = kind; castYaw = target ? yawTo(target, body.x, body.z) : cam.yaw;
      return true;
    };
    const flame = cooked.flame, larder = cooked.larder, pin = cooked.pin;
    if (controls.tap(useOf('stove-flame')) && flame && canCast && now - flameAt > flame.every && cast('flame', FLAME.stamina, 'Too out of breath to blow.')) {
      flameAt = now;
      spells.flame(body.x - Math.sin(castYaw) * 0.4, body.y + 1.35, body.z - Math.cos(castYaw) * 0.4, castYaw, flame.reach, now);
      sounds.play('throw', null, 0.9, 0.6);
      const b = blowFrom(body, castYaw, { range: flame.reach, arc: FLAME.arc, low: FLAME.low, high: FLAME.high });
      for (const f of foes()) if (reach(b, f)) damage(f, blows.range(flame.damage[0], flame.damage[1]), body.x, body.z, FLAME.knock, 'fire');
    }
    if (controls.tap(useOf('cold-larder')) && larder && canCast && now - larderAt > LARDER.every && cast('larder', LARDER.stamina, 'Too out of breath to let the cold out.')) {
      larderAt = now;
      spells.frost(body.x, body.y, body.z, larder.r, now);
      sounds.play('throw', null, 0.6, 0.45);
      for (const f of foes()) if (!f.dead && Math.hypot(f.x - body.x, f.z - body.z) - f.radius < larder.r && Math.abs(f.y - body.y) < 3) f.chill = { left: larder.lasts, by: larder.slow };
    }
    if (controls.tap(useOf('rolling-pin')) && pin && canCast && now - pinAt > PIN.every && cast('pin', PIN.stamina, 'Too out of breath to roll it out.')) {
      pinAt = now;
      spells.push(body.x, body.y, body.z, castYaw, pin.reach, now);
      sounds.play('pound', null, 0.8, 0.7);
      const b = blowFrom(body, castYaw, { range: pin.reach, arc: PIN.arc, low: PIN.low, high: PIN.high });
      for (const f of foes()) if (reach(b, f)) damage(f, blows.range(PIN.damage[0], PIN.damage[1]), body.x, body.z, pin.knock, 'force');
    }
    // Grandma's Horseradish: stoop and set a root at your feet; it tunnels to the Tab target (or the foe nearest where you look).
    const rooting = cooked.horseradish;
    if (controls.tap(useOf('horseradish')) && rooting && canCast && now - radishAt > rooting.every) {
      const quarry = target ?? candidates(foes(), body.x, body.y, body.z, cam.yaw)[0] ?? null;
      if (!quarry) say('Nothing near enough to set it at.', 2);
      else if (cast('root', ROOTING.stamina, 'Too out of breath to push it in.')) {
        radishAt = now; castYaw = yawTo(quarry, body.x, body.z);
        const r = radish.set(body.x - Math.sin(castYaw) * 0.5, level.groundAt(body.x, body.z), body.z - Math.cos(castYaw) * 0.5, quarry, rooting);
        spells.breaks(r.x, r.y, r.z, now);
        sounds.play('snap_sprout', r, 0.7, 0.8);
      }
    }
    // The larder's cold wears off; frost glints on what it caught meanwhile.
    const glint = Math.floor(now * CAST.glints) !== Math.floor((now - dt) * CAST.glints);
    for (const f of foes()) {
      if (!f.chill || f.chill.left <= 0) continue;
      f.chill.left -= dt;
      if (glint && !f.dead) spells.glint(f.x, f.y, f.z, f.height, now);
    }
    // Grandma's Salt Line: kneeling, pours a circle of salt round you.
    const line = cooked.saltLine;
    if (controls.tap(useOf('salt-line')) && line && !busy && !handsBusy && !body.rolling && homeTo === null && !saltLine.pouring(now)) {
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
    atCounter = nearKemal;
    const nearWeber = level.depth === 0 && !busy && !nearLadder && !nearFind && !nearNote && body.grounded && weber.canHear(body.x, body.y, body.z);
    const nearStranger = strangerHere() && !busy && !nearLadder && !nearFind && !nearNote && !nearWeber && body.grounded && stranger.canHear(body.x, body.y, body.z);
    const nearMarks = busy || tinView.open || nearLadder || nearFind || nearNote || !body.grounded ? undefined : [...level.inscriptions, ...view.props.inscriptions].find((i) => canRead(i, body.x, body.y, body.z));
    if (readView.open && (!nearMarks || controls.tap('Escape'))) readView.hide();
    const nearDoor = busy || nearLadder || nearFind || nearNote || nearMarks || !body.grounded ? null : doors.near(body.x, body.y, body.z);
    // Kemal's counter: 1, 2, 3 buy what is on it.
    if (nearKemal) GEAR_ORDER.forEach((k, i) => {
      if (!controls.tap(`Digit${i + 1}`)) return;
      const r = buyGear(kit, k, euros);
      if (r.euros !== euros) readAt = now; // (stooping over his counter)
      euros = r.euros;
      say(r.line, 6);
    });
    // Grandma's tin, open by the fire: choose a card, cook it, arrange the bar; by key or with the mouse (the mouse is let go while it is open).
    if (tinView.open) {
      const acts = tinView.take();
      if (controls.tap('KeyT') || controls.tap('Escape') || acts.some((a) => a.kind === 'close') || !campfire.resting || body.dead) {
        tinView.hide();
        if (!body.dead) canvas.requestPointerLock?.();
      } else {
        const order = TinView.order(cooked), at = order.indexOf(tinSel);
        let why: string | null = null, redraw = false, cookNow = controls.tap('KeyE');
        if (controls.tap('KeyW')) { tinSel = order[(at + order.length - 1) % order.length]; redraw = true; }
        if (controls.tap('KeyS')) { tinSel = order[(at + 1) % order.length]; redraw = true; }
        if (controls.tap('KeyA')) { tinSel = TinView.chapterStep(cooked, tinSel, -1); redraw = true; }
        if (controls.tap('KeyD')) { tinSel = TinView.chapterStep(cooked, tinSel, 1); redraw = true; }
        // 1–8: the chosen card (cooked, one used through the bar) into that slot.
        SLOT_KEYS.forEach((k, i) => {
          if (!controls.tap(k) || cooked.rank(tinSel) === 0) return;
          redraw = mainBar.set(i, tinSel) || redraw;
        });
        for (const a of acts) {
          if (a.kind === 'choose' && cooked.has(a.id)) { tinSel = a.id; redraw = true; }
          else if (a.kind === 'cook') cookNow = true;
          // A card dropped on a slot goes in it (one dragged from another slot swaps with it); a slot's card dropped in the tin comes off the bar.
          else if (a.kind === 'slot') {
            if (a.id === null) mainBar.clear(a.i);
            else if (cooked.rank(a.id) > 0) mainBar.set(a.i, a.id);
            redraw = true;
          }
        }
        if (cookNow) {
          why = cooked.cantCook(tinSel, tin, tin.deepest);
          if (!why) {
            const r = cooked.cook(tinSel, tin), c = card(tinSel), at = r === 1 ? mainBar.slotIn(tinSel) : -1, fire = campfire.fire ?? (campfire.inHaven(body) ? level.haven : null);
            cookAt = now;
            tinView.hide();
            canvas.requestPointerLock?.();
            tick('cook');
            say(r === 1 ? `${c.title}, cooked${at >= 0 ? `, on your bar (${keyName(SLOT_KEYS[at])})` : ''}.\n${c.method}` : `${c.title}, rank ${r}.\n${c.ranks[r - 2]}`, 6);
            if (fire) drift.burst(fire.x, fire.y + 0.3, fire.z, 2, now);
          }
        }
        if (tinView.open && (redraw || why)) tinView.show(cooked, tin, tinSel, why, practice, mainBar, keyName);
      }
    } else if (controls.tap('KeyT') && campfire.resting) {
      if (!cooked.has(tinSel)) tinSel = TinView.order(cooked)[0];
      tinView.take();
      tinView.show(cooked, tin, tinSel, null, practice, mainBar, keyName);
      document.exitPointerLock?.();
    }
    // The pack (I), open anywhere: W/S choose a line, E uses it (a find left on the floor before you, a spare item put on, a worn one taken off).
    const packKeys = { up: keyName('KeyW'), down: keyName('KeyS'), use: keyName('KeyE'), close: keyName('KeyI') };
    if (packView.open) {
      if (controls.tap('KeyI') || controls.tap('Escape') || tinView.open || body.dead || climb.active) packView.hide();
      else {
        const rows = packRows(pack), n = rows.length;
        let said: string | null = null;
        if (controls.tap('KeyW')) { packSel = (packSel + n - 1) % n; said = ''; }
        if (controls.tap('KeyS')) { packSel = (packSel + 1) % n; said = ''; }
        if (controls.tap('KeyE') && rows[packSel]) {
          const r = rummage(rows[packSel], pack, kit);
          if (r.left) {
            finds.drop(r.left, body.x - Math.sin(body.facing) * 0.5, body.z - Math.cos(body.facing) * 0.5);
            readAt = now; // (stooping to lay it down)
          }
          packSel = Math.min(packSel, packRows(pack).length - 1);
          said = r.line;
        }
        if (said !== null) packView.show(pack, kit, packSel, packKeys, said);
      }
    } else if (controls.tap('KeyI') && !tinView.open && !body.dead) {
      packSel = 0;
      packView.show(pack, kit, packSel, packKeys);
    }
    if (letterView.open && (!nearNote || controls.tap('Escape'))) letterView.hide();
    if (controls.tap('KeyE') && !packView.open) {
      if (letterView.open) letterView.hide();
      else if (nearLadder) climbFrom(nearLadder);
      else if (nearFind && pack.full) say(`Your pack is full (${PACK.room} finds). ${keyName('KeyI')}: open it and leave something here.`, 3.5);
      else if (nearFind) pickUp(nearFind, now);
      else if (nearWeber) say(weber.talk({ deepest: tin.deepest, fallen: fallen.length }, now), 7);
      else if (nearStranger) say(stranger.talk(now), 6);
      else if (nearPawn && pack.items.length) {
        const r = sell(pack, sales++);
        euros += r.paid; readAt = now; // (stooping over her counter)
        sounds.play('coins');
        say(r.line, 6);
      } else if (nearDoor) {
        const line = doors.toggle(nearDoor, now);
        if (line) say(line, 4);
      } else if (nearMarks && readView.open) readView.hide();
      else if (nearMarks) {
        const learned = key.read(nearMarks.id, nearMarks.script, nearMarks.text);
        readAt = now;
        readView.show(breakLines(nearMarks.script, nearMarks.text, 22).map((t) => letter(nearMarks.script, t)), nearMarks.script === 'kerf' ? '#8a6420' : '#2f4f6a', nearMarks.where,
          key.makeOut(nearMarks.script, nearMarks.text), learned && `Looking long enough, you are sure of one: ${learned.toUpperCase()}. You pencil it into the key in her tin.`);
      } else if (nearNote && writing!.kind === 'page') {
        const p = level.page!, gain = tin.page(level.depth), k = p.page.key;
        const runes = k !== undefined && key.pencil(k.script, k.letters) > 0;
        readAt = now;
        letterView.show(`A page torn out of grandma's diary · ${p.page.date}`, p.page.text, `${import.meta.env.BASE_URL}diary/${pageId(p.page)}.webp`,
          [runes ? `You copy her letters into the key in the tin: ${k!.letters.join(', ').toUpperCase()}.` : '', gain ? 'You fold it back into her diary in the tin (J).' : ''].filter(Boolean));
        gained(gain, note[0], note[1], note[2], now);
        if (diaryView.open) diaryView.show((d) => tin.hasPage(d));
      } else if (nearNote) {
        const found = writing!.kind !== 'letter' && cooked.find('salt-line');
        const runes = writing!.kind !== 'letter' && key.pencil('kerf', GRANDMA_KERF) > 0;
        if (writing!.kind === 'letter') tick('letter');
        readAt = now;
        if (writing!.kind === 'letter') letterView.show('A letter from the notary', notaryLetter(heir, params.seed));
        else letterView.show('Grandma\'s handwriting, young and fast', NOTE.join('\n\n'), null,
          [found ? `Under the thermos, a card torn out of her tin: ${card('salt-line').title}. Cook it at a fire.` : '', runes ? RUBBING : ''].filter(Boolean));
        gained(tin.camp(level.depth), note[0], note[1], note[2], now);
      }
    }
    const kindling = campfire.kindling(now);
    if (controls.tap('KeyC') && !busy && body.grounded && kindling < 0) {
      const why = shedOf() ? 'Not in a wooden shed. Shut the door and rest.' : campfire.whyNot(body, body.facing, fauna.after(body), now);
      if (why) say(why, 2.5); else { campfire.light(body, body.facing, now); sounds.play('fire_light'); }
    }
    const stirring = now - cookAt < COOK.dur || saltLine.pouring(now);
    if (picking || now - readAt < PICKUP.dur || campfire.kindling(now) >= 0 || handsBusy || stirring || homeTo !== null) input.forward = input.right = 0; // stooping or kneeling, not walking
    // Grandma's Pot Lid: hold its slot to keep it up between you and whatever it is.
    const lid = cooked.lid;
    body.lid = lid && { through: lid.through, cost: lid.cost * practice.less('guard') };
    nobody.wear(!!cooked.lid, kit.items);
    body.guarding = !!cooked.lid && controls.held(useOf('pot-lid')) && !busy && !handsBusy && !body.rolling && homeTo === null && now - stabAt > stabDur;
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
    } else if (arriving) {
      fade.style.opacity = '1';
      input.jump = false;
    } else {
      meetDoors();
      doors.step(dt, now, body.x, body.y + MOVE.stepOver, body.y + MOVE.height, body.z, MOVE.radius, view.props.blockers);
      // Shut in a shed: nothing outside notices you, and you can rest.
      const shed = shedOf(), shedDoor = shed && doors.of(shed.door);
      body.hidden = !!shedDoor && Doors.shut(shedDoor);
      for (acc += dt; acc >= STEP; acc -= STEP) body.step(level, input, STEP, view.props.blockers);
      // At the top of a climb: pull up over the edge (played out, then the body stands on the ledge).
      if (body.ledge) {
        climb.play([{ kind: 'ledge', ledge: body.ledge, feet: body.y }], body.x, body.y, body.z, body.facing);
        onLanded = () => body.overLedge();
      }
      const stabbing = now - stabAt < stabDur, throwing = now - throwAt < THROWING.dur;
      if (stabbing) body.facing = stabYaw;
      // Knives go at the Tab target, if there is one.
      const aim = target ? yawTo(target, body.x, body.z) : cam.yaw;
      if (body.guarding) body.facing = cam.yaw;
      if (throwing) body.facing = aim;
      if (now - castAt < CAST.dur) body.facing = castYaw;
      if (!released && now - throwAt >= THROWING.release) {
        released = true;
        const hx = body.x - Math.sin(aim) * 0.3, hy = body.y + 1.45, hz = body.z - Math.cos(aim) * 0.3;
        sounds.play(tossing === 'match' ? 'match_strike' : 'throw', null, 0.8, tossing === 'knife' ? 1.1 : tossing === 'match' ? 1 : 0.85);
        if (tossing === 'knife' || tossing === 'flour') thrown.throw(hx, hy, hz, aim, foes(), tossing);
        else if (tossing === 'match') {
          const c = flour.ahead(body.x, body.z, aim, THROW.aim, FLOURING.arc);
          thrown.throw(hx, hy, hz, aim, foes(), 'match', c ? { x: c.x, y: c.y + 1, z: c.z } : undefined);
        } else thrown.toss(hx, hy, hz, aim, tossing);
      }
      thrown.power = practice.more('throwing');
      // A match flown into a cloud of flour sets it off (and every cloud touching it): the nobody too, if in it.
      const hit = thrown.fly(level, foes(), blows, dt, (m) => {
        const c = match && flour.cloudAt(m.x, m.y, m.z);
        if (!c || !match) return false;
        const up = flour.goUp(c, [...foes(), body], match.damage, match.knock, blows);
        for (const u of up.clouds) spells.blast(u.x, u.y, u.z, Flour.reach(u), now);
        sounds.play('flour_blast', c);
        return true;
      });
      if (hit.length) practised('throwing', hit.length);
      // A seed come down comes up; the snapdragons bite the nearest in reach, the nobody among them.
      for (const s of thrown.sown.splice(0)) {
        if (!snap) continue;
        garden.sow(s.x, s.y, s.z, Math.atan2(-s.vx, -s.vz), snap);
        spells.sprout(s.x, s.y, s.z, now);
        sounds.play('snap_sprout', s);
      }
      // A bag of flour that burst hangs as a cloud; what is in one is blind (and its blows find no one), flour shaking off it.
      for (const b of thrown.burst.splice(0)) {
        if (!bag) continue;
        const g = level.groundAt(b.x, b.z), y = Math.abs(g - b.y) < 3 ? g : b.y - 1;
        const c = flour.burst(b.x, y, b.z, bag);
        spells.bagBursts(c.x, c.y, c.z, c.r, now);
        sounds.play('flour_burst', c);
      }
      flour.linger(dt, foes());
      const puff = Math.floor(now * CAST.glints) !== Math.floor((now - dt) * CAST.glints);
      if (puff) {
        for (const c of flour.clouds) spells.hang(c.x, c.y, c.z, Flour.reach(c), Math.min(1, (c.hangs - c.t) / (c.hangs * FLOUR.thin)), now);
        for (const f of foes()) if (!f.dead && (f.blind ?? 0) > 0) spells.dusted(f.x, f.y, f.z, f.height, now);
      }
      body.unseenFrom = (x, z) => flour.blinds(x, body.y, z, foes());
      // The horseradish tunnels on, comes up under its quarry and bites; the earth flies where it goes.
      for (const { root: r, hit } of radish.tunnel(dt, foes(), (x, z) => level.groundAt(x, z), blows)) {
        spells.snap(hit.x, hit.y + hit.height * 0.5, hit.z, now);
        sounds.play('snap_bite', r, 0.8, 0.75);
      }
      const crumb = Math.floor(now * ROOTING.crumbs) !== Math.floor((now - dt) * ROOTING.crumbs);
      for (const r of radish.roots) {
        // It has just broken out of the floor, or gone back in.
        if ((r.phase === 'rise' || r.phase === 'dive') && r.t === 0) { spells.breaks(r.x, r.y, r.z, now); sounds.play('snap_sprout', r, 0.6, 0.7); }
        else if (r.phase === 'dig' && crumb) spells.furrow(r.x, r.y, r.z, r.yaw, now);
      }
      for (const f of garden.step(dt, [...foes(), body], blows)) {
        const p = garden.plants.find((g) => g.target === f);
        spells.snap(f.x, f.y + f.height * 0.6, f.z, now);
        sounds.play('snap_bite', p ?? null, 1, 0.85);
      }
      const candles = thrown.candles;
      fauna.glare = candles;
      fauna.salt = saltLine.keeping(now);
      view.props.loose = new Float32Array(candles.flatMap((c) => [c.x, c.y + 0.35, c.z]));
      if (picking && now - pickAt >= PICKUP.at && finds.lying(picking)) {
        finds.take(picking);
        sounds.play('pickup');
        pack.add(picking);
        tick('pickup');
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
          for (const r of struck) damage(r, blows.range(pound.damage[0], pound.damage[1]) * knife.damage * kit.edge * practice.more('knife'), body.x, body.z, POUND.knock, 'knife');
          if (struck.length) practised('knife');
        } else {
          const r = nearestReached(blowFrom(body, stabYaw, STAB), foes());
          if (r) { damage(r, blows.range(STAB.damage[0], STAB.damage[1]) * knife.damage * kit.edge * practice.more('knife'), body.x, body.z, STAB.knock, 'knife'); practised('knife'); }
          if (r) { const skid = 'took' in r && r.took < 1; sounds.play(skid ? 'pick_work' : 'pound', r, skid ? 0.6 : 0.8, skid ? 1.4 : 1.3); }
          if (r && 'took' in r && r.took < 1) say('The knife skids off the salt on his chest.', 2);
        }
      }
      const health = body.health;
      fauna.blockers = view.props.blockers;
      view.camera.getWorldDirection(lampDir);
      if (view.carrier) [lamp.x, lamp.y, lamp.z] = [view.carrier.x, view.carrier.y, view.carrier.z];
      [lamp.dx, lamp.dy, lamp.dz] = [lampDir.x, lampDir.y, lampDir.z];
      fauna.goblins.thief = snatch;
      const struck = fauna.advance(dt, body, lamp, body.facing);
      for (const d of fauna.goblins.dropped.splice(0)) finds.drop(d.loot as Find, d.x, d.z);
      for (const f of fauna.fallen()) { gained(tin.killed(f.kind), f.x, f.y + 0.2, f.z, now); tick('stab'); }
      if (body.health < health) {
        // Flinch away from the nearest foe (thrown back by a pick).
        let near: Foe | undefined, nd = Infinity;
        for (const r of foes()) { const d = Math.hypot(r.x - body.x, r.z - body.z); if (!r.dead && d < nd) { nd = d; near = r; } }
        if (near) nobody.hit(body.x - near.x, body.z - near.z, struck ? 1 : 0.5);
      }
      // The knife comes out when something is after the nobody or it is used, and goes back after a while.
      const threat = fauna.after(body);
      body.climbCost = cooked.climbing * practice.less('climbing') * kit.climb;
      body.armour = kit.armour;
      // Practice: metres climbed, and blows the lid stopped.
      if (body.mode === 'climb') climbed += Math.max(0, body.y - climbY);
      climbY = body.y;
      if (climbed >= 1) { practised('climbing', Math.floor(climbed)); climbed -= Math.floor(climbed); }
      if (body.blockedAt !== blockedAt) { if (body.blockedAt > blockedAt) practised('guard'); blockedAt = body.blockedAt; }
      body.tiptoe = cooked.tiptoe;
      body.spring = cooked.spring;
      campfire.soup = cooked.soup;
      campfire.step(body, threat, now, dt, body.hidden);
      // First steps done by being somewhere or doing something (the rest tick where they happen).
      if (campfire.resting) tick(campfire.inHaven(body) ? 'circle' : 'fire');
      if (body.mode === 'climb') tick('climb');
      if (level.depth >= 1) tick('down');
      if (level.depth >= 2) tick('deeper');
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
          announce(level);
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
      const action = lighting >= 0 ? { id: 'harvest', t0: now - lighting, dur: FIRE.kindle } : saltLine.pouring(now) ? { id: 'harvest', t0: saltLine.circle!.at, dur: SALT_LINE.pour } : stirring ? { id: 'harvest', t0: cookAt, dur: COOK.dur } : body.rolling ? { id: 'roll', t0: rollAt, dur: MOVE.roll.dur } : now - castAt < CAST.dur ? { id: casting === 'pin' ? 'swing_1h' : casting === 'larder' ? 'block' : casting === 'root' ? 'pickup' : 'throw', t0: castAt, dur: CAST.dur } : throwing ? { id: 'throw', t0: throwAt, dur: THROWING.dur } : stooping ? { id: 'pickup', t0: reading ? readAt : pickAt, dur: PICKUP.dur } : stabbing ? { id: striking === 'pound' ? 'slam' : 'swing_1h', t0: stabAt, dur: stabDur } : blocking ? { id: 'block', t0: blockAt, dur: BLOCK.dur } : undefined;
      nobody.pose(body, dt, now, action, ready && !stooping && lighting < 0, (campfire.mending || homeTo !== null) && !stabbing ? 'crouch' : undefined);
      pain.style.opacity = String(body.dead ? 0 : Math.max(0, 1 - (body.time - body.hurtAt) / 0.45) * 0.8);
      if (fadeIn > 0) { fadeIn = Math.max(0, fadeIn - dt); fade.style.opacity = String(fadeIn / 0.8); }
    }

    drawLife(fauna, body, dt, now);
    const rung = fauna.foreman.list[0]?.rung ?? 0;
    if (rung > bells) say('A bell rings out through the halls. Something answers it.', 4);
    bells = rung;
    if (fauna.scavengers.calls > calls) say(fauna.scavengers.said, 3.5);
    calls = fauna.scavengers.calls;
    if (fauna.ghosts.calls > spoken) say(`The ${fauna.ghosts.saidBy}'s ghost says: "${fauna.ghosts.said}"`, 5);
    spoken = fauna.ghosts.calls;
    if (level.depth === 0) weber.turn(body.x, body.z, dt);
    neighbourView.people.draw(level.depth === 0 ? [weber] : [], body.x, body.z, dt, now);
    if (strangerHere()) stranger.turn(body.x, body.z, dt);
    strangerView.people.draw(strangerHere() ? [stranger] : [], body.x, body.z, dt, now);
    // Not while the level streams in behind the black, nor through the prologue.
    // On 18, far off where she laid her first ring, as one comes in sight of it (once for the family).
    const ring = level.depth === GLIMPSES.ring.depth && !below ? level.page : null, off = ring ? Math.hypot(ring.x - body.x, ring.z - body.z) : 0;
    if (ring && off > RING_SIGHT[0] && off < RING_SIGHT[1] && Math.abs(ring.y - body.y) < 4 && tin.firstTime('grandma:ring')) below = Grandma.glimpse(GLIMPSES.ring, ring.x, ring.y, ring.z, ring.yaw, now);
    // On 40, by the two names cut in the rock, as one comes to her page: beside you, looking at his name.
    const names = level.depth === GLIMPSES.names.depth && !below ? level.page : null;
    if (names?.face && Math.hypot(names.x - body.x, names.z - body.z) < NAMES_NEAR && Math.abs(names.y - body.y) < 1.5 && tin.firstTime('grandma:names')) {
      const { nx, nz } = names.face;
      below = Grandma.glimpse(GLIMPSES.names, names.x + nx * 0.9 - nz * 0.8, names.y, names.z + nz * 0.9 + nx * 0.8, names.yaw, now);
    }
    const kin = { deepest: tin.deepest, fallen, seed: params.seed };
    const her = level.depth === 0 ? grandma : below;
    const word = her && !body.dead && !arriving && !loading.open && !prologue ? her.keep(dt, now, body.x, body.y, body.z, kin) : null;
    if (word) say(`Grandma: ${word}`, GRANDMA.talk + 1);
    if (below?.mode === 'away') below = null;
    grandmaView.people.draw(her && her.mode !== 'away' ? [her] : [], body.x, body.z, dt, now);
    if (fauna.tall.stares > stares) say('The Tall One looks at you, and the cold of it goes right through you.', 3);
    // The first time it looks at anyone of the family, she stands between it and you, a moment.
    const tall = fauna.tall.stares > stares && !below ? fauna.tall.list.find((t) => !t.dead) : undefined;
    if (tall && tin.firstTime('grandma:tall')) {
      const dx = tall.x - body.x, dz = tall.z - body.z, d = Math.hypot(dx, dz) || 1, k = Math.min(2.5, d / 2);
      below = Grandma.glimpse(GLIMPSES.tall, body.x + (dx / d) * k, body.y, body.z + (dz / d) * k, Math.atan2(-dx, -dz), now);
    }
    stares = fauna.tall.stares;
    const fire = campfire.fire, lit = campfire.kindling(now);
    hearth.root.visible = !!fire;
    doorView.draw();
    if (fire) { hearth.root.position.set(fire.x, fire.y, fire.z); hearth.flicker(now, lit >= 0 ? (lit / FIRE.kindle) ** 2 * 0.5 : campfire.left(now)); }
    findView.draw(finds.near(body.x, body.z, PICKUP.shown, shownFinds), now);
    drift.stream(now, body.x, body.y + 1, body.z);
    wisps.advance(dt, body.x, body.y + 1.5, body.z, -Math.sin(cam.yaw), -Math.cos(cam.yaw));
    for (const w of wisps.risen.splice(0)) sounds.play('wisp_rise', w, 0.5);
    for (const w of wisps.popped.splice(0)) sounds.play('wisp_pop', w, 0.7);
    wispView.draw(wisps);
    thin.advance(dt, body.x, body.y + 1.6, body.z, -Math.sin(cam.yaw), -Math.cos(cam.yaw));
    thinView.draw(thin.current);
    for (const t of thin.opened) sounds.play('thin_place', t);
    thin.opened.length = 0;
    if (body.sprangAt !== sprangSeen) { sprangSeen = body.sprangAt; if (Number.isFinite(sprangSeen)) spells.puff(body.x, body.y, body.z, now); }
    spells.place(now);
    thrownView.arrange(thrown.missiles, now);
    gardenView.draw(garden.plants, now);
    radishView.draw(radish.roots, now, body);
    saltLineView.draw(saltLine, level, now);
    nobody.shown = !cam.firstPerson;
    cam.room = shedOf();
    cam.follow(body.x, body.y + 1.6, body.z, dt);
    // The map: mark the floor round the nobody seen, now and then; draw it while open.
    if (timer.getElapsed() - exploredAt > 0.3 && !climb.active && !body.dead) { exploredAt = timer.getElapsed(); explored.see(level, body.x, body.y, body.z); }
    mapView.draw(level, explored, body.x, body.y, body.z, cam.yaw, campfire.burning(timer.getElapsed()) ? campfire.fire : null, timer.getElapsed());
    const lines: string[] = [];
    const E = keyName('KeyE');
    if (nearLadder) lines.push(nearLadder.up ? `${E}: climb up the ladder` : `${E}: climb down the ladder`);
    else if (nearFind) lines.push(pack.full ? `Your pack is full. ${keyName('KeyI')}: leave something to make room for ${FINDS[nearFind.kind].name}` : `${E}: pick up ${FINDS[nearFind.kind].name}`);
    else if (nearWeber) lines.push(weber.talking(now) ? '' : `${E}: call on Frau Weber`);
    else if (nearStranger) lines.push(stranger.talking(now) ? '' : `${E}: speak to the stranger`);
    else if (nearKemal) lines.push(`Kemal's hardware store (purse €${euros}): ` + GEAR_ORDER.map((k, i) => `${i + 1} ${GEAR[k].name} €${GEAR[k].price}${hasGear(kit, k) ? ' (yours)' : ''}`).join(' · '));
    else if (nearPawn) lines.push(pack.items.length ? `${E}: sell your finds to Ilse (about €${pack.worth})` : 'Ilse\'s pawn shop. You have nothing to sell her yet.');
    else if (nearMarks && !readView.open) lines.push(`${E}: read the marks`);
    else if (nearDoor) lines.push(`${E}: ${nearDoor.want ? 'shut' : 'open'} ${nearDoor.spec.name}`);
    else if (nearNote && !letterView.open) lines.push(writing!.kind === 'letter' ? `${E}: read the notary's letter` : writing!.kind === 'page' ? `${E}: read the page under the stone` : `${E}: read the note`);
    else if (campfire.resting && !tinView.open) lines.push(`Resting ${campfire.inHaven(body) ? 'in grandma\'s salt circle' : body.hidden ? 'in the miners\' shed, the door shut' : 'by the fire'}${campfire.mending ? ' (walk on to get up)' : ''}. ${keyName('KeyT')}: open grandma's tin (${tin.salt} salt)`);
    else if (!body.dead && !climb.active && body.grounded && body.health < MOVE.maxHealth * 0.7 && !campfire.burning(timer.getElapsed()) && !fauna.after(body)) lines.push(shedOf() ? (body.hidden ? 'Stand still to rest' : 'Shut the shed door to rest') : `${keyName('KeyC')}: light a fire and rest`);
    else if (!body.dead && !climb.active) {
      const s = level.descents.nearest(body.x, body.z, DRAFT_RANGE);
      const draft = s && draftLine(body.x, body.z, cam.yaw, s.x, s.z);
      if (draft) lines.push(draft);
    }
    const flags = debug.invulnerable || debug.tireless ? `debug: ${[debug.invulnerable && 'invulnerable', debug.tireless && 'tireless'].filter(Boolean).join(', ')}` : '';
    // The main bar: how soon each slot is ready again, and what is on.
    const slot = (a: Ability): SlotState => {
      const ready = (t0: number, dur: number) => Math.min(1, (now - t0) / dur);
      switch (a.card) {
        case 'tenderising': return { ready: striking === 'pound' ? ready(stabAt, POUND.dur) : 1, on: false, dim: body.stamina < POUND.stamina };
        case 'helpings': return { ready: ready(throwAt, Math.max(THROWING.dur, every ?? 0)), on: false, dim: false };
        case 'duck': return { ready: body.rolling ? ready(rollAt, MOVE.roll.dur) : 1, on: body.rolling, dim: body.stamina < (duck?.stamina ?? 0) };
        case 'stove-flame': return { ready: ready(flameAt, flame?.every ?? 1), on: false, dim: body.stamina < FLAME.stamina };
        case 'cold-larder': return { ready: ready(larderAt, LARDER.every), on: false, dim: body.stamina < LARDER.stamina };
        case 'rolling-pin': return { ready: ready(pinAt, PIN.every), on: false, dim: body.stamina < PIN.stamina };
        case 'pot-lid': return { ready: 1, on: body.guarding, dim: false };
        case 'flour-bag': return { ready: ready(flourAt, bag?.every ?? 1), on: flour.clouds.length > 0, dim: body.stamina < FLOURING.stamina };
        case 'matchstick': return { ready: ready(matchAt, match?.every ?? 1), on: flour.clouds.length > 0, dim: false };
        case 'horseradish': return { ready: ready(radishAt, rooting?.every ?? 1), on: radish.roots.length > 0, dim: body.stamina < ROOTING.stamina };
        case 'snapdragon': return { ready: ready(seedAt, snap?.between ?? 1), on: garden.plants.length > 0, dim: body.stamina < SEED.stamina };
        case 'candle': return { ready: 1, on: false, dim: thrown.candles.length >= cooked.candles, count: `${thrown.candles.length}/${cooked.candles}` };
        case 'salt-line': {
          const c = saltLine.circle;
          return { ready: c && saltLine.pouring(now) ? ready(c.at, SALT_LINE.pour) : 1, on: !!c && !saltLine.pouring(now), dim: false, count: c && !saltLine.pouring(now) ? `${Math.ceil(c.at + SALT_LINE.pour + c.keeps - now)} s` : '' };
        }
        case 'way-home': return { ready: homeTo !== null ? ready(homeAt, WAY_HOME.dur) : 1, on: homeTo !== null, dim: false };
        default: return { ready: 1, on: false, dim: false };
      }
    };
    targetMark.paint(view.camera, target?.x ?? 0, (target?.y ?? 0) + (target?.height ?? 0) + 0.3, target?.z ?? 0, target ? target.health / targetFull : null);
    abilityBar.paint(bar, bar.map((a) => (a ? slot(a) : null)), passivesOf(cooked), body.dead, tinView.open);
    stepsView.pin(steps, now);
    hudView.render({
      health: body.health, maxHealth: MOVE.maxHealth, stamina: body.stamina, maxStamina: MOVE.stamina,
      mode: body.mode === 'climb' ? 'climbing' : body.mode === 'swim' ? 'swimming' : '',
      hurt: body.time - body.hurtAt < 2 && !body.dead ? `${hurtLine(body.lastCause)}: -${body.lastHurt.toFixed(0)}` : '',
      boss: fauna.boss(body), notice: timer.getElapsed() < noticeUntil ? notice : '', gain: now < gainUntil ? gainLine : '',
      prompt: lines.filter(Boolean).join(' · '), tally: fauna.tally(), flags,
      salt: tin.salt, euros, pack: pack.items.length ? { count: pack.items.length, room: PACK.room, worth: pack.worth } : null,
      dead: body.dead, dev: `${backend} · ${view.stage.hudLine()}`, help: !beenDown && steps.over,
    }, timer.getElapsed());
    // The headlamp: above the head and a little towards where one looks (the camera, not the
    // body: standing and looking round, the figure would shade its own way).
    view.carrier!.set(body.x - Math.sin(cam.yaw) * 0.4, body.mode === 'swim' ? level.waterAt(body.x, body.z) + 0.25 : body.y + 1.85, body.z - Math.cos(cam.yaw) * 0.4);
    const dripNow = timer.getElapsed();
    view.frame(body.x, body.y, body.z, dripNow, !loading.open && !(arriving && !climb.active));
    // A drop landing on each living stalagmite's tip (src/gen/drips.ts), heard close by.
    for (const s of view.drips.shown) {
      if ((s.x - body.x) ** 2 + (s.z - body.z) ** 2 > DRIP_HEARD ** 2) continue;
      const drops = heard(s, dripThen, dripNow, dripSeen);
      for (let k = 0; k < drops; k++) sounds.play('drip', { x: s.x, y: s.y + Math.max(0, tipOf(dripSeen)), z: s.z }, dripSeen.drip);
    }
    dripThen = dripNow;
    view.camera.getWorldDirection(lampDir);
    const ear = view.camera.position;
    sounds.update({
      dt, body, level, fauna, doors: doors.list, fire: campfire.burning(timer.getElapsed()) ? campfire.fire : null,
      resting: campfire.resting, ladder: climb.active, ear: { x: ear.x, y: ear.y, z: ear.z, fx: lampDir.x, fy: lampDir.y, fz: lampDir.z },
    });
    fadeLine.style.opacity = arriving && !loading.open && Number(fade.style.opacity) > 0.9 ? '1' : '0';
    (globalThis as { __ready?: boolean }).__ready = view.settled && loading.gone && !arriving;
    controls.endFrame();
  });
}

