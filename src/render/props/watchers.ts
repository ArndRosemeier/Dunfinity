/**
 * The watchers (docs/design/town-and-first-strata.md §4, the Salt Works: "salt statues face a
 * different way when you look back"): some of the carved miners (src/gen/quarryProps.ts) are not part
 * of their tile. Their figures are drawn here, and while one is out of sight for a moment it turns
 * to face you. Never while you look: you only ever find it turned.
 *
 * A fixed pool of figures in the rock kind, added with the Stage once.
 */
import { Frustum, Group, Matrix4, Sphere, Vector3, type Camera, type Mesh } from 'three/webgpu';
import { PropBuilder } from '../../gen/propMesh';
import { MINER_POSES, carveMiner } from '../../gen/quarryProps';
import { SALT } from '../../gen/bands';
import { meshFromData } from '../meshes';
import { ROCK } from '../materials';

/** Figures of each pose that can be drawn at once; drawn within SHOWN metres; seconds out of sight before one turns. */
const PER_POSE = 4;
const SHOWN = 60;
const UNSEEN = 1.2;

interface Watch {
  yaw: number;
  /** Seconds out of sight. */
  unseen: number;
}

export class Watchers {
  readonly root = new Group();
  private readonly pools: Mesh[][] = [];
  private readonly state = new Map<string, Watch>();
  private readonly frustum = new Frustum();
  private readonly m = new Matrix4();
  private readonly sphere = new Sphere(new Vector3(), 1.3);

  constructor() {
    const k = 1.15, salt: [number, number, number] = [SALT.stone[0] * k, SALT.stone[1] * k, SALT.stone[2] * k];
    for (let p = 0; p < MINER_POSES; p++) {
      const b = new PropBuilder();
      carveMiner(b, 0, 0, 0, 0, p, salt);
      const first = meshFromData(b.build()!, ROCK);
      const pool = [first];
      for (let i = 1; i < PER_POSE; i++) pool.push(first.clone());
      for (const m of pool) { m.matrixAutoUpdate = true; m.visible = false; this.root.add(m); }
      this.pools.push(pool);
    }
  }

  /** Once per frame: draw the watchers of `lists` (x, top, z, yaw, pose each) near (px, pz), turning the unseen ones to you. */
  draw(lists: readonly Float32Array[], px: number, pz: number, camera: Camera, dt: number): void {
    camera.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(this.m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const used = this.pools.map(() => 0);
    for (const l of lists) for (let i = 0; i < l.length; i += 5) {
      const x = l[i], top = l[i + 1], z = l[i + 2], pose = l[i + 4];
      if (Math.hypot(x - px, z - pz) > SHOWN || used[pose] >= PER_POSE) continue;
      const key = `${x.toFixed(2)},${z.toFixed(2)}`;
      let w = this.state.get(key);
      if (!w) { w = { yaw: l[i + 3], unseen: 0 }; this.state.set(key, w); }
      this.sphere.center.set(x, top + 1, z);
      if (this.frustum.intersectsSphere(this.sphere)) w.unseen = 0;
      else if ((w.unseen += dt) > UNSEEN) w.yaw = Math.atan2(px - x, pz - z);
      const m = this.pools[pose][used[pose]++];
      m.visible = true;
      m.position.set(x, top, z);
      m.rotation.y = w.yaw;
    }
    this.pools.forEach((pool, p) => { for (let i = used[p]; i < pool.length; i++) pool[i].visible = false; });
  }

  /** A new level: forget which way they were turned. */
  reset(): void {
    this.state.clear();
  }
}
