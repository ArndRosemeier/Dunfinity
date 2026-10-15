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
/** How much faster than 1 m a metre the field may change over long distances (the walls between workings: their opening noise is steep). */
const LIPSCHITZ = 1.6;

/**
 * Whether the box (corner o, edge `size`) surely holds no surface: each of its eight octants' middles
 * is all rock or all air further than the octant reaches (one middle for the whole box is not enough:
 * where floors and ceilings change fast, a corner of the box can hold a surface the middle cannot see).
 */
export function farFromSurface(level: Level, ox: number, oy: number, oz: number, size: number, step: number): boolean {
  const q = size / 4, reach = LIPSCHITZ * q * Math.sqrt(3) + SLACK + step * 2;
  let sign = 0;
  for (let k = 0; k < 8; k++) {
    const d = level.sdf(ox + q * (1 + 2 * (k & 1)), oy + q * (1 + 2 * ((k >> 1) & 1)), oz + q * (1 + 2 * ((k >> 2) & 1)));
    if (Math.abs(d) <= reach || (sign !== 0 && Math.sign(d) !== sign)) return false;
    sign = Math.sign(d);
  }
  return true;
}

export function meshChunk(level: Level, r: ChunkRequest): ChunkMesh | null {
  // A chunk far from any surface (deep in rock, or in the middle of a hall) has nothing to mesh.
  const size = r.cells * r.step;
  const shafts = level.descents.within(r.ox - 8, r.oz - 8, r.ox + size + 8, r.oz + size + 8).length > 0; // the centre may not see a shaft in a corner
  if (!shafts && farFromSurface(level, r.ox, r.oy, r.oz, size, r.step)) return null;
  const grid = level.sampleGrid(r.ox - PAD * r.step, r.oy - PAD * r.step, r.oz - PAD * r.step, r.step, r.cells + 2 * PAD + 1);
  const mesh = surfaceNets(grid, r.ox, r.oy, r.oz, r.step, r.overlap);
  if (!mesh) return null;
  return { ...mesh, colors: level.colors(grid, mesh.positions, r.colorMode, r.lod) };
}
