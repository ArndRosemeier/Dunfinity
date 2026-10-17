/**
 * Suns: big burning lights, not quite round, that now and then rise out of the glowing rock and
 * wander the level for minutes, bobbing up and down as they go, lighting the halls wide around them.
 * Prominences swell on them and break off, falling as burning drops. At the end a sun sinks low and
 * shrinks to nothing. One can hang from a sun (E) and fly along: let go (E again), or when it goes
 * out, and the fall is one's own lookout (`Body.featherfall` softens it).
 *
 * Never foes. As often as the level's rock glows (`glowOf`, src/creatures/wisps.ts). Their light is
 * borrowed from the lamp pool (src/render/props/lamps.ts), so they never add a light or a shader.
 *
 * Pure: the level's field only (src/render/creatures/sunView.ts draws them).
 */
import { Rng, damp, deriveSeed, smoothstep } from '@futuremagic/core';
import type { Level } from '../gen/level';
import { glowOf } from './wisps';

export const SUN = {
  /** At most this many at once. */
  most: 2,
  /** Seconds between births on fully glowing rock (min, max); fainter rock waits longer (÷ strength). None below `faint`. */
  gap: [80, 160] as const,
  faint: 0.05,
  /** Seconds until it looks again when no rock in reach had room for one. */
  retry: 3,
  /** Born out of rock this far from the viewer, m (min, max). */
  reach: [12, 40] as const,
  /** Seconds it lives, from its birth to nothing (min, max): about five minutes. */
  life: [270, 330] as const,
  /** Seconds it takes to come out of the rock, growing; the last seconds, sinking and shrinking. */
  rise: 6,
  end: 25,
  /** Its radius, m (min, max): from a ball 1 m across to one of 4 m, small ones the commonest. */
  radius: [0.5, 2.0] as const,
  /** Its speed across the level, m/s: it wanders between these, slowly. */
  speed: [0.4, 2.6] as const,
  /** How high its underside rides over the floor, m (it wanders between these), and its bob up and down: how far, m, and its period, s (min, max). */
  clearance: [2.2, 6.5] as const,
  bob: 0.9,
  /** Carrying someone, its underside rises this high over the floor, m: high enough that letting go is a fall to fear. */
  carry: 13,
  bobPeriod: [5, 8] as const,
  /** Space it keeps between its surface and the rock, m. */
  keep: 1.8,
  /** How far ahead it looks for rock in its way, m. */
  look: 5,
  /** Further off the viewer than this, m, it turns back towards them (so it does not wander off for good). */
  leash: 70,
  /** Its light: brightness and reach (m) of a middling one (radius 1.25 m): wide, it shows the halls round it. Bigger ones light farther (`lightOf`). */
  light: 45,
  lightReach: 45,
  /** It reveals the map round where it is (`Explored.see`) this far, m, while this near the viewer, m. */
  reveal: 18,
  revealNear: 60,
  /** Prominences: seconds between them (min, max), seconds one swells before it breaks off, its size (share of the radius), the drops' fall (m/s²) and how long one may fall, s. */
  flare: [2.5, 7] as const,
  swell: 2.2,
  flareSize: 0.32,
  fall: 4,
  fallFor: 8,
  /** Seconds a drop splashes on the floor. */
  splash: 0.35,
  /** Hanging from it: the hands this far into its underside, m; the feet this far under the hands, m; reached by hands within this, m. */
  grip: 0.25,
  hang: 2.05,
  grab: 1.3,
} as const;

/** A prominence: swelling on the sun's surface along (dx, dy, dz), then a burning drop falling free. */
export interface Flare {
  readonly dx: number; readonly dy: number; readonly dz: number;
  /** Seconds since it began to swell. */
  age: number;
  /** Once broken off: where the drop is, its fall speed, and the seconds since it splashed (-1: still falling). */
  x: number; y: number; z: number; vy: number;
  splashed: number;
  readonly size: number;
}

export interface Sun {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  /** Its full radius, m; seconds since birth; seconds it lives; its wanders' phase (0–1). */
  readonly r: number;
  age: number;
  readonly life: number;
  readonly phase: number;
  /** Where it came out of the rock, and the rock's normal there. */
  readonly ox: number; readonly oy: number; readonly oz: number;
  readonly nx: number; readonly ny: number; readonly nz: number;
  readonly flares: Flare[];
  /** Seconds until its next prominence. */
  nextFlare: number;
  /** Someone hangs from it (set by the game): it climbs higher (`SUN.carry`). */
  ridden: boolean;
}

/** A sun's light now: brightness and reach, m, by its size (a 4 m one lights about twice as far as a 1 m one). */
export function lightOf(s: Sun): { intensity: number; reach: number } {
  const k = sizeOf(s) / 1.25;
  return { intensity: SUN.light * Math.min(1.6, k), reach: SUN.lightReach * Math.min(1.35, 0.6 + 0.4 * k) };
}

/** A sun's radius now: growing as it comes out, shrinking to nothing at its end. */
export function sizeOf(s: Sun): number {
  const grow = smoothstep(0, SUN.rise, s.age), shrink = 1 - smoothstep(s.life - SUN.end, s.life, s.age);
  return s.r * (0.15 + 0.85 * grow) * Math.sqrt(Math.max(0, shrink));
}

/** Where a sun's prominence stands out of it (its swelling blob's centre and radius), while it swells. */
export function flareAt(s: Sun, f: Flare): { x: number; y: number; z: number; r: number } {
  const k = Math.min(1, f.age / SUN.swell), r = sizeOf(s), fr = f.size * r * smoothstep(0, 1, k);
  const out = r * (0.85 + 0.35 * k);
  return { x: s.x + f.dx * out, y: s.y + f.dy * out, z: s.z + f.dz * out, r: fr };
}

/** Where the feet of someone hanging from sun `s` are. */
export function hangOf(s: Sun, out: [number, number, number]): [number, number, number] {
  out[0] = s.x; out[1] = s.y - sizeOf(s) + SUN.grip - SUN.hang; out[2] = s.z;
  return out;
}

export class Suns {
  readonly list: Sun[] = [];
  /** Born since last asked, and drops splashed since last asked (for sounds): the caller empties them. */
  readonly risen: Sun[] = [];
  readonly splashed: Flare[] = [];
  readonly strength: number;
  private readonly rng: Rng;
  private wait: number;
  private readonly n: [number, number, number] = [0, 1, 0];

  constructor(private readonly level: Level) {
    this.strength = glowOf(level).strength;
    this.rng = new Rng(deriveSeed(level.seed, 'suns', level.depth));
    this.wait = this.gap() * 0.25; // the first one comes sooner
  }

  /** Step `dt` seconds round a viewer whose head is at (x, y, z), looking along (fx, fz). */
  advance(dt: number, x: number, y: number, z: number, fx: number, fz: number): void {
    if (this.strength >= SUN.faint) {
      this.wait -= dt;
      if (this.wait <= 0) this.wait = this.list.length >= SUN.most || this.bear(x, y, z, fx, fz) ? this.gap() : SUN.retry;
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i];
      s.age += dt;
      this.flaresOf(s, dt);
      if (s.age >= s.life && !s.flares.length) { this.list.splice(i, 1); continue; }
      if (s.age < s.life) this.drift(s, dt, x, z);
    }
  }

  /** A sun whose underside the hands of a body standing at (x, y, z) can reach, if any. */
  reach(x: number, y: number, z: number): Sun | null {
    const hy = y + MOVE_REACH;
    for (const s of this.list) {
      if (s.age < SUN.rise || s.age > s.life - SUN.end * 0.5) continue;
      const r = sizeOf(s), d = Math.hypot(s.x - x, s.y - r - hy, s.z - z);
      if (d < SUN.grab) return s;
    }
    return null;
  }

  /** Call a sun into being out of the rock round (x, y, z) now (the debug menu); whether one came. */
  call(x: number, y: number, z: number, fx: number, fz: number): boolean {
    if (this.list.length >= SUN.most) return false;
    for (let i = 0; i < 6; i++) if (this.bear(x, y, z, fx, fz)) return true;
    return false;
  }

  private gap(): number {
    return this.rng.range(SUN.gap[0], SUN.gap[1]) / Math.max(this.strength, SUN.faint);
  }

  /** A new one out of rock round the viewer, where there is room for it to come out. */
  private bear(x: number, y: number, z: number, fx: number, fz: number): boolean {
    const level = this.level, rng = this.rng, ahead = Math.atan2(fz, fx);
    for (let tries = 0; tries < 12; tries++) {
      const yaw = rng.chance(0.7) ? ahead + rng.range(-1.2, 1.2) : rng.range(0, Math.PI * 2);
      const pitch = rng.range(-0.15, 0.5), cp = Math.cos(pitch);
      const dx = Math.cos(yaw) * cp, dy = Math.sin(pitch), dz = Math.sin(yaw) * cp;
      const t = level.trace(x, y, z, dx, dy, dz, SUN.reach[1]);
      if (t < SUN.reach[0] || t >= SUN.reach[1]) continue;
      const hx = x + dx * t, hy = y + dy * t, hz = z + dz * t;
      if (hy < level.waterAt(hx, hz) + 0.5) continue;
      const [nx, ny, nz] = level.normal(hx, hy, hz, this.n);
      const r = SUN.radius[0] + (SUN.radius[1] - SUN.radius[0]) * rng.float() ** 1.4;
      // Room to come out: where it will float free of the rock is open air.
      const out = r + SUN.keep;
      if (level.sdf(hx + nx * out, hy + ny * out, hz + nz * out) < r + 0.6) continue;
      const s: Sun = {
        x: hx + nx * 0.2, y: hy + ny * 0.2, z: hz + nz * 0.2, vx: 0, vy: 0, vz: 0, r,
        age: 0, life: rng.range(SUN.life[0], SUN.life[1]), phase: rng.float(),
        ox: hx, oy: hy, oz: hz, nx, ny, nz, flares: [], nextFlare: rng.range(SUN.flare[0], SUN.flare[1]) + SUN.rise, ridden: false,
      };
      this.list.push(s);
      this.risen.push(s);
      return true;
    }
    return false;
  }

  private drift(s: Sun, dt: number, x: number, z: number): void {
    const level = this.level, t = s.age, p = s.phase * 6.283, r = sizeOf(s);
    let tx: number, ty: number, tz: number;
    if (t < SUN.rise) {
      // Coming out of the rock along its normal, slowly, as it grows.
      const k = 0.6 * (1 - t / SUN.rise) + 0.25;
      tx = s.nx * k; ty = s.ny * k + 0.15; tz = s.nz * k;
    } else {
      // Across the level: a heading and a speed that wander slowly, back towards the viewer when far.
      let yaw = p + 1.1 * Math.sin(t * 0.031 + p * 3) + 0.7 * Math.sin(t * 0.077 + p * 7);
      const away = Math.hypot(s.x - x, s.z - z);
      if (away > SUN.leash) {
        const home = Math.atan2(z - s.z, x - s.x), k = Math.min(1, (away - SUN.leash) / 30);
        yaw += Math.atan2(Math.sin(home - yaw), Math.cos(home - yaw)) * k;
      }
      const u = 0.5 + 0.5 * Math.sin(t * 0.043 + p * 5) * Math.cos(t * 0.019 + p);
      const speed = SUN.speed[0] + (SUN.speed[1] - SUN.speed[0]) * u;
      tx = Math.cos(yaw) * speed; tz = Math.sin(yaw) * speed;
      // Up and down: its height over the floor wanders, it bobs, and at its end it sinks low.
      const clear = s.ridden ? SUN.carry : SUN.clearance[0] + (SUN.clearance[1] - SUN.clearance[0]) * (0.5 + 0.5 * Math.sin(t * 0.023 + p * 11));
      const period = SUN.bobPeriod[0] + (SUN.bobPeriod[1] - SUN.bobPeriod[0]) * s.phase;
      const sink = smoothstep(s.life - SUN.end, s.life, t);
      const height = clear * (1 - sink) + 0.4 * sink + SUN.bob * Math.sin((t * 2 * Math.PI) / period + p) * (1 - sink);
      // Over open void (between floating islands) it holds its height: it never sinks into the dark.
      const floor = level.groundAt(s.x, s.z, s.y), want = floor < s.y - 30 ? s.y : floor + r + height;
      ty = Math.max(-1.5, Math.min(1.5, (want - s.y) * 0.6));
    }
    // Clear of the rock: pushed off it when close (the walls and the roof alike), and turned from
    // rock a few seconds ahead before it gets there.
    const d = level.sdf(s.x, s.y, s.z) - r;
    if (d < SUN.keep) {
      const [nx, ny, nz] = level.normal(s.x, s.y, s.z, this.n);
      const off = (SUN.keep - d) * 2;
      tx += nx * off; ty += ny * off; tz += nz * off;
    }
    const v = Math.hypot(s.vx, s.vy, s.vz);
    if (v > 0.05 && t >= SUN.rise) {
      const look = SUN.look / v, ax = s.x + s.vx * look, ay = s.y + s.vy * look, az = s.z + s.vz * look;
      const da = level.sdf(ax, ay, az) - r;
      if (da < SUN.keep) {
        const [nx, ny, nz] = level.normal(ax, ay, az, this.n);
        const off = (SUN.keep - da) * 0.8;
        tx += nx * off; ty += ny * off; tz += nz * off;
      }
    }
    const a = damp(1, dt);
    s.vx += (tx - s.vx) * a; s.vy += (ty - s.vy) * a; s.vz += (tz - s.vz) * a;
    s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    // Never into the rock: out of it along the normal if it got in (a corner it could not see).
    if (t >= SUN.rise) {
      const g = level.sdf(s.x, s.y, s.z) - r;
      if (g < 0.3) {
        const [nx, ny, nz] = level.normal(s.x, s.y, s.z, this.n);
        s.x += nx * (0.3 - g); s.y += ny * (0.3 - g); s.z += nz * (0.3 - g);
      }
    }
  }

  private flaresOf(s: Sun, dt: number): void {
    const rng = this.rng;
    if (s.age < s.life - SUN.end) {
      s.nextFlare -= dt;
      if (s.nextFlare <= 0) {
        s.nextFlare = rng.range(SUN.flare[0], SUN.flare[1]);
        // Mostly from its sides and underside: what breaks off falls.
        const yaw = rng.range(0, Math.PI * 2), dy = rng.range(-0.9, 0.4), c = Math.sqrt(1 - dy * dy);
        s.flares.push({ dx: Math.cos(yaw) * c, dy, dz: Math.sin(yaw) * c, age: 0, x: 0, y: 0, z: 0, vy: 0, splashed: -1, size: rng.range(0.7, 1.2) * SUN.flareSize });
      }
    }
    for (let i = s.flares.length - 1; i >= 0; i--) {
      const f = s.flares[i];
      const was = f.age;
      f.age += dt;
      if (was < SUN.swell && f.age >= SUN.swell) {
        // It breaks off where it stood, with the sun's own drift.
        const at = flareAt(s, { ...f, age: SUN.swell });
        f.x = at.x; f.y = at.y; f.z = at.z; f.vy = s.vy;
      }
      if (f.age < SUN.swell) continue;
      if (f.splashed >= 0) {
        f.splashed += dt;
        if (f.splashed >= SUN.splash) s.flares.splice(i, 1);
        continue;
      }
      f.vy -= SUN.fall * dt;
      f.x += s.vx * 0.3 * dt; f.y += f.vy * dt; f.z += s.vz * 0.3 * dt;
      if (f.y <= this.level.groundAt(f.x, f.z, f.y + 0.5) || this.level.sdf(f.x, f.y, f.z) < 0.05 || f.age - SUN.swell > SUN.fallFor) {
        f.splashed = 0;
        this.splashed.push(f);
      }
    }
  }
}

/** How high over its feet a standing body's hands reach, arms up, m. */
const MOVE_REACH = 2.15;
