/**
 * The levels one may go to next, prepared in the background (Arnd 2026-10-17: "the previous and next
 * level should always be prepared already"): the rock chunks and prop tiles round where one would
 * come out on each are built by workers of their own while the level shown is settled, and kept, with
 * what was shown lately, in caches bounded by size (the oldest used go first). A level shown takes
 * its chunks and tiles from here before asking its own workers, so arriving where one was expected
 * is an upload, not a wait.
 */
import { chunksAround, DEFAULT_VIEW, type ChunkKey, type ChunkView } from '../world/chunks';
import type { ColorMode, LevelKey } from '../gen/level';
import type { ChunkMesh } from '../gen/chunkMesh';
import type { PropTile } from '../gen/quarryProps';
import { createMeshPool, createPropsPool, type WorkerPool } from '../workers/pool';
import type { MeshJob } from '../workers/mesh.worker';
import type { PropsJob } from '../workers/props.worker';
import { tilesAround } from './props/Props';
import { meshJob } from './terrain/Terrain';

export const PREPARED = {
  /** Bytes kept of meshed rock and of built prop tiles (the oldest used go first). */
  chunks: 160e6,
  tiles: 48e6,
  /** Jobs each preparing worker has in hand at once. */
  inHand: 2,
  /** Seconds between looks at whether everything prepared is still kept. */
  recheck: 4,
} as const;

/** Where one may come out next: a level, and the place on it. */
export interface Spot {
  readonly level: LevelKey;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export class Prepared {
  private readonly chunks = new Kept<ChunkMesh | null>(PREPARED.chunks);
  private readonly tiles = new Kept<PropTile>(PREPARED.tiles);
  private mesher: WorkerPool<MeshJob, ChunkMesh | null> | null = null;
  private builder: WorkerPool<PropsJob, PropTile> | null = null;
  /** What is still to prepare, in order: chunk jobs and tile jobs, each with its cache key. */
  private todo: ({ kind: 'chunk'; id: string; job: MeshJob } | { kind: 'tile'; id: string; job: PropsJob })[] = [];
  private spots: readonly Spot[] = [];
  private asked = new Set<string>();
  private lookedAt = -Infinity;
  private idle = false;
  /** Chunks and tiles found here or not, by the levels shown (the dev line's check that preparing pays). */
  readonly stats = { hits: 0, misses: 0 };
  /** How the rock is picked and coloured (as the level shown: its view's detail, its colour mode). */
  view: ChunkView = DEFAULT_VIEW;
  colorMode: ColorMode = 'rock';

  /** Prepare round these from now on (the last ones asked for go when nothing keeps them). */
  want(spots: readonly Spot[]): void {
    this.spots = spots;
    this.lookedAt = -Infinity;
  }

  /** A chunk of `level` meshed before (null: known empty), or undefined. */
  chunk(level: LevelKey, k: ChunkKey, colorMode: ColorMode): ChunkMesh | null | undefined {
    return this.counted(this.chunks.get(chunkId(level, k, colorMode)));
  }

  /** Keep a chunk meshed for the level shown. */
  keepChunk(level: LevelKey, k: ChunkKey, colorMode: ColorMode, mesh: ChunkMesh | null): void {
    this.chunks.set(chunkId(level, k, colorMode), mesh, mesh ? bytes(mesh) : 64);
  }

  /** A prop tile of `level` built before, or undefined. */
  tile(level: LevelKey, tx: number, tz: number): PropTile | undefined {
    return this.counted(this.tiles.get(tileId(level, tx, tz)));
  }

  private counted<V>(v: V | undefined): V | undefined {
    if (v === undefined) this.stats.misses++; else this.stats.hits++;
    return v;
  }

  /** Keep a prop tile built for the level shown. */
  keepTile(level: LevelKey, tx: number, tz: number, tile: PropTile): void {
    this.tiles.set(tileId(level, tx, tz), tile, bytes(tile));
  }

  /** Once a frame (`time` in seconds): whether the level shown is settled (only then does preparing go on). */
  work(idle: boolean, time: number): void {
    this.idle = idle;
    if (time - this.lookedAt > PREPARED.recheck) { this.lookedAt = time; this.lookRound(); }
    this.send();
  }

  /** Hand the next jobs to the preparing workers, while idle; each one done sends the next at once (not a frame later). */
  private send(): void {
    if (!this.idle || !this.todo.length) return;
    const mesher = (this.mesher ??= createMeshPool(1)), builder = (this.builder ??= createPropsPool(1));
    for (let i = 0; i < this.todo.length; i++) {
      const t = this.todo[i];
      if (this.asked.has(t.id)) { this.todo.splice(i--, 1); continue; }
      if ((t.kind === 'chunk' ? mesher : builder).inFlight >= PREPARED.inHand) continue;
      this.todo.splice(i--, 1);
      this.asked.add(t.id);
      const kept = t.kind === 'chunk'
        ? mesher.run(t.job).then((m) => this.chunks.set(t.id, m, m ? bytes(m) : 64))
        : builder.run(t.job).then((p) => this.tiles.set(t.id, p, bytes(p)));
      void kept.then(() => { this.asked.delete(t.id); this.send(); }, () => this.asked.delete(t.id));
      if (mesher.inFlight >= PREPARED.inHand && builder.inFlight >= PREPARED.inHand) break;
    }
  }

  /** What is not kept yet round the spots, nearest first (and what is, touched, so it stays). */
  private lookRound(): void {
    this.todo = [];
    for (const s of this.spots) {
      for (const k of chunksAround(s.x, s.y, s.z, this.view)) {
        const id = chunkId(s.level, k, this.colorMode);
        if (this.chunks.get(id) !== undefined) continue;
        this.todo.push({ kind: 'chunk', id, job: meshJob(s.level, k, this.colorMode) });
      }
      for (const [tx, tz] of tilesAround(s.x, s.z)) {
        const id = tileId(s.level, tx, tz);
        if (this.tiles.get(id) === undefined) this.todo.push({ kind: 'tile', id, job: { level: s.level, tx, tz } });
      }
    }
  }

  dispose(): void {
    this.mesher?.dispose();
    this.builder?.dispose();
  }
}

/** Values kept by key up to `budget` bytes; reading one makes it the newest, the oldest go first. */
export class Kept<V> {
  private readonly map = new Map<string, { v: V; size: number }>();
  private total = 0;

  constructor(private readonly budget: number) {}

  get(id: string): V | undefined {
    const e = this.map.get(id);
    if (!e) return undefined;
    this.map.delete(id);
    this.map.set(id, e);
    return e.v;
  }

  set(id: string, v: V, size: number): void {
    const old = this.map.get(id);
    if (old) { this.total -= old.size; this.map.delete(id); }
    this.map.set(id, { v, size });
    this.total += size;
    for (const [k, e] of this.map) {
      if (this.total <= this.budget) break;
      this.map.delete(k);
      this.total -= e.size;
    }
  }
}

const levelId = (l: LevelKey) => `${l.seed}:${l.depth}:${l.style ?? ''}`;
const chunkId = (l: LevelKey, k: ChunkKey, colorMode: ColorMode) => `${levelId(l)}:${colorMode}:${k.id}:${k.overlap}`;
const tileId = (l: LevelKey, tx: number, tz: number) => `${levelId(l)}:${tx},${tz}`;

/** The bytes in the typed arrays of `o` and the objects in it (a mesh, a tile of meshes). */
function bytes(o: unknown, depth = 0): number {
  if (ArrayBuffer.isView(o)) return o.byteLength;
  if (!o || typeof o !== 'object' || depth > 3) return 0;
  let n = 0;
  for (const v of Object.values(o)) n += bytes(v, depth + 1);
  return n;
}
