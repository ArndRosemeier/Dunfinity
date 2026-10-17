/**
 * Draw the thin place open now (src/world/thinPlaces.ts): one quad of the `THIN` kind, added once
 * with the Stage, placed, turned and sized to it; the glimpsed world and how open it is go to the
 * shader (`THIN_STATE`). Nothing new compiles when one opens.
 */
import { type Mesh, type Vector3 } from 'three/webgpu';
import { meshFromData } from './meshes';
import { THIN as THIN_KIND, THIN_STATE, type MaterialKind } from './materials';
import { THIN, openness, type Glimpse, type ThinPlace } from '../world/thinPlaces';

export class ThinView {
  readonly mesh = windowQuad(THIN_KIND, 'thin place');

  /** Once a frame: show `place` (null: none open), `open` that much (by default as its age says). */
  draw(place: ThinPlace | null, open = place ? openness(place.age) : 0): void {
    this.mesh.visible = !!place;
    if (!place) return;
    const g = place.glimpse;
    this.mesh.position.set(place.x, place.y, place.z);
    this.mesh.rotation.set(0, place.yaw, 0);
    this.mesh.scale.set(THIN.half[0], THIN.half[1], 1);
    THIN_STATE.open.value.set(open, place.age, g.bay, g.height);
    tintHall(THIN_STATE, g);
    THIN_STATE.floor.value = -THIN.over;
  }
}

/** Give a hall's shader state (`THIN_STATE`, `WAY_STATE`, `HALL_STATE`) the colours of the world `g` shows. */
export function tintHall(state: Record<'stone' | 'light' | 'haze', { value: Vector3 }>, g: Glimpse): void {
  state.stone.value.set(...g.stone);
  state.light.value.set(...g.light);
  state.haze.value.set(...g.haze);
}

/** One window's quad (-1..1, facing +z, scaled to its half size when drawn) of `kind`, hidden until drawn; what it shows lies far behind it, so it is never culled. */
export function windowQuad(kind: MaterialKind, name: string): Mesh {
  const mesh = meshFromData({
    positions: new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    colors: new Float32Array(12).fill(1),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  }, kind);
  mesh.name = name;
  mesh.matrixAutoUpdate = true;
  mesh.frustumCulled = false;
  mesh.visible = false;
  return mesh;
}
