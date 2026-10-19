/**
 * The town alive on screen (town-and-first-strata.md §3): birds wheeling above the roofs, a cat
 * walking the ledge by grandma's door, and smoke rising from the chimneys. One view, added with the
 * Stage when the level starts and hidden below the town: the birds and the cat are small vertex-
 * coloured meshes of `VERTEX_COLOR_SOLID`, the plumes are the `SMOKE` kind's fixed pool.
 *
 * The pure models are src/world/birds.ts, src/world/cat.ts and src/world/smoke.ts; the chimneys are
 * src/gen/chimneys.ts. Nothing here is rebuilt or compiled as the town moves: positions and uniforms
 * only, from preallocated scratch (no per-frame allocation).
 */
import { Group, type BufferAttribute, type Mesh } from 'three/webgpu';
import { SMOKE as SMOKE_KIND, SMOKE_PUFFS, SMOKE_SLOTS, SMOKE_STATE, VERTEX_COLOR_SOLID } from './materials';
import { meshFromData, meshOf, type IndexedData } from './meshes';
import { BIRDS, BIRD_SEED, birdAt, type Bird } from '../world/birds';
import { CAT, CAT_SEED, catAt, type Cat } from '../world/cat';
import { puffAge, puffAt, SMOKE, type Puff } from '../world/smoke';
import { CHIMNEYS } from '../gen/chimneys';
import { TOWN } from '../gen/town';

/** The cat's dark fur, its pale chest and paws, and its eyes. */
const FUR: readonly [number, number, number] = [0.055, 0.05, 0.048];
const PALE: readonly [number, number, number] = [0.62, 0.6, 0.55];
const EYE: readonly [number, number, number] = [0.5, 0.58, 0.25];
const NOSE: readonly [number, number, number] = [0.24, 0.12, 0.13];

/** A bird's dark body and its a little lighter wings. */
const BODY: readonly [number, number, number] = [0.045, 0.045, 0.05];
const WING: readonly [number, number, number] = [0.075, 0.075, 0.085];

interface Vector4Like {
  set(x: number, y: number, z: number, w: number): unknown;
}

export class TownLife {
  readonly group = new Group();
  private readonly birds: Mesh;
  private readonly birdBase: Float32Array;
  private readonly birdPos: BufferAttribute;
  private readonly cat = new CatView();
  private readonly smoke = new SmokeView();
  private readonly bird: Bird = { x: 0, y: 0, z: 0, yaw: 0, flap: 0, span: 1 };

  constructor() {
    const shape = birdShape(), base: number[] = [], colors: number[] = [], indices: number[] = [];
    for (let k = 0; k < BIRDS.count; k++) {
      const at = base.length / 3;
      for (let i = 0; i < shape.positions.length; i++) { base.push(shape.positions[i]); colors.push(shape.colors[i]); }
      for (const i of shape.indices) indices.push(i + at);
    }
    this.birdBase = new Float32Array(shape.positions);
    const normals = new Float32Array(base.length);
    for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
    const data: IndexedData = {
      positions: new Float32Array(base), normals, colors: new Float32Array(colors), indices: new Uint32Array(indices),
    };
    this.birds = meshFromData(data, VERTEX_COLOR_SOLID);
    this.birds.name = 'birds';
    this.birds.frustumCulled = false;
    this.birds.visible = false;
    this.birdPos = this.birds.geometry.getAttribute('position') as BufferAttribute;
    this.group.add(this.birds, this.cat.group, this.smoke.group);
  }

  /**
   * Once a frame: the town's life, if the viewer is in the town above ground (`level.depth === 0`,
   * `y` over the street); nothing below it. `time` in seconds.
   */
  present(level: { readonly depth: number }, x: number, y: number, z: number, time: number): void {
    const town = level.depth === 0 && y > TOWN.ground - 1;
    this.group.visible = town;
    if (!town) return;
    this.drawBirds(time);
    const mid = (CAT.wall.z0 + CAT.wall.z1) / 2;
    this.cat.group.visible = Math.hypot(CAT.wall.x - x, mid - z) < CAT.seen;
    if (this.cat.group.visible) this.cat.poseCat(time);
    this.smoke.drawPlumes(time, x, z);
  }

  /** Move the flock's one mesh to its birds' places at `time`. */
  private drawBirds(time: number): void {
    const pos = this.birdPos.array as Float32Array, base = this.birdBase, per = base.length / 3;
    let at = 0;
    for (let k = 0; k < BIRDS.count; k++) {
      birdAt(BIRD_SEED, k, time, this.bird);
      const b = this.bird, ca = Math.cos(b.yaw), sa = Math.sin(b.yaw), span = b.span;
      for (let v = 0; v < per; v++) {
        const bx = base[v * 3] * span, lz = base[v * 3 + 2] * span;
        // The wings beat: their tips rise and fall, their roots hardly move.
        const ly = (base[v * 3 + 1] + b.flap * Math.abs(base[v * 3]) * 0.55) * span;
        pos[at++] = b.x + ca * bx + sa * lz;
        pos[at++] = b.y + ly;
        pos[at++] = b.z - sa * bx + ca * lz;
      }
    }
    this.birdPos.needsUpdate = true;
  }
}

/** One bird's unit shape, both ways round (so it is seen from below as from above), repeated for the flock. */
function birdShape(): { positions: number[]; colors: number[]; indices: number[] } {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const tri = (a: readonly number[], b: readonly number[], c: readonly number[], col: readonly [number, number, number]) => {
    for (const [p, q, r] of [[a, b, c], [a, c, b]] as const) {
      const i = positions.length / 3;
      for (const v of [p, q, r]) { positions.push(v[0], v[1], v[2]); colors.push(col[0], col[1], col[2]); }
      indices.push(i, i + 1, i + 2);
    }
  };
  const nose: readonly number[] = [0, 0.05, -0.45], noseLow: readonly number[] = [0, -0.03, -0.36];
  const tail: readonly number[] = [0, 0.04, 0.45], tailLow: readonly number[] = [0, -0.01, 0.4];
  const top: readonly number[] = [0, 0.11, 0], belly: readonly number[] = [0, -0.04, 0.05];
  const rootL: readonly number[] = [-0.04, 0.04, 0], midL: readonly number[] = [-0.55, 0.02, 0.12];
  const tipL: readonly number[] = [-1.05, 0, 0.25], rearL: readonly number[] = [-0.5, 0.02, 0.32];
  const rootR: readonly number[] = [0.04, 0.04, 0], midR: readonly number[] = [0.55, 0.02, 0.12];
  const tipR: readonly number[] = [1.05, 0, 0.25], rearR: readonly number[] = [0.5, 0.02, 0.32];
  tri(nose, top, tail, BODY);
  tri(noseLow, tailLow, belly, BODY);
  tri(nose, noseLow, top, BODY);
  tri(top, noseLow, belly, BODY);
  tri(top, belly, tail, BODY);
  tri(tail, belly, tailLow, BODY);
  tri(rootL, midL, tipL, WING);
  tri(rootL, tipL, rearL, WING);
  tri(rootR, tipR, midR, WING);
  tri(rootR, rearR, tipR, WING);
  return { positions, colors, indices };
}

/** The cat on screen: body and head, a tail, four legs, posed from `catAt` each frame. */
class CatView {
  readonly group = new Group();
  private readonly body = new Group();
  private readonly head = new Group();
  private readonly tail = new Group();
  private readonly legs: Group[] = [];
  private readonly pose: Cat = { x: 0, y: 0, z: 0, yaw: 0, pose: 'walk', gait: 0, sit: 0, jump: 0 };

  constructor() {
    const mesh = (build: Parameters<typeof meshOf>[0]): Mesh => meshOf(build, VERTEX_COLOR_SOLID);
    // Her body and chest, head and ears, muzzle and eyes, and a tail that curls up behind.
    this.body.add(mesh((b) => {
      b.ellipsoid(0, 0, 0, 0.085, 0.09, 0.21, FUR, 10);
      b.ellipsoid(0, -0.015, -0.17, 0.052, 0.047, 0.055, PALE, 8);
    }));
    this.body.position.y = 0.2;
    this.head.position.y = 0.1; this.head.position.z = -0.2;
    this.head.add(mesh((b) => {
      b.ellipsoid(0, 0, 0, 0.07, 0.065, 0.075, FUR, 10);
      b.ellipsoid(0, -0.02, -0.06, 0.035, 0.03, 0.028, PALE, 8);
      b.ellipsoid(0, -0.005, -0.075, 0.012, 0.008, 0.008, NOSE, 6);
      for (const side of [-1, 1]) {
        b.upright(side * 0.038, 0.075, 0.005, 0, 0.022, 0.035, 0.01, FUR);
        b.ellipsoid(side * 0.032, 0.015, -0.062, 0.012, 0.01, 0.006, EYE, 6);
      }
    }));
    this.body.add(this.head);
    this.tail.position.y = 0.03; this.tail.position.z = 0.2;
    this.tail.add(mesh((b) => {
      b.tube(0, 0, 0, 0, 0.12, 0.1, 0.016, FUR, 6);
      b.tube(0, 0.12, 0.1, 0, 0.25, 0.2, 0.013, FUR, 6);
      b.tube(0, 0.25, 0.2, 0, 0.3, 0.32, 0.009, FUR, 6);
    }));
    this.body.add(this.tail);
    this.group.add(this.body);
    for (const [side, fwd] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const leg = new Group();
      leg.position.x = side * 0.055; leg.position.y = 0.19; leg.position.z = fwd * 0.145;
      leg.add(mesh((b) => {
        b.upright(0, -0.085, 0, 0, 0.022, 0.085, 0.022, FUR);
        b.upright(0, -0.165, 0.008, 0, 0.026, 0.022, 0.03, PALE);
      }));
      this.group.add(leg);
      this.legs.push(leg);
    }
    this.group.visible = false;
  }

  /** Pose it at `time`: walking (legs swinging), sitting or jumping. */
  poseCat(time: number): void {
    const p = this.pose, sit = p.sit, jump = p.jump, walk = p.pose === 'walk';
    catAt(CAT_SEED, time, p);
    this.group.position.x = p.x; this.group.position.y = p.y; this.group.position.z = p.z;
    this.group.rotation.y = p.yaw;
    const swing = walk ? Math.sin(p.gait) : 0, bob = walk ? Math.abs(Math.cos(p.gait)) * 0.012 : 0;
    this.body.position.y = 0.2 - 0.035 * sit + bob;
    this.body.rotation.x = -0.5 * sit - 0.16 * jump;
    this.head.rotation.x = 0.3 * sit + 0.1 * jump;
    this.tail.rotation.x = -0.15 + sit * 0.45 + jump * 0.3;
    this.tail.rotation.z = Math.sin(p.gait * 0.35) * (walk ? 0.2 : 0.06);
    this.legs[0].rotation.x = swing * 0.55 - sit * 0.8 - jump * 0.6;
    this.legs[1].rotation.x = -swing * 0.55 - sit * 0.8 - jump * 0.6;
    this.legs[2].rotation.x = -swing * 0.55 + sit * 1.1 + jump * 0.5;
    this.legs[3].rotation.x = swing * 0.55 + sit * 1.1 + jump * 0.5;
  }
}

/** The plumes on screen: a fixed mesh of the `SMOKE` kind per chimney, its puffs' state in `SMOKE_STATE`. */
class SmokeView {
  readonly group = new Group();
  private readonly plumes: Mesh[] = [];
  private readonly puff: Puff = { x: 0, y: 0, z: 0, size: 0, alpha: 0, shade: 1 };

  constructor() {
    const state = SMOKE_STATE.array as Vector4Like[];
    for (let i = 0; i < SMOKE_SLOTS; i++) {
      const m = meshFromData(plumeShape(i), SMOKE_KIND);
      m.name = 'chimney smoke';
      m.frustumCulled = false;
      m.matrixAutoUpdate = true;
      m.visible = false;
      this.group.add(m);
      this.plumes.push(m);
      for (let k = 0; k < SMOKE_PUFFS; k++) { state[(i * SMOKE_PUFFS + k) * 2].set(0, 0, 0, 0); state[(i * SMOKE_PUFFS + k) * 2 + 1].set(0, 1, 0, 0); }
    }
  }

  /** Put the nearest chimneys' plumes in the slots' uniforms at `time`. */
  drawPlumes(time: number, x: number, z: number): void {
    const state = SMOKE_STATE.array as Vector4Like[];
    for (let i = 0; i < SMOKE_SLOTS; i++) {
      const c = CHIMNEYS[i], m = this.plumes[i];
      if (!c) { m.visible = false; continue; }
      const d = Math.hypot(c.x - x, c.z - z);
      m.visible = d < SMOKE.seen;
      if (!m.visible) continue;
      m.position.x = c.x; m.position.y = c.mouth; m.position.z = c.z;
      // Fade a plume out before it is culled, so it does not pop as one walks the fields.
      const fade = Math.min(1, Math.max(0, (SMOKE.seen - d) / (SMOKE.seen * 0.35)));
      for (let k = 0; k < SMOKE_PUFFS; k++) {
        const p = puffAt(c, k, puffAge(k, time), this.puff), at = (i * SMOKE_PUFFS + k) * 2;
        state[at].set(p.x - c.x, p.y - c.mouth, p.z - c.z, p.size);
        state[at + 1].set(p.alpha * fade, p.shade, 0, 0);
      }
    }
  }
}

/** A plume's shape: `SMOKE_PUFFS` unit quads, their corners; `color` is (puff, slot, 0). */
function plumeShape(slot: number): IndexedData {
  const positions: number[] = [], normals: number[] = [], colors: number[] = [], indices: number[] = [];
  for (let k = 0; k < SMOKE_PUFFS; k++) {
    const at = positions.length / 3;
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      positions.push(x, y, 0);
      normals.push(0, 0, 1);
      colors.push(k, slot, 0);
    }
    indices.push(at, at + 1, at + 2, at, at + 2, at + 3);
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), colors: new Float32Array(colors), indices: new Uint32Array(indices) };
}
