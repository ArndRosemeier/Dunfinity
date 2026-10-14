/**
 * Which chunks to show around a viewer: an octree of level-of-detail chunks. Every chunk has the
 * same number of cells (CELLS³); a chunk at lod l has cells of 2^l · BASE_STEP metres. A node is
 * split while the viewer is close to it compared to its size, so the result tiles space without
 * gaps or overlaps: fine near the viewer, coarse far away.
 */
export const CELLS = 32;
export const BASE_STEP = 1;

export interface ChunkKey {
  lod: number;
  /** Chunk index at its lod: the chunk spans [i, i + 1) · size on each axis. */
  ix: number;
  iy: number;
  iz: number;
  /** Edge length in metres. */
  size: number;
  /** Cell size in metres. */
  step: number;
  /** Stable id: "lod:ix:iy:iz". */
  id: string;
  /** Distance from the viewer to the chunk's box, metres. */
  dist: number;
  /**
   * Sides that touch a coarser chunk: bit 2·axis for the low side, 2·axis + 1 for the high side
   * (axis x 0, y 1, z 2; the same bits as SIDE in gen/surfaceNets.ts). The mesher overlaps them.
   */
  overlap: number;
}

export interface ChunkView {
  /** Coarsest lod (top-level nodes). */
  maxLod: number;
  /** Top-level nodes are kept within this distance of the viewer, metres. */
  radius: number;
  /** A node is split while its distance is below `split` × its size. */
  split: number;
  /** Vertical extent of the level, metres. */
  yMin: number;
  yMax: number;
}

export const DEFAULT_VIEW: ChunkView = { maxLod: 3, radius: 900, split: 1.1, yMin: -32, yMax: 128 };

export function chunkKey(lod: number, ix: number, iy: number, iz: number, dist = 0): ChunkKey {
  const step = BASE_STEP * 2 ** lod;
  return { lod, ix, iy, iz, size: CELLS * step, step, id: `${lod}:${ix}:${iy}:${iz}`, dist, overlap: 0 };
}

function boxDist(px: number, py: number, pz: number, k: ChunkKey): number {
  const d = (p: number, i: number) => Math.max(i * k.size - p, 0, p - (i + 1) * k.size);
  return Math.hypot(d(px, k.ix), d(py, k.iy), d(pz, k.iz));
}

/** The chunks to show from (px, py, pz), nearest first. */
export function chunksAround(px: number, py: number, pz: number, view: ChunkView = DEFAULT_VIEW): ChunkKey[] {
  const out: ChunkKey[] = [];
  const top = chunkKey(view.maxLod, 0, 0, 0);
  const r = view.radius;
  const y0 = Math.floor(view.yMin / top.size), y1 = Math.ceil(view.yMax / top.size) - 1;
  const visit = (k: ChunkKey): void => {
    // Skip children entirely outside the level's vertical extent.
    if ((k.iy + 1) * k.size <= view.yMin || k.iy * k.size >= view.yMax) return;
    k.dist = boxDist(px, py, pz, k);
    if (k.lod > 0 && k.dist < view.split * k.size) {
      for (let c = 0; c < 8; c++) visit(chunkKey(k.lod - 1, k.ix * 2 + (c & 1), k.iy * 2 + ((c >> 1) & 1), k.iz * 2 + ((c >> 2) & 1)));
      return;
    }
    out.push(k);
  };
  for (let iz = Math.floor((pz - r) / top.size); iz <= Math.floor((pz + r) / top.size); iz++) {
    for (let ix = Math.floor((px - r) / top.size); ix <= Math.floor((px + r) / top.size); ix++) {
      for (let iy = y0; iy <= y1; iy++) {
        const k = chunkKey(view.maxLod, ix, iy, iz);
        if (boxDist(px, py, pz, k) <= r) visit(k);
      }
    }
  }
  markCoarserSides(out, view.maxLod);
  return out.sort((a, b) => a.lod - b.lod || a.dist - b.dist);
}

/** Set each chunk's `overlap` to the sides where its neighbour is a coarser chunk. */
function markCoarserSides(keys: ChunkKey[], maxLod: number): void {
  const ids = new Set(keys.map((k) => k.id));
  for (const k of keys) {
    k.overlap = 0;
    for (let axis = 0; axis < 3; axis++) {
      for (let side = 0; side < 2; side++) {
        const n = [k.ix, k.iy, k.iz];
        n[axis] += side ? 1 : -1;
        for (let lod = k.lod + 1; lod <= maxLod; lod++) {
          const f = 2 ** (lod - k.lod);
          if (ids.has(`${lod}:${Math.floor(n[0] / f)}:${Math.floor(n[1] / f)}:${Math.floor(n[2] / f)}`)) {
            k.overlap |= 1 << (2 * axis + side);
            break;
          }
        }
      }
    }
  }
}
