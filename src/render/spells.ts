/**
 * Grandma's salt-magic seen (src/loot/recipes.ts, Fire & Frost and Force): Stove Flame's gout of
 * fire, Cold Larder's cold spreading over the floor (and frost glinting on what it caught), and
 * Rolling Pin's shove going out ahead, and the puff of salt under a sprung jump (Spring in Your
 * Step), and the green of grandma's Snapdragons: the floor bursting where one comes up, sap where
 * it bites; grandma's flour hanging in a cloud (and dusting what it blinded), and the cloud going
 * up when a match finds it. Every cast is seen, not only its numbers (Arnd's rule).
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
  sap: { colors: [[0.45, 1.6, 0.35], [0.3, 1.3, 0.9], [1.1, 1.7, 0.3]], life: 0.6, size: 0.07 },
  /** Flour: big soft puffs, dim (lit by the lamp more than glowing), many of them, long-lived. */
  flour: { colors: [[0.55, 0.53, 0.48], [0.62, 0.6, 0.55], [0.48, 0.46, 0.42]], life: 1.6, size: 0.32, pool: 220 },
  /** A flour cloud going up: a big hot ball. */
  blast: { colors: [[3, 1.5, 0.35], [2.6, 0.8, 0.15], [3.2, 2.2, 0.8]], life: 0.7, size: 0.3, pool: 120 },
} as const;

type Kind = 'fire' | 'frost' | 'force' | 'sap' | 'flour' | 'blast';

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
    for (let i = 0; i < ('pool' in k ? k.pool : SPELLS.pool); i++) {
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
    this.pools = { fire: new Pool(this.root, 'fire'), frost: new Pool(this.root, 'frost'), force: new Pool(this.root, 'force'), sap: new Pool(this.root, 'sap'), flour: new Pool(this.root, 'flour'), blast: new Pool(this.root, 'blast') };
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

  /** Spring in Your Step: a puff of salt kicked out round the feet at (x, y, z), at `now`. */
  puff(x: number, y: number, z: number, now: number): void {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, v = this.rng.range(2, 3.2);
      this.pools.force.emit(x, y + 0.1, z, Math.cos(a) * v, this.rng.range(0, 0.8), Math.sin(a) * v, now, SPELLS.force.life * 1.4);
    }
  }

  /** Snapdragons: the floor bursting at (x, y, z) where a seed comes up, at `now`, the green going up with the stalk. */
  sprout(x: number, y: number, z: number, now: number): void {
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2 + this.rng.range(-0.15, 0.15), v = this.rng.range(0.6, 1.6), up = i % 3 === 0;
      this.pools.sap.emit(x, y + 0.05, z, Math.cos(a) * v * (up ? 0.3 : 1), up ? this.rng.range(2, 3.5) : this.rng.range(0.4, 1.2), Math.sin(a) * v * (up ? 0.3 : 1), now + (up ? 0.3 : 0) + i * 0.01, SPELLS.sap.life * this.rng.range(0.8, 1.4));
    }
  }

  /** A snapdragon's bite landing at (x, y, z): sap spattering, at `now`. */
  snap(x: number, y: number, z: number, now: number): void {
    for (let i = 0; i < 12; i++) {
      const a = this.rng.range(0, Math.PI * 2), v = this.rng.range(1, 2.4);
      this.pools.sap.emit(x, y, z, Math.cos(a) * v, this.rng.range(-0.3, 1.5), Math.sin(a) * v, now, SPELLS.sap.life * 0.6);
    }
  }

  /** Flour Bag: the bag bursting at (x, y, z) into a cloud `r` metres round, at `now`. */
  burst(x: number, y: number, z: number, r: number, now: number): void {
    for (let i = 0; i < 40; i++) {
      const a = this.rng.range(0, Math.PI * 2), v = this.rng.range(0.4, 1) * (r / SPELLS.flour.life);
      this.pools.flour.emit(x, y + 0.6, z, Math.cos(a) * v, this.rng.range(-0.2, 1), Math.sin(a) * v, now + i * 0.004, SPELLS.flour.life * this.rng.range(0.7, 1.1));
    }
  }

  /** A flour cloud hanging at (x, y, z), `r` metres round (`thin`: 1 thick, towards 0 as it thins away): a few puffs more, at `now`. */
  hang(x: number, y: number, z: number, r: number, thin: number, now: number): void {
    const n = Math.round(4 * r * thin);
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, Math.PI * 2), d = Math.sqrt(this.rng.float()) * r * 0.9;
      this.pools.flour.emit(x + Math.cos(a) * d, y + this.rng.range(0.1, 2.2), z + Math.sin(a) * d, this.rng.range(-0.15, 0.15), this.rng.range(-0.05, 0.12), this.rng.range(-0.15, 0.15), now, SPELLS.flour.life * this.rng.range(0.8, 1.3));
    }
  }

  /** Flour on something blinded at (x, y, z), `h` metres tall: it shakes off as it stumbles. */
  dusted(x: number, y: number, z: number, h: number, now: number): void {
    const a = this.rng.range(0, Math.PI * 2);
    this.pools.flour.emit(x + Math.cos(a) * 0.2, y + this.rng.range(0.2, h + 0.1), z + Math.sin(a) * 0.2, Math.cos(a) * 0.3, -0.2, Math.sin(a) * 0.3, now, SPELLS.flour.life * 0.5);
  }

  /** A flour cloud at (x, y, z), `r` metres round, going up at `now`: a ball of flame through it all at once, flung out. */
  blast(x: number, y: number, z: number, r: number, now: number): void {
    for (let i = 0; i < 90; i++) {
      const a = this.rng.range(0, Math.PI * 2), d = Math.sqrt(this.rng.float()) * r * 0.8, v = this.rng.range(1.5, 3.5);
      this.pools.blast.emit(x + Math.cos(a) * d, y + this.rng.range(0.1, 2), z + Math.sin(a) * d, Math.cos(a) * v, this.rng.range(0.5, 3), Math.sin(a) * v, now + (d / r) * 0.12, SPELLS.blast.life * this.rng.range(0.7, 1.2));
    }
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2, v = (r * 1.4) / SPELLS.fire.life;
      this.pools.fire.emit(x, y + 0.5, z, Math.cos(a) * v, this.rng.range(0, 1), Math.sin(a) * v, now, SPELLS.fire.life);
    }
  }

  place(now: number): void {
    for (const p of Object.values(this.pools)) p.place(now);
  }
}
