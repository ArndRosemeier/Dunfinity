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
import { hash3f } from '@futuremagic/core';
import type { Level } from '../gen/level';
import { noticed, type Fighter } from '../combat/combat';
import { closeIn, pickSwing } from './pick';
import { Population, type Den } from './population';
import { rockDistance } from '../gen/quarry';
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
  /** Called by the Foreman's bell: seconds it comes for you from however far. */
  called: 25,
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
  /** Seconds left of answering the bell (it does not give up on you meanwhile). */
  called = 0;

  /** Where it works, facing the rock. */
  constructor(readonly id: number, readonly homeX: number, readonly homeZ: number, readonly homeYaw: number, y: number, readonly look: number) {
    super(homeX, y, homeZ, homeYaw, TOUCHED.radius, TOUCHED.height, TOUCHED.health, 'work');
  }
}

/** Where one of them works: against the rock, facing it. */
interface Spot extends Den {
  readonly y: number;
  readonly yaw: number;
}

export class SaltTouched extends Population<Spot, Touched> {
  /** Salt does not stop them (src/world/saltLine.ts). */
  protected override heedsSalt = false;
  private readonly n: [number, number, number] = [0, 0, 0];

  constructor(level: Level) {
    super(level, 'touched', TOUCHED, { arrive: 0.6, still: 0.08, step: 0.5, drop: 1.2, accel: 5, turn: 4, face: 6 });
  }

  protected hatch(s: Spot, killed: (id: number) => boolean): Touched[] {
    if (killed(s.key)) return [];
    const t = new Touched(s.key, s.x, s.z, s.yaw, s.y, Math.floor(hash3f(this.seed, s.key, 0, 30) * 3));
    t.t = this.rng.range(0, TOUCHED.pause[1]);
    return [t];
  }

  /** Where in cell (i, j) one of them works, if any: dry floor against a pillar or a wall, away from the arrival. */
  protected denIn(key: number, i: number, j: number): Spot | null {
    for (const [x, z] of this.sites(i, j, this.level.band.touched, 6, 0.1)) {
      const s = this.spotNear(key, x, z);
      if (s) return s;
    }
    return null;
  }

  /** `n` of them working the rock within `r` metres of (x, z) (the Foreman's crew), wherever there is rock to work. */
  gather(x: number, z: number, r: number, n: number): void {
    for (let k = 0; k < n * 40 && this.placed.length < n; k++) {
      const a = hash3f(this.seed, k, 0, 50) * Math.PI * 2, d = r * Math.sqrt(hash3f(this.seed, k, 0, 51));
      const s = this.spotNear(-1 - this.placed.length, x + Math.cos(a) * d, z + Math.sin(a) * d);
      if (s && this.placed.every((p) => Math.hypot(p.x - s.x, p.z - s.z) > 4)) this.placed.push(s);
    }
  }

  /** A spot near (x, z) to work the rock from: dry floor against a pillar or a wall, standing off it and facing it. */
  private spotNear(key: number, x: number, z: number): Spot | null {
    const l = this.level, col = l.columnAt(x, z), d = rockDistance(col);
    if (d < 0.4 || d > 3 || col.rubble > 0.05 || col.collapse > 0) return null;
    const g = l.groundAt(x, z);
    l.normal(x, g + 1.3, z, this.n);
    const h = Math.hypot(this.n[0], this.n[2]);
    if (h < 0.6) return null;
    const ox = this.n[0] / h, oz = this.n[2] / h, sx = x + ox * (TOUCHED.atRock - d), sz = z + oz * (TOUCHED.atRock - d);
    const y = l.groundAt(sx, sz);
    if (!l.dry(sx, sz, 0.1) || l.sdf(sx, y + 1.2, sz) < 0.45 || l.sdf(sx, y + 2.4, sz) < 0.3 || l.descents.at(sx, sz, 4)) return null;
    return { key, x: sx, z: sz, y, yaw: Math.atan2(ox, oz) };
  }

  /** A bell rung at (x, z): the living ones within `r` metres come for you, however far you are. */
  call(x: number, z: number, r: number): void {
    for (const t of this.list) if (!t.dead && Math.hypot(t.x - x, t.z - z) < r) { t.angry = true; t.called = TOUCHED.called; }
  }

  /** One step of one of them; returns 1 if its blow landed. */
  protected act(t: Touched, prey: Fighter, _ctx: null, dt: number): number {
    t.swingT += dt;
    t.strokeT += dt;
    t.called = Math.max(0, t.called - dt);
    if (t.provoked) { t.provoked = false; t.angry = true; }
    if (t.dead) return this.lieDead(t, dt, 6);
    const T = TOUCHED, S = T.swing;
    const dx = prey.x - t.x, dz = prey.z - t.z, d = Math.hypot(dx, dz), toYou = Math.atan2(-dx, -dz);
    const near = !prey.dead && Math.abs(prey.y - t.y) < 3;
    if (near && noticed(prey, d, T.notice)) t.angry = true;
    if (t.angry && (prey.dead || (d > T.forget && !t.called) || Math.abs(prey.y - t.y) > 5)) t.angry = false;
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
      case 'chase':
        if (closeIn(t, t.swingT, prey, S, T.chase, this.steer, dt, 0.8)) { t.mode = 'swing'; t.swingT = 0; }
        break;
      case 'swing':
        hit = pickSwing(t, t.swingT, S, prey, T.aim, this.steer, this.rng, 'salt-touched', dt);
        if (t.swingT >= S.dur) t.mode = t.angry ? 'chase' : 'home';
        break;
    }
    return hit;
  }
}
