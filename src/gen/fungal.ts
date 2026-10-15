/**
 * The fungal grotto style (catalog §3.3; Arnd's "real underground biomes"): wet, warm caves
 * overgrown with giant mushrooms. Rounded chambers and tubes (the karst's own shape, from its own
 * seed) full of mushrooms from knee-high to 14 m: a pale stalk under a broad domed cap, the big
 * caps wide and flat enough to climb onto and walk across, a second storey over the loam floor.
 * The caps take the stratum's hue; their gills glow faintly.
 *
 * A cap is a spherical cap (a ball cut flat underneath), a stalk a capsule: both within 1-Lipschitz
 * bounds. Envelope (E1): the cave's floor and roof; the mushrooms are things in its chambers
 * (src/gen/caveThings.ts).
 *
 * Pure, like every style.
 */
import { Noise, deriveSeed, hashToFloat, smoothstep } from '@futuremagic/core';
import type { Band } from './bands';
import { CaveThings, THING_REACH, karstChambers, type Chamber } from './caveThings';
import { Karst } from './karst';
import type { Column } from './quarry';
import { rockMix } from './rockTypes';
import type { Style, StyleId } from './style';
import { propModel, type ModelName } from './models';
import { scatter, type Dress } from './styleProps';

export const FUNGAL = {
  /** Mushrooms per 100 m² of chamber floor (min, extra). */
  density: [0.8, 0.4] as const,
  /** A cap's underside over the floor, metres: more low than high (min, extra; the draw to the power 1.4). */
  height: [1.2, 11] as const,
  /** The cap's radius: this much per metre of height, plus (min, extra); how high it domes: of its radius, plus metres (broad, nearly flat tops to walk on). */
  capPer: 0.35,
  cap: [1, 1.5] as const,
  dome: [0.12, 0.1, 0.7] as const,
  /** The stalk's radius: this much of the cap's, at least this. */
  stalk: [0.14, 0.25] as const,
  /** Mushrooms stand no further than this many chamber radii from its middle, and under this much of its dome. */
  spread: 0.75,
  under: 0.65,
} as const;

/** One mushroom: its stalk's foot, the cap's underside height and radius, the ball the cap is cut from, its hue. */
interface Shroom {
  x: number;
  z: number;
  foot: number;
  base: number;
  r: number;
  ball: number;
  by: number;
  stalk: number;
  hue: number;
}

export class Fungal implements Style {
  readonly id: StyleId = 'fungal';
  /** The rock it is cut through (src/gen/rockTypes.ts). */
  readonly rocks = rockMix({ shale: 0.45, limestone: 0.35, slate: 0.2 });
  /** Violet on the map (M). */
  readonly mapFloor = [0.55, 0.42, 0.62] as const;
  private readonly cave: Karst;
  private readonly noise: Noise;
  private readonly shrooms: CaveThings<Shroom>;
  /** The level's mushroom hue, 0..1 round the wheel of CAP_HUES. */
  private readonly hue: number;

  constructor(readonly seed: number, readonly band: Band) {
    this.cave = new Karst(deriveSeed(seed, 'fungal', 'cave'), band);
    this.noise = new Noise(deriveSeed(seed, 'fungal', 'shape'));
    this.hue = hashToFloat(deriveSeed(seed, 'fungal', 'hue'));
    this.shrooms = new CaveThings(karstChambers(this.cave), deriveSeed(seed, 'fungal', 'shrooms'), { make: shroomsOf, plan, dist: shroom, radii: FUNGAL.spread, pad: FUNGAL.cap[0] + FUNGAL.cap[1] + FUNGAL.capPer * (FUNGAL.height[0] + FUNGAL.height[1]) });
  }

  column(x: number, z: number, col: Column): Column {
    this.cave.column(x, z, col);
    this.shrooms.column(x, z, col);
    return col;
  }

  at(col: Column, x: number, y: number, z: number): number {
    return Math.min(this.cave.at(col, x, y, z), this.shrooms.at(col, x, y, z), THING_REACH);
  }

  /** Moss in the damp between the mushrooms (not on them), in patches (src/gen/style.ts `Cover`). */
  cover(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    out[o] = this.shrooms.nearest(col, x, y, z, 0.4) ? 0 : 0.3 + 0.3 * this.noise.n2(x / 7 - 1.3, z / 7 + 3.8);
    out[o + 1] = 0;
  }

  color(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    const B = this.band, n = this.noise, h = y - col.floor;
    const s = this.shrooms.nearest(col, x, y, z, 0.4);
    if (s) {
      const [r, g, b] = capHue(this.hue + (s.hue - 0.5) * 0.25);
      if (y > s.base + 0.25) {
        // The cap: the hue, paler spots.
        const spot = smoothstep(0.55, 0.75, n.n2(x * 1.1 + y, z * 1.1 - y));
        out[o] = r + (0.9 - r) * spot; out[o + 1] = g + (0.86 - g) * spot; out[o + 2] = b + (0.8 - b) * spot;
      } else if (y > s.base - 0.4) {
        // The gills under the cap: glowing faintly in the hue.
        out[o] = 0.4 + r * 0.8; out[o + 1] = 0.4 + g * 0.8; out[o + 2] = 0.4 + b * 0.8;
      } else {
        // The stalk: pale, fibrous.
        const k = 0.8 + 0.12 * n.n2(x * 3, y * 0.4 + z * 3);
        out[o] = 0.78 * k; out[o + 1] = 0.74 * k; out[o + 2] = 0.66 * k;
      }
      return;
    }
    // Dark loam underfoot, damp brown rock above, threads of pale mycelium.
    const thread = smoothstep(0.82, 0.95, 1 - Math.abs(n.n2(x / 1.7 + y / 3, z / 1.7 - y / 3)));
    const loam = smoothstep(0.8, 0.1, h);
    const k = 1 - loam * 0.45;
    out[o] = (0.22 + B.rock[0] * 0.3) * k + thread * 0.35;
    out[o + 1] = (0.18 + B.rock[1] * 0.3) * k + thread * 0.33;
    out[o + 2] = (0.16 + B.rock[2] * 0.3) * k + thread * 0.3;
  }

  /** A passage from another style ends in the nearest chamber (E3). */
  portal(x: number, z: number): [number, number] {
    return this.cave.portal(x, z);
  }

  /** Small mushrooms in clumps over the loam, a giant's scale of the woods' kinds (the giant ones are the field's own). */
  props(d: Dress): void {
    const n = this.noise;
    scatter(d, 2.5, 0x5f0, 0.8, (x, z, g, r) => {
      const clump = smoothstep(0.1, 0.6, n.n2(x / 9 - 2.2, z / 9 + 6.1));
      if (r(3) >= 0.03 + 0.3 * clump) return;
      const kind = SMALL_SHROOMS[Math.floor(r(4) * SMALL_SHROOMS.length)];
      d.solid.stamp(propModel(kind), x, g - 0.03, z, r(5) * Math.PI * 2, { scale: 2 + 3 * r(6) * r(6) });
      d.placed();
    });
  }

  climbable(): boolean {
    return true;
  }
}

/** The packed mushrooms strewn over the floor (src/gen/models.ts). */
const SMALL_SHROOMS: readonly ModelName[] = ['mush_fly_agaric', 'mush_porcini', 'mush_inkcaps', 'mush_honey_cluster', 'mush_chanterelles', 'mush_puffballs', 'mush_morels', 'mush_cave_pale'];

/** Cap colours round the wheel: violet, teal, amber, rose. */
const CAP_HUES = [[0.5, 0.25, 0.6], [0.15, 0.5, 0.48], [0.68, 0.45, 0.15], [0.66, 0.28, 0.36]] as const;

/** The cap colour at `t` round the wheel (wrapping). */
function capHue(t: number): [number, number, number] {
  const w = ((t % 1) + 1) % 1 * CAP_HUES.length, i = Math.floor(w), k = w - i, a = CAP_HUES[i], b = CAP_HUES[(i + 1) % CAP_HUES.length];
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

/** The mushrooms of chamber `c`. */
function shroomsOf(c: Chamber, f: () => number): Shroom[] {
  const F = FUNGAL, out: Shroom[] = [];
  const count = Math.round((F.density[0] + F.density[1] * f()) * c.r * c.r * Math.PI / 100);
  for (let k = 0; k < count; k++) {
    const a = f() * Math.PI * 2, d = Math.sqrt(f()) * F.spread * c.r;
    const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
    const height = Math.min(F.height[0] + F.height[1] * f() ** 1.4, c.dome * F.under);
    const r = F.cap[0] + F.cap[1] * f() + F.capPer * height, rise = r * (F.dome[0] + F.dome[1] * f()) + F.dome[2];
    // The ball the cap is cut from: through the cap's rim at its underside, `rise` high in the middle.
    const ball = (r * r + rise * rise) / (2 * rise), base = c.floor + height;
    out.push({ x, z, foot: c.floor - 1, base, r, ball, by: base + rise - ball, stalk: Math.max(F.stalk[1], r * F.stalk[0]), hue: f() });
  }
  return out;
}

/** Plan distance from (x, z) to a mushroom (a lower bound on the 3D distance). */
function plan(s: Shroom, x: number, z: number): number {
  return Math.hypot(x - s.x, z - s.z) - s.r;
}

/** Distance to a mushroom: the cap (a ball cut flat underneath) and the stalk (a capsule up into it). */
function shroom(s: Shroom, x: number, y: number, z: number): number {
  const q = Math.hypot(x - s.x, z - s.z);
  // (Never nearer than the cylinder round the cap: the plan bound holds.)
  const cap = Math.max(Math.hypot(q, y - s.by) - s.ball, s.base - y, q - s.r);
  const stalk = Math.hypot(q, y - Math.max(s.foot, Math.min(s.base + 0.2, y))) - s.stalk;
  return Math.min(cap, stalk);
}
