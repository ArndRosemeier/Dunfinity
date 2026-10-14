/**
 * One chunk of a level as mesh data (runs in a worker): sample the field, run surface nets, colour.
 */
import type { ColorMode, Level } from './level';
import { surfaceNets, PAD, type MeshData } from './surfaceNets';

export interface ChunkMesh extends MeshData {
  colors: Float32Array;
}

export interface ChunkRequest {
  /** Chunk corner, metres. */
  ox: number;
  oy: number;
  oz: number;
  /** Cell size, metres. */
  step: number;
  /** Cells per axis. */
  cells: number;
  lod: number;
  colorMode: ColorMode;
  /** Sides next to a coarser chunk (SIDE mask in surfaceNets.ts), overlapped to hide cracks. */
  overlap: number;
}

/** Room the field may break its 1-Lipschitz promise by (roughness, cut corners), metres. */
const SLACK = 3;

export function meshChunk(level: Level, r: ChunkRequest): ChunkMesh | null {
  // A chunk far from any surface (deep in rock, or in the middle of a hall) has nothing to mesh.
  const half = (r.cells * r.step) / 2;
  const centre = level.sdf(r.ox + half, r.oy + half, r.oz + half);
  const shafts = level.descents.within(r.ox - 8, r.oz - 8, r.ox + half * 2 + 8, r.oz + half * 2 + 8).length > 0; // the centre may not see a shaft in a corner
  if (!shafts && Math.abs(centre) > half * Math.sqrt(3) + SLACK + r.step * 2) return null;
  const grid = level.sampleGrid(r.ox - PAD * r.step, r.oy - PAD * r.step, r.oz - PAD * r.step, r.step, r.cells + 2 * PAD + 1);
  const mesh = surfaceNets(grid, r.ox, r.oy, r.oz, r.step, r.overlap);
  if (!mesh) return null;
  return { ...mesh, colors: level.colors(grid, mesh.positions, r.colorMode, r.lod) };
}
