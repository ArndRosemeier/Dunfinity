/**
 * The worker side of the pool protocol (pool.ts): answer each `{ id, job }` with `{ id, result }` or
 * `{ id, error }`, handing over the result's buffers. Also keeps the worker's last few Levels.
 */
import { Level, type LevelKey } from '../gen/level';

/** The last few levels asked for (a preparing worker goes back and forth between two). */
const levels = new Map<string, Level>();

/** The level for `key`, kept between jobs. */
export function levelFor(key: LevelKey): Level {
  const id = `${key.seed}:${key.depth}:${key.style ?? ''}`;
  let level = levels.get(id);
  if (!level) {
    level = new Level(key.seed, key.depth, key.style);
    levels.set(id, level);
    if (levels.size > 3) levels.delete(levels.keys().next().value!);
  }
  return level;
}

/** Handle jobs with `handle`, which returns the result and the buffers to transfer with it. */
export function serve<Job, Result>(handle: (job: Job) => { result: Result; transfer: Transferable[] }): void {
  const post = (msg: unknown, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(msg, transfer);
  self.onmessage = (e: MessageEvent<{ id: number; job: Job }>) => {
    const { id, job } = e.data;
    try {
      const { result, transfer } = handle(job);
      post({ id, result }, transfer);
    } catch (err) {
      post({ id, error: String((err as Error)?.stack ?? err) });
    }
  };
}
