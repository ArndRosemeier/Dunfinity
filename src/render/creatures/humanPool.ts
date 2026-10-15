/**
 * A fixed pool of drawn humans (the Salt-Touched, scavengers, the Foreman): Scale's humans built before the
 * warm-up (their materials compile with the rest) and added with the Stage once; each frame the
 * nearest of a list are drawn with them. Who is drawn keeps their human while they stay near, and
 * a newcomer takes the human of its own look where it can. A blow makes them flinch.
 */
import { Group, type Object3D } from 'three/webgpu';
import { Humanoid, type AnimState } from '@futuremagic/humanoid/three';
import type { EquipmentVisuals, HumanoidAppearance } from '@futuremagic/humanoid';
import { WARDROBE } from '../humans/wardrobe';
import type { Level } from '../../gen/level';
import { floorUnder } from '../humans/nobody';

/** What the pool needs of someone drawn. */
export interface Drawn {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly vx: number;
  readonly vz: number;
  readonly yaw: number;
  readonly health: number;
  readonly dead: boolean;
  /** Which human of the pool suits them best (any, if none). */
  readonly look?: number;
}

/** `n` humans for a pool: human k with `look(k)`, dressed in `clothes(k)` (from the WARDROBE). */
export async function humans(n: number, look: (k: number) => HumanoidAppearance, clothes: (k: number) => EquipmentVisuals): Promise<Humanoid[]> {
  const out: Humanoid[] = [];
  for (let k = 0; k < n; k++) {
    const h = await Humanoid.create(look(k), { wardrobe: WARDROBE, expressions: true });
    h.dress(clothes(k));
    out.push(h);
  }
  return out;
}

interface Slot<T> {
  readonly human: Humanoid;
  who: T | null;
  health: number;
}

export class HumanPool<T extends Drawn> {
  readonly root = new Group();
  /** The level they stand on (the feet find its floor). */
  level: Level | null = null;
  private readonly ground = floorUnder(() => this.level);
  private readonly slots: Slot<T>[];

  /** `shown`: how far off they are drawn, metres; `anim`: what the animator plays for one of them, and whether they hold their weapon ready; `flinch`: how hard a blow jerks them (a death always fully). */
  constructor(humans: Humanoid[], private readonly shown: number, private readonly anim: (t: T, time: number) => { anim: AnimState; combat: boolean }, private readonly flinch = 0.7) {
    this.slots = humans.map((human) => ({ human, who: null, health: 0 }));
    for (const s of this.slots) this.root.add(s.human.object);
  }

  /** The humans, for the warm-up (`stage.warmUp(extra)`). */
  get figures(): Object3D[] {
    return this.slots.map((s) => s.human.object);
  }

  /** Draw the ones nearest (px, pz). */
  draw(list: readonly T[], px: number, pz: number, dt: number, time: number): void {
    const far = (t: T) => Math.hypot(t.x - px, t.z - pz);
    const near = list.filter((t) => far(t) < this.shown).sort((a, b) => far(a) - far(b)).slice(0, this.slots.length);
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
      if (t.health < s.health) s.human.animator.onHit(Math.sin(t.yaw), Math.cos(t.yaw), t.dead ? 1 : this.flinch);
      s.health = t.health;
      const { anim, combat } = this.anim(t, time);
      s.human.update({ pos: [t.x, t.y, t.z], vel: [t.vx, 0, t.vz], yaw: t.yaw, anim, combat }, dt, time, this.ground);
    }
  }
}
