/**
 * A fixed pool of meshes for seeded things drawn near the viewer (living stalagmites, salt blooms):
 * built once and added with the Stage, each slot its own geometry; each frame the things nearest
 * the viewer take the slots, and the view moves them and sets their look. Nothing is rebuilt or
 * compiled as they come and go.
 */
import { Group, type Mesh } from 'three/webgpu';
import { meshFromData, type IndexedData } from '../meshes';
import type { MaterialKind } from '../materials';
import type { Sited } from '../../gen/cellMemo';

export class SlotPool<T extends Sited> {
  readonly root = new Group();
  readonly slots: Mesh[] = [];
  /** The things holding the slots now, nearest first. */
  readonly sites: T[] = [];

  constructor(count: number, name: string, kind: MaterialKind, shape: (slot: number) => IndexedData) {
    for (let i = 0; i < count; i++) {
      const m = meshFromData(shape(i), kind);
      m.name = name;
      m.frustumCulled = false; // the shader shapes it beyond its unit geometry
      m.visible = false;
      m.matrixAutoUpdate = true;
      this.root.add(m);
      this.slots.push(m);
    }
  }

  /** Give the slots to the things of `field` within `seen` m of (x, z), nearest first. */
  fill(field: { near(x: number, z: number, r: number, out: T[]): T[] }, x: number, z: number, seen: number): readonly T[] {
    field.near(x, z, seen, this.sites);
    this.sites.sort((a, b) => (a.x - x) ** 2 + (a.z - z) ** 2 - ((b.x - x) ** 2 + (b.z - z) ** 2));
    if (this.sites.length > this.slots.length) this.sites.length = this.slots.length;
    return this.sites;
  }
}
