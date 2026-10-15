/**
 * The Salt-Touched (docs/design/town-and-first-strata.md §5: levels 3–8): the lost miners, changed.
 * Salt has grown into them; they are slow, and they hit very hard. Alone, each one still works the
 * rock where it stood, striking it with its pick now and then (you hear it before you see it). Come
 * close, or hurt one, and it turns, comes for you at a trudge and brings the pick down over its head:
 * a long, plain wind-up you can step out of. Get far enough away and it goes back to its rock.
 *
 * Pure: positions on the level's floor (walked with src/creatures/steer.ts), blows through
 * src/combat. Where they stand is fixed by the seed; the ones you killed stay dead on this visit.
 */
import { Rng, deriveSeed, hash3f, angleDiff } from '@futuremagic/core';
import type { Blockers } from '../world/blockers';
import type { Level } from '../gen/level';
import { damage, reach, type Blow, type Fighter } from '../combat/combat';
import { CellMemo } from '../gen/cellMemo';
import { Steer } from './steer';
import { Creature } from './creature';

export const TOUCHED = {
  radius: 0.32,
  height: 1.8,
  health: 60,
  /** Speeds, metres per second: going home, and coming for you (you walk 4.2). */
  walk: 1.0,
  chase: 1.9,
  /** They notice you this close, and give up beyond `forget`. */
  notice: 12,
  forget: 30,
  /** On noticing you: a moment turning to you before it comes, s. */
  alert: 0.8,
  /**
   * The blow: the pick brought down over the head. Seconds it takes and when it lands (the wind-up
   * before is the tell), how far beyond touching it starts one, its reach beyond the attacker's
   * centre, sweep, heights, damage, knockback, and the rest after one before the next.
   */
  swing: { dur: 1.6, hit: 0.95, start: 0.55, range: 1.25, arc: 0.6, low: 0, high: 2, damage: [24, 32] as const, knock: 4, rest: 1.1 },
  /** How fast it turns to you in the wind-up (it commits after), per second. */
  aim: 2.5,
  /** Working the rock: seconds a stroke takes, and the pause between strokes (min, extra). */
  stroke: 1.3,
  pause: [1.5, 3] as const,
  /** Where they stand: cell size, none this close to the arrival; they wake within `wake` metres and go back to sleep beyond `sleep`. */
  cell: 56,
  quiet: 30,
  wake: 60,
  sleep: 80,
  /** How far from the rock it works, metres. */
  atRock: 0.75,
} as const;

export type TouchedMode = 'work' | 'alert' | 'chase' | 'swing' | 'home' | 'dead';

export class Touched extends Creature<TouchedMode> {
  /** Seconds left in the current mode (work: until the next stroke; alert). */
  t = 0;
  /** Seconds since the current (or last) swing started, and the last stroke at the rock. */
  swingT = 9;
  strokeT = 9;
  /** It was hurt, or saw you: it is after you. */
  angry = false;

  /** Where it works, facing the rock. */
  constructor(readonly id: number, readonly homeX: number, readonly homeZ: number, readonly homeYaw: number, y: number, readonly look: number) {
    super(homeX, y, homeZ, homeYaw, TOUCHED.radius, TOUCHED.height, TOUCHED.health, 'work');
  }
}

interface Spot {
  readonly key: number;
  readonly x: number;
  readonly z: number;
  readonly y: number;
  readonly yaw: number;
  /** Its Salt-Touched while awake. */
  one: Touched | null;
}

export class SaltTouched {
  /** The Salt-Touched near you (the dead included, while near). */
  readonly list: Touched[] = [];
  killed = 0;
  private readonly spots = new CellMemo<Spot | null>((i, j, key) => this.spotIn(key, i, j));
  private readonly awake = new Set<Spot>();
  private readonly dead = new Set<number>();
  private readonly seed: number;
  private readonly rng: Rng;
  private readonly steer: Steer;
  private readonly n: [number, number, number] = [0, 0, 0];

  constructor(private readonly level: Level) {
    this.seed = deriveSeed(level.seed, 'touched', level.depth);
    this.rng = new Rng(deriveSeed(level.seed, 'touched', 'behaviour', level.depth));
    this.steer = new Steer(level, { arrive: 0.6, still: 0.08, step: 0.5, drop: 1.2, accel: 5, turn: 4, face: 6 });
  }

  /** The props in the way (src/world/blockers.ts). */
  set blockers(b: Blockers | null) { this.steer.blockers = b; }

  /** Advance by dt seconds. `prey`: the player; blows go through combat.damage. Returns the blows landed this step. */
  advance(dt: number, prey: Fighter): number {
    this.steer.keepOff = prey;
    this.wake(prey.x, prey.z);
    const n = Math.ceil(dt * 60 - 1e-6), h = dt / Math.max(1, n);
    let hits = 0;
    for (let k = 0; k < n; k++) for (const t of this.list) hits += this.think(t, prey, h);
    for (const t of this.list) if (t.dead && !this.dead.has(t.id)) { this.dead.add(t.id); this.killed++; }
    return hits;
  }

  /** The working spot of cell (i, j), if one of them stands there. */
  spotAt(i: number, j: number): { x: number; z: number } | null {
    return this.spots.at(i, j);
  }

  private wake(px: number, pz: number): void {
    const c = TOUCHED.cell, m = Math.ceil(TOUCHED.wake / c);
    const ci = Math.floor(px / c), cj = Math.floor(pz / c);
    for (let j = cj - m; j <= cj + m; j++) for (let i = ci - m; i <= ci + m; i++) {
      const s = this.spots.at(i, j);
      if (!s || s.one || this.dead.has(s.key) || Math.hypot(s.x - px, s.z - pz) > TOUCHED.wake) continue;
      s.one = new Touched(s.key, s.x, s.z, s.yaw, s.y, Math.floor(hash3f(this.seed, i, j, 30) * 3));
      s.one.t = this.rng.range(0, TOUCHED.pause[1]);
      this.list.push(s.one);
      this.awake.add(s);
    }
    for (const s of this.awake) {
      const t = s.one!;
      if (Math.hypot(t.x - px, t.z - pz) < TOUCHED.sleep && Math.hypot(s.x - px, s.z - pz) < TOUCHED.sleep) continue;
      this.list.splice(this.list.indexOf(t), 1);
      s.one = null;
      this.awake.delete(s);
    }
  }

  /** Where in cell (i, j) one of them works, if any: dry floor against a pillar or a wall, away from the arrival. */
  private spotIn(key: number, i: number, j: number): Spot | null {
    const c = TOUCHED.cell, s = this.seed, l = this.level;
    if (hash3f(s, i, j, 0) >= l.band.touched) return null;
    const [ax, , az] = l.arrival;
    for (let k = 0; k < 6; k++) {
      const x = (i + 0.1 + 0.8 * hash3f(s, i, j, 1 + 2 * k)) * c, z = (j + 0.1 + 0.8 * hash3f(s, i, j, 2 + 2 * k)) * c;
      if (Math.hypot(x - ax, z - az) < TOUCHED.quiet) continue;
      const col = l.columnAt(x, z), d = Math.min(col.pillarD, col.wall);
      if (d < 0.4 || d > 3 || col.rubble > 0.05 || col.collapse > 0) continue;
      const g = l.groundAt(x, z);
      l.normal(x, g + 1.3, z, this.n);
      const h = Math.hypot(this.n[0], this.n[2]);
      if (h < 0.6) continue;
      // Stand off the rock, facing it.
      const ox = this.n[0] / h, oz = this.n[2] / h, sx = x + ox * (TOUCHED.atRock - d), sz = z + oz * (TOUCHED.atRock - d);
      const y = l.groundAt(sx, sz);
      if (y < l.waterAt(sx, sz) + 0.1 || l.sdf(sx, y + 1.2, sz) < 0.45 || l.sdf(sx, y + 2.4, sz) < 0.3 || l.descents.at(sx, sz, 4)) continue;
      return { key, x: sx, z: sz, y, yaw: Math.atan2(ox, oz), one: null };
    }
    return null;
  }

  /** One step of one of them; returns 1 if its blow landed. */
  private think(t: Touched, prey: Fighter, dt: number): number {
    t.swingT += dt;
    t.strokeT += dt;
    t.hurtT += dt;
    if (t.provoked) { t.provoked = false; t.angry = true; }
    if (t.dead) {
      t.deadT += dt;
      t.vx *= Math.max(0, 1 - dt * 6); t.vz *= Math.max(0, 1 - dt * 6);
      this.steer.slide(t, dt);
      return 0;
    }
    const T = TOUCHED, S = T.swing;
    const dx = prey.x - t.x, dz = prey.z - t.z, d = Math.hypot(dx, dz), toYou = Math.atan2(-dx, -dz);
    const near = !prey.dead && Math.abs(prey.y - t.y) < 3;
    if (near && d < T.notice) t.angry = true;
    if (t.angry && (prey.dead || d > T.forget || Math.abs(prey.y - t.y) > 5)) t.angry = false;
    if (t.angry && (t.mode === 'work' || t.mode === 'home')) { t.mode = 'alert'; t.t = T.alert; }
    if (!t.angry && (t.mode === 'alert' || t.mode === 'chase')) t.mode = 'home';

    let hit = 0;
    switch (t.mode) {
      case 'work':
        this.steer.move(t, t.homeX, t.homeZ, T.walk, dt, t.homeYaw);
        if ((t.t -= dt) <= 0) { t.strokeT = 0; t.t = T.stroke + this.rng.range(T.pause[0], T.pause[0] + T.pause[1]); }
        break;
      case 'home':
        this.steer.move(t, t.homeX, t.homeZ, T.walk, dt, Math.hypot(t.homeX - t.x, t.homeZ - t.z) < 0.6 ? t.homeYaw : null);
        if (Math.hypot(t.homeX - t.x, t.homeZ - t.z) < 0.15) { t.mode = 'work'; t.t = this.rng.range(T.pause[0], T.pause[0] + T.pause[1]); }
        break;
      case 'alert':
        this.steer.move(t, t.x, t.z, 0, dt, toYou);
        if ((t.t -= dt) <= 0) t.mode = 'chase';
        break;
      case 'chase': {
        // To a place just short of you, on the line from you to it: it does not turn as it walks
        // (a goal that swings round as one moves is chased round and round).
        const stand = prey.radius + t.radius + S.start * 0.5;
        const gx = prey.x - (dx / (d || 1)) * stand, gz = prey.z - (dz / (d || 1)) * stand;
        this.steer.move(t, gx, gz, T.chase, dt, d - stand < 0.8 ? toYou : null);
        if (d - prey.radius - t.radius < S.start && t.swingT > S.dur + S.rest) { t.mode = 'swing'; t.swingT = 0; }
        break;
      }
      case 'swing': {
        // The wind-up: it stands and turns to you; then it is committed, and the pick comes down.
        const aim = t.swingT < S.hit - 0.25 ? toYou : null;
        this.steer.move(t, t.x, t.z, 0, dt, null);
        if (aim !== null) t.yaw += angleDiff(t.yaw, aim) * Math.min(1, dt * T.aim);
        if (t.swingT >= S.hit && t.swingT - dt < S.hit) {
          const blow: Blow = { x: t.x, y: t.y, z: t.z, yaw: t.yaw, range: S.range, arc: S.arc, low: S.low, high: S.high };
          if (reach(blow, prey)) {
            damage(prey, this.rng.range(S.damage[0], S.damage[1]), t.x, t.z, S.knock, 'salt-touched');
            hit = 1;
          }
        }
        if (t.swingT >= S.dur) t.mode = t.angry ? 'chase' : 'home';
        break;
      }
    }
    return hit;
  }
}
