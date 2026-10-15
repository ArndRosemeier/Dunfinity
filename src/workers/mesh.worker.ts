/** Meshes level chunks (src/gen) off the main thread; see pool.ts for the protocol. */
import { meshChunk, type ChunkMesh, type ChunkRequest } from '../gen/chunkMesh';
import type { LevelKey } from '../gen/level';
import { levelFor, serve } from './serve';

export interface MeshJob extends ChunkRequest {
  level: LevelKey;
}

serve<MeshJob, ChunkMesh | null>((job) => {
  const result = meshChunk(levelFor(job.level), job);
  return { result, transfer: result ? [result.positions.buffer, result.normals.buffer, result.indices.buffer, result.colors.buffer] : [] };
});
