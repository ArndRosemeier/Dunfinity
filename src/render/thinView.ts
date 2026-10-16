/**
 * Draw the thin place open now (src/world/thinPlaces.ts): one quad of the `THIN` kind, added once
 * with the Stage, placed, turned and sized to it; the glimpsed world and how open it is go to the
 * shader (`THIN_STATE`). Nothing new compiles when one opens.
 */
import { type Mesh } from 'three/webgpu';
import { meshFromData } from './meshes';
import { THIN as THIN_KIND, THIN_STATE } from './materials';
import { THIN, openness, type ThinPlace } from '../world/thinPlaces';

export class ThinView {
  readonly mesh: Mesh;

  constructor() {
    this.mesh = meshFromData({
      positions: new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
      colors: new Float32Array(12).fill(1),
      indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    }, THIN_KIND);
    this.mesh.name = 'thin place';
    this.mesh.matrixAutoUpdate = true;
    this.mesh.frustumCulled = false; // its hall lies far behind its quad
    this.mesh.visible = false;
  }

  /** Once a frame: show `place` (null: none open). */
  draw(place: ThinPlace | null): void {
    this.mesh.visible = !!place;
    if (!place) return;
    const g = place.glimpse;
    this.mesh.position.set(place.x, place.y, place.z);
    this.mesh.rotation.set(0, place.yaw, 0);
    this.mesh.scale.set(THIN.half[0], THIN.half[1], 1);
    THIN_STATE.open.value.set(openness(place.age), place.age, g.bay, g.height);
    THIN_STATE.stone.value.set(...g.stone);
    THIN_STATE.light.value.set(...g.light);
    THIN_STATE.haze.value.set(...g.haze);
    THIN_STATE.floor.value = -THIN.over;
  }
}
