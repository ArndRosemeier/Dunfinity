/**
 * Infused salt drifting into the tin (src/loot/tin.ts): where it formed (a corpse, the nobody's own
 * feet) pale blue motes rise, swirl, then stream to the nobody and are gone, "like iron filings to a
 * magnet" (docs/design/recipe-box.md §4). Every gain is seen, not only counted.
 *
 * A fixed pool of motes in the glow kind, built once and added with the Stage before play.
 */
import { Group, type Mesh } from 'three/webgpu';
import { Rng, deriveSeed } from '@futuremagic/core';
import { meshOf } from '../meshes';
import { GLOW } from '../materials';

/** Motes in the pool; seconds a mote rises and swirls, then flies; how high it rises, metres. */
export const DRIFT = { pool: 48, rise: 0.7, fly: 0.8, up: 0.9, spread: 0.35, stagger: 0.04, size: 0.06 } as const;

interface Mote {
  readonly mesh: Mesh;
  /** Where it formed, and its swirl. */
  x: number; y: number; z: number; a: number;
  /** When it formed; -1: not in use. */
  t0: number;
}

export class SaltDrift {
  readonly root = new Group();
  private readonly motes: Mote[] = [];
  private readonly rng: Rng;
  private next = 0;

  constructor(seed: number) {
    this.rng = new Rng(deriveSeed(seed, 'salt-drift'));
    const proto = meshOf((b) => {
      b.ellipsoid(0, 0, 0, DRIFT.size, DRIFT.size, DRIFT.size, [0.7, 0.95, 1.4], 6);
    }, GLOW);
    for (let k = 0; k < DRIFT.pool; k++) {
      const mesh = proto.clone();
      mesh.visible = false;
      this.root.add(mesh);
      this.motes.push({ mesh, x: 0, y: 0, z: 0, a: 0, t0: -1 });
    }
  }

  /** `amount` pinches form at (x, y, z) at time `now`: a few motes per pinch. */
  burst(x: number, y: number, z: number, amount: number, now: number): void {
    const n = Math.min(DRIFT.pool / 2, 6 + amount * 3);
    for (let k = 0; k < n; k++) {
      const m = this.motes[this.next];
      this.next = (this.next + 1) % DRIFT.pool;
      m.x = x + this.rng.range(-DRIFT.spread, DRIFT.spread);
      m.y = y + this.rng.range(0, 0.3);
      m.z = z + this.rng.range(-DRIFT.spread, DRIFT.spread);
      m.a = this.rng.range(0, Math.PI * 2);
      m.t0 = now + k * DRIFT.stagger;
    }
  }

  /** Place the motes at `now`, streaming to (tx, ty, tz) (the nobody). */
  stream(now: number, tx: number, ty: number, tz: number): void {
    for (const m of this.motes) {
      const t = now - m.t0;
      m.mesh.visible = m.t0 >= 0 && t >= 0 && t < DRIFT.rise + DRIFT.fly;
      if (!m.mesh.visible) { if (t >= DRIFT.rise + DRIFT.fly) m.t0 = -1; continue; }
      // Rising and swirling round where it formed, then drawn in, faster and faster.
      const r = Math.min(1, t / DRIFT.rise), sw = 0.18 * Math.sin(r * Math.PI);
      const a = m.a + t * 5;
      const hx = m.x + Math.cos(a) * sw, hy = m.y + DRIFT.up * (1 - (1 - r) ** 2), hz = m.z + Math.sin(a) * sw;
      const f = Math.max(0, t - DRIFT.rise) / DRIFT.fly, e = f * f;
      m.mesh.position.set(hx + (tx - hx) * e, hy + (ty - hy) * e, hz + (tz - hz) * e);
      m.mesh.scale.setScalar(1 + 0.6 * Math.sin(t * 17 + m.a) - 0.6 * e);
    }
  }
}
