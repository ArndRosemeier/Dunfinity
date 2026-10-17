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
 * How each species lives comes from its temper (src/creatures/temper.ts), grown with its body: its
 * pace, its flock (a cluster, a procession in single file, a scatter, loners), how curious or shy
 * it is, what its herd does in alarm (bolt, scatter, freeze, bunch up), its nerve and its warning,
 * its habits while it grazes, and what it makes of your headlamp; and between all that, its life
 * as every animal's (src/creatures/life.ts): off to feed, by its diet, and lying down with its herd
 * in their hours of rest.
 *
 * Levels 1 to 10 have them rarely (the hand-made foes rule there); deeper, more often.
 *
 * Pure: floor walking with src/creatures/steer.ts, blows through src/combat. Herds are fixed by the
 * seed; the dead stay dead on this visit.
 */
import { clamp, hash3f } from '@futuremagic/core';
import type { Level } from '../gen/level';
import type { Den } from './population';
import { bestiaryOf, type Species } from './bestiary';
import { habitAction, temperOf, type Strategy } from './temper';
import { Animal, Animals, CALM, HUNTING, type Nature } from './animals';

export const HERD = {
  ...CALM,
  /** Herds: cell size, chance per cell on levels 1–10 and deeper, none this close to the arrival. */
  cell: 70,
  chance: 0.16,
  deeper: 0.3,
  quiet: 35,
  wake: 70,
  sleep: 95,
  /** Health and a blow's damage from mass (kg): k·mass^p. You have 100 health and a knife does 6–10. */
  health: [6, 0.55] as const,
  blow: [2.2, 0.45] as const,
} as const;

/** The hunting kinds: how often a den is theirs, how they find you, and their fair power per level. */
export const HUNT = {
  ...HUNTING,
  /** Share of the dens that are hunters' on levels 1–10 and deeper. */
  share: 0.3,
  deeper: 0.45,
  /** One that comes for you: its fair health on level d, base + per·d, times its strategy's share (one charger is a pack's worth). */
  base: 12,
  per: 2.5,
  strategy: { pack: 1, swarm: 0.35, ambush: 1.4, charge: 3 } as Readonly<Record<Strategy, number>>,
  /** Sizes it may be grown to. */
  size: [0.25, 3] as const,
} as const;

export class Critter extends Animal<Herd> {
  constructor(id: number, herd: Herd, x: number, y: number, z: number, yaw: number, size: number) {
    const sp = herd.species, b = bodyOf(sp, size);
    super(id, herd, natureOf(sp), x, y, z, yaw, size, b.radius, b.height);
  }

  get herd(): Herd { return this.den; }
  get species(): Species { return this.den.species; }
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
  const want = (HUNT.base + HUNT.per * depth) * HUNT.strategy[temperOf(sp).strategy];
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

export class Critters extends Animals<Herd, Critter> {
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
      c.habitT = rng.range(1, 12);
      if (!sp.peaceful && temperOf(sp).strategy === 'ambush') c.mode = 'lurk';
      return c;
    }, body.radius * 0.9 + 0.05, body.height * 0.5625);
  }
  protected natureIn(h: Herd): Nature {
    return natureOf(h.species);
  }
}

const natures = new WeakMap<Species, Nature>();

/** A species' nature (src/creatures/animals.ts), the same object every time. */
export function natureOf(sp: Species): Nature {
  let n = natures.get(sp);
  if (!n) {
    const T = temperOf(sp);
    natures.set(sp, (n = { aggression: sp.aggression, peaceful: sp.peaceful, temper: T, role: sp.role, mass: sp.mass, totalLength: sp.totalLength, walkSpeed: sp.walkSpeed, runSpeed: sp.runSpeed, strike: strikeOf(sp), habit: habitAction(sp, T), power: (size) => powerOf(sp, size) }));
  }
  return n;
}
