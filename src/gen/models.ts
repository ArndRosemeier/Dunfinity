/**
 * Props made in Blender (AssetGenerator specs, packed by its `ag.py pack`): meshes with ambient
 * occlusion baked into their vertex colours, decoded once per worker from the generated pack
 * (models.pack.ts, made by `npm run props`). Placed into a tile with `PropBuilder.stamp`.
 *
 * Frame: metres, y up, the origin on the ground under the model's footprint centre, its front +z.
 */
import { PACK, type ModelName } from './models.pack';
import type { V3 } from './propMesh';

export type { ModelName };

export interface Model {
  name: ModelName;
  /** Metres, 3 per vertex. */
  positions: Float32Array;
  normals: Float32Array;
  /** Linear RGB, 3 per vertex. */
  colors: Float32Array;
  indices: Uint32Array;
  /** The model's bounds. */
  min: V3;
  max: V3;
}

let models: Map<string, Model> | null = null;

function packed(): Map<string, Model> {
  return (models ??= decodePack(Uint8Array.from(atob(PACK), (c) => c.charCodeAt(0))));
}

/** The names of every packed model. */
export function modelNames(): ModelName[] {
  return [...packed().keys()] as ModelName[];
}

/** The model packed under `name`. */
export function propModel(name: ModelName): Model {
  const m = packed().get(name);
  if (!m) throw new Error(`no model '${name}' in the pack`);
  return m;
}

/** Read an FMPK v1 pack (the format is described in AssetGenerator's blender/entrypoints/pack.py). */
export function decodePack(bytes: Uint8Array): Map<string, Model> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== 'FMPK' || view.getUint32(4, true) !== 1) throw new Error('not an FMPK v1 pack');
  const out = new Map<string, Model>();
  let at = 12;
  const pad = () => { at = (at + 3) & ~3; };
  for (let m = view.getUint32(8, true); m > 0; m--) {
    const len = view.getUint16(at, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 2, at + 2 + len)) as ModelName;
    at += 2 + len; pad();
    const float = (k: number) => view.getFloat32(at + 4 * k, true);
    const scale = float(0), min: V3 = [float(1), float(2), float(3)], max: V3 = [float(4), float(5), float(6)];
    const n = view.getUint32(at + 28, true), ni = view.getUint32(at + 32, true);
    at += 36;
    const positions = new Float32Array(3 * n), normals = new Float32Array(3 * n), colors = new Float32Array(3 * n);
    for (let i = 0; i < 3 * n; i++) positions[i] = view.getInt16(at + 2 * i, true) * scale;
    at += 6 * n; pad();
    for (let i = 0; i < 3 * n; i++) normals[i] = view.getInt8(at + i) / 127;
    at += 3 * n;
    for (let i = 0; i < 3 * n; i++) colors[i] = (bytes[at + i] / 255) ** 2;
    at += 3 * n; pad();
    const wide = n > 65535, indices = new Uint32Array(ni);
    for (let i = 0; i < ni; i++) indices[i] = wide ? view.getUint32(at + 4 * i, true) : view.getUint16(at + 2 * i, true);
    at += ni * (wide ? 4 : 2); pad();
    out.set(name, { name, positions, normals, colors, indices, min, max });
  }
  return out;
}
