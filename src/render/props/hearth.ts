/**
 * A small fire on the floor (a scavengers' camp, the nobody's own rest fire): a ring of stones, ash
 * and burning sticks, embers and three flames in the glow kind that flicker, and die down as the
 * fire burns out.
 *
 * Its meshes are built once (`hearthParts`) and cloned for each hearth; added with the Stage.
 */
import { Group, type Object3D } from 'three/webgpu';
import type { Rgb } from '../../gen/propMesh';
import { meshOf as mesh } from '../meshes';
import { GLOW, VERTEX_COLOR_SOLID } from '../materials';

const STONE: Rgb = [0.3, 0.29, 0.27], ASH: Rgb = [0.12, 0.11, 0.1], STICK: Rgb = [0.22, 0.14, 0.08];
const FLAME: Rgb = [1, 0.55, 0.15], CORE: Rgb = [1, 0.85, 0.5], EMBER: Rgb = [0.75, 0.2, 0.05];

/** The meshes of a hearth, built once. */
export function hearthParts() {
  const ring = mesh((b) => {
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
  return { ring, embers, flame };
}

export class Hearth {
  readonly root = new Group();
  private readonly embers: Object3D;
  private readonly flames: Object3D[] = [];

  constructor(p: ReturnType<typeof hearthParts>) {
    this.embers = p.embers.clone();
    this.root.add(p.ring.clone(), this.embers);
    for (let k = 0; k < 3; k++) {
      const f = p.flame.clone();
      f.position.set(Math.sin(k * 2.1) * 0.08, 0.04, Math.cos(k * 2.1) * 0.08);
      this.flames.push(f);
      this.root.add(f);
    }
  }

  /** Flicker at `time`; `burn`: how much fire there is, 1 (blazing) … 0 (cold ash). */
  flicker(time: number, burn = 1): void {
    this.embers.visible = burn > 0;
    this.flames.forEach((f, k) => {
      const w = time * (7 + k * 1.3) + k * 2, h = Math.min(1, burn * 3 - k * 0.6);
      f.visible = h > 0;
      f.scale.set(1 + Math.sin(w * 1.7) * 0.12, (0.75 + 0.35 * (0.5 + 0.5 * Math.sin(w)) * (k === 0 ? 1.3 : 1)) * h, 1 + Math.cos(w * 1.3) * 0.12);
    });
  }
}
