/**
 * The level's own animals (docs/design/procedural-creatures.md §6): procedural species from the
 * level's bestiary (src/creatures/bestiary.ts), living in herds, broods, packs and drifts.
 *
 * The peaceful ones graze, wander, watch you from a distance, drift in the air, and keep out of your
 * way. None comes after you; but every one of them fights back when hurt, or flees if the fight is
 * hopeless (Arnd, 2026-10-16), and its power is its size: a colossus that ten metres long kills
 * whoever attacks it.
 *
 * The hunting ones (hunters, lurkers, swarmers, brutes) come after you, and are grown to the size
 * that makes them a fair fight for their level (`fitSize`: power is still size, so a level-1 hunter is
 * a small thing and a level-30 brute a big one). Each blow has its tell: the wind-up, then the lunge
 * or the slam; after it they spring back and come again. Badly hurt, they run.
 *
 * Levels 1 to 10 have them rarely (the hand-made foes rule there); deeper, more often.
 *
 * Pure: floor walking with src/creatures/steer.ts, blows through src/combat. Herds are fixed by the
 * seed; the dead stay dead on this visit.
 */
import { angleDiff, clamp, hash3f } from '@futuremagic/core';
import type { Level } from '../gen/level';
import { damage, type Fighter, noticed } from '../combat/combat';
import { Creature } from './creature';
import { Population, type Den } from './population';
import { brake } from './steer';
import { bestiaryOf, type Species } from './bestiary';

export const HERD = {
  /** Herds: cell size, chance per cell on levels 1–10 and deeper, none this close to the arrival. */
  cell: 70,
  chance: 0.16,
  deeper: 0.3,
  quiet: 35,
  wake: 70,
  sleep: 95,
  /** How far they wander from their herd's place, in their own lengths (and at least `roam` metres). */
  roam: 4,
  roamMin: 3,
  /** Health and a blow's damage from mass (kg): k·mass^p. You have 100 health and a knife does 6–10. */
  health: [6, 0.55] as const,
  blow: [2.2, 0.45] as const,
  /** Fights back when hurt if it weighs this much (else nips once and runs) and has more than this share of its health left. */
  bold: 12,
  hopeless: 0.3,
  /** How long it stays angry after a blow, s (bigger ones longer). */
  anger: 7,
  /** A blow: the wind-up (the tell) and the whole action, s; its reach beyond touching, in its own lengths. */
  windup: 0.35,
  strike: 0.9,
  reach: 0.3,
  /** How long it runs when frightened, s. */
  flee: 5,
} as const;

/** The hunting kinds: how often a den is theirs, how they find you, and their fair power per level. */
export const HUNT = {
  /** Share of the dens that are hunters' on levels 1–10 and deeper. */
  share: 0.3,
  deeper: 0.45,
  /** They see you this close (a lurker only when you are nearly on it), and give up beyond `forget`. */
  notice: 14,
  lurk: 5,
  forget: 32,
  /** A pack member's fair health on level d: base + per·d, times its role's share (one brute is a pack's worth). */
  base: 12,
  per: 2.5,
  role: { hunter: 1, swarmer: 0.35, lurker: 1.4, brute: 3 } as Readonly<Record<string, number>>,
  /** The wind-up before its blow, s (a brute's slam is slower and plainer), and the lunge's speed share of its run. */
  windup: { hunter: 0.4, swarmer: 0.3, lurker: 0.3, brute: 0.65 } as Readonly<Record<string, number>>,
  lunge: 1.2,
  /** After a blow: how long it springs back, s; the least time between its blows; how far off it waits meanwhile, in lengths. */
  back: 0.6,
  every: 1.8,
  wait: 1.5,
  /** At most this many of a pack strike at once; the rest wait their turn round you. */
  together: 2,
  /** Sizes it may be grown to. */
  size: [0.25, 3] as const,
} as const;

export type CritterMode = 'graze' | 'wander' | 'watch' | 'lurk' | 'flee' | 'fight' | 'stalk' | 'back' | 'dead';

export class Critter extends Creature<CritterMode> {
  /** Seconds left in the mode (graze, wander, flee, fight). */
  t = 0;
  /** Where it goes. */
  tx: number;
  tz: number;
  /** The action it is in ('bite', 'slam', ...; '' none) and how far (0..1); the rig plays it. */
  action = '';
  actionT = 0;
  /** It struck in this action. */
  struck = false;
  /** Running (the rig's faster gait). */
  running = false;
  /** Watching you (the rig turns its head to you). */
  watching = false;
  /** Seconds until a hunter may strike again. */
  cool = 0;
  readonly maxHealth: number;

  constructor(readonly id: number, readonly herd: Herd, x: number, y: number, z: number, yaw: number, readonly size: number) {
    const sp = herd.species, b = bodyOf(sp, size);
    super(x, y, z, yaw, b.radius, b.height, powerOf(sp, size).health, 'graze');
    this.maxHealth = this.health;
    this.tx = x; this.tz = z;
  }

  get species(): Species { return this.herd.species; }
}

export interface Herd extends Den {
  readonly y: number;
  readonly count: number;
  /** Which of the level's species lives here (an index into `Critters.species`). */
  readonly kind: number;
  readonly species: Species;
  /** The size its animals are grown to (1 for peaceful ones; a hunter's fair size for the level). */
  readonly scale: number;
}

/** The walker's body of a species at a size: its radius, and its height (at least 1.5 radii: the floor walker probes for rock at about half its height, and a low, wide body, a serpent, would find only floor). */
export function bodyOf(sp: Species, size = 1): { radius: number; height: number } {
  const radius = sp.radius * size;
  return { radius, height: Math.max(0.1, radius * 1.5, (sp.hipHeight + sp.length * sp.girth * sp.bodyHeight) * size) };
}

/** A species' health and blow at a size (its mass grows with the cube of the size). */
export function powerOf(sp: Species, size = 1): { health: number; blow: number } {
  const m = sp.mass * size ** 3;
  return { health: Math.max(2, HERD.health[0] * m ** HERD.health[1]), blow: Math.max(1, HERD.blow[0] * m ** HERD.blow[1]) };
}

/** The size that gives a hunting species its fair health on level `depth` (see HUNT). */
export function fitSize(sp: Species, depth: number): number {
  const want = (HUNT.base + HUNT.per * depth) * (HUNT.role[sp.role] ?? 1);
  const mass = (want / HERD.health[0]) ** (1 / HERD.health[1]);
  return clamp(Math.cbrt(mass / sp.mass), HUNT.size[0], HUNT.size[1]);
}

/** What a species does when it strikes (the rig's action). */
export function strikeOf(sp: Species): string {
  if (sp.tail.tip === 'sting') return 'sting';
  if (sp.plan === 'crab') return 'pinch';
  if (sp.mass > 400) return 'slam';
  if (sp.plan === 'floater') return 'flinch';
  return 'bite';
}

export class Critters extends Population<Herd, Critter> {
  /** The level's species (one per herd kind), peaceful and hunting. */
  readonly species: readonly Species[];
  private readonly chance: number;
  private readonly share: number;

  constructor(level: Level) {
    super(level, 'critters', HERD, { arrive: 0.6, still: 0.08, step: 0.5, drop: 1.2, accel: 6, turn: 4, face: 5 });
    this.species = level.depth ? bestiaryOf(level.seed, level.depth) : [];
    const shallow = level.depth <= 10;
    this.share = this.species.some((s) => !s.peaceful) ? (shallow ? HUNT.share : HUNT.deeper) : 0;
    // The hunters' dens come on top of the herds' (as many herds as before).
    this.chance = level.depth ? (shallow ? HERD.chance : HERD.deeper) / (1 - this.share) : 0;
    this.apart = 1;
  }

  protected denIn(key: number, i: number, j: number): Herd | null {
    if (!this.species.length) return null;
    for (const [x, z] of this.sites(i, j, this.chance)) {
      const hunting = hash3f(this.seed, i, j, 31) < this.share;
      const kinds = this.species.map((s, k) => [s, k] as const).filter(([s]) => s.peaceful !== hunting);
      const [sp, kind] = kinds[Math.floor(hash3f(this.seed, i, j, 30) * kinds.length)];
      const scale = sp.peaceful ? 1 : fitSize(sp, this.level.depth);
      // Room over its back, and room to walk where the walker feels for rock (see `bodyOf`).
      const b = bodyOf(sp, scale);
      const y = this.floorFor(x, z, Math.max(1, (sp.hipHeight * 2 + sp.altitude) * scale), Math.max(0.5, b.radius * 1.5));
      if (y !== null && this.floorFor(x, z, b.height * 0.5625, b.radius * 1.2) !== null) return { key, x, z, y, kind, species: sp, scale, count: this.countIn(i, j, sp.group) };
    }
    return null;
  }

  protected hatch(h: Herd, killed: (id: number) => boolean): Critter[] {
    const sp = h.species, body = bodyOf(sp, h.scale), len = sp.totalLength * h.scale, spread = Math.max(1.5, len * 2);
    return this.brood(h, 'herd', 16, len * 0.6, spread, killed, (id, x, y, z, rng) => {
      const c = new Critter(id, h, x, y, z, rng.range(0, Math.PI * 2), h.scale * rng.range(0.85, 1.15));
      c.t = rng.range(0.5, 6);
      if (sp.role === 'lurker') c.mode = 'lurk';
      return c;
    }, body.radius * 0.9 + 0.05, body.height * 0.5625);
  }

  /** One animal's step. Returns 1 if it struck you. */
  protected act(c: Critter, prey: Fighter, _ctx: null, dt: number): number {
    const sp = c.species, H = HERD;
    c.t -= dt;
    if (c.action) c.actionT = Math.min(1, c.actionT + dt / H.strike);
    if (c.dead) { c.action = ''; c.running = false; c.watching = false; return this.lieDead(c, dt, 4); }
    const dx = prey.x - c.x, dz = prey.z - c.z, d = Math.hypot(dx, dz), toYou = Math.atan2(-dx, -dz);
    const len = Math.max(0.2, sp.totalLength * c.size), near = Math.abs(prey.y - c.y) < 2 + c.height;
    if (!sp.peaceful) return this.hunt(c, prey, dt, dx, dz, d, toYou, len, near);

    if (c.provoked) {
      c.provoked = false;
      // Fight back, or run if the fight is hopeless (a small thing nips first if you are in reach).
      const bold = sp.mass * c.size ** 3 >= H.bold && c.health > c.maxHealth * H.hopeless;
      if (bold && c.cause === 'knife') { c.mode = 'fight'; c.t = H.anger * (1 + Math.log10(1 + sp.mass) * 0.5); }
      else if (c.cause === 'knife' && d < len * (0.5 + H.reach) + prey.radius && !c.action) this.attack(c);
      else this.frighten(c, H.flee);
      // The rest of its herd hears it.
      for (const o of this.list) if (o !== c && o.herd === c.herd && !o.dead && (o.mode === 'graze' || o.mode === 'wander' || o.mode === 'watch')) {
        if (sp.mass * o.size ** 3 >= H.bold && bold) { o.mode = 'fight'; o.t = c.t * 0.7; } else this.frighten(o, H.flee * 0.8);
      }
    }
    // Shy ones keep their distance (a giant minds nobody).
    const shy = sp.role === 'giant' ? 0 : sp.role === 'scuttler' ? 2.5 + len : sp.role === 'watcher' ? 3.5 + len : 4 + len * 1.5;
    if (!prey.dead && near && d < shy && (c.mode === 'graze' || c.mode === 'wander')) {
      if (sp.role === 'watcher') { c.mode = 'watch'; c.t = 3; } else this.frighten(c, 2 + H.flee * 0.4);
    }
    if (c.mode === 'fight' && (prey.dead || c.t <= 0 || d > 25 || !near)) { c.mode = 'wander'; c.t = 0; }

    c.watching = c.mode === 'watch' || c.mode === 'fight' || (d < shy * 2.5 && sp.role !== 'giant' && !prey.dead);
    let struck = 0;
    if (c.action) {
      // The blow lands at the end of the wind-up, if you are still in reach in front of it.
      c.yaw += angleDiff(c.yaw, toYou) * Math.min(1, dt * 3);
      brake(c, 6, dt);
      this.steer.slide(c, dt);
      if (!c.struck && c.actionT * H.strike >= H.windup) {
        c.struck = true;
        const ahead = Math.abs(angleDiff(c.yaw, toYou)) < 1.1;
        if (ahead && near && d - prey.radius - c.radius < len * H.reach + 0.2) {
          const { blow } = powerOf(sp, c.size);
          damage(prey, this.rng.range(0.8, 1.2) * blow, c.x, c.z, clamp(1 + blow * 0.08, 1, 9), sp.mass * c.size ** 3 > 400 ? 'colossus' : 'critter');
          struck = 1;
        }
      }
      if (c.actionT >= 1) {
        c.action = ''; c.actionT = 0;
        // A small thing that nipped now runs.
        if (c.mode !== 'fight') this.frighten(c, H.flee);
      }
      return struck;
    }

    switch (c.mode) {
      case 'graze':
        c.running = false;
        brake(c, 4, dt);
        this.steer.slide(c, dt);
        if (c.t <= 0) {
          [c.tx, c.tz] = this.roamFrom(c.herd, Math.max(H.roamMin, len * H.roam));
          c.mode = 'wander'; c.t = 4 + len * 2;
        }
        break;
      case 'wander':
        c.running = false;
        this.steer.move(c, c.tx, c.tz, sp.walkSpeed * c.size * 0.6, dt, null);
        if (c.t <= 0 || Math.hypot(c.tx - c.x, c.tz - c.z) < Math.max(0.3, len * 0.3)) { c.mode = 'graze'; c.t = this.rng.range(2, 8); }
        break;
      case 'watch':
        // Stands its ground, eyes on you; backs off if you come closer still.
        c.running = false;
        if (d < shy * 0.6) this.steer.move(c, c.x - (dx / (d || 1)) * 2, c.z - (dz / (d || 1)) * 2, sp.walkSpeed * c.size, dt, toYou);
        else this.steer.move(c, c.x, c.z, 0, dt, toYou);
        if (c.t <= 0 && d > shy) { c.mode = 'graze'; c.t = this.rng.range(1, 4); }
        break;
      case 'flee':
        c.running = true;
        this.steer.move(c, c.x - (dx / (d || 1)) * 6, c.z - (dz / (d || 1)) * 6, sp.runSpeed * c.size, dt, null);
        if (c.t <= 0) { [c.tx, c.tz] = this.roamFrom(c.herd, Math.max(H.roamMin, len * H.roam)); c.mode = 'wander'; c.t = 6; }
        break;
      case 'fight': {
        c.running = d > len * 2;
        const stand = c.radius + prey.radius + len * H.reach * 0.5;
        this.steer.close(c, prey, stand, sp.runSpeed * c.size * 0.8, dt, len * 2);
        if (d - stand < len * H.reach && Math.abs(angleDiff(c.yaw, toYou)) < 0.5) this.attack(c);
        break;
      }
    }
    return 0;
  }

  /** A hunting animal's step (see the header). Returns 1 if it struck you. */
  private hunt(c: Critter, prey: Fighter, dt: number, dx: number, dz: number, d: number, toYou: number, len: number, near: boolean): number {
    const sp = c.species, H = HUNT, run = sp.runSpeed * c.size;
    c.cool -= dt;
    const hopeless = c.health <= c.maxHealth * HERD.hopeless;
    if (c.provoked) {
      c.provoked = false;
      // Hurt: it turns on you, or runs if it is nearly done; its pack comes too.
      if (hopeless) this.frighten(c, HERD.flee * 1.5);
      else if (c.mode !== 'stalk' && c.mode !== 'back') c.mode = 'stalk';
      for (const o of this.list) if (o !== c && o.herd === c.herd && !o.dead && o.mode !== 'flee') if (o.mode !== 'back') o.mode = 'stalk';
    }
    const idle = c.mode === 'graze' || c.mode === 'wander' || c.mode === 'lurk';
    if (idle && !prey.dead && near && noticed(prey, d, sp.role === 'lurker' ? H.lurk : H.notice)) {
      c.mode = 'stalk';
      for (const o of this.list) if (o.herd === c.herd && !o.dead && (o.mode === 'graze' || o.mode === 'wander' || o.mode === 'lurk')) o.mode = 'stalk';
    }
    if ((c.mode === 'stalk' || c.mode === 'back') && (prey.dead || d > H.forget || !near)) { c.mode = sp.role === 'lurker' ? 'lurk' : 'wander'; c.t = 0; }
    c.watching = c.mode === 'stalk' || c.mode === 'back' || c.mode === 'lurk' && d < H.notice;

    const windup = H.windup[sp.role] ?? HERD.windup;
    if (c.action) {
      // The tell, then the lunge (a brute stands and slams); the blow lands as the lunge reaches you.
      c.yaw += angleDiff(c.yaw, toYou) * Math.min(1, dt * (c.actionT * HERD.strike < windup ? 4 : 1));
      const at = c.actionT * HERD.strike, lunging = sp.role !== 'brute' && at >= windup && at < windup + 0.25;
      if (lunging) this.steer.move(c, prey.x, prey.z, run * H.lunge, dt, null);
      else { brake(c, 6, dt); this.steer.slide(c, dt); }
      let struck = 0;
      if (!c.struck && at >= windup + (sp.role === 'brute' ? 0 : 0.12)) {
        const ahead = Math.abs(angleDiff(c.yaw, toYou)) < 1.1;
        if (ahead && near && d - prey.radius - c.radius < len * HERD.reach + 0.35) {
          c.struck = true;
          const { blow } = powerOf(sp, c.size);
          damage(prey, this.rng.range(0.8, 1.2) * blow, c.x, c.z, clamp(1 + blow * 0.08, 1, 9), 'hunter');
          struck = 1;
        } else if (!lunging) c.struck = true;
      }
      if (c.actionT >= 1) {
        c.action = ''; c.actionT = 0; c.cool = H.every * this.rng.range(0.8, 1.2);
        if (c.mode === 'stalk') { c.mode = 'back'; c.t = H.back; }
      }
      return struck;
    }

    switch (c.mode) {
      case 'lurk':
        // Still as the rock, until you come too close.
        c.running = false;
        brake(c, 6, dt);
        this.steer.slide(c, dt);
        break;
      case 'back':
        // Springs back from you after its blow, facing you.
        c.running = false;
        this.steer.move(c, c.x - (dx / (d || 1)) * 3, c.z - (dz / (d || 1)) * 3, run * 0.7, dt, toYou);
        if (c.t <= 0) c.mode = 'stalk';
        break;
      case 'stalk': {
        // Comes for you; waits a little way off while it gathers for the next blow.
        let striking = 0;
        for (const o of this.list) if (o.herd === c.herd && o.action) striking++;
        const turn = c.cool <= 0 && striking < H.together;
        const stand = c.radius + prey.radius + len * HERD.reach * 0.5, hold = turn ? stand : stand + len * H.wait + 0.5;
        c.running = d > hold + len * 2;
        this.steer.close(c, prey, hold, c.running ? run : run * 0.5, dt, len * 3);
        // In reach of its blow (a lunge carries it the last bit; a brute's slam does not).
        const gap = d - prey.radius - c.radius, lunge = sp.role === 'brute' ? 0 : Math.min(len, run * H.lunge * 0.2);
        if (turn && gap < len * HERD.reach + 0.2 + lunge && Math.abs(angleDiff(c.yaw, toYou)) < 0.5) this.attack(c);
        break;
      }
      case 'flee':
        c.running = true;
        this.steer.move(c, c.x - (dx / (d || 1)) * 6, c.z - (dz / (d || 1)) * 6, run, dt, null);
        if (c.t <= 0) { [c.tx, c.tz] = this.roamFrom(c.herd, Math.max(HERD.roamMin, len * HERD.roam)); c.mode = 'wander'; c.t = 6; }
        break;
      case 'graze':
        c.running = false;
        brake(c, 4, dt);
        this.steer.slide(c, dt);
        if (c.t <= 0) { [c.tx, c.tz] = this.roamFrom(c.herd, Math.max(HERD.roamMin, len * HERD.roam)); c.mode = 'wander'; c.t = 4 + len * 2; }
        break;
      case 'wander':
        c.running = false;
        this.steer.move(c, c.tx, c.tz, sp.walkSpeed * c.size * 0.6, dt, null);
        if (c.t <= 0 || Math.hypot(c.tx - c.x, c.tz - c.z) < Math.max(0.3, len * 0.3)) { c.mode = 'graze'; c.t = this.rng.range(2, 8); }
        break;
    }
    return 0;
  }

  private attack(c: Critter): void {
    c.action = strikeOf(c.species);
    c.actionT = 0;
    c.struck = false;
  }

  private frighten(c: Critter, t: number): void {
    c.mode = 'flee';
    c.t = t;
  }
}
