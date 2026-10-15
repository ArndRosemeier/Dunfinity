/**
 * The Salt-Touched on screen (src/creatures/touched.ts): Scale's humans, old miners grown through
 * with salt (grey skin under a crust of crystals, eyes gone pale and faintly glowing), in salt-crusted
 * work clothes, with a miner's pick. They work the rock with it, turn to you, trudge after you and
 * bring it down over their heads; a stab makes them flinch, and they fall when they die.
 *
 * A fixed pool of humans, built before the warm-up (their materials compile with the rest) and added
 * with the Stage once; the nearest Salt-Touched are drawn with them.
 */
import { groundSpeed } from '../../creatures/creature';
import { Group, type Object3D } from 'three/webgpu';
import { randomAppearance, type HumanoidAppearance } from '@futuremagic/humanoid';
import { Humanoid, type ActionAnim } from '@futuremagic/humanoid/three';
import { deriveSeed } from '@futuremagic/core';
import { TOUCHED, type Touched } from '../../creatures/touched';
import type { Level } from '../../gen/level';
import { WARDROBE, minersClothes } from '../humans/wardrobe';
import { floorUnder } from '../humans/nobody';

/** How many can be drawn at once, and how far off they are drawn, metres. */
const POOL = 3;
const SHOWN = 55;

/** A lost miner's look: an older man (mostly), the salt grown into him. */
export function touchedLook(seed: number, k: number): HumanoidAppearance {
  const a = randomAppearance('human', deriveSeed(seed, 'touched', k), { age: 0.62 + 0.1 * k, gender: k === 2 ? 0.3 : 0.95 });
  return {
    ...a,
    skinTone: [0.56, 0.58, 0.62], skinAccent: [0.62, 0.82, 1.0], skinPattern: 'crystals', patternStrength: 0.85,
    eyeColor: [0.75, 0.88, 1.0], eyeGlow: 0.7, hairColor: [0.72, 0.73, 0.75],
  };
}

interface Slot {
  readonly human: Humanoid;
  who: Touched | null;
  health: number;
}

export class TouchedView {
  readonly root = new Group();
  /** The level they stand on (the feet find its floor). */
  level: Level | null = null;
  private readonly ground = floorUnder(() => this.level);

  static async create(seed: number): Promise<TouchedView> {
    const humans: Humanoid[] = [];
    for (let k = 0; k < POOL; k++) {
      const h = await Humanoid.create(touchedLook(seed, k), { wardrobe: WARDROBE, expressions: true });
      h.dress(minersClothes(deriveSeed(seed, 'touched', 'clothes', k)));
      humans.push(h);
    }
    return new TouchedView(humans);
  }

  private readonly slots: Slot[];

  private constructor(humans: Humanoid[]) {
    this.slots = humans.map((human) => ({ human, who: null, health: 0 }));
    for (const s of this.slots) this.root.add(s.human.object);
  }

  /** The humans, for the warm-up (`stage.warmUp(extra)`). */
  get figures(): Object3D[] {
    return this.slots.map((s) => s.human.object);
  }

  /** Draw the Salt-Touched nearest (px, pz). */
  draw(list: readonly Touched[], px: number, pz: number, dt: number, time: number): void {
    const near = list.filter((t) => Math.hypot(t.x - px, t.z - pz) < SHOWN).sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz)).slice(0, POOL);
    // Keep who is drawn where it is; free slots take the rest (each look stays with its own where it can).
    for (const s of this.slots) if (s.who && !near.includes(s.who)) s.who = null;
    for (const t of near) {
      if (this.slots.some((s) => s.who === t)) continue;
      const free = this.slots.find((s) => !s.who && this.slots.indexOf(s) === t.look) ?? this.slots.find((s) => !s.who)!;
      free.who = t;
      free.health = t.health;
    }
    for (const s of this.slots) {
      const t = s.who;
      s.human.object.visible = !!t;
      if (!t) continue;
      if (t.health < s.health) s.human.animator.onHit(Math.sin(t.yaw), Math.cos(t.yaw), t.dead ? 1 : 0.7);
      s.health = t.health;
      const S = TOUCHED.swing;
      let action: ActionAnim | undefined;
      if (t.mode === 'swing') action = { id: 'slam', t0: time - t.swingT, dur: S.dur };
      else if (t.mode === 'work' && t.strokeT < TOUCHED.stroke) action = { id: 'mine', t0: time - t.strokeT, dur: TOUCHED.stroke };
      const moving = groundSpeed(t) > 0.15;
      s.human.update({
        pos: [t.x, t.y, t.z], vel: [t.vx, 0, t.vz], yaw: t.yaw,
        anim: { move: t.dead ? 'dead' : moving ? 'walk' : 'idle', action, mood: t.angry ? 'angry' : 'neutral' },
        combat: t.angry && !t.dead,
      }, dt, time, this.ground);
    }
  }
}
