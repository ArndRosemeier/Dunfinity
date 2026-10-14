/**
 * Mesh data from the generator (plain arrays from a worker) into a three.js mesh of a material kind.
 * The one way: the attribute layout must match the kind (docs/SHADERS.md), so it is written once.
 */
import { BufferGeometry, Float32BufferAttribute, Mesh, Uint32BufferAttribute } from 'three/webgpu';
import type { MaterialKind } from './materials';
import { PropBuilder } from '../gen/propMesh';

export interface IndexedData {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
}

/** A static mesh (no per-frame matrix update) of `kind` from position, normal, colour and index arrays. */
export function meshFromData(d: IndexedData, kind: MaterialKind): Mesh {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(d.positions, 3));
  g.setAttribute('normal', new Float32BufferAttribute(d.normals, 3));
  g.setAttribute('color', new Float32BufferAttribute(d.colors, 3));
  g.setIndex(new Uint32BufferAttribute(d.indices, 1));
  g.computeBoundingSphere();
  const m = new Mesh(g, kind.make());
  m.matrixAutoUpdate = false;
  return m;
}

/** A small hand-built mesh of `kind` (a creature's part, a find), posed per frame: `build` adds its shapes. */
export function meshOf(build: (b: PropBuilder) => void, kind: MaterialKind): Mesh {
  const b = new PropBuilder();
  build(b);
  const m = meshFromData(b.build()!, kind);
  m.matrixAutoUpdate = true;
  return m;
}
