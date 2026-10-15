/**
 * A walking, climbing, swimming body on the rock (docs/design/level-generator.md §4.1): the player's
 * movement, pure so the generator's reachability check and tests can run it too.
 *
 * The body is a capsule (three spheres stacked) pushed out of the rock along the field's gradient.
 * Any rock is climbable while stamina lasts, except overhangs (decision L1) and built walls (`level.climbable`). Water deeper than the
 * chest is swum. Landing too hard hurts.
 */
import type { Blockers } from '../blockers';
import type { Level } from '../../gen/level';

/** The body's movement metrics: what the reachability check must assume the player can do. */
export const MOVE = {
  radius: 0.35,
  /** Props lower than this over the feet are stepped over (the body does not stand on props), metres. */
  stepOver: 0.3,
  height: 1.75,
  walk: 4.2,
  sprint: 7,
  /** Speed walking through water deeper than the knees. */
  wade: 2.6,
  /** Walking with the pot lid up. */
  guarded: 2,
  swim: 2.4,
  jump: 6.2,
  gravity: 18,
  climb: 1.7,
  /** Seconds of climbing on a full bar. */
  stamina: 12,
  /** A surface whose normal points up more than this is floor, otherwise wall. */
  floorY: 0.64,
  /** Steeper than this (facing down) is an overhang: nothing to climb. */
  overhangY: -0.35,
  /** Landing faster than this hurts, metres per second (a drop of about 5.4 m). */
  safeImpact: 14,
  /** Damage per m/s over the safe impact speed. */
  impactDamage: 12,
  maxHealth: 100,
  /** Healing: after this many seconds unhurt, health comes back at this many points a second. */
  healAfter: 10,
  healRate: 0.8,
  /** A roll (grandma's Duck card): seconds it takes, its speed at the start, m/s (it slows to a stop). */
  roll: { dur: 0.6, speed: 7 },
} as const;

/** What the player wants this step: move relative to the camera, which faces along `yaw`. */
export interface BodyInput {
  /** -1 … 1: back / forward. */
  forward: number;
  /** -1 … 1: left / right. */
  right: number;
  /** Camera yaw, radians (forward is (-sin yaw, -cos yaw)). */
  yaw: number;
  sprint: boolean;
  /** Tiptoe (grandma's Tiptoe card, if cooked: see `Body.tiptoe`). */
  sneak?: boolean;
  /** Jump pressed (consumed by the step). */
  jump: boolean;
}

export type BodyMode = 'walk' | 'climb' | 'swim';

/** The lid covers blows from this far either side of where the nobody faces, radians. */
const GUARD_ARC = 1.2;

/** Sphere centres above the feet. */
const SPHERES = [MOVE.radius, MOVE.height / 2, MOVE.height - MOVE.radius];

export class Body {
  /** Feet position. */
  x: number;
  y: number;
  z: number;
  vx = 0;
  vy = 0;
  vz = 0;
  mode: BodyMode = 'walk';
  /** Standing on floor this step. */
  grounded = false;
  stamina: number = MOVE.stamina;
  health: number = MOVE.maxHealth;
  /** What climbing costs in stamina, a share of the plain cost (grandma's Kneading card lowers it). */
  climbCost = 1;
  /** What share of a blow hurts (a miner's helmet from Kemal's, src/loot/hardware.ts). */
  armour = 1;
  /** Seconds since a roll began (Infinity: none yet), which way it goes, and the part of it that blows miss (seconds from its start). */
  rollT = Infinity;
  private rollX = 0;
  private rollZ = 0;
  private safe: readonly [number, number] = [0, 0];
  /** Grandma's Tiptoe card, if cooked: speed tiptoeing, m/s, and how far off things notice you then (a share). */
  tiptoe: { readonly speed: number; readonly hush: number } | null = null;
  /** Tiptoeing this step. */
  sneaking = false;
  /** Grandma's pot lid (the Pot Lid card), if cooked: the share of a blow that gets through it, and the stamina a blocked blow costs. */
  lid: { readonly through: number; readonly cost: number } | null = null;
  /** Holding the lid up (set by the game each step; only counts while walking on the floor). */
  guarding = false;
  /** Facing, radians (same convention as the camera yaw). */
  facing = 0;
  /** The wall being climbed: its normal. */
  readonly wall: [number, number, number] = [0, 0, 1];
  /** The last damage taken (for the HUD), when (seconds of body time) and what from ('fall', 'rat', ...). */
  lastHurt = 0;
  hurtAt = -Infinity;
  lastCause = '';
  readonly radius = MOVE.radius;
  readonly height = MOVE.height;
  /** Body time, seconds. */
  time = 0;
  private pushing = 0;
  private restSince = 0;
  private readonly n: [number, number, number] = [0, 0, 0];
  private readonly pushOut: [number, number] = [0, 0];
  /** A climbable wall the capsule touched in the last step, and its normal. */
  private touching = false;
  private readonly touch: [number, number, number] = [0, 0, 0];

  constructor(x: number, y: number, z: number) {
    this.x = x; this.y = y; this.z = z;
  }

  get dead(): boolean { return this.health <= 0; }

  /** A blow from (fromX, fromZ): what gets through the raised lid, if it comes from in front (`Fighter.shield`). */
  shield(fromX: number, fromZ: number): number {
    if (!this.lid || !this.guarding || this.mode !== 'walk' || this.stamina < this.lid.cost) return 1;
    const a = Math.atan2(-(fromX - this.x), -(fromZ - this.z)), d = Math.abs(Math.atan2(Math.sin(a - this.facing), Math.cos(a - this.facing)));
    if (d > GUARD_ARC) return 1;
    this.stamina -= this.lid.cost;
    this.blockedAt = this.time;
    return this.lid.through;
  }

  /** Body time of the last blow the lid stopped. */
  blockedAt = -Infinity;

  /** How far off things notice the nobody, a share of their usual (`Fighter.hush`). */
  get hush(): number { return this.sneaking ? this.tiptoe!.hush : 1; }

  /** Mid-roll. */
  get rolling(): boolean { return this.rollT < MOVE.roll.dur; }

  /** In the part of a roll that blows miss. */
  get evading(): boolean { return this.rollT >= this.safe[0] && this.rollT < this.safe[1]; }

  /**
   * Roll along (dx, dz) (any length): on the floor, walking, not rolling already, and with `stamina`
   * to spare. Blows miss it from `safe[0]` to `safe[1]` seconds in. Returns whether it rolls.
   */
  roll(dx: number, dz: number, stamina: number, safe: readonly [number, number]): boolean {
    const l = Math.hypot(dx, dz);
    if (this.dead || this.mode !== 'walk' || !this.grounded || this.rolling || this.stamina < stamina || l < 1e-6) return false;
    this.stamina -= stamina;
    this.rollX = dx / l; this.rollZ = dz / l;
    this.safe = safe;
    this.rollT = 0;
    this.facing = Math.atan2(-this.rollX, -this.rollZ);
    return true;
  }

  /** Advance by dt seconds (call with small fixed steps, ~1/120 s). `blockers`: the props in the way (src/world/blockers.ts). */
  step(level: Level, input: BodyInput, dt: number, blockers?: Blockers): void {
    this.time += dt;
    this.rollT += dt;
    if (!this.dead && this.time - this.hurtAt > MOVE.healAfter) this.health = Math.min(MOVE.maxHealth, this.health + MOVE.healRate * dt);
    if (this.dead) { input.jump = false; return; }
    const fx = -Math.sin(input.yaw), fz = -Math.cos(input.yaw);
    const rx = Math.cos(input.yaw), rz = -Math.sin(input.yaw);
    let mx = fx * input.forward + rx * input.right, mz = fz * input.forward + rz * input.right;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }

    const water = level.waterAt(this.x, this.z);
    const depth = water - this.y;
    if (this.mode !== 'climb') this.mode = depth > 1.3 || (this.mode === 'swim' && depth > 1.1) ? 'swim' : 'walk';

    this.sneaking = false;
    if (this.mode === 'climb') this.climb(level, input, dt);
    else if (this.mode === 'swim') this.swim(input, mx, mz, water, dt);
    else this.walk(input, mx, mz, depth, dt);

    this.x += this.vx * dt; this.y += this.vy * dt; this.z += this.vz * dt;
    const impact = this.collide(level);
    if (blockers && this.mode !== 'climb') this.collideProps(blockers);
    if (this.mode === 'walk' && impact > MOVE.safeImpact && depth < 1.5) this.hurt((impact - MOVE.safeImpact) * MOVE.impactDamage, 'fall');
    if (this.mode === 'climb' && this.grounded && input.forward < 0) this.mode = 'walk'; // climbed down to the floor

    // Walking into a climbable wall for a moment starts a climb.
    if (this.mode === 'walk' && ml > 0.3 && this.stamina > 0.5) {
      const into = this.touching && (this.touch[0] * mx + this.touch[2] * mz) / ml < -0.5;
      this.pushing = into ? this.pushing + dt : 0;
      if (this.pushing > 0.15) { this.mode = 'climb'; this.vx = this.vy = this.vz = 0; this.pushing = 0; }
    } else this.pushing = 0;

    // Stamina comes back after a moment's rest on the floor.
    if (this.mode === 'climb' || (input.sprint && ml > 0.1 && this.grounded)) this.restSince = this.time;
    else if (this.grounded && this.time - this.restSince > 0.8) this.stamina = Math.min(MOVE.stamina, this.stamina + 3 * dt);
    if (ml > 0.1 && this.mode !== 'climb' && !this.rolling) this.facing = Math.atan2(-mx, -mz);
    input.jump = false;
  }

  /** Take damage: a hard landing, or a blow (through `combat.damage`, src/combat/combat.ts; `armour` takes a share off a blow). */
  hurt(amount: number, cause: string): void {
    if (cause !== 'fall') amount *= this.armour;
    this.health = Math.max(0, this.health - amount);
    this.lastHurt = amount;
    this.hurtAt = this.time;
    this.lastCause = cause;
  }

  private walk(input: BodyInput, mx: number, mz: number, depth: number, dt: number): void {
    if (this.rolling) {
      // A roll goes where it was aimed, whatever the keys say, slowing to a stop.
      const v = MOVE.roll.speed * (1 - (this.rollT / MOVE.roll.dur) ** 2);
      this.vx = this.rollX * v; this.vz = this.rollZ * v;
      this.vy = this.grounded ? Math.min(this.vy, -2) : this.vy - MOVE.gravity * dt;
      return;
    }
    const sprint = input.sprint && this.stamina > 0;
    this.sneaking = !!input.sneak && !!this.tiptoe && !sprint && depth <= 0.5 && this.grounded;
    const speed = depth > 0.5 ? MOVE.wade : sprint && !this.guarding ? MOVE.sprint : this.guarding ? MOVE.guarded : this.sneaking ? this.tiptoe!.speed : MOVE.walk;
    if (sprint && this.grounded && Math.hypot(mx, mz) > 0.1) this.stamina = Math.max(0, this.stamina - 0.5 * dt);
    const accel = this.grounded ? 30 : 5;
    this.vx += clampStep(mx * speed - this.vx, accel * dt);
    this.vz += clampStep(mz * speed - this.vz, accel * dt);
    this.vy -= MOVE.gravity * dt;
    if (this.grounded) {
      if (input.jump) this.vy = MOVE.jump;
      else this.vy = Math.min(this.vy, -2); // stick to the floor walking downhill
    }
  }

  private swim(input: BodyInput, mx: number, mz: number, water: number, dt: number): void {
    // Float with the head out of the water.
    const target = water - 1.4;
    this.vy += ((target - this.y) * 8 - this.vy * 3) * dt;
    this.vx += clampStep(mx * MOVE.swim - this.vx, 6 * dt);
    this.vz += clampStep(mz * MOVE.swim - this.vz, 6 * dt);
    if (input.jump) this.vy = 3; // a kick, to climb out onto a shore
  }

  private climb(level: Level, input: BodyInput, dt: number): void {
    const cy = this.y + SPHERES[1];
    const d = level.sdf(this.x, cy, this.z);
    const n = level.normal(this.x, cy, this.z, this.n);
    if (d > MOVE.radius + 0.6 || n[1] > MOVE.floorY || n[1] < MOVE.overhangY || this.stamina <= 0) {
      // Off the wall: over the top (a mantle onto the ledge), or let go.
      const over = d > MOVE.radius + 0.6 && input.forward > 0;
      this.mode = 'walk';
      this.vx = over ? -this.wall[0] * 2.5 : this.wall[0] * 0.5;
      this.vz = over ? -this.wall[2] * 2.5 : this.wall[2] * 0.5;
      this.vy = over ? 4.5 : 0;
      return;
    }
    this.wall[0] = n[0]; this.wall[1] = n[1]; this.wall[2] = n[2];
    if (input.forward < -0.5 && input.jump) { this.mode = 'walk'; input.jump = false; return; } // let go
    // Up the wall, and sideways along it.
    let ux = -n[0] * n[1], uy = 1 - n[1] * n[1], uz = -n[2] * n[1];
    const ul = Math.hypot(ux, uy, uz) || 1;
    ux /= ul; uy /= ul; uz /= ul;
    const hl = Math.hypot(n[0], n[2]) || 1;
    const sx = -n[2] / hl, sz = n[0] / hl; // (-n) × up, horizontal
    const moving = Math.abs(input.forward) > 0.1 || Math.abs(input.right) > 0.1;
    if (input.jump && this.stamina > 2 * this.climbCost) {
      this.stamina -= 2 * this.climbCost;
      if (input.forward > 0) { this.vx = ux * 5; this.vy = uy * 5; this.vz = uz * 5; return; } // a lunge up
      this.mode = 'walk'; // push off the wall
      this.vx = n[0] * 4; this.vy = 3; this.vz = n[2] * 4;
      return;
    }
    this.stamina = Math.max(0, this.stamina - (moving ? 1 : 0.35) * this.climbCost * dt);
    const v = MOVE.climb;
    // Stay snug against the rock.
    const snug = (d - MOVE.radius - 0.04) * 6;
    const tx = (ux * input.forward + sx * input.right) * v - n[0] * snug;
    const ty = uy * input.forward * v - n[1] * snug;
    const tz = (uz * input.forward + sz * input.right) * v - n[2] * snug;
    this.vx += clampStep(tx - this.vx, 20 * dt);
    this.vy += clampStep(ty - this.vy, 20 * dt);
    this.vz += clampStep(tz - this.vz, 20 * dt);
  }

  /** Push the capsule out of the props (not what it can step over), and stop the speed into them. */
  private collideProps(blockers: Blockers): void {
    const p = this.pushOut;
    if (!blockers.pushOut(this.x, this.z, MOVE.radius, this.y + MOVE.stepOver, this.y + MOVE.height, p)) return;
    this.x += p[0]; this.z += p[1];
    const l = Math.hypot(p[0], p[1]);
    if (l < 1e-6) return;
    const vn = (this.vx * p[0] + this.vz * p[1]) / l;
    if (vn < 0) { this.vx -= (p[0] / l) * vn; this.vz -= (p[1] / l) * vn; }
  }

  /** Push the capsule out of the rock; returns the speed it hit the rock with. */
  private collide(level: Level): number {
    let impact = 0;
    this.grounded = false;
    this.touching = false;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const h of SPHERES) {
        const cy = this.y + h;
        const d = level.sdf(this.x, cy, this.z);
        if (d >= MOVE.radius) continue;
        const n = level.normal(this.x, cy, this.z, this.n);
        const push = MOVE.radius - d;
        // Out of a floor straight up (no sliding down slopes while standing), out of a wall along its normal.
        if (n[1] > MOVE.floorY) this.y += push / n[1];
        else { this.x += n[0] * push; this.y += n[1] * push; this.z += n[2] * push; }
        if (n[1] <= MOVE.floorY && n[1] > MOVE.overhangY && level.climbable(this.x, cy, this.z)) { this.touch[0] = n[0]; this.touch[1] = n[1]; this.touch[2] = n[2]; this.touching = true; }
        const vn = this.vx * n[0] + this.vy * n[1] + this.vz * n[2];
        if (vn < 0) {
          impact = Math.max(impact, -vn);
          // On a floor only the vertical speed goes (walking keeps its pace up and down slopes);
          // a wall takes the part of the velocity that goes into it.
          if (n[1] > MOVE.floorY) this.vy -= vn / n[1];
          else { this.vx -= n[0] * vn; this.vy -= n[1] * vn; this.vz -= n[2] * vn; }
        }
        if (n[1] > MOVE.floorY) this.grounded = true;
        moved = true;
      }
      if (!moved) break;
    }
    return impact;
  }
}

function clampStep(delta: number, max: number): number {
  return Math.max(-max, Math.min(max, delta));
}
