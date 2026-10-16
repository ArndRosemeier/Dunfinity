/**
 * Goblins (dunfinity-plan.md D13, the "goblin warrens" of the old halls): small, quick, cowardly
 * and greedy, living in the dens of the warrens (src/gen/goblin.ts) in threes and fours round a
 * cook fire. They squat in the den until they see you; the first to see you shrieks (a tell: it
 * jumps up and throws its arms up) and the whole den comes. They come at you from all sides at
 * once, each round to its own side of you, and jab with a stolen knife. A jab that lands may
 * snatch something from your pack: the thief runs for it with it, and it drops where the thief
 * dies. A badly hurt goblin runs as well.
 *
 * Pure: floor walking with src/creatures/steer.ts, the jab through src/creatures/pick.ts. What a
 * goblin takes is the game's business (`thief`, `dropped`): the kind only carries it.
 */
import { hash3f } from '@futuremagic/core';
import type { Level } from '../gen/level';
import type { Goblin as Warrens } from '../gen/goblin';
import { owns } from '../gen/style';
import { noticed, type Fighter } from '../combat/combat';
import { Creature } from './creature';
import { Population, type Den } from './population';
import { closeIn, pickSwing } from './pick';

export const GOBLIN_FOLK = {
  radius: 0.25,
  height: 1.1,
  health: 22,
  /** Speeds, m/s: about the den, coming for you, running off. */
  walk: 1.1,
  run: 4.2,
  flee: 5,
  /** They see you this close; give up beyond `forget`. */
  notice: 13,
  forget: 28,
  /** The shriek (the den wakes): seconds. */
  shriek: 0.8,
  /** The jab (see pick.ts): short, quick and weak; before each jab a goblin goes round to its own side of you, this far out, for up to `round` seconds. */
  swing: { dur: 0.55, hit: 0.3, start: 0.6, range: 0.85, arc: 0.8, low: 0, high: 1.3, damage: [4, 7] as const, knock: 1.2, rest: 0.45 },
  aim: 7,
  reach: 2.2,
  round: 2.5,
  /** Coming for you and getting nowhere for `stuck` seconds (rock in the way), it gives up on you for `balk` seconds. */
  stuck: 1.5,
  balk: 5,
  /** The chance a jab that lands snatches something; how long a thief runs, s. */
  snatch: 0.35,
  fleeT: 9,
  /** Below this share of its health it runs, this long. */
  fear: 0.3,
  /** Dens: the warrens' cells (GOBLIN.cell), the share of its dens lived in, none this close to the arrival; how many to a den; how far out from the middle they squat. */
  cell: 16,
  chance: 0.6,
  quiet: 30,
  count: [3, 4] as const,
  squat: [1, 2.4] as const,
  wake: 45,
  sleep: 70,
} as const;

export type GoblinMode = 'squat' | 'shriek' | 'chase' | 'jab' | 'flee' | 'home' | 'dead';

export class Goblin extends Creature<GoblinMode> {
  t = 0;
  swingT = 9;
  /** Coming for you: where it last got going from, and seconds since (it is getting nowhere); seconds left of giving up on you (it cannot get at you from here). */
  fromX = 0;
  fromZ = 0;
  stuckT = 0;
  balk = 0;
  /** What it snatched from you (the game's), carried until it dies. */
  loot: unknown = null;
  /** Where it squats in the den. */
  readonly homeX: number;
  readonly homeZ: number;

  /** `flank`: the side of you it comes round to (radians round you, 0: the side it comes from). */
  constructor(readonly id: number, readonly den: Lair, x: number, z: number, yaw: number, readonly look: number, public flank: number) {
    super(x, den.y, z, yaw, GOBLIN_FOLK.radius, GOBLIN_FOLK.height, GOBLIN_FOLK.health, 'squat');
    this.homeX = x; this.homeZ = z;
  }

  /** It is after you (or running off with your things). */
  get hostile(): boolean {
    return this.den.roused && !this.dead;
  }
}

/** A den: its middle, floor, whether it has a cook fire; how many live there. */
export interface Lair extends Den {
  readonly y: number;
  readonly count: number;
  readonly fire: boolean;
  /** One of them has seen you and shrieked: the den is after you. */
  roused: boolean;
}

export class Goblins extends Population<Lair, Goblin> {
  /** Salt does not stop them: they are people, of a kind (src/world/saltLine.ts). */
  protected override heedsSalt = false;
  /** Set by the game: take something from your pack for a goblin whose jab landed (null: nothing to take). */
  thief: (() => unknown) | null = null;
  /** Things snatched, dropped where their thieves died since the game last took them. */
  readonly dropped: { loot: unknown; x: number; y: number; z: number }[] = [];
  private readonly warrens: Warrens | null;

  constructor(level: Level) {
    super(level, 'goblins', GOBLIN_FOLK, { arrive: 0.4, still: 0.06, step: 0.45, drop: 1.4, accel: 10, turn: 9, face: 10 });
    this.apart = 1.1;
    this.warrens = (level.field.styles.find((s) => s.id === 'goblin') as Warrens | undefined) ?? null;
  }

  protected denIn(key: number, i: number, j: number): Lair | null {
    const w = this.warrens, G = GOBLIN_FOLK;
    if (!w || hash3f(this.seed, i, j, 0) >= G.chance) return null;
    const d = w.den(i, j), f = this.level.field;
    if (!d || f.styles[f.regions.styleAt(d.x, d.z)] !== w || !owns(w, d.x, d.z)) return null;
    const [ax, , az] = this.level.arrival;
    if (Math.hypot(d.x - ax, d.z - az) < G.quiet) return null;
    const y = this.floorFor(d.x, d.z, 1.8, 1);
    return y === null ? null : { key, x: d.x, z: d.z, y, count: this.countIn(i, j, G.count), fire: d.fire, roused: false };
  }

  protected hatch(den: Lair, killed: (id: number) => boolean): Goblin[] {
    const G = GOBLIN_FOLK;
    return this.brood(den, 'goblins', 4, G.squat[0], G.squat[1], killed, (id, x, _y, z, rng, k) => {
      // Squatting round the middle (the fire), turned to it.
      return new Goblin(id, den, x, z, Math.atan2(x - den.x, z - den.z), (den.key + k) % 4, (k / den.count) * Math.PI * 2 + rng.range(-0.4, 0.4));
    });
  }

  /** Out of sight, the den settles again. */
  protected sleep(den: Lair): void {
    den.roused = false;
  }

  protected act(g: Goblin, prey: Fighter, _: null, dt: number): number {
    const G = GOBLIN_FOLK, W = G.swing, den = g.den;
    g.swingT += dt;
    g.t += dt;
    g.balk = Math.max(0, g.balk - dt);
    if (g.provoked) {
      g.provoked = false;
      if (!g.dead) den.roused = true;
      if (!g.dead && g.health < G.health * G.fear && g.mode !== 'flee') { g.mode = 'flee'; g.t = 0; }
    }
    if (g.dead) {
      if (g.loot !== null) { this.dropped.push({ loot: g.loot, x: g.x, y: g.y, z: g.z }); g.loot = null; }
      return this.lieDead(g, dt, 7);
    }
    const dx = prey.x - g.x, dz = prey.z - g.z, d = Math.hypot(dx, dz), toYou = Math.atan2(-dx, -dz);
    const seen = !prey.dead && Math.abs(prey.y - g.y) < 3;
    const after = den.roused && seen && g.balk <= 0 && (g.mode === 'squat' || g.mode === 'home' ? noticed(prey, d, G.notice * 1.4) : d < G.forget);

    let hit = 0;
    switch (g.mode) {
      case 'squat':
        this.steer.move(g, g.homeX, g.homeZ, G.walk, dt, Math.atan2(g.homeX - den.x, g.homeZ - den.z));
        if (seen && noticed(prey, d, G.notice) && !den.roused) { g.mode = 'shriek'; g.t = 0; den.roused = true; }
        else if (after) { g.mode = 'chase'; g.t = 0; }
        break;
      case 'shriek':
        this.steer.move(g, g.x, g.z, 0, dt, toYou);
        if (g.t > G.shriek) g.mode = 'chase';
        break;
      case 'chase': {
        if (!after) { g.mode = 'home'; break; }
        // Round to its own side of you first (for a while at most), then in for the jab: once it
        // turns in it keeps on in (it never goes back and forth between the two).
        const a = toYou + Math.PI + g.flank, fx = prey.x - Math.sin(a) * G.reach, fz = prey.z - Math.cos(a) * G.reach;
        if (g.t < G.round && Math.hypot(fx - g.x, fz - g.z) > 0.8 && d > G.reach * 0.7) this.steer.move(g, fx, fz, G.run, dt, toYou);
        else {
          if (g.t < G.round) { g.t = G.round; g.fromX = g.x; g.fromZ = g.z; g.stuckT = 0; }
          // Getting nowhere (rock between it and you): it gives up on you for a while, rather than push at the rock.
          if (Math.hypot(g.x - g.fromX, g.z - g.fromZ) > 0.4) { g.fromX = g.x; g.fromZ = g.z; g.stuckT = 0; } else g.stuckT += dt;
          if (g.stuckT > G.stuck && d > G.reach + 0.5) { g.mode = 'home'; g.balk = G.balk; break; }
          // Stuck a moment, it stands and glares at you rather than shuffle at what is in the way;
          // close by (the others in the way) it tries again after a while.
          if (g.stuckT > G.stuck * 0.25) {
            this.steer.move(g, g.x, g.z, 0, dt, toYou);
            if (d <= G.reach + 0.5 && g.stuckT > G.stuck * 0.75) { g.fromX = g.x; g.fromZ = g.z; g.stuckT = 0; }
            break;
          }
          if (closeIn(g, g.swingT, prey, W, G.run, this.steer, dt, 0.8)) { g.mode = 'jab'; g.swingT = 0; }
        }
        break;
      }
      case 'jab':
        hit = pickSwing(g, g.swingT, W, prey, G.aim, this.steer, this.rng, 'goblin', dt);
        if (hit && g.loot === null && this.thief && this.rng.chance(G.snatch)) {
          const took = this.thief();
          if (took !== null) { g.loot = took; g.mode = 'flee'; g.t = 0; break; }
        }
        if (g.swingT >= W.dur) { g.mode = after ? 'chase' : 'home'; g.t = 0; g.flank += this.rng.range(-0.8, 0.8); }
        break;
      case 'flee': {
        // Away from you round what is in the way, until you are well behind it; then back to the den (a thief with your things).
        const ax = g.x - dx / (d || 1) * 6, az = g.z - dz / (d || 1) * 6;
        this.steer.move(g, ax, az, G.flee, dt, null);
        if (g.t > G.fleeT && d > G.notice) g.mode = 'home';
        break;
      }
      case 'home': {
        const left = Math.hypot(g.homeX - g.x, g.homeZ - g.z);
        this.steer.move(g, g.homeX, g.homeZ, G.walk, dt, null);
        if (after && g.health >= G.health * G.fear) g.mode = 'chase';
        else if (left < 0.2) g.mode = 'squat';
        break;
      }
    }
    return hit;
  }
}

