/**
 * The nobody: Scale's human (decision D1, @futuremagic/humanoid) dressed in rags, posed from the
 * body's movement by the package's animator (mocap walk, run, climb, swim, fall, death).
 */
import { Group, type Mesh, type Object3D } from 'three/webgpu';
import { randomAppearance, setHumanAssetBase, type HumanoidAppearance } from '@futuremagic/humanoid';
import { Humanoid } from '@futuremagic/humanoid/three';
import { deriveSeed } from '@futuremagic/core';
import type { Body } from '../../world/traverse/body';
import type { Level } from '../../gen/level';
import { WARDROBE, rags } from './wardrobe';
import { moveOf } from './move';

/** Where Vite serves the package's assets (vite.config.ts). */
setHumanAssetBase(`${import.meta.env.BASE_URL}humanoid/`);

/** The nobody's look: a human of the grandchild's seed (Grandma's family, so always human). */
export function nobodyLook(seed: number): HumanoidAppearance {
  return randomAppearance('human', deriveSeed(seed, 'nobody'), { age: 0.46 });
}

export class Nobody {
  /** Put this into the scene (it moves with the body). */
  readonly root: Object3D;
  /** At eye height, turning with the body: things like the headlamp hang here. */
  readonly head = new Group();
  private readonly ground: (x: number, y: number, z: number) => number | null;

  static async create(seed: number, level: Level): Promise<Nobody> {
    const h = await Humanoid.create(nobodyLook(seed), { wardrobe: WARDROBE, expressions: true });
    h.dress(rags(seed));
    return new Nobody(h, level);
  }

  private constructor(readonly human: Humanoid, level: Level) {
    this.root = human.object;
    this.head.position.y = human.height - 0.1;
    this.root.add(this.head);
    // The feet find the floor (the rock's surface under them, if near).
    this.ground = (x, y, z) => {
      const g = level.groundAt(x, z);
      return Math.abs(g - y) < 0.8 ? g : null;
    };
  }

  /**
   * Show or hide the meshes (hidden in first person). The root stays visible: a light hanging on
   * it must stay in the scene, or the light count, and every shader, would change.
   */
  set shown(v: boolean) {
    this.root.traverse((o) => { if ((o as Mesh).isMesh) o.visible = v; });
  }

  /** Follow the body: place, turn and pose. */
  pose(b: Body, dt: number, time: number): void {
    const yaw = b.mode === 'climb' ? Math.atan2(b.wall[0], b.wall[2]) : b.facing;
    this.human.update({ pos: [b.x, b.y, b.z], vel: [b.vx, b.vy, b.vz], yaw, anim: { move: moveOf(b) } }, dt, time, this.ground);
  }
}
