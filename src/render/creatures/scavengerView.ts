/**
 * The scavengers on screen (src/creatures/scavengers.ts): goblins (Norgo's goblin race on Scale's
 * bodies; below level 10 the peoples of the deep, Norgo's races), in the miners' patched cast-offs, with crowbars. They sit round their fire on crates, get up and
 * turn to you, come at you swinging the crowbar, flinch when stabbed, and fall when they die. Their
 * camps: a `Hearth` (src/render/props/hearth.ts) and a crate to sit on at each seat.
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
import { deepFolk } from '../../creatures/folk';
import type { Rgb } from '../../gen/propMesh';
import { meshOf as mesh } from '../meshes';
import { VERTEX_COLOR_SOLID } from '../materials';
import { Hearth, hearthParts } from '../props/hearth';
import { scavengersClothes } from '../humans/wardrobe';
import { HumanPool, humans } from './humanPool';
import { FigurePool, type Figure } from './figures';

/** How many people and camps can be drawn at once, and how far off the people are drawn, metres: four goblins, three of each people of the deep (`lookOf`). */
const PEOPLE = 4 + 2 * 3;
const CAMPS = 3;
const SHOWN = 60;

const CRATE: Rgb = [0.34, 0.26, 0.17], SLAT: Rgb = [0.25, 0.19, 0.12];

/** A scavenger's look: a goblin; from the fifth body on, one of the game's peoples of the deep (src/creatures/folk.ts). */
function scavengerLook(seed: number, k: number): HumanoidAppearance {
  const race = k < 4 ? 'goblin' : deepFolk(seed)[Math.floor((k - 4) / 3)], j = k < 4 ? k : (k - 4) % 3;
  return randomAppearance(race, deriveSeed(seed, 'scavenger', k), { age: 0.3 + 0.12 * j, gender: j === 1 ? 0.15 : 0.85 });
}

function campParts() {
  const crate = mesh((b) => {
    b.upright(0, 0.22, 0, 0, 0.24, 0.22, 0.2, CRATE);
    for (const y of [0.08, 0.36]) b.upright(0, y, 0, 0, 0.25, 0.03, 0.21, SLAT);
  }, VERTEX_COLOR_SOLID);
  return { hearth: hearthParts(), crate };
}

class CampFigure implements Figure<Camp> {
  readonly root = new Group();
  private readonly fire: Hearth;
  private readonly seats: Object3D[] = [];

  constructor(p: ReturnType<typeof campParts>) {
    this.fire = new Hearth(p.hearth);
    this.root.add(this.fire.root);
    for (let k = 0; k < SCAVENGER.count[1]; k++) {
      const c = p.crate.clone();
      this.seats.push(c);
      this.root.add(c);
    }
  }

  pose(c: Camp, time: number): void {
    this.root.visible = true;
    this.root.position.set(c.x, c.y, c.z);
    this.fire.flicker(time);
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
