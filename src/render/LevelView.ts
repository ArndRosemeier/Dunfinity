/**
 * A level on screen: scene, fog, the fixed lights (ambient, headlamp, lamp pool), the Stage and its
 * warm-up, and the streamed rock and props. The Lab and the game both look at a level through this.
 *
 * Lights are fixed before the warm-up: they are part of every shader's cache key (docs/SHADERS.md).
 */
import { Scene, PerspectiveCamera, Color, SRGBColorSpace, Fog, HemisphereLight, DirectionalLight, PointLight, SpotLight, Group, Vector3, type Object3D, type WebGPURenderer } from 'three/webgpu';
import type { Level } from '../gen/level';
import { airOf, type Air } from '../gen/air';
import { daylightAt } from '../gen/cellar';
import { createRenderer } from './renderer';
import { Stage } from './stage';
import { Dust } from './dust';
import { ROCK_FINISH, ROCK_VEINS, SKY_LOOK, VEIN_PULSE, setRockRecipes } from './materials';
import { pulseAt, pulseFrom, pulseRing } from '../gen/veinPulse';
import { skyOf } from '../gen/glowworms';
import { Terrain } from './terrain/Terrain';
import { Props } from './props/Props';
import { LampLights } from './props/lamps';
import { Watchers } from './props/watchers';
import { DripView } from './props/dripView';
import { BloomView } from './props/bloomView';
import { HumView } from './humView';
import { DEFAULT_VIEW, type ChunkView } from '../world/chunks';
import { QUALITY } from './quality';
import { Prepared } from './prepared';
import type { Quality } from '../persist/settings';

/** Fog distances: a lit survey view, and roughly what a headlamp shows. */
const FOG = { survey: [80, 900], dark: [10, 140] } as const;

export class LevelView {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(70, 1, 0.1, 4000);
  readonly stage: Stage;
  readonly fog = new Fog(0x050607, FOG.survey[0], FOG.survey[1]);
  /**
   * The lamp the viewer carries: a cone where the camera looks, casting the one shadow in the game,
   * from where it is carried (the nobody's head; the camera in the Lab). Off the camera, so the
   * shadows show from behind.
   */
  readonly headlamp = new SpotLight(0xfff0dc, 60, 160, HEADLAMP.angle, HEADLAMP.penumbra, HEADLAMP.decay);
  /** A little of its light all round the carrier (the cone's spill). */
  private readonly spill = new PointLight(0xfff0dc, 0, 30, HEADLAMP.decay);
  /** Where the headlamp is carried (null: on the camera). */
  carrier: Vector3 | null = null;
  private readonly ambient = new HemisphereLight(0x9aa6b4, 0x2a2218, 0.7);
  /** The sun over the village (depth 0, out of doors): no shadow, dark (intensity 0) everywhere else. */
  private readonly sun = new DirectionalLight(DAY.sun, 0);
  /** How much daylight the view has now, 0–1 (src/gen/cellar.ts `daylightAt` where the viewer is, eased). */
  private day = 0;
  /** The lamps' brightness on this level before the day dims them (its band's `lamplight`). */
  private lamplight = 1;
  private readonly dayFog = new Color();
  /** The lamp pool; wisps borrow lights from it (`lamps.glows`). */
  readonly lamps: LampLights;
  private readonly rock = new Group();
  private readonly things = new Group();
  private readonly dust: Dust;
  private readonly watchers = new Watchers();
  /** The living stalagmites near the viewer (src/gen/drips.ts). */
  readonly drips = new DripView();
  /** The salt blooms near the viewer (src/gen/blooms.ts). */
  readonly blooms = new BloomView();
  /** Singing crystals ringing (src/world/singing.ts): rung by the game, drawn each frame. */
  readonly hums = new HumView();
  /** The levels one may go to next, prepared in the background (`prepared.want(spots)`). */
  readonly prepared = new Prepared();
  private lastTime = 0;
  /** The pulse in the veins running now: when it started and where from. */
  private pulse: { start: number; at: [number, number] } | null = null;
  private readonly facing = new Vector3();
  /** An age (s) to hold a pulse at, as if one were running (the Lab and stills). */
  pulseHeld: number | null = null;
  private terrain_: Terrain | null = null;
  private props_: Props | null = null;
  private dark_ = false;
  private torch_ = false;
  /** The level's light and air (src/gen/air.ts). */
  private air: Air = airOf(0, 0);
  /** Which chunks the rock is streamed in (the quality's detail). */
  private chunkView: ChunkView = DEFAULT_VIEW;
  private quality_: Quality = 'high';
  /** Headlamp intensity in the survey view and in the dark (a lamp carried close to the body wants less). */
  headlampPower = { survey: 60, dark: 17 };

  /** A canvas filling `host`, its renderer, and a view of `level` that follows the window size. */
  static async open(host: HTMLElement, level: Level, opts: { forceWebGL: boolean }): Promise<{ view: LevelView; canvas: HTMLCanvasElement; backend: string }> {
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);
    const { renderer, backend } = await createRenderer(canvas, opts);
    const view = new LevelView(renderer, level);
    const resize = () => view.resize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', resize);
    resize();
    return { view, canvas, backend };
  }

  constructor(readonly renderer: WebGPURenderer, private level_: Level) {
    this.scene.background = new Color(0x050607);
    this.scene.fog = this.fog;
    this.scene.add(this.ambient);
    this.sun.position.set(DAY.toSun[0], DAY.toSun[1], DAY.toSun[2]);
    this.scene.add(this.sun);
    this.lamps = new LampLights(this.scene);
    renderer.shadowMap.enabled = true;
    const sh = this.headlamp.shadow;
    sh.mapSize.set(HEADLAMP.map, HEADLAMP.map);
    sh.camera.near = 0.2;
    sh.camera.far = HEADLAMP.shadowFar;
    sh.bias = -0.0004;
    sh.normalBias = 0.03;
    this.headlamp.castShadow = true;
    // On the camera: lights moved out of it into the scene changed every shader's key after the warm-up.
    this.headlamp.target.position.set(0, 0, -10);
    this.camera.add(this.headlamp, this.headlamp.target, this.spill);
    this.scene.add(this.camera);
    this.stage = new Stage(renderer, this.scene, this.camera);
    this.dust = new Dust(level_.seed);
  }

  /** Everything given to `start` as `later` is warm (resolved at once if nothing was). */
  warmed: Promise<void> = Promise.resolve();

  /**
   * Warm up the shaders (with `extra`, see Stage.warmUp), then start streaming the level. `later`:
   * objects like `extra` that need not be ready yet (the title screen plays meanwhile): they warm
   * while the view draws (Stage.warmLater), and `warmed` says when.
   */
  async start(extra: readonly Object3D[] = [], later: readonly Object3D[] = []): Promise<void> {
    this.aimHeadlamp(); // the warm-up draws the shadow pass too: the lamp must shine where the camera looks
    await this.stage.warmUp(extra);
    this.stage.shadowCamera = this.headlamp.shadow.camera;
    this.warmed = later.length ? this.stage.warmLater(later) : Promise.resolve();
    this.scene.add(this.rock, this.things);
    await this.stage.add(this.dust.mesh);
    await this.stage.add(this.watchers.root);
    await this.stage.add(this.drips.root);
    await this.stage.add(this.blooms.root);
    await this.stage.add(this.hums.root);
    this.stream();
  }

  get level(): Level { return this.level_; }

  /** Show another level (the way down): drop the streamed rock and props and stream the new one's. */
  go(level: Level): void {
    this.terrain_?.dispose();
    this.props_?.dispose();
    this.level_ = level;
    this.watchers.reset();
    this.stream();
  }

  private stream(): void {
    // The level's light and air: uniforms and light colours only, the same shaders in every stratum.
    this.air = airOf(this.level_.seed, this.level_.depth);
    ROCK_VEINS.value = this.air.veins;
    this.fog.color.setRGB(...this.air.fog, SRGBColorSpace);
    (this.scene.background as Color).setRGB(...this.air.fog, SRGBColorSpace);
    this.ambient.color.setRGB(...this.air.sky, SRGBColorSpace);
    this.ambient.groundColor.setRGB(...this.air.ground, SRGBColorSpace);
    this.headlamp.color.setRGB(...this.air.lamp, SRGBColorSpace);
    this.spill.color.setRGB(...this.air.lamp, SRGBColorSpace);
    this.lamps.tint(this.air.flame);
    this.lamplight = this.level_.band.lamplight;
    this.dark = this.dark_; // the fog's distances, as clear as the air; the lamps' power
    setRockRecipes(this.level_.rockRecipes);
    const sky = skyOf(this.level_.seed, this.level_.depth);
    SKY_LOOK.tint.value.set(...sky.color);
    SKY_LOOK.arms.value.set(sky.arms, sky.spin);
    const finish = this.level_.band.finish;
    ROCK_FINISH.formwork.value = finish.formwork; ROCK_FINISH.wet.value = finish.wet;
    this.terrain_ = new Terrain(this.stage, this.rock, this.level_.key, this.chunkView, this.prepared);
    this.props_ = new Props(this.stage, this.things, this.level_.key, this.lamps, this.prepared);
  }

  /** The graphics quality: pixels drawn, the headlamp's shadow map, the rock's detail far off (src/render/quality.ts). Applies at once; compiles nothing. */
  get quality(): Quality { return this.quality_; }
  set quality(q: Quality) {
    const p = QUALITY[q];
    this.quality_ = q;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, p.pixels));
    this.headlamp.shadow.mapSize.set(p.shadowMap, p.shadowMap);
    this.chunkView = { ...DEFAULT_VIEW, split: p.split };
    this.terrain_?.setView(this.chunkView);
    this.prepared.view = this.chunkView;
  }

  get terrain(): Terrain { return need(this.terrain_); }
  get props(): Props { return need(this.props_); }

  /** Survey view, or what a miner sees: the headlamp and the burning lamps. */
  get dark(): boolean { return this.dark_; }
  set dark(dark: boolean) {
    this.dark_ = dark;
    const [near, far] = dark ? FOG.dark : FOG.survey, torch = dark && this.torch_;
    const reach = torch ? TORCH.reach : 1;
    this.fog.near = near * this.air.clear * reach; this.fog.far = far * this.air.clear * reach;
    this.ambient.intensity = dark ? 0.05 : 0.7;
    const power = dark ? this.headlampPower.dark : this.headlampPower.survey;
    this.headlamp.intensity = power * (torch ? TORCH.power : 1);
    this.headlamp.angle = torch ? TORCH.angle : HEADLAMP.angle;
    this.spill.intensity = power * HEADLAMP.spill;
    this.applyDay();
  }

  /** A flashlight on in the hand (Kemal's): in the dark the cone narrows, burns brighter and reaches farther. Light values only; compiles nothing. */
  get torch(): boolean { return this.torch_; }
  set torch(on: boolean) {
    if (on === this.torch_) return;
    this.torch_ = on;
    this.dark = this.dark_;
  }

  /**
   * Lay the day over the light and air just set (by `dark`): sky-coloured haze far off, a bright sky,
   * the sun, the carried lamp and the burning lamps faded out. Light values only: never a new shader.
   */
  private applyDay(): void {
    const d = this.day;
    this.sun.intensity = DAY.sunPower * d;
    this.lamps.power = this.lamplight * (1 - d);
    this.dayFog.setRGB(...this.air.fog, SRGBColorSpace).lerp(DAY.fog, d);
    this.fog.color.copy(this.dayFog);
    (this.scene.background as Color).copy(this.dayFog);
    this.ambient.color.setRGB(...this.air.sky, SRGBColorSpace).lerp(DAY.sky, d);
    this.ambient.groundColor.setRGB(...this.air.ground, SRGBColorSpace).lerp(DAY.ground, d);
    if (d <= 0) return;
    this.ambient.intensity += (DAY.ambient - this.ambient.intensity) * d;
    this.fog.near += (DAY.fogNear - this.fog.near) * d;
    this.fog.far += (DAY.fogFar - this.fog.far) * d;
    this.headlamp.intensity *= 1 - d;
    this.spill.intensity *= 1 - d;
  }

  /** Ease the daylight towards what reaches (x, y, z) (none below the town); `dt` in seconds. */
  private follow(x: number, y: number, z: number, dt: number): void {
    const want = this.level_.depth === 0 ? daylightAt(x, y, z) : 0;
    const next = Math.abs(want - this.day) < 0.002 ? want : this.day + (want - this.day) * Math.min(1, dt * DAY.ease);
    if (next === this.day) return;
    this.day = next;
    this.dark = this.dark_; // the night's light afresh, the day laid over it
  }

  /** Show or hide the streamed rock and props (the Lab's creature studio draws on a plain floor). */
  set worldShown(v: boolean) { this.rock.visible = v; this.things.visible = v; }

  /** True when the rock and props around the viewer are all on screen. */
  get settled(): boolean {
    return !!this.terrain_?.settled && !!this.props_?.settled;
  }

  /** How far the rock around the viewer has come, 0–1 (the loading screen's bar; props follow it closely). */
  get streamed(): number {
    return this.settled ? 1 : Math.min(0.99, this.terrain_?.progress ?? 0);
  }

  /** Put the headlamp where it is carried (in the camera's frame); it shines where the camera looks. */
  private aimHeadlamp(): void {
    if (!this.carrier) this.headlamp.position.set(0, 0, 0);
    else {
      this.camera.updateMatrixWorld();
      this.camera.worldToLocal(this.headlamp.position.copy(this.carrier));
    }
    this.spill.position.copy(this.headlamp.position);
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  /**
   * Once per frame: stream around (x, y, z), then render. `time` in seconds. `draw` false while
   * something covers the view (the loading screen, the black of an arrival): streaming goes on,
   * and the frame's drawing time goes to it.
   */
  frame(x: number, y: number, z: number, time: number, draw = true): void {
    this.stage.frame();
    this.aimHeadlamp();
    this.dust.follow(this.headlamp);
    this.terrain.update(x, y, z);
    this.props.update(x, y, z, time);
    this.prepared.work(this.settled, time);
    this.drips.draw(this.level_, x, z, time);
    this.blooms.draw(this.level_, x, z, time);
    this.hums.draw(time);
    this.pulseVeins(x, z, time);
    this.follow(x, y, z, Math.max(0, Math.min(0.1, time - this.lastTime)));
    this.watchers.draw(this.props.watcherLists, x, z, this.camera, Math.min(0.1, time - this.lastTime));
    this.lastTime = time;
    if (draw) this.renderer.render(this.scene, this.camera);
  }

  /** The pulse in the veins (src/gen/veinPulse.ts): where it starts is latched when it starts; its ring goes to the rock's shader. */
  private pulseVeins(x: number, z: number, time: number): void {
    const start = this.pulseHeld !== null ? -1 : this.level_.depth ? pulseAt(this.level_.seed, this.level_.depth, time) : null;
    if (start === null) { this.pulse = null; VEIN_PULSE.value.w = 0; return; }
    if (this.pulse?.start !== start) {
      this.camera.getWorldDirection(this.facing);
      this.pulse = { start, at: pulseFrom(this.level_, x, z, this.facing.x, this.facing.z) };
    }
    const [r, strength] = pulseRing(this.pulseHeld ?? time - start);
    VEIN_PULSE.value.set(this.pulse.at[0], this.pulse.at[1], r, strength);
  }
}

/**
 * The headlamp: half the cone's angle and its soft edge, its shadow map size and reach, the share of
 * its light spilt all round, and how fast it falls off. A gentle falloff (1, not the physical 2): the
 * rock an arm's length away must not burn out to white while the far end of a hall still shows.
 */
const HEADLAMP = { angle: 0.95, penumbra: 0.6, map: 1024, shadowFar: 60, spill: 0.15, decay: 1 };
/** The flashlight's beam over the headlamp's: its half angle, how much brighter, how much farther the dark lets one see. */
const TORCH = { angle: 0.38, power: 10, reach: 2.2 };

/**
 * The day over the village: the haze far off (and the sky behind it), the ambient light from the sky
 * and the fields, the sun (its colour, power, and where it stands: up the hill's side, south-west and
 * high), how far one sees, and how fast the eye takes to it when going in or out (per second).
 */
const DAY = {
  fog: new Color().setRGB(0.66, 0.76, 0.86, SRGBColorSpace),
  sky: new Color().setRGB(0.86, 0.9, 0.96, SRGBColorSpace),
  ground: new Color().setRGB(0.42, 0.42, 0.3, SRGBColorSpace),
  ambient: 1.4,
  sun: 0xfff0d8, sunPower: 2.4, toSun: [-45, 80, 40] as const,
  fogNear: 90, fogFar: 1200,
  ease: 2.5,
} as const;

function need<T>(v: T | null): T {
  if (!v) throw new Error('LevelView.start() has not finished');
  return v;
}
