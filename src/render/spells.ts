/**
 * Grandma's salt-magic seen (src/loot/recipes.ts, Fire & Frost and Force): Stove Flame's gout of
 * fire, Cold Larder's cold spreading over the floor (and frost glinting on what it caught), and
 * Rolling Pin's shove going out ahead. Every cast is seen, not only its numbers (Arnd's rule).
 *
 * Fixed pools of glowing sparks per colour, built once and added with the Stage before play.
 */
import { Group, type Mesh } from 'three/webgpu';
import { Rng, deriveSeed } from '@futuremagic/core';
import { meshOf } from './meshes';
import { GLOW } from './materials';

/** Sparks per pool, and each kind's colours (linear RGB, glowing), how long a spark lives and how big it is. */
export const SPELLS = {
  pool: 64,
  fire: { colors: [[2.4, 0.9, 0.2], [2.2, 1.5, 0.35], [1.8, 0.4, 0.1]], life: 0.45, size: 0.14 },
  frost: { colors: [[0.75, 1.3, 2.2], [1.6, 1.9, 2.3], [0.5, 0.9, 1.8]], life: 0.7, size: 0.08 },
  force: { colors: [[1.6, 1.5, 1.3], [1.3, 1.3, 1.4], [1.9, 1.7, 1.3]], life: 0.3, size: 0.09 },
} as const;

type Kind = 'fire' | 'frost' | 'force';

interface Spark {
  readonly mesh: Mesh;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  /** When it was cast (-1: not in use), and how long it lives. */
  t0: number;
  life: number;
}

class Pool {
  readonly sparks: Spark[] = [];
  private next = 0;

  constructor(root: Group, kind: Kind) {
    const k = SPELLS[kind];
    const protos = k.colors.map((c) => meshOf((b) => { b.ellipsoid(0, 0, 0, k.size, k.size, k.size, [c[0], c[1], c[2]], 6); }, GLOW));
    for (let i = 0; i < SPELLS.pool; i++) {
      const mesh = protos[i % protos.length].clone();
      mesh.visible = false;
      root.add(mesh);
      this.sparks.push({ mesh, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t0: -1, life: 1 });
    }
  }

  /** A spark from (x, y, z) at velocity (vx, vy, vz), from `t0` for `life` seconds. */
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, t0: number, life: number): void {
    const s = this.sparks[this.next];
    this.next = (this.next + 1) % this.sparks.length;
    Object.assign(s, { x, y, z, vx, vy, vz, t0, life });
  }

  place(now: number): void {
    for (const s of this.sparks) {
      const t = now - s.t0;
      s.mesh.visible = s.t0 >= 0 && t >= 0 && t < s.life;
      if (!s.mesh.visible) continue;
      // Slowing as it goes (drag), swelling then going out.
      const f = t / s.life, d = s.life * (1 - (1 - f) ** 2) * 0.5 + t * 0.5;
      s.mesh.position.set(s.x + s.vx * d, s.y + s.vy * d, s.z + s.vz * d);
      s.mesh.scale.setScalar(0.4 + 1.6 * Math.sin(Math.PI * Math.min(1, f * 1.3)) * (1 - f * 0.5));
    }
  }
}

export class SpellView {
  readonly root = new Group();
  private readonly pools: Record<Kind, Pool>;
  private readonly rng: Rng;

  constructor(seed: number) {
    this.rng = new Rng(deriveSeed(seed, 'spells'));
    this.pools = { fire: new Pool(this.root, 'fire'), frost: new Pool(this.root, 'frost'), force: new Pool(this.root, 'force') };
  }

  /** Stove Flame from the hand at (x, y, z) along `yaw`, `reach` metres, at `now`. */
  flame(x: number, y: number, z: number, yaw: number, reach: number, now: number): void {
    const life = SPELLS.fire.life;
    for (let i = 0; i < 40; i++) {
      const a = yaw + this.rng.range(-0.38, 0.38), v = (reach / life) * this.rng.range(0.55, 1.05);
      this.pools.fire.emit(x, y, z, -Math.sin(a) * v, this.rng.range(-0.4, 1.4), -Math.cos(a) * v, now + i * 0.006, life * this.rng.range(0.7, 1));
    }
  }

  /** Cold Larder: the cold going out over the floor from (x, y, z) to `r` metres, at `now`. */
  frost(x: number, y: number, z: number, r: number, now: number): void {
    const life = SPELLS.frost.life;
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2 + this.rng.range(-0.1, 0.1), v = (r / life) * this.rng.range(0.8, 1.05);
      this.pools.frost.emit(x, y + 0.15, z, Math.cos(a) * v, this.rng.range(0, 0.6), Math.sin(a) * v, now, life);
    }
  }

  /** Frost glinting on something chilled at (x, y, z), `h` metres tall. */
  glint(x: number, y: number, z: number, h: number, now: number): void {
    const a = this.rng.range(0, Math.PI * 2), r = this.rng.range(0.1, 0.35);
    this.pools.frost.emit(x + Math.cos(a) * r, y + this.rng.range(0.1, h + 0.1), z + Math.sin(a) * r, 0, 0.5, 0, now, SPELLS.frost.life);
  }

  /** Rolling Pin: a shove going out from (x, y, z) along `yaw`, `reach` metres, at `now`. */
  push(x: number, y: number, z: number, yaw: number, reach: number, now: number): void {
    const life = SPELLS.force.life;
    for (let i = 0; i < 30; i++) {
      const a = yaw + ((i % 15) / 14 - 0.5) * 1.5, v = reach / life;
      this.pools.force.emit(x, y + (i < 15 ? 0.5 : 1.1), z, -Math.sin(a) * v, 0, -Math.cos(a) * v, now, life);
    }
  }

  place(now: number): void {
    for (const p of Object.values(this.pools)) p.place(now);
  }
}
