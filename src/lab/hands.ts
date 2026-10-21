/**
 * The Lab's hands view (`?lab&hands=<items>&studio`): the nobody standing with its kit held ready,
 * for a close look at the fist round it. `__lab.hands.act = { id, at, dur }` holds the figure at `at`
 * seconds into that action (the swing never moves on); `__lab.hands.view = { yaw, dist, up }` puts the
 * camera `dist` metres off the right fist, `yaw` radians round from the figure's front, `up` metres
 * above it, looking at it; `{ grip: [x, y, z] }` puts it there in the fist's own frame (with `side: 'L'`, the left fist's; the grip
 * socket's: +y out of the thumb side along the handle, +z along the fingers) (tools/shot/grip-probe.mjs).
 */
import { Vector3, type Object3D, type PerspectiveCamera } from 'three/webgpu';
import type { ActionAnim } from '../render/actors/figure';
import { Nobody } from '../render/humans/nobody';
import type { Level } from '../gen/level';
import type { ItemKind } from '../loot/items';

export class Hands {
  /** The one action held, if any. */
  act: { id: string; at: number; dur: number } | null = null;
  /** Where the camera looks at the fist from, if anywhere. */
  view: { yaw: number; dist: number; up: number } | { grip: [number, number, number]; side?: 'L' | 'R' } | null = null;
  private readonly place = { x: 0, y: 0, z: 0, yaw: 0 };

  /** `held`: kit items, comma-separated ('pick,flashlight'); 'knife' is left out (no one carries it now). */
  static async holding(seed: number, held: string): Promise<Hands> {
    const items = held.split(',').filter((k) => k && k !== 'knife').map((k) => ({ kind: k as ItemKind, quality: 'sound' as const }));
    const nobody = await Nobody.create(seed, null);
    nobody.wear(false, items);
    return new Hands(nobody);
  }

  private constructor(private readonly nobody: Nobody) {}

  /** What goes into the scene (and the warm-up). */
  get root(): Object3D { return this.nobody.root; }
  set level(l: Level | null) { this.nobody.level = l; }

  /** Stand them `ahead` metres before (x, y, z), looking along `yaw` (forward (-sin, -cos)), facing back. */
  standBefore(x: number, y: number, z: number, yaw: number, ahead: number): void {
    Object.assign(this.place, { x: x - Math.sin(yaw) * ahead, y, z: z - Math.cos(yaw) * ahead, yaw: yaw + Math.PI });
  }

  /** Pose them, then (with a `view`) put the camera on the fist. */
  poseAndFrame(camera: PerspectiveCamera, dt: number, time: number): void {
    const p = this.place, a = this.act;
    const action: ActionAnim | undefined = a ? { id: a.id, t0: time - a.at, dur: a.dur } : undefined;
    this.nobody.puppet([p.x, p.y, p.z], [0, 0, 0], p.yaw, 'idle', dt, time, action, true);
    const v = this.view;
    if (!v) return;
    const grip = this.nobody.figure.rig.socket('side' in v && v.side === 'L' ? 'grip.L' : 'grip.R');
    this.nobody.root.updateMatrixWorld(true);
    grip.getWorldPosition(at);
    if ('grip' in v) camera.position.copy(grip.localToWorld(from.set(...v.grip)));
    else {
      const yaw = p.yaw + v.yaw;
      camera.position.set(at.x - Math.sin(yaw) * v.dist, at.y + v.up, at.z - Math.cos(yaw) * v.dist);
    }
    camera.lookAt(at);
  }
}

const at = new Vector3(), from = new Vector3();
