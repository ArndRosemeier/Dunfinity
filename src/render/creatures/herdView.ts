/**
 * The level's own animals on screen (src/creatures/critters.ts): each of the level's species meshed
 * when the level is shown (src/render/creatures/critterView.ts), a few figures of each, given to the
 * nearest of that species and kept by it while it is drawn (its rig remembers where its feet stand).
 * One stand-in figure goes through the warm-up, so the skinned creature shaders are built before play;
 * every species after draws with the same ones.
 */
import { Group, type Object3D } from 'three/webgpu';
import { Rng } from '@futuremagic/core';
import type { Stage } from '../stage';
import type { Level } from '../../gen/level';
import { grow, type Species } from '../../creatures/bestiary';
import type { Critter } from '../../creatures/critters';
import { CritterModel, type CritterFigure } from './critterView';
import type { RigInput } from './critterRig';

/** How long a hit flashes and flinches, s. */
const FLINCH = 0.4;

interface Pool {
  readonly model: CritterModel;
  readonly group: Group;
  readonly free: CritterFigure[];
  readonly used: Map<number, CritterFigure>;
}

export class HerdView {
  /** Goes into the warm-up (`view.start`), then is dropped. */
  readonly warmUp: Object3D;
  private pools = new Map<Species, Pool>();
  private shown: Level | null = null;
  private readonly input: { -readonly [K in keyof RigInput]: RigInput[K] } = { x: 0, y: 0, z: 0, yaw: 0, vx: 0, vz: 0, dead: false, action: '', actionT: 0, lookAt: null, running: false, time: 0, scale: 1 };
  private readonly eye: [number, number, number] = [0, 0, 0];

  constructor(private readonly stage: Stage) {
    const model = new CritterModel(grow(new Rng(1), 'grazer', 0.5, 'warm-up'));
    this.warmUp = model.figure(() => 0).root;
  }

  /** Mesh `species` for `level` (once per level; the last level's are dropped). */
  stock(level: Level, species: readonly Species[]): void {
    if (this.shown === level) return;
    this.shown = level;
    for (const p of this.pools.values()) { this.stage.remove(p.group); p.model.free(); }
    this.pools = new Map();
    const floorOf = (x: number, z: number) => level.groundAt(x, z);
    for (const sp of species) {
      const model = new CritterModel(sp), group = new Group();
      group.name = `critters ${sp.id}`;
      const free: CritterFigure[] = [];
      for (let k = 0; k < Math.min(12, sp.group[1] * 2); k++) {
        const f = model.figure(floorOf);
        f.root.visible = false;
        group.add(f.root);
        free.push(f);
      }
      this.pools.set(sp, { model, group, free, used: new Map() });
      void this.stage.add(group);
    }
  }

  /** Pose the ones near `at` (the nearest first); `head`: where your eyes are (they watch you). */
  drawHerds(list: readonly Critter[], head: { readonly x: number; readonly y: number; readonly z: number }, dt: number, time: number): void {
    this.eye[0] = head.x; this.eye[1] = head.y; this.eye[2] = head.z;
    const seen = new Set<number>();
    const byDistance = [...list].sort((a, b) => Math.hypot(a.x - head.x, a.z - head.z) - Math.hypot(b.x - head.x, b.z - head.z));
    for (const c of byDistance) {
      const pool = this.pools.get(c.species);
      if (!pool) continue;
      let fig = pool.used.get(c.id);
      if (!fig) {
        fig = pool.free.pop();
        if (!fig) continue;
        pool.used.set(c.id, fig);
      }
      seen.add(c.id);
      const i = this.input;
      i.x = c.x; i.y = c.y; i.z = c.z; i.yaw = c.yaw; i.vx = c.vx; i.vz = c.vz;
      i.dead = c.dead; i.running = c.running; i.time = time; i.scale = c.size;
      i.lookAt = c.watching && !c.dead ? this.eye : null;
      // A hit shows: a flinch (unless it is striking) and a red flash.
      if (c.action) { i.action = c.action; i.actionT = c.actionT; } else if (c.hurtT < FLINCH && !c.dead) { i.action = 'flinch'; i.actionT = c.hurtT / FLINCH; } else { i.action = ''; i.actionT = 0; }
      fig.animate(i, dt, c.hurtT < FLINCH ? 1 - c.hurtT / FLINCH : 0);
    }
    for (const pool of this.pools.values()) for (const [id, fig] of pool.used) {
      if (seen.has(id)) continue;
      fig.root.visible = false;
      pool.used.delete(id);
      pool.free.push(fig);
    }
  }
}
