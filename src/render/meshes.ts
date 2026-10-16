/**
 * Mesh data from the generator (plain arrays from a worker) into a three.js mesh of a material kind.
 * The one way: the attribute layout must match the kind (docs/SHADERS.md), so it is written once.
 */
import { BufferGeometry, Float32BufferAttribute, Mesh, Uint32BufferAttribute } from 'three/webgpu';
import type { MaterialKind } from './materials';
import { PropBuilder } from '../gen/propMesh';
import { SURFACE_STRIDE } from '../gen/style';

export interface IndexedData {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
  /** The rock's surface (`SURFACE_STRIDE` numbers per vertex: src/gen/style.ts `Surface`, then a `RockMix`, then a `Cover`), for kinds that read it; plain natural rock if left out. */
  surfaces?: Float32Array;
}

/** The surface record's attributes, in order, and their sizes (adding up to SURFACE_STRIDE). */
const SURFACE_ATTRIBUTES = [['surface', 4], ['rocks', 4], ['rocks2', 4], ['cover', 2]] as const;

/** The rock's surface record, split into the shader's attributes: `surface` (vec4), `rocks` and `rocks2` (the eight rock-type weights), `cover` (vec2). */
export function surfaceAttributes(g: BufferGeometry, data: Float32Array): void {
  const n = data.length / SURFACE_STRIDE;
  let at = 0;
  for (const [name, size] of SURFACE_ATTRIBUTES) {
    const part = new Float32Array(n * size);
    for (let i = 0; i < n; i++) for (let k = 0; k < size; k++) part[i * size + k] = data[i * SURFACE_STRIDE + at + k];
    g.setAttribute(name, new Float32BufferAttribute(part, size));
    at += size;
  }
}

/** A static mesh (no per-frame matrix update) of `kind` from position, normal, colour and index arrays. */
export function meshFromData(d: IndexedData, kind: MaterialKind): Mesh {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(d.positions, 3));
  g.setAttribute('normal', new Float32BufferAttribute(d.normals, 3));
  g.setAttribute('color', new Float32BufferAttribute(d.colors, 3));
  if (kind.attributes.includes('surface')) surfaceAttributes(g, d.surfaces ?? new Float32Array((d.positions.length / 3) * SURFACE_STRIDE));
  g.setIndex(new Uint32BufferAttribute(d.indices, 1));
  g.computeBoundingSphere();
  const m = new Mesh(g, kind.make());
  m.matrixAutoUpdate = false;
  return wear(m, kind);
}

/** Put `mesh` on `kind`: its material, and the kind's shadow flags (never set per mesh). */
export function wear<T extends Mesh>(mesh: T, kind: MaterialKind): T {
  mesh.material = kind.make();
  mesh.castShadow = kind.shadow.cast;
  mesh.receiveShadow = kind.shadow.receive;
  return mesh;
}

/** A small hand-built mesh of `kind` (a creature's part, a find), posed per frame: `build` adds its shapes. */
export function meshOf(build: (b: PropBuilder) => void, kind: MaterialKind): Mesh {
  const b = new PropBuilder();
  build(b);
  const m = meshFromData(b.build()!, kind);
  m.matrixAutoUpdate = true;
  return m;
}
