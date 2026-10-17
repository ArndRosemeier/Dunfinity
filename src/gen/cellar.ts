/**
 * Grandma's cellar (depth 0; docs/design/town-and-first-strata.md §1 and §3, dunfinity-plan.md §4.1):
 * where every grandchild starts. A vaulted brick cellar under the house, the stairs up into the
 * house at its west end (the ground floor: hall, kitchen, her bedroom, the living room); through a low doorway in the east wall, the strange small room (her
 * armchair, her lamp, the circle of infused salt on the floor); and in the room's far wall the arch
 * she bricked up in 1966, broken through now. Behind it, a rough passage to the old shaft, its
 * ladder going down into the Quarry.
 *
 * Hand-placed, not generated: the same cellar for every seed. A field like the Quarry's (the one
 * density function, positive in air), so everything that walks, meshes and lights the levels works
 * here unchanged.
 */
import { Noise, deriveSeed, smoothstep } from '@futuremagic/core';
import { CELLAR_BAND } from './bands';
import { putSurface, type StyleId, type Surface } from './style';
import { QuarryField, unworked, type Column, type Working } from './quarry';
import type { Shaft } from './descents';
import { TOWN, onBuilding, shopAir, townAir, townGround, townLook } from './town';

/** The places of the cellar, metres (floor at y = 0, the house to the west, the way down to the east). */
export const CELLAR = {
  /** The brick cellar: its walls, and its barrel vault (height at the walls, at the crown). */
  cellar: { x: [-4.5, 3.4], z: [-2.6, 2.6], spring: 1.9, crown: 2.6 },
  /** The stairs up to the house, rising westwards into its hall (their air reaches `join` on into the cellar and the hall). */
  stairs: { x: [-8.2, -4.4], z: [-0.65, 0.65], top: 2.7, head: 2.3, join: 0.8 },
  /**
   * The low doorway from the cellar into the strange room. Its air reaches well into both (the
   * spaces join as a union of boxes, and one that stops at the other's wall pinches the way to less
   * than a body's width).
   */
  door: { x: [2.6, 5.2], z: [-0.65, 0.65], top: 1.95 },
  /** The strange small room: round, domed. */
  room: { x: 6.6, z: 0, r: 2.3, spring: 2.0, crown: 2.6 },
  /** The infused-salt circle on its floor (the one fire that is always safe), and the armchair inside it. */
  circle: { x: 6.4, z: 0.1, r: 1.15 },
  chair: { x: 6.2, z: -0.25, yaw: -1.9 },
  /** The notary's letter, on her side table (src/gen/notary.ts). */
  letter: { x: 5.94, y: 0.645, z: 0.62 },
  /** The arch she bricked up, broken through: a round arch in the room's east wall (reaching into the room and the passage, as the doorway). */
  arch: { x: [8.0, 10.2], z: [-0.85, 0.85], spring: 1.4, crown: 2.05 },
  /** The passage beyond, rough rock, and the chamber round the old shaft. */
  passage: { x: [9.4, 13.4], z: [-0.95, 0.95], top: 2.4 },
  chamber: { x: 15, z: 0, r: 2.9, top: 2.8 },
  /**
   * The house's ground floor, over the cellar's west end: one space under the field's thick walls,
   * floor level with the stairs' top, split into rooms by thin walls that are furniture (a wall
   * thinner than the mesh's metre cells would not show). The stairs come up through its floor.
   */
  house: { x: [-15, -7.4], z: [-4.4, 4.4], floor: 2.7, height: 2.5 },
  /** Where a grandchild comes to: by the armchair, facing the arch. */
  start: { x: 4.8, z: 0.2, yaw: -Math.PI / 2 },
} as const;

/** The old shaft: the way down to the Quarry, its ladder on the far (east) side. */
export const CELLAR_SHAFT: Shaft = { x: 15, z: 0, r: 1.25, top: 0, bottom: -40, ladder: 0, up: false, floor: 0 };

/** How much daylight reaches her house's ground floor (through its windows and the open front door). */
const HOUSE_DAY = 0.45;

/**
 * How much of the day reaches (x, y, z) at depth 0: 1 out in the village (always day there), some in
 * her house and the two shops, none down in the cellar and the passage to the shaft. Out in the fields the land falls
 * below the street's level, so "below" is only her cellar's own stretch.
 */
export function daylightAt(x: number, y: number, z: number): number {
  const C = CELLAR, h = C.house;
  if (x >= h.x[0] && x <= h.x[1] && z >= h.z[0] && z <= h.z[1]) return y < TOWN.ground - 0.5 ? 0 : HOUSE_DAY;
  if (shopAir(x, y, z) > -0.3) return HOUSE_DAY; // (in Ilse's or Kemal's shop)
  const below = y < TOWN.ground - 0.5 && x > C.stairs.x[0] - 1 && x < C.chamber.x + C.chamber.r + 1 && Math.abs(z) < C.chamber.r + 1;
  return below ? 0 : 1;
}

/** The cellar's own seed, for the roughness of its rock. */
const CELLAR_SEED = 1966;

const HOME: Working = { id: -1, angle: 0, spacing: 1000, pillar: 0, floor: 0, height: 2.6, collapse: 0, cavern: false, cx: 0, cz: 0 };

/** Air distance of the box [x0, x1] × [z0, z1] in plan (positive inside). */
function plan(x: number, z: number, xs: readonly [number, number], zs: readonly [number, number]): number {
  return Math.min(x - xs[0], xs[1] - x, z - zs[0], zs[1] - z);
}

/** A round vault's height across a span of half-width `half`, `t` from its middle. */
function vault(t: number, half: number, spring: number, crown: number): number {
  const u = Math.min(1, Math.abs(t) / half);
  return spring + (crown - spring) * Math.sqrt(1 - u * u);
}

/** Her cellar's surfaces (src/gen/style.ts `Surface`): brick courses (flagstones underfoot), the mine's worked rock, setts, the house's plaster. */
const BRICK: Surface = [0, 1, 0, 0.075];
const MINE: Surface = [1, 0, 0, 0];
const COBBLES: Surface = [0, 1, 0, 0.2];
const HOUSE_SURFACE: Surface = [0, 0, 0.4, 0];

export class CellarField extends QuarryField {
  override readonly id: StyleId = 'cellar';
  private readonly grain: Noise;

  /** (No seed: the cellar is the same for every seed.) */
  constructor() {
    super(CELLAR_SEED, CELLAR_BAND);
    this.grain = new Noise(deriveSeed(CELLAR_SEED, 'cellar', 'grain'));
  }

  workingAt(): Working {
    return HOME;
  }

  /** The floor: the cellar's, the stairs rising to the house's, the house's. */
  private floorOf(x: number, z: number): number {
    const S = CELLAR.stairs, H = CELLAR.house, G = TOWN.grandma;
    // Out in the town (not over the cellar's spaces): the street, the ground.
    if (x < G.x[0] || Math.abs(z) > 3.2) return townGround(x, z).y;
    if (x <= S.x[0] || (x < H.x[1] && Math.abs(z) > S.z[1] + 0.2)) return x < -4.5 ? H.floor : 0;
    return x < S.x[1] ? Math.min(S.top, ((S.x[1] - x) / (S.x[1] - S.x[0])) * S.top) : 0;
  }

  /** Air in plan: how far inside the cellar's spaces (x, z) is (negative: in the walls). */
  private planAir(x: number, z: number): number {
    const C = CELLAR, rm = C.room, ch = C.chamber;
    return Math.max(
      plan(x, z, C.cellar.x, C.cellar.z),
      plan(x, z, C.house.x, C.house.z),
      plan(x, z, [C.stairs.x[0] - C.stairs.join, C.stairs.x[1] + C.stairs.join], C.stairs.z),
      plan(x, z, C.door.x, C.door.z),
      rm.r - Math.hypot(x - rm.x, z - rm.z),
      plan(x, z, C.arch.x, C.arch.z),
      plan(x, z, C.passage.x, C.passage.z),
      ch.r - Math.hypot(x - ch.x, z - ch.z),
    );
  }

  column(x: number, z: number, col: Column): Column {
    col.floor = this.floorOf(x, z);
    col.ceiling = col.floor + 2.4;
    col.wall = this.planAir(x, z);
    unworked(col, HOME, 100, 0);
    return col;
  }

  /**
   * Her bricks and plaster, and the houses' walls, are not climbed (walking into them at a slant
   * slides one along them, into the doorway one was making for); the mine's rock beyond the arch and
   * the hill and valley round the town are.
   */
  climbable(x: number, y: number, z: number): boolean {
    if (x >= CELLAR.passage.x[0]) return true;
    if (this.planAir(x, z) > -1) return false;
    return !onBuilding(x, y, z);
  }

  at(col: Column, x: number, y: number, z: number): number {
    return Math.max(this.inside(col, x, y, z), townAir(x, y, z));
  }

  /** The air of the cellar, the house and the two shops (as `at`, without the town outside). */
  private inside(col: Column, x: number, y: number, z: number): number {
    const C = CELLAR, rm = C.room, ch = C.chamber, H = C.house, D = TOWN.door, f = col.floor;
    const air = Math.max(
      Math.min(plan(x, z, C.cellar.x, C.cellar.z), y, vault(z, 2.6, C.cellar.spring, C.cellar.crown) - y),
      Math.min(plan(x, z, H.x, H.z), y - H.floor, H.floor + H.height - y),
      Math.min(plan(x, z, D.x, D.z), y - H.floor, H.floor + D.top - y),
      Math.min(plan(x, z, [C.stairs.x[0] - C.stairs.join, C.stairs.x[1] + C.stairs.join], C.stairs.z), y - f, f + C.stairs.head - y),
      Math.min(plan(x, z, C.door.x, C.door.z), y, C.door.top - y),
      Math.min(rm.r - Math.hypot(x - rm.x, z - rm.z), y, vault(Math.hypot(x - rm.x, z - rm.z), rm.r, rm.spring, rm.crown) - y),
      Math.min(plan(x, z, C.arch.x, C.arch.z), y, vault(z, C.arch.z[1], C.arch.spring, C.arch.crown) - y),
      Math.min(plan(x, z, C.passage.x, C.passage.z), y, C.passage.top - y),
      Math.min(ch.r - Math.hypot(x - ch.x, z - ch.z), y, ch.top - y),
      shopAir(x, y, z),
    );
    // Beyond the arch it is the mine's rock, not her bricks: rough.
    const wild = smoothstep(10.0, 11.0, x);
    return air + wild * (this.grain.n3(x / 1.6, y / 1.6, z / 1.6) * 0.22 + this.grain.n3(x / 0.6, y / 0.6, z / 0.6) * 0.05) * smoothstep(0.1, 0.6, y);
  }

  /** Bricks in her part, flagstones on its floor, the mine's pick-marked rock beyond the arch; in the town cobbles on the streets, smooth plaster and ground elsewhere. */
  override surface(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    if (townAir(x, y, z) > this.inside(col, x, y, z)) putSurface(this.town(x, y, z).cobbles ? COBBLES : HOUSE_SURFACE, out, o);
    else if (x > 9.3) putSurface(MINE, out, o);
    else if (y > CELLAR.house.floor - 0.1 && x < -7) putSurface(HOUSE_SURFACE, out, o);
    else putSurface(BRICK, out, o);
  }

  /** Grass on the town's verges, gardens, meadows and some fields, leaves on the hedgerows (the rock shader's moss); nothing indoors. */
  cover(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    out[o] = townAir(x, y, z) > this.inside(col, x, y, z) ? this.town(x, y, z).grass : 0;
    out[o + 1] = 0;
  }

  /** The town's look at a surface point (src/gen/town.ts), its colour roughened by the grain. */
  private town(x: number, y: number, z: number) {
    return townLook(x, y, z, this.grain.n2(x * 2.1, z * 2.1) * 0.04);
  }

  /** Bricks in her part (walls and vaults), flagstones on its floor, the mine's rock beyond the arch. */
  color(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    let r: number, g: number, b: number;
    if (townAir(x, y, z) > this.inside(col, x, y, z)) {
      [r, g, b] = this.town(x, y, z).rgb;
    } else if (x > 9.3) {
      const band = 0.5 + 0.5 * Math.sin(y * 1.3 + x * 0.2);
      r = 0.42 + 0.05 * band; g = 0.38 + 0.045 * band; b = 0.32 + 0.035 * band;
      if (y < 0.3) { r += 0.06; g += 0.055; b += 0.05; }
    } else if (y > CELLAR.house.floor - 0.1 && x < -7) {
      // The house: floorboards, faded striped wallpaper, a yellowed ceiling.
      const H = CELLAR.house, k = this.grain.n2(x * 3.1, z * 3.1) * 0.02;
      if (y - H.floor < 0.04) { const plank = 0.5 + 0.5 * Math.sin(z * 14); r = 0.26 + k + 0.03 * plank; g = 0.17 + k + 0.02 * plank; b = 0.1 + k; }
      else if (y > H.floor + H.height - 0.05) { r = 0.5 + k; g = 0.47 + k; b = 0.38 + k; }
      else { const stripe = 0.5 + 0.5 * Math.sin((x + z) * 9); r = 0.4 + k + 0.04 * stripe; g = 0.38 + k + 0.03 * stripe; b = 0.27 + k; }
    } else if (y - col.floor < 0.04) {
      // Flagstones, worn.
      const k = this.grain.n2(x * 1.7, z * 1.7) * 0.03;
      r = 0.3 + k; g = 0.29 + k; b = 0.27 + k;
    } else {
      // Old red brick, smoke-darkened towards the vault.
      const k = this.grain.n2(x * 2.3 + y * 3.1, z * 2.3 - y * 1.7) * 0.05, soot = 1 - 0.3 * smoothstep(1.4, 2.6, y);
      r = (0.4 + k) * soot; g = (0.2 + k * 0.6) * soot; b = (0.14 + k * 0.4) * soot;
    }
    out[o] = r; out[o + 1] = g; out[o + 2] = b;
  }

  water(): number {
    return -100;
  }
}
