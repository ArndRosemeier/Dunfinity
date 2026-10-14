/**
 * Quarry rats (docs/design/town-and-first-strata.md §5: levels 1–4, "individually pathetic, together
 * not"): the first enemy. They live in nests scattered over the floor of the workings, a few to a
 * nest; near you they wake up, sniff about and scurry round their nest. Come too close, or hurt one,
 * and the whole nest comes for you: they run faster than you walk (but not than you sprint), spread
 * round you and bite. They cannot climb, so a ledge saves you. A badly hurt rat may bolt for a moment.
 *
 * Pure: positions on the level's floor, blows through src/combat. Nests are fixed by the seed; the
 * rats of a nest exist only while you are near it, and the ones you killed stay dead on this visit.
 */
import { Rng, deriveSeed, hash3f, angleDiff } from '@futuremagic/core';
import type { Level } from '../gen/level';
import { damage, type Fighter } from '../combat/combat';
import { CellMemo } from '../gen/cellMemo';

export const RAT = {
  /** Body radius and height at size 1, metres. */
  radius: 0.2,
  height: 0.32,
  health: 14,
  /** Speeds, metres per second: pottering about, and running at you (you walk 4.2 and sprint 7). */
  walk: 1.2,
  run: 4.8,
  /** They notice you this close (closer when you sneak about in the dark later); give up beyond `forget`. */
  notice: 9,
  forget: 26,
  /** A bite: reach beyond touching, damage, seconds between bites, and the wind-up before the snap. */
  biteReach: 0.35,
  biteDamage: [2, 4] as const,
  biteEvery: 1.6,
  windup: 0.3,
  /** Nests: cell size, chance per cell (rising a little with depth), none this close to the arrival, rats per nest, how far they roam. */
  cell: 36,
  chance: 0.42,
  quiet: 16,
  count: [3, 6] as const,
  roam: 5,
  /** Nests come alive within `wake` metres of you and go back to sleep beyond `sleep`. */
  wake: 50,
  sleep: 70,
  /** A step up a rat can take (it scrambles up a knee-high ledge); a drop it will not take, metres. */
  step: 0.8,
  drop: 1.6,
} as const;

export type RatMode = 'sniff' | 'scurry' | 'chase' | 'bite' | 'flee' | 'dead';

export interface Nest {
  readonly key: number;
  readonly x: number;
  readonly z: number;
  readonly y: number;
  readonly count: number;
  /** The nest is up in arms (one of them was hurt, or it saw you). */
  alarmed: boolean;
  /** Its rats while it is awake, else null. */
  rats: Rat[] | null;
}

export class Rat implements Fighter {
  x: number;
  y: number;
  z: number;
  vx = 0;
  vz = 0;
  /** Facing (forward is (-sin yaw, -cos yaw)). */
  yaw: number;
  health: number = RAT.health;
  mode: RatMode = 'sniff';
  /** Seconds left in the current mode (sniff, scurry, flee) or of the bite. */
  t = 0;
  /** Gait phase (radians), advanced by distance travelled. */
  gait = 0;
  /** Seconds since the last bite started (the snap is at RAT.windup), and since it was last hurt. */
  biteT = 9;
  hurtT = 9;
  /** Seconds since death. */
  deadT = 0;
  /** Where it is going (scurrying about). */
  tx: number;
  tz: number;
  readonly radius: number;
  readonly height: number;

  constructor(readonly id: number, readonly nest: Nest, x: number, y: number, z: number, yaw: number, readonly size: number, readonly slot: number) {
    this.x = x; this.y = y; this.z = z; this.yaw = yaw;
    this.tx = x; this.tz = z;
    this.radius = RAT.radius * size;
    this.height = RAT.height * size;
  }

  get dead(): boolean { return this.health <= 0; }

  hurt(amount: number, _cause: string): void {
    this.health = Math.max(0, this.health - amount);
    this.hurtT = 0;
    this.nest.alarmed = true;
    if (this.dead) { this.mode = 'dead'; this.deadT = 0; }
  }
}

export class Rats {
  /** Rats near you (dead ones included, while their nest is awake). */
  readonly list: Rat[] = [];
  /** Rats killed on this visit to the level. */
  killed = 0;
  private readonly nests = new CellMemo<Nest | null>((i, j, key) => this.nestIn(key, i, j));
  private readonly awake = new Set<Nest>();
  private readonly dead = new Set<number>();
  private readonly seed: number;
  private readonly rng: Rng;
  private readonly chance: number;

  constructor(private readonly level: Level) {
    this.seed = deriveSeed(level.seed, 'rats', level.depth);
    this.rng = new Rng(deriveSeed(level.seed, 'rats', 'behaviour', level.depth));
    this.chance = Math.min(0.8, RAT.chance + 0.08 * (level.depth - 1));
  }

  /** Advance by dt seconds. `prey`: the player; bites go through combat.damage. Returns the bites landed this step. */
  advance(dt: number, prey: Fighter): number {
    this.wakeNests(prey.x, prey.z);
    // In steps of at most 1/60 s: a rat looks one step ahead for floor, and a long step overreaches.
    const n = Math.ceil(dt * 60 - 1e-6), h = dt / Math.max(1, n);
    let bites = 0;
    for (let k = 0; k < n; k++) {
      for (const r of this.list) bites += this.think(r, prey, h);
      this.separate();
    }
    this.noteDeaths();
    return bites;
  }

  /** The nest of cell (i, j), if it has one. */
  nestAt(i: number, j: number): Nest | null {
    return this.nests.at(i, j);
  }

  // ------------------------------------------------------------------ nests

  private wakeNests(px: number, pz: number): void {
    const c = RAT.cell, n = Math.ceil(RAT.wake / c);
    const ci = Math.floor(px / c), cj = Math.floor(pz / c);
    for (let j = cj - n; j <= cj + n; j++) for (let i = ci - n; i <= ci + n; i++) {
      const nest = this.nestAt(i, j);
      if (nest && !nest.rats && Math.hypot(nest.x - px, nest.z - pz) < RAT.wake) this.wake(nest);
    }
    for (const nest of this.awake) {
      if (Math.hypot(nest.x - px, nest.z - pz) < RAT.sleep) continue;
      // Gone back into their holes (the dead stay dead).
      for (const r of nest.rats!) this.list.splice(this.list.indexOf(r), 1);
      nest.rats = null;
      nest.alarmed = false;
      this.awake.delete(nest);
    }
  }

  private wake(nest: Nest): void {
    const rng = new Rng(deriveSeed(this.seed, 'nest', nest.key));
    nest.rats = [];
    for (let k = 0; k < nest.count; k++) {
      const id = nest.key * 16 + k;
      const a = rng.range(0, Math.PI * 2), d = rng.range(0.3, 2.5), size = rng.range(0.85, 1.25), yaw = rng.range(0, Math.PI * 2);
      if (this.dead.has(id)) continue;
      const x = nest.x + Math.cos(a) * d, z = nest.z + Math.sin(a) * d;
      const y = this.level.groundAt(x, z);
      const r = new Rat(id, nest, x, Math.abs(y - nest.y) < 1 ? y : nest.y, z, yaw, size, k);
      r.t = rng.range(0.5, 3);
      nest.rats.push(r);
      this.list.push(r);
    }
    this.awake.add(nest);
  }

  /** Where in cell (i, j) a nest is, if any: open, dry floor, away from the arrival and the shafts. */
  private nestIn(key: number, i: number, j: number): Nest | null {
    const c = RAT.cell, s = this.seed;
    if (hash3f(s, i, j, 0) > this.chance) return null;
    const [ax, , az] = this.level.arrival;
    for (let k = 0; k < 4; k++) {
      const x = (i + 0.15 + 0.7 * hash3f(s, i, j, 1 + 2 * k)) * c, z = (j + 0.15 + 0.7 * hash3f(s, i, j, 2 + 2 * k)) * c;
      if (Math.hypot(x - ax, z - az) < RAT.quiet) continue;
      const col = this.level.columnAt(x, z);
      if (col.pillarD < 2 || col.wall < 2) continue;
      const y = this.level.groundAt(x, z);
      if (y < this.level.waterAt(x, z) + 0.05 || this.level.sdf(x, y + 0.6, z) < 0.4 || this.level.descents.at(x, z, 4)) continue;
      const count = RAT.count[0] + Math.floor(hash3f(s, i, j, 20) * (RAT.count[1] - RAT.count[0] + 1));
      return { key, x, z, y, count, alarmed: false, rats: null };
    }
    return null;
  }

  // ------------------------------------------------------------------ behaviour

  /** One rat's step; returns 1 if it bit. */
  private think(r: Rat, prey: Fighter, dt: number): number {
    r.biteT += dt;
    r.hurtT += dt;
    if (r.dead) {
      r.deadT += dt;
      this.slide(r, dt);
      return 0;
    }
    const dx = prey.x - r.x, dz = prey.z - r.z, d = Math.hypot(dx, dz);
    const sees = !prey.dead && d < RAT.notice && Math.abs(prey.y - r.y) < 2.5;
    if (sees && r.mode !== 'chase' && r.mode !== 'bite' && r.mode !== 'flee') r.nest.alarmed = true;
    const hunting = r.nest.alarmed && !prey.dead && d < RAT.forget && Math.abs(prey.y - r.y) < 4;
    if (!hunting && (r.mode === 'chase' || r.mode === 'bite')) { r.mode = 'scurry'; r.t = 0; r.nest.alarmed = r.nest.alarmed && !prey.dead && d < RAT.forget; }
    if (hunting && (r.mode === 'sniff' || r.mode === 'scurry')) r.mode = 'chase';
    // Badly hurt: now and then it bolts for a moment.
    if (r.hurtT === 0 && r.health < RAT.health * 0.4 && this.rng.chance(0.5)) { r.mode = 'flee'; r.t = this.rng.range(1.2, 2.2); }

    let speed = 0, gx = r.x, gz = r.z, bit = 0;
    switch (r.mode) {
      case 'sniff':
        if ((r.t -= dt) <= 0) {
          // Off somewhere near the nest.
          const a = this.rng.range(0, Math.PI * 2), dd = this.rng.range(0, RAT.roam);
          r.tx = r.nest.x + Math.cos(a) * dd; r.tz = r.nest.z + Math.sin(a) * dd;
          r.mode = 'scurry'; r.t = 4;
        }
        break;
      case 'scurry':
        gx = r.tx; gz = r.tz; speed = RAT.walk * (1 + 0.6 * Math.max(0, Math.sin(r.gait * 0.13)));
        if ((r.t -= dt) <= 0 || Math.hypot(r.tx - r.x, r.tz - r.z) < 0.3) { r.mode = 'sniff'; r.t = this.rng.range(0.8, 3.5); }
        break;
      case 'flee':
        gx = r.x - dx; gz = r.z - dz; speed = RAT.run;
        if ((r.t -= dt) <= 0) r.mode = hunting ? 'chase' : 'sniff';
        break;
      case 'chase': {
        // Spread round the prey: each rat makes for its own side.
        const a = Math.atan2(-dz, -dx) + (r.slot - 2) * 0.55;
        const ring = prey.radius + r.radius + 0.1;
        gx = prey.x + Math.cos(a) * ring; gz = prey.z + Math.sin(a) * ring;
        speed = RAT.run;
        if (d - prey.radius - r.radius < RAT.biteReach && r.biteT > RAT.biteEvery) { r.mode = 'bite'; r.biteT = 0; }
        break;
      }
      case 'bite':
        // Wind up, snap, hang on a moment.
        gx = prey.x; gz = prey.z; speed = r.biteT < RAT.windup ? 0.5 : 0;
        if (r.biteT >= RAT.windup && r.biteT - dt < RAT.windup && d - prey.radius - r.radius < RAT.biteReach + 0.25 && Math.abs(prey.y - r.y) < 1.2) {
          damage(prey, this.rng.range(RAT.biteDamage[0], RAT.biteDamage[1]), r.x, r.z, 0.6, 'rat');
          bit = 1;
        }
        if (r.biteT > RAT.windup + 0.35) r.mode = 'chase';
        break;
    }
    this.move(r, gx, gz, speed, dt, r.mode === 'bite' ? Math.atan2(-dx, -dz) : null);
    return bit;
  }

  /** Steer towards (gx, gz) at `speed` over the floor, round what is in the way; face `face` if given. */
  private move(r: Rat, gx: number, gz: number, speed: number, dt: number, face: number | null): void {
    let ddx = gx - r.x, ddz = gz - r.z;
    const dist = Math.hypot(ddx, ddz);
    if (speed > 0 && dist > 0.05) {
      ddx /= dist; ddz /= dist;
      let want = Math.atan2(-ddx, -ddz);
      // Round obstacles: try the direct way, then ever wider to either side.
      const step = Math.min(dist, speed * dt);
      for (const off of [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9]) {
        const a = want + off, nx = r.x - Math.sin(a) * step, nz = r.z - Math.cos(a) * step;
        if (this.walkable(r, nx, nz)) { want = a; break; }
        if (off === -1.9) speed = 0; // boxed in
      }
      r.yaw += angleDiff(r.yaw, want) * Math.min(1, dt * 12);
      if (speed > 0) {
        const fx = -Math.sin(want), fz = -Math.cos(want);
        r.vx += (fx * speed - r.vx) * Math.min(1, dt * 10);
        r.vz += (fz * speed - r.vz) * Math.min(1, dt * 10);
      }
    } else {
      r.vx *= Math.max(0, 1 - dt * 10);
      r.vz *= Math.max(0, 1 - dt * 10);
    }
    if (face !== null) r.yaw += angleDiff(r.yaw, face) * Math.min(1, dt * 15);
    this.slide(r, dt);
  }

  /** Move by the velocity where the floor allows, settle on the ground, slow down. */
  private slide(r: Rat, dt: number): void {
    const nx = r.x + r.vx * dt, nz = r.z + r.vz * dt;
    if (this.walkable(r, nx, nz)) {
      r.gait += Math.hypot(nx - r.x, nz - r.z) / (0.09 * r.size);
      r.x = nx; r.z = nz;
    } else { r.vx *= 0.3; r.vz *= 0.3; }
    const g = this.level.groundAt(r.x, r.z);
    if (Math.abs(g - r.y) < 1.2) r.y += (g - r.y) * Math.min(1, dt * 15);
    if (r.dead) { r.vx *= Math.max(0, 1 - dt * 6); r.vz *= Math.max(0, 1 - dt * 6); }
  }

  /** Can a rat stand at (x, z), coming from where it is: no wall, no step it cannot take, no drop, no deep water. */
  private walkable(r: Rat, x: number, z: number): boolean {
    const l = this.level;
    if (l.sdf(x, r.y + 0.18 * r.size, z) < r.radius * 0.8) return false;
    const g = l.groundAt(x, z);
    if (g - r.y > RAT.step || r.y - g > RAT.drop) return false;
    return l.waterAt(x, z) < g + 0.2;
  }

  /** Keep the living from standing in each other. */
  private separate(): void {
    const L = this.list;
    for (let a = 0; a < L.length; a++) {
      if (L[a].dead) continue;
      for (let b = a + 1; b < L.length; b++) {
        if (L[b].dead) continue;
        const dx = L[b].x - L[a].x, dz = L[b].z - L[a].z, d = Math.hypot(dx, dz), min = L[a].radius + L[b].radius;
        if (d >= min || d < 1e-4) continue;
        const push = (min - d) / 2 / d;
        L[a].x -= dx * push; L[a].z -= dz * push;
        L[b].x += dx * push; L[b].z += dz * push;
      }
    }
  }

  /** Remember the dead: they stay dead when their nest wakes again. */
  private noteDeaths(): void {
    for (const r of this.list) if (r.dead && !this.dead.has(r.id)) { this.dead.add(r.id); this.killed++; }
  }
}
