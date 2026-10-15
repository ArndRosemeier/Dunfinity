/**
 * The Foreman on screen (src/creatures/foreman.ts): one of Scale's humans built three metres tall,
 * the Salt-Touched look on him (grey skin crusted with crystals, pale glowing eyes), in a miner's
 * clothes with his pick. Beside him the old mine bell on its timber frame. He strikes the bell
 * with the pick to ring it, and it swings and goes on swinging; he brings the pick down over his
 * head on you, flinches when stabbed and falls when he dies.
 *
 * Built before the warm-up (his materials compile with the rest) and added with the Stage once.
 */
import { Group, type Object3D } from 'three/webgpu';
import { Humanoid, type ActionAnim } from '@futuremagic/humanoid/three';
import { deriveSeed } from '@futuremagic/core';
import type { Rgb } from '../../gen/propMesh';
import { meshOf as mesh } from '../meshes';
import { METAL, VERTEX_COLOR_SOLID } from '../materials';
import { FOREMAN, type Boss, type Hall } from '../../creatures/foreman';
import { groundSpeed } from '../../creatures/creature';
import type { Level } from '../../gen/level';
import { WARDROBE, minersClothes } from '../humans/wardrobe';
import { floorUnder } from '../humans/nobody';
import { touchedLook } from './touchedView';

const WOOD: Rgb = [0.3, 0.22, 0.15], BRONZE: Rgb = [0.42, 0.3, 0.14];
/** One strike of the bell, seconds (he strikes it twice in a ringing). */
const STRIKE = 1.3;

/** The bell's frame (at its feet) and the bell itself (hung from the crossbeam, swinging about it). */
function bellParts() {
  const frame = mesh((b) => {
    for (const s of [-1, 1]) b.beam(s * 0.7, 0, 0, s * 0.6, 2.6, 0, 0.14, 0.14, WOOD);
    b.beam(-0.8, 2.6, 0, 0.8, 2.6, 0, 0.16, 0.18, WOOD);
  }, VERTEX_COLOR_SOLID);
  const bell = mesh((b) => {
    b.cylinder(0, -0.55, 0, 0.3, 0.3, BRONZE, 14, 0, -0.7); // wide at the mouth
    b.ellipsoid(0, -0.25, 0, 0.3, 0.14, 0.3, BRONZE, 12);
    b.ellipsoid(0, -0.88, 0, 0.07, 0.07, 0.07, BRONZE, 6); // the clapper
  }, METAL);
  return { frame, bell };
}

export class ForemanView {
  readonly root = new Group();
  /** The level he stands on (the feet find its floor). */
  level: Level | null = null;
  private readonly ground = floorUnder(() => this.level);
  private readonly frame = new Group();
  private readonly swing = new Group();
  private health = 0;

  static async create(seed: number): Promise<ForemanView> {
    const human = await Humanoid.create({ ...touchedLook(seed, 0), scale: FOREMAN.height / 1.78, muscle: 1, weight: 0.85 }, { wardrobe: WARDROBE, expressions: true });
    human.dress(minersClothes(deriveSeed(seed, 'foreman', 'clothes')));
    return new ForemanView(human);
  }

  private constructor(private readonly human: Humanoid) {
    const p = bellParts();
    this.frame.add(p.frame, this.swing);
    this.swing.position.y = 2.6;
    this.swing.add(p.bell);
    this.root.add(human.object, this.frame);
  }

  /** His figure, for the warm-up (`stage.warmUp(extra)`). */
  get figures(): Object3D[] {
    return [this.human.object, this.frame];
  }

  /** Draw him (if he is about) and the bell of `hall` (if this level has one). */
  draw(f: Boss | null, hall: Hall | null, dt: number, time: number): void {
    this.frame.visible = !!hall;
    this.human.object.visible = !!f;
    if (hall) {
      this.frame.position.set(hall.bx, this.level?.groundAt(hall.bx, hall.bz) ?? hall.y, hall.bz);
      this.frame.rotation.y = Math.atan2(hall.bx - hall.x, hall.bz - hall.z) + Math.PI / 2;
      // Struck, the bell swings, and dies down slowly.
      const t = f ? f.ringT : 99, k = t < FOREMAN.ring.dur + 4 ? Math.exp(-0.5 * Math.max(0, t - FOREMAN.ring.at)) : 0;
      this.swing.rotation.x = t >= FOREMAN.ring.at ? Math.sin((t - FOREMAN.ring.at) * 5) * 0.45 * k : 0;
    }
    if (!f) return;
    if (f.health < this.health) this.human.animator.onHit(Math.sin(f.yaw), Math.cos(f.yaw), f.dead ? 1 : 0.4);
    this.health = f.health;
    const S = FOREMAN.swing;
    let action: ActionAnim | undefined;
    if (f.mode === 'swing') action = { id: 'slam', t0: time - f.swingT, dur: S.dur };
    else if (f.mode === 'ring') action = { id: 'swing_1h', t0: time - (f.ringT % STRIKE), dur: STRIKE };
    this.human.update({
      pos: [f.x, f.y, f.z], vel: [f.vx, 0, f.vz], yaw: f.yaw,
      anim: { move: f.dead ? 'dead' : groundSpeed(f) > 0.15 ? 'walk' : 'idle', action, mood: f.angry ? 'angry' : 'neutral' },
      combat: f.angry && !f.dead,
    }, dt, time, this.ground);
  }
}
