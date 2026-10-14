/**
 * A level on screen: scene, fog, the fixed lights (ambient, headlamp, lamp pool), the Stage and its
 * warm-up, and the streamed rock and props. The Lab and the game both look at a level through this.
 *
 * Lights are fixed before the warm-up: they are part of every shader's cache key (docs/SHADERS.md).
 */
import { Scene, PerspectiveCamera, Color, Fog, HemisphereLight, PointLight, Group, type Object3D, type WebGPURenderer } from 'three/webgpu';
import type { Level } from '../gen/level';
import { createRenderer } from './renderer';
import { Stage } from './stage';
import { Terrain } from './terrain/Terrain';
import { Props } from './props/Props';
import { LampLights } from './props/lamps';

/** Fog distances: a lit survey view, and roughly what a headlamp shows. */
const FOG = { survey: [80, 900], dark: [10, 140] } as const;

export class LevelView {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(70, 1, 0.1, 4000);
  readonly stage: Stage;
  readonly fog = new Fog(0x050607, FOG.survey[0], FOG.survey[1]);
  /** The light the viewer carries; it rides on the camera. */
  readonly headlamp = new PointLight(0xffe9cc, 160, 160, 1.4);
  private readonly ambient = new HemisphereLight(0x9aa6b4, 0x2a2218, 0.7);
  private readonly lamps: LampLights;
  private terrain_: Terrain | null = null;
  private props_: Props | null = null;
  private dark_ = false;
  /** Headlamp intensity in the survey view and in the dark (a lamp carried close to the body wants less). */
  headlampPower = { survey: 160, dark: 45 };

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

  constructor(readonly renderer: WebGPURenderer, readonly level: Level) {
    this.scene.background = new Color(0x050607);
    this.scene.fog = this.fog;
    this.scene.add(this.ambient);
    this.lamps = new LampLights(this.scene);
    this.camera.add(this.headlamp);
    this.scene.add(this.camera);
    this.stage = new Stage(renderer, this.scene, this.camera);
  }

  /** Compile every material kind (behind the loading screen), then start streaming the level. */
  /** Warm up the shaders (with `extra`, see Stage.warmUp), then start streaming the level. */
  async start(extra: readonly Object3D[] = []): Promise<void> {
    await this.stage.warmUp(extra);
    const rock = new Group();
    const things = new Group();
    this.scene.add(rock, things);
    this.terrain_ = new Terrain(this.stage, rock, this.level.seed, this.level.depth);
    this.props_ = new Props(this.stage, things, this.level.seed, this.level.depth, this.lamps);
  }

  get terrain(): Terrain { return need(this.terrain_); }
  get props(): Props { return need(this.props_); }

  /** Survey view, or what a miner sees: the headlamp and the burning lamps. */
  get dark(): boolean { return this.dark_; }
  set dark(dark: boolean) {
    this.dark_ = dark;
    [this.fog.near, this.fog.far] = dark ? FOG.dark : FOG.survey;
    this.ambient.intensity = dark ? 0.05 : 0.7;
    this.headlamp.intensity = dark ? this.headlampPower.dark : this.headlampPower.survey;
  }

  /** True when the rock and props around the viewer are all on screen. */
  get settled(): boolean {
    return !!this.terrain_?.settled && !!this.props_?.settled;
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  /** Once per frame: stream around (x, y, z), then render. `time` in seconds. */
  frame(x: number, y: number, z: number, time: number): void {
    this.stage.frame();
    this.terrain.update(x, y, z);
    this.props.update(x, y, z, time);
    this.renderer.render(this.scene, this.camera);
  }
}

function need<T>(v: T | null): T {
  if (!v) throw new Error('LevelView.start() has not finished');
  return v;
}
