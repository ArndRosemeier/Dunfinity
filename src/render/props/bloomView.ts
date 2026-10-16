/**
 * Draw the salt blooms (src/gen/blooms.ts): a fixed pool of `BLOOM_SLOTS` meshes of the `BLOOM`
 * kind, added once with the Stage, each a few dozen little hopper cubes of salt over a unit disc.
 * Each frame the nearest blooms take the slots, and how far grown and crumbled they are goes to the
 * shader (`BLOOM_STATE`): nothing is rebuilt as they spread, nothing compiles.
 */
import { Rng, hash2i } from '@futuremagic/core';
import { SlotPool } from './slotPool';
import { BLOOM as BLOOM_KIND, BLOOM_SALT, BLOOM_SLOTS, BLOOM_STATE } from '../materials';
import { BLOOM, bloomLook, type BloomLook, type BloomSite } from '../../gen/blooms';
import type { Level } from '../../gen/level';
import { ROCK_TYPES } from '../../gen/rockTypes';

/** Crystals in a bloom. */
const CRYSTALS = 110;

export class BloomView {
  private readonly pool = new SlotPool<BloomSite>(BLOOM_SLOTS, 'salt bloom', BLOOM_KIND, crystals);
  readonly root = this.pool.root;
  private readonly look: BloomLook = { grown: 0, crumbled: 0, t: 0 };
  private level: Level | null = null;
  /** A time to hold every bloom at instead of the clock (the Lab and stills). */
  held: number | null = null;

  /** The blooms drawn now, nearest first (for their sounds). */
  get shown(): readonly BloomSite[] { return this.pool.sites; }

  /** Once a frame: give the slots to the blooms nearest (x, z) and set their look at `time` (s). */
  draw(level: Level, x: number, z: number, time: number): void {
    if (level !== this.level) {
      this.level = level;
      const r = level.rockRecipes[ROCK_TYPES.indexOf('salt')].base;
      BLOOM_SALT.value.set(0.2 + r[0] * 0.2, 0.22 + r[1] * 0.2, 0.25 + r[2] * 0.2);
    }
    const sites = this.pool.fill(level.blooms, x, z, BLOOM.seen);
    const state = BLOOM_STATE.array as { set(x: number, y: number, z: number, w: number): unknown }[];
    for (let i = 0; i < BLOOM_SLOTS; i++) {
      const m = this.pool.slots[i], s = sites[i];
      const l = s ? bloomLook(s, this.held ?? time, this.look) : null;
      m.visible = !!l && l.grown > 0;
      if (!s || !l) continue;
      m.position.set(s.x, s.y, s.z);
      state[i].set(l.grown, l.crumbled, s.r, 0);
    }
  }
}

/**
 * Slot `slot`'s crystals over the unit disc: tilted little cubes, bigger and earlier near the middle,
 * smaller and later out at the edge, some in clusters; each knows its foot and when it forms.
 */
function crystals(slot: number) {
  const pos: number[] = [], nor: number[] = [], col: number[] = [], idx: number[] = [];
  const rng = new Rng(hash2i(slot, 91, 3)), last = [0, 0];
  for (let c = 0; c < CRYSTALS; c++) {
    // Out from the middle as the bloom spreads: the c-th crystal a little further out, at a seeded angle.
    // Half of them gather beside the one before, so they grow in clusters.
    const near = c > 0 && rng.chance(0.5);
    const out = near ? Math.min(0.97, Math.hypot(last[0], last[1]) + rng.range(0, 0.04)) : Math.sqrt((c + rng.range(0, 1)) / CRYSTALS) * 0.97;
    const ang = near ? Math.atan2(last[1], last[0]) + rng.range(-0.12, 0.12) : rng.range(0, Math.PI * 2);
    const fx = Math.cos(ang) * out, fz = Math.sin(ang) * out;
    last[0] = fx; last[1] = fz;
    const size = (0.14 - out * 0.08) * rng.range(0.5, 1.3);
    const when = Math.min(0.92, out * out * 0.9 + rng.range(0, 0.06));
    // A cube tilted a little about a random axis, half sunk into the floor.
    const ax = rng.range(-0.5, 0.5), az = rng.range(-0.5, 0.5), yaw = rng.range(0, Math.PI * 2);
    const tilt = (v: readonly [number, number, number]): [number, number, number] => {
      const [x0, y0, z0] = v;
      const x1 = x0 * Math.cos(yaw) - z0 * Math.sin(yaw), z1 = x0 * Math.sin(yaw) + z0 * Math.cos(yaw);
      const y2 = y0 * Math.cos(ax) - z1 * Math.sin(ax), z2 = y0 * Math.sin(ax) + z1 * Math.cos(ax);
      const x3 = x1 * Math.cos(az) - y2 * Math.sin(az), y3 = x1 * Math.sin(az) + y2 * Math.cos(az);
      return [x3, y3, z2];
    };
    for (const [n, u, v] of FACES) {
      const base = pos.length / 3, nn = tilt(n);
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const corner = tilt([(n[0] + u[0] * a + v[0] * b) * size / 2, (n[1] + u[1] * a + v[1] * b) * size / 2 + size * 0.15, (n[2] + u[2] * a + v[2] * b) * size / 2]);
        pos.push(fx + corner[0], corner[1], fz + corner[2]);
        nor.push(...nn);
        col.push(fx, fz, slot + when * 0.9);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  return { positions: new Float32Array(pos), normals: new Float32Array(nor), colors: new Float32Array(col), indices: new Uint32Array(idx) };
}

/** A cube's faces: (normal, u, v), wound so u × v = normal. */
const FACES = [
  [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
  [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
  [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
] as const;
