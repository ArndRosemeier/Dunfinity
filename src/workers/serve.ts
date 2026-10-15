/**
 * The worker side of the pool protocol (pool.ts): answer each `{ id, job }` with `{ id, result }` or
 * `{ id, error }`, handing over the result's buffers. Also keeps the worker's one Level.
 */
import { Level, type LevelKey } from '../gen/level';

let level: Level | null = null;

/** The level for `key`, kept between jobs. */
export function levelFor(key: LevelKey): Level {
  if (!level || level.seed !== key.seed || level.depth !== key.depth || level.style !== key.style) level = new Level(key.seed, key.depth, key.style);
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
