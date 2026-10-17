/**
 * A kind of creature on a level (rats, the Salt-Touched, cave crickets): where its dens are (one
 * decision per cell, fixed by the seed), waking the dens near you and putting the far ones back to
 * sleep, remembering the ones you killed on this visit, and stepping them all in small steps. A
 * kind says where its dens are (`denIn`), what lives in one (`hatch`) and how one acts (`act`).
 */
import { Rng, angleDiff, deriveSeed, hash3f } from '@futuremagic/core';
import type { Blockers } from '../world/blockers';
import type { Level } from '../gen/level';
import type { SaltCircle } from '../gen/lair';
import { byYou, type Fighter } from '../combat/combat';
import { CellMemo } from '../gen/cellMemo';
import { Steer, brake, thwarted, type Gait, type Walker } from './steer';
import { GRUDGE_HELD, type Creature } from './creature';
import { LIFE } from './life';
import { pastureOf, type Pasture } from './pasture';
import { oddsAt } from '../gen/genome';
import type { Diet } from './temper';

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

/**
 * A kind met above the depth it belongs to (Arnd 2026-10-17: any mob on any level; one a few levels
 * early is fine, a horde of them is not). `share`: how much of its usual chance of a den it has there
 * (1 from `from` down, rarer above, by `oddsAt`), and a den of it holds as much less (at least one);
 * `youth`: how grown it is there (1 from `from` down; smaller and weaker above).
 */
export function early(depth: number, from: number): { share: number; youth: number } {
  if (depth >= from) return { share: 1, youth: 1 };
  const share = Math.min(1, oddsAt(depth, EARLY) / oddsAt(from, EARLY));
  return { share, youth: EARLY_YOUTH + (1 - EARLY_YOUTH) * share };
}
const EARLY = [0.02, 1] as const, EARLY_YOUTH = 0.6;

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
  /** The level's time, s (the dens' hours run on it), and each den's pasture once one of it needs it. */
  private clock = 0;
  private readonly pastures = new Map<number, Pasture>();

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
      this.clock += h;
      for (const c of this.list) {
        c.hurtT += h;
        if (c.dead) c.deadT += h;
        // One with a grudge (bitten by a salt pet) goes for that one instead, while it lives and is near.
        const g = c.grudge, foe = g && !g.dead && Math.hypot(g.x - c.x, g.z - c.z) < GRUDGE_HELD ? g : prey;
        if (g && foe === prey) c.grudge = null;
        const x0 = c.x, z0 = c.z;
        const n = this.act(c, foe, ctx, h);
        c.walked += Math.hypot(c.x - x0, c.z - z0);
        if (foe === prey) hits += n;
        // Its mind turned to something else: its feeding or rest is over.
        if (!c.life.seen) c.life.stop();
        c.life.seen = false;
      }
      this.settle();
    }
    for (const c of this.list) if (c.dead && !this.dead.has(c.id)) { this.dead.add(c.id); if (byYou(c.cause)) { this.killed++; this.fallen.push({ x: c.x, y: c.y, z: c.z }); } }
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
        // Each gives way half; one standing a moment (getting nowhere) holds its ground and the other
        // gives way for both; one about its life never into the rock or the water.
        const A = L[a], B = L[b], sa = (A.aim?.wait ?? 0) > 0, sb = (B.aim?.wait ?? 0) > 0;
        const half = (min - d) / 2 / d, pa = sa === sb ? half : sa ? 0 : half * 2, pb = half * 2 - pa;
        if (pa && this.free(A, A.x - dx * pa, A.z - dz * pa)) { A.x -= dx * pa; A.z -= dz * pa; }
        if (pb && this.free(B, B.x + dx * pb, B.z + dz * pb)) { B.x += dx * pb; B.z += dz * pb; }
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

  /** Whether c, about its life (feeding, resting), would be clear of the rock and out of the water at (x, z); one in a fight is shoved anyway. */
  private free(c: C, x: number, z: number): boolean {
    return !c.life.doing || (this.level.dry(x, z, 0) && this.level.sdf(x, c.y + c.height * 0.5625, z) > c.radius * 0.5);
  }

  /**
   * A seeded spot `near`–`far` metres round a den on the floor at `y`, on the den's own floor, out of
   * the water and clear of the rock by `room` at `lift` up (a spot over a ledge, under a step or in a
   * pool is drawn again; none: the den itself).
   */
  protected around(den: D & { readonly y: number }, rng: Rng, near: number, far: number, room = 0.15, lift = 0.3): [number, number, number] {
    for (let k = 0; k < 6; k++) {
      const a = rng.range(0, Math.PI * 2), d = rng.range(near, far), x = den.x + Math.cos(a) * d, z = den.z + Math.sin(a) * d, y = this.level.groundAt(x, z);
      if (Math.abs(y - den.y) < 1 && this.level.dry(x, z, 0) && this.level.sdf(x, y + lift, z) > room) return [x, y, z];
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

  // ------------------------------------------------------------------ life between fights (src/creatures/life.ts)

  /** What its kind eats (src/creatures/pasture.ts); the procedural species say by their temper. */
  protected dietOf(_den: D): Diet {
    return 'floor';
  }

  /** Where den feeds and rests, for animals like `c` within `reach` metres (found once, the same every time). */
  pasture(den: D & { readonly y: number }, c: C, reach: number): Pasture {
    let p = this.pastures.get(den.key);
    if (!p) this.pastures.set(den.key, (p = pastureOf(this.level, den, this.dietOf(den), reach, c.radius, c.height, (f, x, z) => this.steer.walkable({ x: f.x, y: f.y, z: f.z, radius: c.radius, height: c.height } as Walker, x, z))));
    return p;
  }

  /** Whether den is in its hours of rest now (each den its own hours, seeded by its key). */
  resting(den: D): boolean {
    const L = LIFE, hours = (k: number) => hash3f(this.seed, den.key, 1, 40 + k);
    const awake = L.awake[0] + (L.awake[1] - L.awake[0]) * hours(0), day = awake + L.asleep[0] + (L.asleep[1] - L.asleep[0]) * hours(1);
    return (this.clock + hours(2) * day) % day >= awake;
  }

  /** How much of its alertness it has: less lying asleep (`LIFE.doze`). Its kind multiplies how far it notices you by it. */
  protected wakeful(c: C, asleep: number = LIFE.doze): number {
    return c.pose === 'rest' ? asleep : 1;
  }

  /**
   * Its life in its idle moments: called by its kind's mind every step it is about its own business.
   * While its den rests it goes to its place in the nook and lies down (all but its sentry); on its
   * way to food it walks there, and at it feeds, facing it. Returns whether its life moved it this
   * step (else its kind's own idling goes on); `walk`: its pace, m/s; `reach`: its pasture's size.
   */
  protected live(c: C, den: D & { readonly y: number }, dt: number, walk: number, reach: number): boolean {
    const L = c.life;
    L.seen = true; L.moved = 0;
    const len = c.radius * 2;
    if (this.resting(den) && !this.sentry(c, den)) {
      if (L.doing !== 'rest') {
        // Its place round the nook's middle, by its place in the den.
        const nook = this.pasture(den, c, reach).nook, k = Math.max(0, this.housed(den).indexOf(c)), r = (c.radius * 2.2 + 0.1) * Math.sqrt(k), a = k * 2.4;
        L.stop(); L.doing = 'rest';
        L.tx = nook.x + Math.cos(a) * r; L.tz = nook.z + Math.sin(a) * r;
        L.t = 6 + Math.hypot(L.tx - c.x, L.tz - c.z) / Math.max(0.2, walk * 0.6);
      }
      L.t -= dt;
      if (!L.down && (L.t <= 0 || Math.hypot(L.tx - c.x, L.tz - c.z) < Math.max(0.3, len * 0.3))) L.down = true;
      if (L.down) { brake(c, 6, dt); L.moved = this.steer.slide(c, dt); }
      else L.moved = this.steer.move(c, L.tx, L.tz, walk * 0.6, dt, null);
      return true;
    }
    if (L.doing === 'rest') { L.stop(); return false; }
    if (L.doing === 'going') {
      L.t -= dt;
      const d = Math.hypot(L.tx - c.x, L.tz - c.z), at = Math.max(0.3, len * 0.3);
      // At its food (or near enough when it cannot get closer): it feeds; it gives up on one it cannot
      // reach in time, or when it is stuck on the way.
      const stuck = L.round && thwarted(c);
      if (d < at || ((L.t <= 0 || stuck) && d < at + 1)) { L.doing = 'feed'; L.t = this.rng.range(LIFE.feedFor[0], LIFE.feedFor[1]); }
      else if (L.t <= 0 || stuck) { L.stop(); return false; }
      else {
        // Straight at it; once that gets it nowhere, round the rock on its den's walk.
        if (!L.round && L.spot && (c.aim?.stuck ?? 0) > LIFE.round) L.round = true;
        const [wx, wz] = L.round && L.spot ? this.pasture(den, c, reach).way(L.spot, c.x, c.z) : [L.tx, L.tz];
        L.moved = this.steer.move(c, wx, wz, walk, dt, null);
        return true;
      }
    }
    if (L.doing === 'feed') {
      L.t -= dt;
      brake(c, 6, dt);
      L.moved = this.steer.slide(c, dt);
      const face = L.spot?.face ?? NaN;
      if (!Number.isNaN(face)) c.yaw += angleDiff(c.yaw, face) * Math.min(1, dt * 3);
      if (L.t <= 0) { L.stop(); return false; }
      return true;
    }
    return false;
  }

  /**
   * The life of one that feeds and rests where it is (a cricket on its wall, an eel in its pool),
   * called every step it is about its own business: in its den's hours of rest it lies still (all
   * but its sentry); else now and then it feeds there. Its kind keeps it still, or slow, meanwhile
   * (by its pose). Returns whether its life holds it this step.
   */
  protected liveInPlace(c: C, den: D, dt: number): boolean {
    const L = c.life, range = ([lo, hi]: readonly [number, number]) => this.rng.range(lo, hi);
    L.seen = true; L.moved = 0;
    if (this.resting(den) && !this.sentry(c, den)) {
      if (L.doing !== 'rest') { L.stop(); L.doing = 'rest'; }
      L.down = true;
      return true;
    }
    if (L.doing === 'rest') { L.stop(); L.t = range(LIFE.between); }
    if (L.doing === 'feed') {
      if ((L.t -= dt) > 0) return true;
      L.stop(); L.t = range(LIFE.between);
      return false;
    }
    if ((L.t -= dt) > 0) return false;
    if (this.rng.chance(LIFE.feed)) { L.doing = 'feed'; L.t = range(LIFE.feedFor); return true; }
    L.t = range(LIFE.between);
    return false;
  }

  /** Moving on from where it idled: now and then (`LIFE.feed`) it goes to feed instead. Returns whether it does (`live` takes it there). */
  protected toFood(c: C, den: D & { readonly y: number }, walk: number, reach: number): boolean {
    if (c.life.doing || !this.rng.chance(LIFE.feed)) return false;
    const food = this.pasture(den, c, reach).food;
    if (!food.length) return false;
    const s = food[this.rng.int(0, food.length - 1)], L = c.life;
    L.doing = 'going'; L.spot = s; L.tx = s.x; L.tz = s.z; L.seen = true;
    L.t = 4 + Math.hypot(s.x - c.x, s.z - c.z) / Math.max(0.2, walk);
    return true;
  }

  /** The one of its den that stays up while the rest sleep: the first living of a den of `LIFE.sentry` or more. */
  protected sentry(c: C, den: D): boolean {
    const h = this.housed(den);
    return h.length >= LIFE.sentry && h[0] === c;
  }

  /** The living of den that are about. */
  protected housed(den: D): C[] {
    return (this.awake.get(den) ?? []).filter((o) => !o.dead);
  }

  /** How many live in the den of cell (i, j): seeded, lo to hi (times `share`, at least one, for a kind met early: `early`). */
  protected countIn(i: number, j: number, [lo, hi]: readonly [number, number], share = 1): number {
    const n = lo + Math.floor(hash3f(this.seed, i, j, 20) * (hi - lo + 1));
    return share < 1 ? Math.max(1, Math.round(n * share)) : n;
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
