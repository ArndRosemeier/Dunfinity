/**
 * Grandma's Salt Pet (src/loot/recipes.ts, Company): a handful of infused salt poured on the floor
 * stands up as an animal made of it, a salty quarry rat (rank 1) or a salty feral dog (rank 2), that
 * keeps at the nobody's heel and goes for what comes at them (or the Tab target) until it dies. It
 * mends like the nobody does, slowly, once it has not been hurt for a while. Whatever it bites turns
 * on it (`Creature.grudge`), so it can be killed; it crumbles back into salt then.
 *
 * Built never to jitter (Arnd's rule): it follows only once the nobody is well off and stops at
 * heel, closing on the line from whom it goes to (`Steer.close`); it keeps its quarry until it is
 * dead or far off. One the nobody has left far behind (up a ladder, a ledge it cannot take) falls
 * to salt there and stands up again at their side.
 *
 * Pure: floor walking with src/creatures/steer.ts, bites through src/combat.
 */
import { angleDiff, type Rng } from '@futuremagic/core';
import { Creature, GRUDGE } from './creature';
import { Steer, brake, thwarted } from './steer';
import type { Level } from '../gen/level';
import { damage, type Fighter } from '../combat/combat';
import { RAT } from './rats';
import { DOG } from './dogs';
import type { PetKind } from '../loot/recipes';

/** Each kind: its name, its size (on its kind's body), health, speeds, m/s (you walk 4.2 and sprint 7), and its bite (damage, seconds between, the wind-up before the snap, reach beyond touching). */
export const PETS = {
  rat: { name: 'Salt rat', size: 1.35, health: 45, walk: 3.6, run: 7.4, bite: [6, 9] as const, every: 1.1, windup: 0.25, reach: 0.35, rear: 0.6, lunge: 2.6 },
  dog: { name: 'Salt dog', size: 1.05, health: 90, walk: 4, run: 8, bite: [11, 16] as const, every: 1.3, windup: 0.3, reach: 0.45, rear: 0.8, lunge: 4 },
} as const;

export const PET = {
  /** It stands this far from the nobody (from centre to centre, past both radii), follows once they are this much further, and runs once further still, metres. */
  heel: 1.1,
  follow: 1.6,
  hurry: 6,
  /** It goes for what comes at the nobody within `guard` of them, and lets its quarry go beyond `forget` of them, metres. */
  guard: 9,
  forget: 16,
  /** Left this far behind (or getting nowhere after the nobody this long, seconds), it falls to salt and stands up at their side. */
  leash: 30,
  lost: 3,
  /** Seconds it takes to stand up out of the salt; to fall back into it, dead. */
  form: 1.2,
  crumble: 2.4,
  /** It mends like the nobody: after this long unhurt, seconds, this share of its health a second (the nobody's 0.8 of 100). */
  healAfter: 10,
  healRate: 0.008,
  /** How fast its gait turns over with distance (as the rat's and the dog's do). */
  stride: { rat: 0.09, dog: 0.16 },
} as const;

/** What a pet is doing: standing up out of the salt, at heel, following, going for its quarry, biting, and dead (crumbling). */
export type PetMode = 'form' | 'heel' | 'follow' | 'fight' | 'bite' | 'dead';

export class Pet extends Creature<PetMode> {
  /** Seconds in the current mode (standing up, crumbling); since the last bite began; since it was last hurt. */
  t = 0;
  biteT = 9;
  /** Gait phase (radians), advanced by distance travelled. */
  gait = 0;
  /** What it goes for (null: nothing). */
  quarry: Fighter | null = null;
  /** Seconds it has got nowhere after the nobody. */
  lost = 0;
  readonly maxHealth: number;
  readonly size: number;
  /** What it is called ('Salt rat'). */
  readonly name: string;

  constructor(readonly kind: PetKind, x: number, y: number, z: number, yaw: number) {
    const k = PETS[kind], body = kind === 'rat' ? RAT : DOG;
    super(x, y, z, yaw, body.radius * k.size, body.height * k.size, k.health, 'form');
    this.maxHealth = k.health;
    this.size = k.size;
    this.name = k.name;
  }
}

/** The pet kept in the save (src/persist/save.ts): what it is and how hurt. */
export interface PetData {
  readonly kind: PetKind;
  readonly health: number;
}

/** Whom the pet keeps by: where they are and which way they face. */
export type Owner = Fighter & { readonly facing?: number };

export class Pets {
  /** The pet (one at a time), the dead one crumbling included. */
  readonly list: Pet[] = [];
  private steer: Steer;

  constructor(private level: Level) {
    this.steer = Pets.steerOn(level);
  }

  private static steerOn(level: Level): Steer {
    return new Steer(level, { arrive: 0.6, still: 0.08, step: RAT.step, drop: RAT.drop, accel: 9, turn: 10, face: 12, probe: 1.1 });
  }

  /** The level shown changed: the pet comes along, standing up again at the nobody's side on the next step (a dead one stays behind). */
  moveTo(level: Level): void {
    this.level = level;
    this.steer = Pets.steerOn(level);
    for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].dead) this.list.splice(i, 1);
    this.moved = true;
  }

  /** Gone with the grandchild. */
  clear(): void {
    this.list.length = 0;
  }

  /** The level changed since the last step. */
  private moved = false;

  /** The living pet, if any. */
  get alive(): Pet | null {
    return this.list.find((p) => !p.dead) ?? null;
  }

  /** The living pet, for the save (null: none). */
  get data(): PetData | null {
    const p = this.alive;
    return p ? { kind: p.kind, health: p.health } : null;
  }

  /** The kept pet comes back (as hurt as it was), standing up at the nobody's side on the next step. */
  restore(d: PetData | null | undefined): void {
    if (!d || !Object.hasOwn(PETS, d.kind) || this.alive) return;
    const p = this.summon(d.kind, 0, 0, 0, 0);
    p.health = Math.min(p.maxHealth, Math.max(1, d.health));
    this.moved = true;
  }

  /** Salt poured at (x, y, z) stands up as a pet of `kind` facing `yaw`. */
  summon(kind: PetKind, x: number, y: number, z: number, yaw: number): Pet {
    const p = new Pet(kind, x, y, z, yaw);
    this.list.push(p);
    return p;
  }

  /** Step by dt: keep by `owner`, go for `threats` (the ones after them) or the Tab `target`; `rng` rolls the bites. Returns those bitten. */
  accompany(dt: number, owner: Owner, threats: readonly Fighter[], target: Fighter | null, rng: Rng): Fighter[] {
    this.steer.keepOff = owner;
    if (this.moved) { this.moved = false; for (const p of this.list) this.reform(p, owner.x, owner.y, owner.z); }
    const bitten: Fighter[] = [];
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t += dt;
      p.biteT += dt;
      p.hurtT += dt;
      p.provoked = false;
      if (p.dead) {
        p.deadT += dt;
        brake(p, 6, dt);
        this.steer.slide(p, dt);
        if (p.deadT > PET.crumble) this.list.splice(i, 1);
        continue;
      }
      // It mends like the nobody does.
      if (p.hurtT > PET.healAfter) p.health = Math.min(p.maxHealth, p.health + p.maxHealth * PET.healRate * dt);
      const hit = this.tend(p, owner, threats, target, rng, dt);
      if (hit) bitten.push(hit);
    }
    return bitten;
  }

  private tend(p: Pet, owner: Owner, threats: readonly Fighter[], target: Fighter | null, rng: Rng, dt: number): Fighter | null {
    const k = PETS[p.kind], od = Math.hypot(owner.x - p.x, owner.z - p.z);
    if (p.mode === 'form') {
      brake(p, 8, dt);
      this.steer.slide(p, dt);
      if (p.t >= PET.form) this.enter(p, 'heel');
      return null;
    }
    // Far behind, or getting nowhere after them: it falls to salt and stands up at their side.
    p.lost = (p.mode === 'follow' && thwarted(p)) || Math.abs(owner.y - p.y) > 3 ? p.lost + dt : 0;
    if (!owner.dead && (od > PET.leash || p.lost > PET.lost)) { this.reform(p, owner.x, owner.y, owner.z); return null; }
    // Its quarry: kept while alive and near the nobody; else the Tab target, or the nearest of what comes at them.
    const q = p.quarry;
    if (q && (q.dead || Math.hypot(q.x - owner.x, q.z - owner.z) > PET.forget || thwarted(p))) p.quarry = null;
    if (!p.quarry && !owner.dead) {
      const guarded = (f: Fighter) => !f.dead && Math.hypot(f.x - owner.x, f.z - owner.z) < PET.guard && Math.abs(f.y - p.y) < 3;
      if (target && guarded(target)) p.quarry = target;
      else {
        let best = Infinity;
        for (const f of threats) {
          const d = Math.hypot(f.x - p.x, f.z - p.z);
          if (guarded(f) && d < best) { best = d; p.quarry = f; }
        }
      }
    }
    const t = p.quarry;
    if (p.mode === 'bite') {
      // Rear back in the wind-up, lunge in with the snap.
      const dx = (t?.x ?? p.x) - p.x, dz = (t?.z ?? p.z) - p.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
      if (p.biteT < k.windup) { p.vx = -ux * k.rear; p.vz = -uz * k.rear; }
      else if (p.biteT < k.windup + 0.12) { p.vx = ux * k.lunge; p.vz = uz * k.lunge; }
      else brake(p, 10, dt);
      if (t) p.yaw += angleDiff(p.yaw, Math.atan2(-dx, -dz)) * Math.min(1, dt * 15);
      let hit: Fighter | null = null;
      if (t && p.biteT >= k.windup && p.biteT - dt < k.windup && d - t.radius - p.radius < k.reach + 0.25 && Math.abs(t.y - p.y) < 1.5) {
        damage(t, rng.range(k.bite[0], k.bite[1]), p.x, p.z, 1, GRUDGE);
        // Bitten, it turns on the pet.
        if ('grudge' in t) (t as { grudge: Fighter | null }).grudge = p;
        hit = t;
      }
      p.gait += this.steer.slide(p, dt) / (PET.stride[p.kind] * p.size);
      if (p.biteT > k.windup + 0.35) this.enter(p, t ? 'fight' : 'heel');
      return hit;
    }
    if (t) {
      if (p.mode !== 'fight') this.enter(p, 'fight');
      const stand = t.radius + p.radius + 0.05, d = Math.hypot(t.x - p.x, t.z - p.z);
      if (d - stand < k.reach && p.biteT > k.every) { this.enter(p, 'bite'); p.biteT = 0; return null; }
      const x0 = p.x, z0 = p.z;
      this.steer.close(p, t, stand, k.run, dt, 1.5);
      p.gait += Math.hypot(p.x - x0, p.z - z0) / (PET.stride[p.kind] * p.size);
      return null;
    }
    // At heel: follows once they are well off, at a run if far, and stops at heel.
    const heel = owner.radius + p.radius + PET.heel;
    if (p.mode === 'fight') this.enter(p, 'follow');
    if (p.mode === 'heel' && od > heel + PET.follow) this.enter(p, 'follow');
    if (p.mode === 'follow' && od <= heel + 0.15) this.enter(p, 'heel');
    if (p.mode === 'follow') {
      const x0 = p.x, z0 = p.z;
      this.steer.close(p, owner, heel, od > heel + PET.hurry ? k.run : k.walk, dt, 0.5);
      p.gait += Math.hypot(p.x - x0, p.z - z0) / (PET.stride[p.kind] * p.size);
    } else {
      brake(p, 8, dt);
      p.gait += this.steer.slide(p, dt) / (PET.stride[p.kind] * p.size);
      // Standing by, it looks the way they look.
      if (owner.facing !== undefined) p.yaw += angleDiff(p.yaw, owner.facing) * Math.min(1, dt * 2);
    }
    return null;
  }

  /** It falls to salt and stands up again next to (x, y, z). */
  private reform(p: Pet, x: number, y: number, z: number): void {
    const a = p.yaw + 2.2;
    p.x = x - Math.sin(a) * (PET.heel + 0.4); p.z = z - Math.cos(a) * (PET.heel + 0.4);
    const g = this.level.groundAt(p.x, p.z, y + 1);
    p.y = Math.abs(g - y) < 1 ? g : y;
    if (Math.abs(p.y - y) >= 1 || !this.steer.walkable(p, p.x, p.z)) { p.x = x; p.z = z; p.y = y; }
    p.vx = p.vz = 0;
    p.quarry = null;
    p.lost = 0;
    this.enter(p, 'form');
  }

  private enter(p: Pet, mode: PetMode): void {
    p.mode = mode;
    p.t = 0;
  }
}
