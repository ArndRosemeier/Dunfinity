/**
 * Slimes (docs/design/town-and-first-strata.md §5: levels 2–8, "two factions at war with each other;
 * Lumen may tolerate you"): Lumen, pale and glowing, and Murk, dark and oily, live in colonies on the
 * floor and fight each other wherever their colonies meet. Murk come for you too; Lumen leave you be
 * until you hurt one of them, and then that whole colony is after you.
 *
 * They move in pulses (squeeze and flow: a pulse slows them but never turns them, so they cannot
 * jitter). A blow shows: a slime squashes down, then throws itself forward. Dead, it melts into a
 * puddle. Pure: floor walking with src/creatures/steer.ts, blows through src/combat. Colonies are
 * fixed by the seed; the dead stay dead on this visit.
 */
import { angleDiff } from '@futuremagic/core';
import type { Level } from '../gen/level';
import { damage, type Fighter, noticed } from '../combat/combat';
import { Creature } from './creature';
import { Population, type Den } from './population';
import { brake } from './steer';
import { rockDistance } from '../gen/quarry';

export type Faction = 'lumen' | 'murk';

export const SLIME = {
  /** Radius and height at size 1, metres; health at size 1. */
  radius: 0.38,
  height: 0.5,
  health: 20,
  /** Oozing about the colony, and going for someone, m/s (at the top of a pulse); pulses per second. */
  ooze: 0.5,
  rush: 1.8,
  pulse: 1.6,
  /** They see you (Murk; Lumen once angered) this close, and an enemy slime this close; give up beyond `forget`. */
  notice: 9,
  enemies: 15,
  forget: 22,
  /** A blow: reach beyond touching, the squash before it (the tell), the throw, seconds between blows, damage per faction. */
  reach: 0.3,
  squash: 0.4,
  throw: 0.18,
  every: 1.5,
  damage: { lumen: [3, 5], murk: [5, 8] } as const,
  /** Colonies: cell size, chance per cell from level 2, none this close to the arrival, slimes per colony, how far they ooze. */
  cell: 44,
  chance: 0.3,
  quiet: 20,
  count: [3, 5] as const,
  roam: 4,
  wake: 55,
  sleep: 75,
} as const;

export type SlimeMode = 'ooze' | 'rest' | 'go' | 'blow' | 'dead';

export class Slime extends Creature<SlimeMode> {
  /** Seconds left in the mode (ooze, rest), or since the blow began. */
  t = 0;
  /** Seconds since its last blow began. */
  blowT = 9;
  /** The pulse's phase (radians, advanced by time). */
  phase: number;
  /** Where it oozes to. */
  tx: number;
  tz: number;
  /** Whom it is after (an enemy slime, or you). */
  foe: Fighter | null = null;

  constructor(readonly id: number, readonly colony: Colony, x: number, y: number, z: number, readonly size: number, phase: number) {
    super(x, y, z, 0, SLIME.radius * size, SLIME.height * size, SLIME.health * size, 'rest');
    this.tx = x; this.tz = z;
    this.phase = phase;
  }

  get faction(): Faction { return this.colony.faction; }
}

export interface Colony extends Den {
  readonly y: number;
  readonly faction: Faction;
  readonly count: number;
  /** Lumen: one of them was hurt by you; the colony is after you now. */
  angry: boolean;
}

export class Slimes extends Population<Colony, Slime, readonly Slime[]> {
  constructor(level: Level, readonly faction: Faction) {
    super(level, `slimes-${faction}`, SLIME, { arrive: 0.4, still: 0.06, step: 0.4, drop: 1, accel: 6, turn: 6, face: 8, probe: 1.1 });
    this.apart = 0.9; // jelly gives a little
  }

  protected denIn(key: number, i: number, j: number): Colony | null {
    const l = this.level;
    if (l.depth < 2) return null;
    for (const [x, z] of this.sites(i, j, SLIME.chance)) {
      const col = l.columnAt(x, z);
      if (rockDistance(col) < 2.5 || col.rubble > 0.1) continue;
      const y = this.floorFor(x, z, 0.8, 0.6);
      if (y !== null) return { key, x, z, y, faction: this.faction, count: this.countIn(i, j, SLIME.count), angry: false };
    }
    return null;
  }

  protected hatch(c: Colony, killed: (id: number) => boolean): Slime[] {
    return this.brood(c, 'colony', 8, 0.5, 2.5, killed, (id, x, y, z, rng) => {
      const size = rng.range(0.75, 1.3), phase = rng.range(0, Math.PI * 2), sl = new Slime(id, c, x, y, z, size, phase);
      sl.t = rng.range(0.5, 3);
      return sl;
    });
  }


  /** Lumen calm down again while you are away. */
  protected sleep(c: Colony): void {
    c.angry = false;
  }

  /** One slime's step; `enemies`: the other faction's slimes. Returns 1 if it hurt you. */
  protected act(sl: Slime, prey: Fighter, enemies: readonly Slime[], dt: number): number {
    const C = SLIME;
    sl.blowT += dt;
    sl.phase += dt * C.pulse * Math.PI * 2;
    if (sl.provoked) {
      sl.provoked = false;
      // Hurt by you (not by a slime): a Lumen colony turns on you.
      if (sl.cause === 'knife') sl.colony.angry = true;
    }
    if (sl.dead) return this.lieDead(sl, dt, 6);
    sl.foe = this.foeOf(sl, prey, enemies);
    const f = sl.foe;
    let hurt = 0;
    if (f && sl.mode !== 'blow') sl.mode = 'go';
    if (!f && (sl.mode === 'go')) { sl.mode = 'rest'; sl.t = this.rng.range(0.5, 2); }
    const flow = 0.35 + 0.65 * Math.max(0, Math.sin(sl.phase)); // the pulse: slower, never backwards
    switch (sl.mode) {
      case 'rest':
        brake(sl, 4, dt);
        this.steer.slide(sl, dt);
        if ((sl.t -= dt) <= 0) {
          [sl.tx, sl.tz] = this.roamFrom(sl.colony, C.roam);
          sl.mode = 'ooze'; sl.t = 6;
        }
        break;
      case 'ooze':
        this.steer.move(sl, sl.tx, sl.tz, C.ooze * flow, dt, null);
        if ((sl.t -= dt) <= 0 || Math.hypot(sl.tx - sl.x, sl.tz - sl.z) < 0.2) { sl.mode = 'rest'; sl.t = this.rng.range(1, 4); }
        break;
      case 'go': {
        const d = this.steer.close(sl, f!, f!.radius + sl.radius + 0.05, C.rush * flow, dt, 0.4);
        if (d - f!.radius - sl.radius < C.reach && sl.blowT > C.every) { sl.mode = 'blow'; sl.blowT = 0; }
        break;
      }
      case 'blow': {
        // Squash down (the tell), then throw itself at the foe.
        const dx = f ? f.x - sl.x : 0, dz = f ? f.z - sl.z : 0, d = Math.hypot(dx, dz) || 1;
        if (sl.blowT < C.squash) brake(sl, 10, dt);
        else if (sl.blowT < C.squash + C.throw) { sl.vx = (dx / d) * 2.4; sl.vz = (dz / d) * 2.4; }
        if (f) sl.yaw += angleDiff(sl.yaw, Math.atan2(-dx, -dz)) * Math.min(1, dt * 10);
        this.steer.slide(sl, dt);
        if (f && sl.blowT >= C.squash && sl.blowT - dt < C.squash && d - f.radius - sl.radius < C.reach + 0.3 && Math.abs(f.y - sl.y) < 1) {
          const [lo, hi] = C.damage[sl.faction];
          damage(f, this.rng.range(lo, hi) * sl.size, sl.x, sl.z, 1.2, sl.faction === 'lumen' ? 'lumen' : 'murk');
          if (f === prey) hurt = 1;
        }
        if (sl.blowT > C.squash + C.throw + 0.3) sl.mode = f ? 'go' : 'rest';
        break;
      }
    }
    return hurt;
  }

  /**
   * The foe a slime goes for: the nearest enemy slime, or you (Murk always; Lumen when angered). It
   * keeps to the foe it has unless another is clearly (a metre) nearer.
   */
  private foeOf(sl: Slime, prey: Fighter, enemies: readonly Slime[]): Fighter | null {
    const C = SLIME, hostile = sl.faction === 'murk' || sl.colony.angry;
    const dist = (f: Fighter) => (Math.abs(f.y - sl.y) > 1.5 ? Infinity : Math.hypot(f.x - sl.x, f.z - sl.z));
    const old = sl.foe;
    const keep = old && !old.dead && dist(old) < C.forget && (old !== prey || hostile) ? old : null;
    let best = keep, bd = keep ? dist(keep) - 1 : Infinity;
    for (const e of enemies) {
      const d = dist(e);
      if (!e.dead && d < C.enemies && d < bd) { best = e; bd = d; }
    }
    if (hostile && !prey.dead && noticed(prey, dist(prey), C.notice) && dist(prey) < bd) best = prey;
    return best;
  }
}
