/** Builds prop tiles (src/gen/quarryProps.ts) off the main thread; see pool.ts for the protocol. */
import { quarryProps, type PropTile } from '../gen/quarryProps';
import type { PropMesh } from '../gen/propMesh';
import { levelFor, serve } from './serve';

export interface PropsJob {
  seed: number;
  depth: number;
  tx: number;
  tz: number;
}

const buffers = (m: PropMesh | null) => (m ? [m.positions.buffer, m.normals.buffer, m.colors.buffer, m.indices.buffer] : []);

serve<PropsJob, PropTile>((job) => {
  const result = quarryProps(levelFor(job.seed, job.depth), job.tx, job.tz);
  return { result, transfer: [...buffers(result.solid), ...buffers(result.glow), ...buffers(result.water), ...buffers(result.stones), result.lamps.buffer] };
});
