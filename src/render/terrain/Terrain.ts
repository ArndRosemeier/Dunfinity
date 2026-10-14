/**
 * Streams a level's rock around the viewer: picks the chunks (world/chunks.ts), meshes them in the
 * worker pool, and puts them on the Stage. Old chunks stay until every chunk of the new set is ready,
 * so moving never opens holes; the swap happens in one frame.
 */
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, Mesh, type Group } from 'three/webgpu';
import { chunksAround, CELLS, DEFAULT_VIEW, type ChunkKey, type ChunkView } from '../../world/chunks';
import type { ColorMode } from '../../gen/level';
import type { ChunkMesh } from '../../gen/chunkMesh';
import { createMeshPool, type WorkerPool } from '../../workers/pool';
import type { MeshJob } from '../../workers/mesh.worker';
import { VERTEX_COLOR_SOLID } from '../materials';
import type { Stage } from '../stage';

interface Shown {
  key: ChunkKey;
  mesh: Mesh | null;
}

export class Terrain {
  private readonly pool: WorkerPool<MeshJob, ChunkMesh | null>;
  /** Chunks on screen (or known empty), by id. */
  private shown = new Map<string, Shown>();
  /** Chunks of the wanted set that are ready (meshed and compiled), by id. */
  private ready = new Map<string, Shown>();
  private wanted: ChunkKey[] = [];
  private wantedIds = new Set<string>();
  private requested = new Set<string>();
  private generation = 0;
  private lastAt: [number, number, number] = [Infinity, Infinity, Infinity];
  colorMode: ColorMode = 'rock';
  /** Totals for the HUD. */
  stats = { chunks: 0, triangles: 0, pending: 0 };

  constructor(private readonly stage: Stage, private readonly group: Group, readonly seed: number, readonly depth: number, readonly view: ChunkView = DEFAULT_VIEW) {
    this.pool = createMeshPool();
  }

  /** Call every frame with the viewer position. */
  update(x: number, y: number, z: number): void {
    const [lx, ly, lz] = this.lastAt;
    if (Math.hypot(x - lx, y - ly, z - lz) > CELLS / 4) {
      this.lastAt = [x, y, z];
      this.want(chunksAround(x, y, z, this.view));
    }
    this.pump();
    this.stats.pending = this.wanted.length - this.ready.size;
  }

  /** Re-mesh everything (after a colour mode change). */
  rebuild(): void {
    this.generation++;
    this.ready.clear();
    this.requested.clear();
    this.want(this.wanted);
  }

  /** True when everything wanted is on screen. */
  get settled(): boolean {
    return this.wanted.length > 0 && this.ready.size === this.wanted.length && this.requested.size === 0;
  }

  private want(keys: ChunkKey[]): void {
    this.wanted = keys;
    this.wantedIds = new Set(keys.map((k) => k.id));
    // What is already on screen and still wanted counts as ready.
    for (const [id, s] of [...this.ready]) {
      if (this.wantedIds.has(id)) continue;
      this.ready.delete(id);
      if (this.shown.get(id) !== s) this.drop(s); // on screen: it goes at the next swap
    }
    for (const k of keys) { const s = this.shown.get(k.id); if (s && !this.ready.has(k.id)) this.ready.set(k.id, s); }
    this.swapIfReady();
  }

  private pump(): void {
    const max = this.pool.size * 2;
    for (const k of this.wanted) {
      if (this.pool.inFlight >= max) break;
      if (this.ready.has(k.id) || this.requested.has(k.id)) continue;
      this.request(k);
    }
  }

  private request(k: ChunkKey): void {
    const gen = this.generation;
    this.requested.add(k.id);
    const job: MeshJob = { seed: this.seed, depth: this.depth, ox: k.ix * k.size, oy: k.iy * k.size, oz: k.iz * k.size, step: k.step, cells: CELLS, lod: k.lod, colorMode: this.colorMode, overlap: k.overlap };
    void this.pool.run(job).then(async (data) => {
      if (gen !== this.generation || !this.wantedIds.has(k.id)) { this.requested.delete(k.id); return; }
      const shown: Shown = { key: k, mesh: data ? meshOf(data) : null };
      if (shown.mesh) await this.stage.prepare(shown.mesh);
      this.requested.delete(k.id);
      if (gen !== this.generation || !this.wantedIds.has(k.id)) { this.drop(shown); return; }
      this.ready.set(k.id, shown);
      this.swapIfReady();
    }, (err: unknown) => {
      this.requested.delete(k.id);
      console.error('chunk mesh failed', k.id, err);
    });
  }

  /** Once the whole wanted set is ready, show it and drop everything else in the same frame. */
  private swapIfReady(): void {
    if (this.ready.size !== this.wanted.length) return;
    for (const [id, s] of this.shown) if (this.ready.get(id) !== s) this.drop(s);
    let triangles = 0;
    for (const s of this.ready.values()) {
      if (s.mesh && !s.mesh.parent) this.group.add(s.mesh);
      if (s.mesh) triangles += (s.mesh.geometry.index?.count ?? 0) / 3;
    }
    this.shown = new Map(this.ready);
    this.stats.chunks = [...this.shown.values()].filter((s) => s.mesh).length;
    this.stats.triangles = triangles;
  }

  private drop(s: Shown): void {
    if (!s.mesh) return;
    s.mesh.removeFromParent();
    s.mesh.geometry.dispose();
    s.mesh = null;
  }

  dispose(): void {
    this.pool.dispose();
    for (const s of this.shown.values()) this.drop(s);
    for (const s of this.ready.values()) this.drop(s);
  }
}

function meshOf(d: ChunkMesh): Mesh {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(d.positions, 3));
  g.setAttribute('normal', new Float32BufferAttribute(d.normals, 3));
  g.setAttribute('color', new Float32BufferAttribute(d.colors, 3));
  g.setIndex(new Uint32BufferAttribute(d.indices, 1));
  g.computeBoundingSphere();
  const m = new Mesh(g, VERTEX_COLOR_SOLID.make());
  m.matrixAutoUpdate = false;
  return m;
}
