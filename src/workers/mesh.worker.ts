/** Meshes level chunks (src/gen) off the main thread; see pool.ts for the protocol. */
import { meshChunk, type ChunkMesh, type ChunkRequest } from '../gen/chunkMesh';
import { levelFor, serve } from './serve';

export interface MeshJob extends ChunkRequest {
  seed: number;
  depth: number;
}

serve<MeshJob, ChunkMesh | null>((job) => {
  const result = meshChunk(levelFor(job.seed, job.depth), job);
  return { result, transfer: result ? [result.positions.buffer, result.normals.buffer, result.indices.buffer, result.colors.buffer] : [] };
});
