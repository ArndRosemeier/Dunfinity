/** Builds prop tiles (src/gen/quarryProps.ts) off the main thread; see pool.ts for the protocol. */
import { quarryProps, type PropTile } from '../gen/quarryProps';
import type { PropMesh } from '../gen/propMesh';
import type { LevelKey } from '../gen/level';
import { levelFor, serve } from './serve';
import { gatesOf } from '../gen/gates';

export interface PropsJob {
  level: LevelKey;
  tx: number;
  tz: number;
}

const buffers = (m: PropMesh | null) => (m ? [m.positions.buffer, m.normals.buffer, m.colors.buffer, m.indices.buffer] : []);

serve<PropsJob, PropTile>((job) => {
  const level = levelFor(job.level), result = quarryProps(level, job.tx, job.tz);
  result.gates = gatesOf(level).inTile(job.tx, job.tz);
  return { result, transfer: [...buffers(result.solid), ...buffers(result.glow), ...buffers(result.water), ...buffers(result.flow), ...buffers(result.stones), ...buffers(result.house), result.lamps.buffer, result.blockers.buffer, result.watchers.buffer] };
});
