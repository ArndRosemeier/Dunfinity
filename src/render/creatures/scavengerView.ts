/**
 * The scavengers on screen (src/creatures/scavengers.ts): Scale's humans, living people, younger
 * and weathered, in patched clothes, with crowbars. They sit round their fire on crates, get up and
 * turn to you, come at you swinging the crowbar, flinch when stabbed, and fall when they die. Their
 * camps: a ring of stones, burning sticks with flames that flicker, a crate to sit on at each seat.
 *
 * The people are a `HumanPool` (built before the warm-up); the camps a `FigurePool` added with the
 * Stage once.
 */
import { Group, type Object3D } from 'three/webgpu';
import { randomAppearance, type HumanoidAppearance } from '@futuremagic/humanoid';
import type { Humanoid, ActionAnim } from '@futuremagic/humanoid/three';
import { deriveSeed } from '@futuremagic/core';
import { SCAVENGER, type Camp, type Scavenger } from '../../creatures/scavengers';
import { groundSpeed } from '../../creatures/creature';
import type { Rgb } from '../../gen/propMesh';
import { meshOf as mesh } from '../meshes';
import { GLOW, VERTEX_COLOR_SOLID } from '../materials';
import { scavengersClothes } from '../humans/wardrobe';
import { HumanPool, humans } from './humanPool';
import { FigurePool, type Figure } from './figures';

/** How many people and camps can be drawn at once, and how far off the people are drawn, metres. */
const PEOPLE = 4;
const CAMPS = 3;
const SHOWN = 60;

const STONE: Rgb = [0.3, 0.29, 0.27], ASH: Rgb = [0.12, 0.11, 0.1], STICK: Rgb = [0.22, 0.14, 0.08], CRATE: Rgb = [0.34, 0.26, 0.17], SLAT: Rgb = [0.25, 0.19, 0.12];
const FLAME: Rgb = [1, 0.55, 0.15], CORE: Rgb = [1, 0.85, 0.5], EMBER: Rgb = [0.75, 0.2, 0.05];

/** A scavenger's look: a living person, weathered by the dark. */
function scavengerLook(seed: number, k: number): HumanoidAppearance {
  return randomAppearance('human', deriveSeed(seed, 'scavenger', k), { age: 0.3 + 0.12 * k, gender: k === 1 ? 0.15 : 0.85 });
}

function campParts() {
  const hearth = mesh((b) => {
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      b.ellipsoid(Math.sin(a) * 0.42, 0.06, Math.cos(a) * 0.42, 0.11, 0.08, 0.09, STONE, 6);
    }
    b.ellipsoid(0, 0.01, 0, 0.36, 0.03, 0.36, ASH, 10);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.3;
      b.tube(Math.sin(a) * 0.32, 0.04, Math.cos(a) * 0.32, Math.sin(a) * 0.04, 0.2, Math.cos(a) * 0.04, 0.03, STICK, 6);
    }
  }, VERTEX_COLOR_SOLID);
  const embers = mesh((b) => b.ellipsoid(0, 0.05, 0, 0.2, 0.04, 0.2, EMBER, 8), GLOW);
  const flame = mesh((b) => {
    b.ellipsoid(0, 0.22, 0, 0.13, 0.22, 0.13, FLAME, 8);
    b.ellipsoid(0, 0.16, 0, 0.07, 0.12, 0.07, CORE, 6);
  }, GLOW);
  const crate = mesh((b) => {
    b.upright(0, 0.22, 0, 0, 0.24, 0.22, 0.2, CRATE);
    for (const y of [0.08, 0.36]) b.upright(0, y, 0, 0, 0.25, 0.03, 0.21, SLAT);
  }, VERTEX_COLOR_SOLID);
  return { hearth, embers, flame, crate };
}

class CampFigure implements Figure<Camp> {
  readonly root = new Group();
  private readonly flames: Object3D[] = [];
  private readonly seats: Object3D[] = [];

  constructor(p: ReturnType<typeof campParts>) {
    this.root.add(p.hearth.clone(), p.embers.clone());
    for (let k = 0; k < 3; k++) {
      const f = p.flame.clone();
      f.position.set(Math.sin(k * 2.1) * 0.08, 0.04, Math.cos(k * 2.1) * 0.08);
      this.flames.push(f);
      this.root.add(f);
    }
    for (let k = 0; k < SCAVENGER.count[1]; k++) {
      const c = p.crate.clone();
      this.seats.push(c);
      this.root.add(c);
    }
  }

  pose(c: Camp, time: number): void {
    this.root.visible = true;
    this.root.position.set(c.x, c.y, c.z);
    this.flames.forEach((f, k) => {
      const w = time * (7 + k * 1.3) + k * 2;
      f.scale.set(1 + Math.sin(w * 1.7) * 0.12, 0.75 + 0.35 * (0.5 + 0.5 * Math.sin(w)) * (k === 0 ? 1.3 : 1), 1 + Math.cos(w * 1.3) * 0.12);
    });
    this.seats.forEach((s, k) => {
      s.visible = k < c.count;
      // Under each seat, turned to the fire like the sitter on it.
      const a = c.turn + (k / c.count) * Math.PI * 2, r = SCAVENGER.seat;
      s.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
      s.rotation.y = a;
    });
  }
}

export class ScavengerView {
  readonly people: HumanPool<Scavenger>;
  readonly camps: FigurePool<Camp>;

  static async create(seed: number): Promise<ScavengerView> {
    return new ScavengerView(await humans(PEOPLE, (k) => scavengerLook(seed, k), (k) => scavengersClothes(deriveSeed(seed, 'scavenger', 'clothes', k), k)));
  }

  private constructor(humans: Humanoid[]) {
    this.people = new HumanPool(humans, SHOWN, (s, time) => {
      let action: ActionAnim | undefined;
      if (s.mode === 'swing') action = { id: 'slam', t0: time - s.swingT, dur: SCAVENGER.swing.dur };
      const moving = groundSpeed(s) > 0.15;
      const move = s.dead ? 'dead' : s.mode === 'sit' && !moving ? 'sit' : s.mode === 'flee' && moving ? 'run' : moving ? (s.mode === 'chase' ? 'run' : 'walk') : 'idle';
      const mood = s.mode === 'flee' ? 'afraid' : s.hostile ? 'angry' : s.mode === 'stand' ? 'focused' : 'neutral';
      return { anim: { move, action, mood }, combat: s.hostile && !s.dead && s.mode !== 'flee' };
    });
    const p = campParts();
    this.camps = new FigurePool('camps', CAMPS, () => new CampFigure(p));
  }

  /** The humans, for the warm-up (`stage.warmUp(extra)`). */
  get figures(): Object3D[] {
    return this.people.figures;
  }

  /** Draw the scavengers and their camps nearest (px, pz). */
  draw(list: readonly Scavenger[], px: number, pz: number, dt: number, time: number): void {
    this.people.draw(list, px, pz, dt, time);
    this.camps.draw([...new Set(list.map((s) => s.camp))], time, { x: px, z: pz });
  }
}
