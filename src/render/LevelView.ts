/**
 * A level on screen: scene, fog, the fixed lights (ambient, headlamp, lamp pool), the Stage and its
 * warm-up, and the streamed rock and props. The Lab and the game both look at a level through this.
 *
 * Lights are fixed before the warm-up: they are part of every shader's cache key (docs/SHADERS.md).
 */
import { Scene, PerspectiveCamera, Color, SRGBColorSpace, Fog, HemisphereLight, PointLight, SpotLight, Group, Vector3, type Object3D, type WebGPURenderer } from 'three/webgpu';
import type { Level } from '../gen/level';
import { airOf, type Air } from '../gen/air';
import { createRenderer } from './renderer';
import { Stage } from './stage';
import { Dust } from './dust';
import { ROCK_FINISH, ROCK_VEINS, SKY_LOOK, setRockRecipes } from './materials';
import { skyOf } from '../gen/glowworms';
import { Terrain } from './terrain/Terrain';
import { Props } from './props/Props';
import { LampLights } from './props/lamps';
import { Watchers } from './props/watchers';
import { DripView } from './props/dripView';
import { DEFAULT_VIEW, type ChunkView } from '../world/chunks';
import { QUALITY } from './quality';
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
  private readonly lamps: LampLights;
  private readonly rock = new Group();
  private readonly things = new Group();
  private readonly dust: Dust;
  private readonly watchers = new Watchers();
  /** The living stalagmites near the viewer (src/gen/drips.ts). */
  readonly drips = new DripView();
  private lastTime = 0;
  private terrain_: Terrain | null = null;
  private props_: Props | null = null;
  private dark_ = false;
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
    this.dark = this.dark_; // the fog's distances, as clear as the air
    setRockRecipes(this.level_.rockRecipes);
    const sky = skyOf(this.level_.seed, this.level_.depth);
    SKY_LOOK.tint.value.set(...sky.color);
    SKY_LOOK.arms.value.set(sky.arms, sky.spin);
    const finish = this.level_.band.finish;
    ROCK_FINISH.formwork.value = finish.formwork; ROCK_FINISH.wet.value = finish.wet;
    this.lamps.power = this.level_.band.lamplight;
    this.terrain_ = new Terrain(this.stage, this.rock, this.level_.key, this.chunkView);
    this.props_ = new Props(this.stage, this.things, this.level_.key, this.lamps);
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
  }

  get terrain(): Terrain { return need(this.terrain_); }
  get props(): Props { return need(this.props_); }

  /** Survey view, or what a miner sees: the headlamp and the burning lamps. */
  get dark(): boolean { return this.dark_; }
  set dark(dark: boolean) {
    this.dark_ = dark;
    const [near, far] = dark ? FOG.dark : FOG.survey;
    this.fog.near = near * this.air.clear; this.fog.far = far * this.air.clear;
    this.ambient.intensity = dark ? 0.05 : 0.7;
    this.headlamp.intensity = dark ? this.headlampPower.dark : this.headlampPower.survey;
    this.spill.intensity = this.headlamp.intensity * HEADLAMP.spill;
  }

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
    this.drips.draw(this.level_, x, z, time);
    this.watchers.draw(this.props.watcherLists, x, z, this.camera, Math.min(0.1, time - this.lastTime));
    this.lastTime = time;
    if (draw) this.renderer.render(this.scene, this.camera);
  }
}

/**
 * The headlamp: half the cone's angle and its soft edge, its shadow map size and reach, the share of
 * its light spilt all round, and how fast it falls off. A gentle falloff (1, not the physical 2): the
 * rock an arm's length away must not burn out to white while the far end of a hall still shows.
 */
const HEADLAMP = { angle: 0.95, penumbra: 0.6, map: 1024, shadowFar: 60, spill: 0.15, decay: 1 };

function need<T>(v: T | null): T {
  if (!v) throw new Error('LevelView.start() has not finished');
  return v;
}
