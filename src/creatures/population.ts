/**
 * A kind of creature on a level (rats, the Salt-Touched, cave crickets): where its dens are (one
 * decision per cell, fixed by the seed), waking the dens near you and putting the far ones back to
 * sleep, remembering the ones you killed on this visit, and stepping them all in small steps. A
 * kind says where its dens are (`denIn`), what lives in one (`hatch`) and how one acts (`act`).
 */
import { Rng, deriveSeed } from '@futuremagic/core';
import type { Blockers } from '../world/blockers';
import type { Level } from '../gen/level';
import type { Fighter } from '../combat/combat';
import { CellMemo } from '../gen/cellMemo';
import { Steer, type Gait } from './steer';
import type { Creature } from './creature';

/** Where some of a kind live. */
export interface Den {
  readonly key: number;
  readonly x: number;
  readonly z: number;
}

/** Dens are decided per `cell` metres; they wake within `wake` metres of you and sleep beyond `sleep`. */
export interface Spread {
  readonly cell: number;
  readonly wake: number;
  readonly sleep: number;
}

export abstract class Population<D extends Den, C extends Creature<string> & { readonly id: number }, Ctx = null> {
  /** The ones near you (the dead included, while their den is awake). */
  readonly list: C[] = [];
  /** Killed on this visit to the level. */
  killed = 0;
  protected readonly seed: number;
  protected readonly rng: Rng;
  protected readonly steer: Steer;
  private readonly dens = new CellMemo<D | null>((i, j, key) => this.denIn(key, i, j));
  private readonly awake = new Map<D, C[]>();
  private readonly dead = new Set<number>();

  constructor(protected readonly level: Level, name: string, private readonly spread: Spread, gait: Gait) {
    this.seed = deriveSeed(level.seed, name, level.depth);
    this.rng = new Rng(deriveSeed(level.seed, name, 'behaviour', level.depth));
    this.steer = new Steer(level, gait);
  }

  /** The props in the way (src/world/blockers.ts): they walk round them. */
  set blockers(b: Blockers | null) { this.steer.blockers = b; }

  /** The den of cell (i, j), if there is one. */
  denAt(i: number, j: number): D | null {
    return this.dens.at(i, j);
  }

  /** Advance by dt seconds. `prey`: the player (blows go through combat.damage). Returns the blows landed this step. */
  advance(dt: number, prey: Fighter, ctx: Ctx = null as Ctx): number {
    this.steer.keepOff = prey;
    this.rouse(prey.x, prey.z);
    // In steps of at most 1/60 s: a creature looks one step ahead for floor, and a long step overreaches.
    const n = Math.ceil(dt * 60 - 1e-6), h = dt / Math.max(1, n);
    let hits = 0;
    for (let k = 0; k < n; k++) {
      for (const c of this.list) hits += this.act(c, prey, ctx, h);
      this.settle();
    }
    for (const c of this.list) if (c.dead && !this.dead.has(c.id)) { this.dead.add(c.id); this.killed++; }
    return hits;
  }

  /** Where in cell (i, j) a den is, if any. */
  protected abstract denIn(key: number, i: number, j: number): D | null;
  /** What wakes in `den`; `killed(id)`: that one died on this visit (leave it out). */
  protected abstract hatch(den: D, killed: (id: number) => boolean): C[];
  /** One creature's step; returns the blows it landed. */
  protected abstract act(c: C, prey: Fighter, ctx: Ctx, dt: number): number;
  /** After each step of them all (keeping apart). */
  protected settle(): void {}
  /** A den going back to sleep. */
  protected sleep(_den: D): void {}

  private rouse(px: number, pz: number): void {
    const S = this.spread, c = S.cell, m = Math.ceil(S.wake / c);
    const ci = Math.floor(px / c), cj = Math.floor(pz / c);
    for (let j = cj - m; j <= cj + m; j++) for (let i = ci - m; i <= ci + m; i++) {
      const den = this.dens.at(i, j);
      if (!den || this.awake.has(den) || Math.hypot(den.x - px, den.z - pz) > S.wake) continue;
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
