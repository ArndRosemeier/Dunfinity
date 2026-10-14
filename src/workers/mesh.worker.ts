/** Meshes level chunks (src/gen) off the main thread; see pool.ts for the protocol. */
import { Level } from '../gen/level';
import { meshChunk, type ChunkRequest } from '../gen/chunkMesh';

export interface MeshJob extends ChunkRequest {
  seed: number;
  depth: number;
}

let level: Level | null = null;

self.onmessage = (e: MessageEvent<{ id: number; job: MeshJob }>) => {
  const { id, job } = e.data;
  try {
    if (!level || level.seed !== job.seed || level.depth !== job.depth) level = new Level(job.seed, job.depth);
    const result = meshChunk(level, job);
    const transfer = result ? [result.positions.buffer, result.normals.buffer, result.indices.buffer, result.colors.buffer] : [];
    (self as unknown as Worker).postMessage({ id, result }, transfer);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String((err as Error)?.stack ?? err) });
  }
};
