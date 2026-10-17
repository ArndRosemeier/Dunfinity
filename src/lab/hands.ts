/**
 * The Lab's hands view (`?lab&hands=<weapon>&studio`): the nobody standing with a weapon held ready,
 * for a close look at the fist round it. `__lab.hands.act = { id, at, dur }` holds the figure at `at`
 * seconds into that action (the swing never moves on); `__lab.hands.view = { yaw, dist, up }` puts the
 * camera `dist` metres off the right fist, `yaw` radians round from the figure's front, `up` metres
 * above it, looking at it; `{ grip: [x, y, z] }` puts it there in the fist's own frame (with `side: 'L'`, the left fist's; the grip
 * socket's: +y out of the thumb side along the handle, +z along the fingers) (tools/shot/grip-probe.mjs).
 */
import { Vector3, type PerspectiveCamera } from 'three/webgpu';
import type { ActionAnim } from '@futuremagic/humanoid/three';
import { HumanPool, humans, type Drawn } from '../render/creatures/humanPool';
import { nobodyLook } from '../render/humans/nobody';
import { rags } from '../render/humans/wardrobe';
import type { ItemKind } from '../loot/items';

export class Hands {
  readonly pool: HumanPool<Drawn>;
  /** The one action held, if any. */
  act: { id: string; at: number; dur: number } | null = null;
  /** Where the camera looks at the fist from, if anywhere. */
  view: { yaw: number; dist: number; up: number } | { grip: [number, number, number]; side?: 'L' | 'R' } | null = null;
  private readonly place: Drawn[] = [];

  /** `held`: 'knife' (grandma's, in every hand by default) or kit items, comma-separated ('pick,flashlight'). */
  static async holding(seed: number, held: string): Promise<Hands> {
    const items = held.split(',').filter((k) => k !== 'knife').map((k) => ({ kind: k as ItemKind, quality: 'sound' as const }));
    return new Hands(await humans(1, () => nobodyLook(seed), () => rags(seed, false, items)));
  }

  private constructor(private readonly h: Awaited<ReturnType<typeof humans>>) {
    this.pool = new HumanPool(h, 200, (_t, time) => {
      const a = this.act;
      const action: ActionAnim | undefined = a ? { id: a.id, t0: time - a.at, dur: a.dur } : undefined;
      return { anim: { move: 'idle', mood: 'focused', action }, combat: true };
    });
  }

  /** Stand them `ahead` metres before (x, y, z), looking along `yaw` (forward (-sin, -cos)), facing back. */
  standBefore(x: number, y: number, z: number, yaw: number, ahead: number): void {
    this.place[0] = { x: x - Math.sin(yaw) * ahead, y, z: z - Math.cos(yaw) * ahead, vx: 0, vz: 0, yaw: yaw + Math.PI, health: 1, dead: false };
  }

  /** Pose them, then (with a `view`) put the camera on the fist. */
  poseAndFrame(camera: PerspectiveCamera, dt: number, time: number): void {
    const p = this.place[0];
    this.pool.draw(this.place, p.x, p.z, dt, time);
    const v = this.view, grip = this.h[0].socket(`grip.${v && 'side' in v && v.side === 'L' ? 'L' : 'R'}`);
    if (!v || !grip) return;
    this.h[0].object.updateMatrixWorld(true);
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
