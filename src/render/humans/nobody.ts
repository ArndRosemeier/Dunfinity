/**
 * The nobody: Scale's human (decision D1, @futuremagic/humanoid) dressed in rags, posed from the
 * body's movement by the package's animator (mocap walk, run, climb, swim, fall, death).
 */
import { Group, type Mesh, type Object3D } from 'three/webgpu';
import { randomAppearance, setHumanAssetBase, type HumanoidAppearance } from '@futuremagic/humanoid';
import { Humanoid, type ActionAnim, type MoveState } from '@futuremagic/humanoid/three';
import { deriveSeed } from '@futuremagic/core';
import type { Body } from '../../world/traverse/body';
import type { Level } from '../../gen/level';
import { WARDROBE, rags } from './wardrobe';
import { moveOf, SWIM, swimLift } from './move';

/** Where Vite serves the package's assets (vite.config.ts). */
setHumanAssetBase(`${import.meta.env.BASE_URL}humanoid/`);

/** The nobody's look: a human of the grandchild's seed (Grandma's family, so always human). */
export function nobodyLook(seed: number): HumanoidAppearance {
  return randomAppearance('human', deriveSeed(seed, 'nobody'), { age: 0.46 });
}

/** Where a human's feet find the floor (its foot IK): the rock's surface under them, if near, on the level `level()` gives. */
export function floorUnder(level: () => Level | null): (x: number, y: number, z: number) => number | null {
  return (x, y, z) => {
    const l = level();
    if (!l) return null;
    const g = l.groundAt(x, z);
    return Math.abs(g - y) < 0.8 ? g : null;
  };
}

export class Nobody {
  /** Put this into the scene (it moves with the body). */
  readonly root: Object3D;
  /** At eye height, turning with the body: things like the headlamp hang here. */
  readonly head = new Group();
  private readonly ground: (x: number, y: number, z: number) => number | null;
  /** The level the feet stand on (changes on the way down). */
  level: Level;

  static async create(seed: number, level: Level): Promise<Nobody> {
    const h = await Humanoid.create(nobodyLook(seed), { wardrobe: WARDROBE, expressions: true });
    h.dress(rags(seed));
    return new Nobody(h, level, seed);
  }

  /** Grandma's pot lid on the arm (the Pot Lid card), or not. Re-dresses only when it changes. */
  set lid(on: boolean) {
    if (on === this.lid_) return;
    this.lid_ = on;
    this.human.dress(rags(this.seed, on));
  }

  private lid_ = false;

  /** How far the figure is drawn over the body's feet now (`swimLift` while swimming, else 0, eased). */
  lift = 0;

  private constructor(readonly human: Humanoid, level: Level, private readonly seed: number) {
    this.level = level;
    this.root = human.object;
    this.head.position.y = human.height - 0.1;
    this.root.add(this.head);
    this.ground = floorUnder(() => this.level);
  }

  /**
   * Show or hide the meshes (hidden in first person). The root stays visible: a light hanging on
   * it must stay in the scene, or the light count, and every shader, would change.
   */
  set shown(v: boolean) {
    this.root.traverse((o) => { if ((o as Mesh).isMesh) o.visible = v; });
  }

  /** Pose as a puppet (a scripted scene such as a ladder climb): feet at pos, facing yaw. */
  puppet(pos: [number, number, number], vel: [number, number, number], yaw: number, move: MoveState, dt: number, time: number): void {
    this.human.update({ pos, vel, yaw, anim: { move } }, dt, time, null);
  }

  /**
   * Follow the body: place, turn and pose. `action`: a one-shot (a stab) playing over the movement;
   * `combat`: the knife drawn and held ready (else sheathed at the hip); `move`: what the body does, if not what its state says (crouched by a fire).
   */
  pose(b: Body, dt: number, time: number, action?: ActionAnim, combat = false, move: MoveState = moveOf(b)): void {
    const yaw = b.mode === 'climb' ? Math.atan2(b.wall[0], b.wall[2]) : b.facing;
    this.human.update({ pos: [b.x, b.y + this.lifted(b, dt), b.z], vel: [b.vx, b.vy, b.vz], yaw, anim: { move, action }, combat, sneaking: b.sneaking }, dt, time, this.ground);
  }

  /** Ease `lift` towards the swim pose's water line while swimming, else to the feet; its new value. */
  private lifted(b: Body, dt: number): number {
    const to = b.mode === 'swim' ? swimLift(this.human.height) : 0;
    return (this.lift += Math.max(-SWIM.rate * dt, Math.min(SWIM.rate * dt, to - this.lift)));
  }

  /** A blow landed on the nobody from direction (dx, dz) (towards them), strength 0..1: they flinch. */
  hit(dx: number, dz: number, strength: number): void {
    this.human.animator.onHit(dx, dz, strength);
  }
}
