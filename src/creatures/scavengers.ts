/**
 * Scavengers (docs/design/town-and-first-strata.md §5: levels 4–10, "people living down there; some
 * trade, some rob"): living people, camped in twos and threes round a fire in the dark. Most camps
 * want to be left alone: they get up as you come near, one warns you off, and they only come for you
 * if you walk into their camp or stab one of them. Some camps are robbers: they come for you with
 * crowbars as soon as they see you. A badly hurt scavenger runs for it.
 *
 * Pure: floor walking with src/creatures/steer.ts, the crowbar through src/creatures/pick.ts.
 * Camps are fixed by the seed; the dead stay dead on this visit.
 */
import { angleDiff, hash3f } from '@futuremagic/core';
import type { Level } from '../gen/level';
import { noticed, type Fighter } from '../combat/combat';
import { Creature } from './creature';
import { Population, type Den } from './population';
import { rockDistance } from '../gen/quarry';
import { closeIn, pickSwing } from './pick';

export const SCAVENGER = {
  radius: 0.3,
  height: 1.75,
  health: 45,
  /** Speeds, m/s: walking, coming for you, running away. */
  walk: 1.3,
  run: 3.6,
  flee: 4.4,
  /** They see you this close; a wary camp warns you off here and turns on you inside `camp`; they give up beyond `forget`. */
  notice: 14,
  warn: 11,
  camp: 4,
  forget: 30,
  /** On getting up: a moment before they move, s. */
  rise: 0.9,
  /** The crowbar (see pick.ts): a short wind-up over the shoulder and a quick blow. */
  swing: { dur: 1.1, hit: 0.55, start: 0.9, range: 1.15, arc: 0.7, low: 0, high: 1.9, damage: [10, 16] as const, knock: 3, rest: 0.6 },
  aim: 4,
  /** Below this share of its health it runs for it, this long. */
  fear: 0.35,
  fleeT: 6,
  /** Camps: cell size, chance per cell (band.scavengers), none this close to the arrival, people per camp, the share of camps that are robbers; seats round the fire, metres. */
  cell: 80,
  quiet: 35,
  count: [2, 3] as const,
  robbers: 0.35,
  seat: 1.5,
  wake: 60,
  sleep: 85,
} as const;

export type ScavengerMode = 'sit' | 'stand' | 'chase' | 'swing' | 'flee' | 'home' | 'dead';

export class Scavenger extends Creature<ScavengerMode> {
  /** Seconds in the mode (stand), or since the swing began, or left of fleeing. */
  t = 0;
  swingT = 9;
  /** Where it sits, facing the fire. */
  readonly seatX: number;
  readonly seatZ: number;
  readonly seatYaw: number;

  constructor(readonly id: number, readonly camp: Camp, readonly k: number, readonly look: number) {
    const a = camp.turn + (k / camp.count) * Math.PI * 2, x = camp.x + Math.sin(a) * SCAVENGER.seat, z = camp.z + Math.cos(a) * SCAVENGER.seat;
    super(x, camp.y, z, a, SCAVENGER.radius, SCAVENGER.height, SCAVENGER.health, 'sit');
    this.seatX = x; this.seatZ = z; this.seatYaw = a;
  }

  /** It is after you. */
  get hostile(): boolean {
    return (this.camp.robbers || this.camp.angry) && !this.dead;
  }
}

/** A camp: the fire (x, z) and who sits round it. */
export interface Camp extends Den {
  readonly y: number;
  readonly count: number;
  /** Robbers come for you on sight. */
  readonly robbers: boolean;
  /** Where round the fire the first seat is (radians). */
  readonly turn: number;
  /** A wary camp you walked into or hurt: it comes for you. */
  angry: boolean;
  /** One of them has warned you off (once per visit to the camp). */
  warned: boolean;
}

/** What a wary camp calls out to warn you off, and what robbers call as they come for you. */
const WARN = ['"Keep away from our fire."', '"That\'s close enough. Go round."', '"Nothing here for you. Move on."'];
const ROB = ['"Your pack. Put it down."', '"Look, one of the grandchildren. Get it."', '"Nice and slow now. Give us the pack."'];

export class Scavengers extends Population<Camp, Scavenger> {
  /** Salt does not stop them (src/world/saltLine.ts). */
  protected override heedsSalt = false;
  /** The last thing one of them called out, and how many calls so far (the game shows each new one). */
  said = '';
  calls = 0;

  constructor(level: Level) {
    super(level, 'scavengers', SCAVENGER, { arrive: 0.5, still: 0.07, step: 0.5, drop: 1.2, accel: 7, turn: 7, face: 8 });
    this.apart = 1;
  }

  protected denIn(key: number, i: number, j: number): Camp | null {
    if (this.level.depth < 4) return null;
    for (const [x, z] of this.sites(i, j, this.level.band.scavengers, 6)) {
      const col = this.level.columnAt(x, z);
      if (rockDistance(col) < 3 || col.collapse > 0 || col.rubble > 0.05) continue;
      const y = this.floorFor(x, z, 2.2, 1.5);
      if (y === null) continue;
      // The seats round the fire want level, dry floor too.
      const turn = this.rng0(i, j, 41) * Math.PI * 2;
      let ok = true;
      for (let k = 0; k < 3 && ok; k++) {
        const a = turn + (k / 3) * Math.PI * 2, sx = x + Math.sin(a) * SCAVENGER.seat, sz = z + Math.cos(a) * SCAVENGER.seat;
        ok = this.level.dry(sx, sz, 0.05) && Math.abs(this.level.groundAt(sx, sz) - y) < 0.3;
      }
      if (!ok) continue;
      return { key, x, z, y, count: this.countIn(i, j, SCAVENGER.count), robbers: this.rng0(i, j, 42) < SCAVENGER.robbers, turn, angry: false, warned: false };
    }
    return null;
  }

  /** A seeded number in 0..1 for cell (i, j). */
  private rng0(i: number, j: number, k: number): number {
    return hash3f(this.seed, i, j, k);
  }

  protected hatch(c: Camp, killed: (id: number) => boolean): Scavenger[] {
    const born: Scavenger[] = [];
    for (let k = 0; k < c.count; k++) {
      const id = c.key * 4 + k;
      if (!killed(id)) born.push(new Scavenger(id, c, k, (c.key + k) % 3));
    }
    return born;
  }

  /** Out of sight, a wary camp settles again (and will warn you again). */
  protected sleep(c: Camp): void {
    c.angry = false;
    c.warned = false;
  }

  protected act(s: Scavenger, prey: Fighter, _ctx: null, dt: number): number {
    const S = SCAVENGER, W = S.swing, c = s.camp;
    s.swingT += dt;
    s.t += dt;
    if (s.provoked) {
      s.provoked = false;
      if (s.cause === 'knife') c.angry = true;
      if (!s.dead && s.health < S.health * S.fear && s.mode !== 'flee') { s.mode = 'flee'; s.t = 0; }
    }
    if (s.dead) return this.lieDead(s, dt, 6);
    const dx = prey.x - s.x, dz = prey.z - s.z, d = Math.hypot(dx, dz), toYou = Math.atan2(-dx, -dz);
    const seen = !prey.dead && Math.abs(prey.y - s.y) < 3;
    const fromFire = Math.hypot(prey.x - c.x, prey.z - c.z);
    if (seen && !c.robbers && fromFire < S.camp) c.angry = true;
    const after = s.hostile && seen && (s.mode === 'chase' || s.mode === 'swing' ? d < S.forget : noticed(prey, d, S.notice));
    const watching = !s.hostile && seen && d < S.warn;
    if ((watching || (after && c.robbers)) && !c.warned) {
      c.warned = true;
      const lines = c.robbers ? ROB : WARN;
      this.said = lines[Math.floor(hash3f(this.seed, c.key, this.calls, 43) * lines.length)];
      this.calls++;
    }

    let hit = 0;
    switch (s.mode) {
      case 'sit':
        this.steer.move(s, s.seatX, s.seatZ, S.walk, dt, s.seatYaw + Math.PI);
        if (after || watching) { s.mode = 'stand'; s.t = 0; }
        break;
      case 'stand':
        // Up on its feet, turned to you.
        this.steer.move(s, s.x, s.z, 0, dt, toYou);
        if (after && s.t > S.rise) s.mode = 'chase';
        else if (!after && !watching && s.t > S.rise) s.mode = 'home';
        break;
      case 'chase':
        if (closeIn(s, s.swingT, prey, W, S.run, this.steer, dt, 0.8) && after) { s.mode = 'swing'; s.swingT = 0; }
        else if (!after) s.mode = 'home';
        break;
      case 'swing':
        hit = pickSwing(s, s.swingT, W, prey, S.aim, this.steer, this.rng, 'scavenger', dt);
        if (s.swingT >= W.dur) s.mode = after ? 'chase' : 'home';
        break;
      case 'flee': {
        // Away from you, round what is in the way, for a while; then back to the fire.
        const ax = s.x - dx / (d || 1) * 6, az = s.z - dz / (d || 1) * 6;
        this.steer.move(s, ax, az, S.flee, dt, null);
        if (s.t > S.fleeT && d > S.notice) s.mode = 'home';
        break;
      }
      case 'home': {
        const left = Math.hypot(s.seatX - s.x, s.seatZ - s.z);
        this.steer.move(s, s.seatX, s.seatZ, S.walk, dt, left < 0.6 ? s.seatYaw + Math.PI : null);
        if (after && s.health >= S.health * S.fear) s.mode = 'chase';
        else if (left < 0.12 && Math.abs(angleDiff(s.yaw, s.seatYaw + Math.PI)) < 0.3) s.mode = watching ? 'stand' : 'sit';
        break;
      }
    }
    return hit;
  }
}
