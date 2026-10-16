/**
 * A kind of creature on a level (rats, the Salt-Touched, cave crickets): where its dens are (one
 * decision per cell, fixed by the seed), waking the dens near you and putting the far ones back to
 * sleep, remembering the ones you killed on this visit, and stepping them all in small steps. A
 * kind says where its dens are (`denIn`), what lives in one (`hatch`) and how one acts (`act`).
 */
import { Rng, deriveSeed, hash3f } from '@futuremagic/core';
import type { Blockers } from '../world/blockers';
import type { Level } from '../gen/level';
import type { SaltCircle } from '../gen/lair';
import type { Fighter } from '../combat/combat';
import { CellMemo } from '../gen/cellMemo';
import { Steer, brake, type Gait } from './steer';
import { GRUDGE_HELD, type Creature } from './creature';

/** Where some of a kind live. */
export interface Den {
  readonly key: number;
  readonly x: number;
  readonly z: number;
}

/** Dens are decided per `cell` metres, none within `quiet` of the arrival; they wake within `wake` metres of you and sleep beyond `sleep`. */
export interface Spread {
  readonly cell: number;
  readonly quiet: number;
  readonly wake: number;
  readonly sleep: number;
}

export abstract class Population<D extends Den, C extends Creature<string> & { readonly id: number }, Ctx = null> {
  /** The ones near you (the dead included, while their den is awake). */
  readonly list: C[] = [];
  /** Killed by you (a knife) on this visit to the level. */
  killed = 0;
  /** Lights the things of the dark keep away from (Sunday candles), set by the game; within CANDLE.shun of one is too near. */
  glare: readonly { readonly x: number; readonly z: number }[] = [];
  /** Whether they keep out of poured salt (`salt`); the Salt-Touched and people do not. */
  protected heedsSalt = true;
  /** Where the ones you killed fell, since the game last took them (`Fauna.fallen`). */
  readonly fallen: { x: number; y: number; z: number }[] = [];
  protected readonly seed: number;
  protected readonly rng: Rng;
  protected readonly steer: Steer;
  /** Keep the living this far apart, as a share of their radii added (0: they may overlap). */
  protected apart = 0;
  private readonly dens = new CellMemo<D | null>((i, j, key) => this.denIn(key, i, j));
  /** Dens off the grid, placed by something else (the Foreman's crew); negative keys. */
  protected readonly placed: D[] = [];
  private readonly awake = new Map<D, C[]>();
  private readonly dead = new Set<number>();

  constructor(protected readonly level: Level, readonly name: string, private readonly spread: Spread, gait: Gait) {
    this.seed = deriveSeed(level.seed, name, level.depth);
    this.rng = new Rng(deriveSeed(level.seed, name, 'behaviour', level.depth));
    this.steer = new Steer(level, gait);
  }

  /** The props in the way (src/world/blockers.ts): they walk round them. */
  set blockers(b: Blockers | null) { this.steer.blockers = b; }

  /** The salt poured on this level (src/world/saltLine.ts), set by the game: they will not step in, if they heed it. */
  get salt(): readonly SaltCircle[] { return this.steer.salt; }
  set salt(c: readonly SaltCircle[]) { this.steer.salt = this.heedsSalt ? c : []; }

  /** The den of cell (i, j), if there is one. */
  denAt(i: number, j: number): D | null {
    return this.dens.at(i, j);
  }

  /** The den nearest (x, z), looking out ring by ring up to `rings` cells (and the dens placed off the grid), or null. */
  nearestDen(x: number, z: number, rings = 8): D | null {
    const c = this.spread.cell, ci = Math.floor(x / c), cj = Math.floor(z / c);
    let best: D | null = null, bd = Infinity;
    const consider = (d: D | null) => { const k = d ? Math.hypot(d.x - x, d.z - z) : Infinity; if (k < bd) { bd = k; best = d; } };
    for (const d of this.placed) consider(d);
    for (let r = 0; r <= rings; r++) {
      // A den in ring r is at least (r - 1) cells off: stop once nothing nearer can be found.
      if (best && bd < (r - 1) * c) break;
      for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) === r) consider(this.dens.at(i, j));
      }
    }
    return best;
  }

  /** Advance by dt seconds. `prey`: the player (blows go through combat.damage). Returns the blows landed this step. */
  advance(dt: number, prey: Fighter, ctx: Ctx = null as Ctx): number {
    this.steer.keepOff = prey;
    this.rouse(prey.x, prey.z);
    // In steps of at most 1/60 s: a creature looks one step ahead for floor, and a long step overreaches.
    const n = Math.ceil(dt * 60 - 1e-6), h = dt / Math.max(1, n);
    let hits = 0;
    for (let k = 0; k < n; k++) {
      for (const c of this.list) {
        c.hurtT += h;
        if (c.dead) c.deadT += h;
        // One with a grudge (bitten by a salt pet) goes for that one instead, while it lives and is near.
        const g = c.grudge, foe = g && !g.dead && Math.hypot(g.x - c.x, g.z - c.z) < GRUDGE_HELD ? g : prey;
        if (g && foe === prey) c.grudge = null;
        const n = this.act(c, foe, ctx, h);
        if (foe === prey) hits += n;
      }
      this.settle();
    }
    for (const c of this.list) if (c.dead && !this.dead.has(c.id)) { this.dead.add(c.id); if (c.cause === 'knife') { this.killed++; this.fallen.push({ x: c.x, y: c.y, z: c.z }); } }
    return hits;
  }

  /** The glare (a Sunday candle) `c` is too near, if any. */
  protected glaring(c: { readonly x: number; readonly z: number }, shun: number): { readonly x: number; readonly z: number } | null {
    for (const g of this.glare) if (Math.hypot(c.x - g.x, c.z - g.z) < shun) return g;
    return null;
  }

  /** Where in cell (i, j) a den is, if any. */
  protected abstract denIn(key: number, i: number, j: number): D | null;
  /** What wakes in `den`; `killed(id)`: that one died on this visit (leave it out). */
  protected abstract hatch(den: D, killed: (id: number) => boolean): C[];
  /** One creature's step; returns the blows it landed. */
  protected abstract act(c: C, prey: Fighter, ctx: Ctx, dt: number): number;
  /** After each step of them all: by default, push apart the living that overlap (see `apart`). */
  protected settle(): void {
    const L = this.list, k = this.apart;
    if (!k) return;
    for (let a = 0; a < L.length; a++) {
      if (L[a].dead) continue;
      for (let b = a + 1; b < L.length; b++) {
        if (L[b].dead) continue;
        const dx = L[b].x - L[a].x, dz = L[b].z - L[a].z, d = Math.hypot(dx, dz), min = (L[a].radius + L[b].radius) * k;
        if (d >= min || d < 1e-4) continue;
        const push = (min - d) / 2 / d;
        L[a].x -= dx * push; L[a].z -= dz * push;
        L[b].x += dx * push; L[b].z += dz * push;
      }
    }
  }

  /**
   * Where a den of cell (i, j) might be: nothing if the cell's seeded roll misses `chance`, else up
   * to `tries` seeded spots at least `edge` (a share of the cell) in from its sides, none within
   * `quiet` of the arrival. The kind takes the first that suits it.
   */
  protected *sites(i: number, j: number, chance: number, tries = 4, edge = 0.15): Generator<[number, number]> {
    const s = this.seed, c = this.spread.cell, w = 1 - 2 * edge;
    if (hash3f(s, i, j, 0) >= chance) return;
    const [ax, , az] = this.level.arrival;
    for (let k = 0; k < tries; k++) {
      const x = (i + edge + w * hash3f(s, i, j, 1 + 2 * k)) * c, z = (j + edge + w * hash3f(s, i, j, 2 + 2 * k)) * c;
      if (Math.hypot(x - ax, z - az) >= this.spread.quiet) yield [x, z];
    }
  }

  /** The floor at (x, z) if a den can sit there: dry, `room` metres clear `head` metres up, no way down at hand. */
  protected floorFor(x: number, z: number, head: number, room: number): number | null {
    const l = this.level, y = l.groundAt(x, z);
    return l.dry(x, z, 0.05) && l.sdf(x, y + head, z) >= room && !l.descents.at(x, z, 4) ? y : null;
  }

  /**
   * A seeded spot `near`–`far` metres round a den on the floor at `y`, on the den's own floor and
   * clear of the rock by `room` at `lift` up (a spot over a ledge or under a step is drawn again; none:
   * the den itself).
   */
  protected around(den: D & { readonly y: number }, rng: Rng, near: number, far: number, room = 0.15, lift = 0.3): [number, number, number] {
    for (let k = 0; k < 6; k++) {
      const a = rng.range(0, Math.PI * 2), d = rng.range(near, far), x = den.x + Math.cos(a) * d, z = den.z + Math.sin(a) * d, y = this.level.groundAt(x, z);
      if (Math.abs(y - den.y) < 1 && this.level.sdf(x, y + lift, z) > room) return [x, y, z];
    }
    return [den.x, den.y, den.z];
  }

  /**
   * The `den.count` of a den, born round it: a seeded rng per den (`name`), ids `den.key * stride + k`,
   * each `near`–`far` metres out on the den's floor; `make` builds one there (its own seeded looks
   * from `rng`). The ones killed on this visit are left out. `room`, `lift`: as `around` (big ones need more).
   */
  protected brood(den: D & { readonly y: number; readonly count: number }, name: string, stride: number, near: number, far: number, killed: (id: number) => boolean, make: (id: number, x: number, y: number, z: number, rng: Rng, k: number) => C, room?: number, lift?: number): C[] {
    const rng = new Rng(deriveSeed(this.seed, name, den.key)), born: C[] = [];
    for (let k = 0; k < den.count; k++) {
      const id = den.key * stride + k, [x, y, z] = this.around(den, rng, near, far, room, lift), c = make(id, x, y, z, rng, k);
      if (!killed(id)) born.push(c);
    }
    return born;
  }

  /** A spot to wander to, up to `roam` metres from the den (behaviour rng). */
  protected roamFrom(den: Den, roam: number): [number, number] {
    const a = this.rng.range(0, Math.PI * 2), d = this.rng.range(0, roam);
    return [den.x + Math.cos(a) * d, den.z + Math.sin(a) * d];
  }

  /** How many live in the den of cell (i, j): seeded, lo to hi. */
  protected countIn(i: number, j: number, [lo, hi]: readonly [number, number]): number {
    return lo + Math.floor(hash3f(this.seed, i, j, 20) * (hi - lo + 1));
  }
  /** The step of one of the dead that walked: it slides to a stop where it fell (`k`: how fast). Returns 0 (no blow). */
  protected lieDead(c: C, dt: number, k = 6): number {
    brake(c, k, dt);
    this.steer.slide(c, dt);
    return 0;
  }
  /** A den going back to sleep. */
  protected sleep(_den: D): void {}

  private rouse(px: number, pz: number): void {
    const S = this.spread, c = S.cell, m = Math.ceil(S.wake / c);
    const ci = Math.floor(px / c), cj = Math.floor(pz / c);
    const near: D[] = [];
    for (let j = cj - m; j <= cj + m; j++) for (let i = ci - m; i <= ci + m; i++) {
      const den = this.dens.at(i, j);
      if (den) near.push(den);
    }
    for (const den of [...near, ...this.placed]) {
      if (this.awake.has(den) || Math.hypot(den.x - px, den.z - pz) > S.wake) continue;
      const born = this.hatch(den, (id) => this.dead.has(id));
      this.awake.set(den, born);
      this.list.push(...born);
    }
    for (const [den, born] of this.awake) {
      if (Math.hypot(den.x - px, den.z - pz) < S.sleep || born.some((b) => Math.hypot(b.x - px, b.z - pz) < S.sleep)) continue;
      // Gone back to their holes (the dead stay dead).
      for (const b of born) this.list.splice(this.list.indexOf(b), 1);
      this.awake.delete(den);
      this.sleep(den);
    }
  }
}
