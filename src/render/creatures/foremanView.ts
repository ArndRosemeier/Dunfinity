/**
 * The Foreman on screen (src/creatures/foreman.ts): the skeleton of a man three metres tall, his
 * bones thick with salt (the Salt-Touched's look, heavier: his crust turns a knife), in a miner's
 * hard hat and trousers with his pick. Beside him the old mine bell on its timber frame. He strikes the bell
 * with the pick to ring it, and it swings and goes on swinging; he brings the pick down over his
 * head on you, flinches when stabbed and falls when he dies.
 *
 * Built before the warm-up (his materials compile with the rest) and added with the Stage once.
 */
import { Group, type Object3D } from 'three/webgpu';
import type { ActionAnim } from '../actors/figure';
import type { Rgb } from '../../gen/propMesh';
import { meshOf as mesh } from '../meshes';
import { METAL, VERTEX_COLOR_SOLID } from '../materials';
import { FOREMAN, type Boss, type Hall } from '../../creatures/foreman';
import { groundSpeed } from '../../creatures/creature';
import type { Level } from '../../gen/level';
import { HumanPool, figures, type PoolFigure } from './humanPool';
import { miner, touchedLook } from './touchedView';

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
  private readonly man: HumanPool<Boss>;
  private readonly frame = new Group();
  private readonly swing = new Group();

  static async create(seed: number): Promise<ForemanView> {
    const [f] = await figures(1, async () => {
      const look = await touchedLook(seed, 0);
      return { ...look, body: { ...look.body, muscle: 1, weight: 0.85 } };
    }, () => 'pick', miner(1));
    // Three metres of him: the man's frame, scaled.
    f.object.scale.setScalar(FOREMAN.height / f.height);
    return new ForemanView([f]);
  }

  private constructor(man: PoolFigure[]) {
    this.man = new HumanPool(man, Infinity, (f, time) => {
      const S = FOREMAN.swing;
      let action: ActionAnim | undefined;
      if (f.mode === 'swing') action = { id: 'slam', t0: time - f.swingT, dur: S.dur };
      else if (f.mode === 'ring') action = { id: 'swing_1h', t0: time - (f.ringT % STRIKE), dur: STRIKE };
      return { anim: { move: f.dead ? 'dead' : groundSpeed(f) > 0.15 ? 'walk' : 'idle', action, mood: f.angry ? 'angry' : 'neutral' }, combat: f.angry && !f.dead };
    }, 0.4);
    const p = bellParts();
    this.frame.add(p.frame, this.swing);
    this.swing.position.y = 2.6;
    this.swing.add(p.bell);
    this.root.add(this.man.root, this.frame);
  }

  /** The level he stands on (the feet find its floor). */
  get level(): Level | null {
    return this.man.level;
  }

  set level(l: Level | null) {
    this.man.level = l;
  }

  /** His figure, for the warm-up (`stage.warmUp(extra)`). */
  get figures(): Object3D[] {
    return [...this.man.figures, this.frame];
  }

  /** Draw him (if he is about) and the bell of `hall` (if this level has one). */
  draw(f: Boss | null, hall: Hall | null, dt: number, time: number): void {
    this.frame.visible = !!hall;
    if (hall) {
      this.frame.position.set(hall.bx, this.level?.groundAt(hall.bx, hall.bz) ?? hall.y, hall.bz);
      this.frame.rotation.y = Math.atan2(hall.bx - hall.x, hall.bz - hall.z) + Math.PI / 2;
      // Struck, the bell swings, and dies down slowly.
      const t = f ? f.ringT : 99, k = t < FOREMAN.ring.dur + 4 ? Math.exp(-0.5 * Math.max(0, t - FOREMAN.ring.at)) : 0;
      this.swing.rotation.x = t >= FOREMAN.ring.at ? Math.sin((t - FOREMAN.ring.at) * 5) * 0.45 * k : 0;
    }
    this.man.draw(f ? [f] : [], f?.x ?? 0, f?.z ?? 0, dt, time);
  }
}
