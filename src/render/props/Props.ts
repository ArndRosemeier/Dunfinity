/**
 * Streams a level's props (rails, carts, lamps, shacks, standing water; src/gen/quarryProps.ts) around the viewer in
 * tiles, built in the worker pool and compiled on the Stage before they show. Feeds the burning
 * lamps to the lamp lights.
 */
import { Group, type Object3D } from 'three/webgpu';
import { PROP_TILE, type PropTile } from '../../gen/quarryProps';
import { createPropsPool, type WorkerPool } from '../../workers/pool';
import type { PropsJob } from '../../workers/props.worker';
import { GLOW, ROCK, VERTEX_COLOR_SOLID, WATER } from '../materials';
import { meshFromData } from '../meshes';
import type { Stage } from '../stage';
import type { LampLights } from './lamps';
import { Blockers } from '../../world/blockers';

/** Props show within this distance of the viewer, metres. */
const RADIUS = 200;

interface Tile {
  tx: number;
  tz: number;
  /** Null while it is built (or when the tile is empty). */
  group: Group | null;
  lamps: Float32Array;
  watchers: Float32Array;
  triangles: number;
  done: boolean;
}

export class Props {
  private readonly pool: WorkerPool<PropsJob, PropTile>;
  private readonly tiles = new Map<string, Tile>();
  private readonly lampLists: Float32Array[] = [];
  /** The watcher statues of the built tiles (`PropTile.watchers`), for the view that draws them. */
  readonly watcherLists: Float32Array[] = [];
  stats = { tiles: 0, triangles: 0, lamps: 0, pending: 0 };
  /** The props in the way, for the tiles that are built (bodies and creatures ask it). */
  readonly blockers = new Blockers();

  constructor(private readonly stage: Stage, private readonly group: Object3D, readonly seed: number, readonly depth: number, private readonly lights: LampLights) {
    this.pool = createPropsPool();
  }

  /** Call every frame with the viewer position and the time in seconds. */
  update(x: number, y: number, z: number, time: number): void {
    const r = Math.ceil(RADIUS / PROP_TILE);
    const cx = Math.floor(x / PROP_TILE), cz = Math.floor(z / PROP_TILE);
    const wanted: [number, number, number][] = [];
    for (let tz = cz - r; tz <= cz + r; tz++) for (let tx = cx - r; tx <= cx + r; tx++) {
      const d = Math.hypot((tx + 0.5) * PROP_TILE - x, (tz + 0.5) * PROP_TILE - z);
      if (d < RADIUS + PROP_TILE * 0.71) wanted.push([d, tx, tz]);
    }
    wanted.sort((a, b) => a[0] - b[0]);
    for (const [, tx, tz] of wanted) {
      if (this.pool.inFlight >= this.pool.size * 2) break;
      const id = `${tx},${tz}`;
      if (!this.tiles.has(id)) this.request(id, tx, tz);
    }
    // Drop tiles well outside the radius (the margin keeps a tile from flapping at the edge).
    for (const [id, t] of this.tiles) {
      if (Math.hypot((t.tx + 0.5) * PROP_TILE - x, (t.tz + 0.5) * PROP_TILE - z) > RADIUS + PROP_TILE * 1.5) this.drop(id, t);
    }
    this.lampLists.length = 0;
    this.watcherLists.length = 0;
    let tiles = 0, triangles = 0, lamps = 0, pending = 0;
    for (const t of this.tiles.values()) {
      if (!t.done) { pending++; continue; }
      tiles++; triangles += t.triangles; lamps += t.lamps.length / 3;
      if (t.lamps.length) this.lampLists.push(t.lamps);
      if (t.watchers.length) this.watcherLists.push(t.watchers);
    }
    this.stats = { tiles, triangles, lamps, pending };
    this.lights.update(x, y, z, this.lampLists, time);
  }

  /** True when every tile asked for is built and shown. */
  get settled(): boolean {
    return this.tiles.size > 0 && this.stats.pending === 0 && this.pool.inFlight === 0;
  }

  private request(id: string, tx: number, tz: number): void {
    const tile: Tile = { tx, tz, group: null, lamps: new Float32Array(0), watchers: new Float32Array(0), triangles: 0, done: false };
    this.tiles.set(id, tile);
    void this.pool.run({ seed: this.seed, depth: this.depth, tx, tz }).then(async (data) => {
      if (this.tiles.get(id) !== tile) return;
      const group = new Group();
      for (const [mesh, kind] of [[data.solid, VERTEX_COLOR_SOLID], [data.glow, GLOW], [data.water, WATER], [data.stones, ROCK]] as const) {
        if (!mesh) continue;
        group.add(meshFromData(mesh, kind));
        tile.triangles += mesh.indices.length / 3;
      }
      if (group.children.length) await this.stage.prepare(group);
      if (this.tiles.get(id) !== tile) { dispose(group); return; }
      if (group.children.length) { tile.group = group; this.group.add(group); }
      tile.lamps = data.lamps;
      tile.watchers = data.watchers;
      this.blockers.set(id, data.blockers);
      tile.done = true;
    }, (err: unknown) => {
      console.error('props failed', id, err);
      tile.done = true;
    });
  }

  private drop(id: string, t: Tile): void {
    this.tiles.delete(id);
    this.blockers.clear(id);
    if (t.group) dispose(t.group);
  }

  dispose(): void {
    this.pool.dispose();
    for (const [id, t] of this.tiles) this.drop(id, t);
  }
}

function dispose(g: Group): void {
  g.removeFromParent();
  for (const c of g.children) (c as { geometry?: { dispose(): void } }).geometry?.dispose();
}
