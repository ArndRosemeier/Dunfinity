/**
 * Thrown knives on screen (src/combat/thrown.ts): grandma's kitchen knife, turning end over end in
 * flight, then lying still where it landed until it is gone.
 *
 * A fixed pool, built once and added with the Stage before play.
 */
import { Group } from 'three/webgpu';
import { kitchenKnife } from './wardrobe';
import type { Knife } from '../../combat/thrown';

/** Knives drawn at once; turns per second in flight; drawn this much larger than life, to be seen in flight. */
const POOL = 6;
const SPIN = 3;
const SCALE = 1.5;

export class ThrownView {
  readonly root = new Group();
  private readonly pool: Group[] = [];

  constructor() {
    for (let k = 0; k < POOL; k++) {
      const pivot = new Group(), knife = kitchenKnife();
      knife.position.y = -0.11; // turn about the middle of the knife, not the fist
      pivot.add(knife);
      pivot.scale.setScalar(SCALE);
      pivot.visible = false;
      this.pool.push(pivot);
      this.root.add(pivot);
    }
  }

  place(knives: readonly Knife[]): void {
    this.pool.forEach((p, k) => {
      const n = knives[knives.length - 1 - k]; // the newest first
      p.visible = !!n;
      if (!n) return;
      p.position.set(n.x, n.y, n.z);
      if (n.landed < 0) {
        p.rotation.set(n.t * SPIN * Math.PI * 2, Math.atan2(n.vx, n.vz), 0, 'YXZ');
      }
    });
  }
}
