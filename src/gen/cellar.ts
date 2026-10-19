/**
 * Grandma's cellar (depth 0; docs/design/town-and-first-strata.md §1 and §3, dunfinity-plan.md §4.1):
 * where every grandchild starts. A vaulted brick cellar under her house, its stair a turned one up
 * into the hall at its east end (the ground floor: hall, kitchen, her bedroom, the living room);
 * through a low doorway in its east wall, the strange small room (her
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

/**
 * The places of the cellar, metres (the strange room's floor at y = 0, her house above the cellar, the
 * way down to the east).
 *
 * The terrain is meshed on a one-metre grid (src/world/chunks.ts `BASE_STEP`), so the shapes here keep
 * to it: a slab of rock between two airs is drawn only where a grid point lies inside it, and where
 * the grid point sits halfway (the hall's floor over the cellar's vault: rock from 1.3 to 2.7, the
 * grid at 2). A space narrower than two metres is centred on a grid line (the flights, the doorways).
 */
export const CELLAR = {
  /**
   * The brick cellar under the west of her house: its walls, its floor, its barrel vault (height at
   * the walls, at the crown). The crown is 1.4 m under the hall's floor: a thinner floor would not
   * be drawn (the hall would open into the cellar).
   */
  cellar: { x: [-15.0, -11.25], z: [-2.6, 2.6], floor: -1.3, spring: 0.6, crown: 1.3 },
  /**
   * The turned stair, in its well at the hall's east end (the hole in the hall's floor, walled down
   * to the cellar's floor; the wall between it and the cellar is x in [-11.25, -10.75]): the upper
   * flight eastwards down from the hall, the half-landing, the lower flight westwards down to the
   * cellar door at its foot. A flight is a plan box with the floor at its first x edge (`from`) and
   * its second (`to`).
   */
  stairs: {
    well: { x: [-10.75, -7.4], z: [-1.5, 0.5] },
    upper: { x: [-10.75, -8.5], z: [-0.5, 0.5], from: 2.7, to: 0.7 },
    landing: { x: [-8.5, -7.4], z: [-1.5, 0.5], y: 0.7 },
    lower: { x: [-10.75, -8.5], z: [-1.5, -0.5], from: -1.3, to: 0.7 },
    /**
     * The cellar door at the foot, in the cellar's east wall (on its cellar side): its hinge (the
     * north jamb), its width along z, its height; and the doorway through the wall (its air reaches
     * well into the cellar and the well: the spaces join as a union of boxes, and one that stops at
     * the other's wall pinches the way to less than a body's width).
     */
    foot: { x: -11.25, z: -0.55, width: 0.9, height: 2.05, way: { x: [-12.2, -9.9], z: [-1.45, -0.55] } },
  },
  /**
   * The low passage from the cellar's north-east corner to the strange room, under her kitchen: on
   * the cellar's floor, then steps up (`steps`, x) to the room's floor once it is out from under the
   * house. Its air reaches well into the cellar and the room, as the doorway's; where it opens into
   * the room it is wider (`mouth`), so one making for it at a slant from the room is let in.
   */
  door: { x: [-12.2, -3.5], z: [1.3, 2.5], height: 1.95, steps: [-8.0, -6.5], mouth: { x: [-5.6, -3.5], z: [1.0, 2.5] } },
  /** The strange small room: round, domed. */
  room: { x: -2.9, z: 0, r: 2.5, spring: 2.0, crown: 2.6 },
  /** The infused-salt circle on its floor (the one fire that is always safe), and the armchair inside it. */
  circle: { x: -3.1, z: 0.1, r: 1.15 },
  chair: { x: -3.3, z: -0.25, yaw: -1.9 },
  /** The notary's letter, on her side table (src/gen/notary.ts). */
  letter: { x: -3.56, y: 0.645, z: 0.62 },
  /** The arch she bricked up, broken through: a round arch in the room's east wall (reaching into the room and the passage, as the doorway). */
  arch: { x: [-1.5, 0.7], z: [-0.85, 0.85], spring: 1.4, crown: 2.05 },
  /** The passage beyond, rough rock, and the chamber round the old shaft. */
  passage: { x: [-0.1, 3.9], z: [-0.95, 0.95], top: 2.4 },
  chamber: { x: 5.5, z: 0, r: 2.9, top: 2.8 },
  /**
   * The house's ground floor, over the cellar: one space under the field's thick walls, floor level
   * with the street, split into rooms by thin walls that are furniture (a wall thinner than the
   * mesh's metre cells would not show). The stairwell opens in its east end.
   */
  house: { x: [-15, -7.4], z: [-4.4, 4.4], floor: 2.7, height: 2.5 },
  /** Where a grandchild comes to: by the armchair, facing the arch. */
  start: { x: -4.7, z: 0.2, yaw: -Math.PI / 2 },
} as const;

/** The old shaft: the way down to the Quarry, its ladder on the far (east) side. */
export const CELLAR_SHAFT: Shaft = { x: 5.5, z: 0, r: 1.25, top: 0, bottom: -40, ladder: 0, up: false, floor: 0 };

/** How much daylight reaches her house's ground floor (through its windows and the open front door). */
const HOUSE_DAY = 0.45;

/**
 * How much of the day reaches (x, y, z) at depth 0: 1 out in the village (always day there), some in
 * her house and the two shops, none down in the cellar and the passage to the shaft. Out in the fields the land falls
 * below the street's level, so "below" is only her cellar's own stretch.
 */
export function daylightAt(x: number, y: number, z: number): number {
  const C = CELLAR, h = C.house, ch = C.chamber;
  if (x >= h.x[0] && x <= h.x[1] && z >= h.z[0] && z <= h.z[1]) return y < TOWN.ground - 0.5 ? 0 : HOUSE_DAY;
  if (shopAir(x, y, z) > -0.3) return HOUSE_DAY; // (in Ilse's or Kemal's shop)
  const below = y < TOWN.ground - 0.5 && x > C.cellar.x[0] - 1 && x < ch.x + ch.r + 1 && Math.abs(z) < ch.r + 1;
  return below ? 0 : 1;
}

/** The cellar's own seed, for the roughness of its rock. */
const CELLAR_SEED = 1966;

const HOME: Working = { id: -1, angle: 0, spacing: 1000, pillar: 0, floor: 0, height: 2.6, collapse: 0, cavern: false, cx: 0, cz: 0 };

/** Air distance of the box [x0, x1] × [z0, z1] in plan (positive inside). */
function plan(x: number, z: number, xs: readonly [number, number], zs: readonly [number, number]): number {
  return Math.min(x - xs[0], xs[1] - x, z - zs[0], zs[1] - z);
}

/** Whether (x, z) is in a plan box (edges count). */
function inPlan(x: number, z: number, xs: readonly [number, number], zs: readonly [number, number]): boolean {
  return x >= xs[0] && x <= xs[1] && z >= zs[0] && z <= zs[1];
}

/** A flight of the cellar's stair: its plan, the floor at its first x edge (`from`) and second (`to`). */
export type Flight = { readonly x: readonly [number, number]; readonly z: readonly [number, number]; readonly from: number; readonly to: number };

/** A flight's floor at x: `from` at its first x edge, `to` at its second, level beyond them. */
function flightFloor(x: number, f: Flight): number {
  const t = Math.min(1, Math.max(0, (x - f.x[0]) / (f.x[1] - f.x[0])));
  return f.from + (f.to - f.from) * t;
}

/** The stair's floor at (x, z), or null outside it (the upper flight, the lower flight, the half-landing). */
export function stairFloorAt(x: number, z: number): number | null {
  const S = CELLAR.stairs;
  if (inPlan(x, z, S.upper.x, S.upper.z)) return flightFloor(x, S.upper);
  if (inPlan(x, z, S.lower.x, S.lower.z)) return flightFloor(x, S.lower);
  if (inPlan(x, z, S.landing.x, S.landing.z)) return S.landing.y;
  return null;
}

/** The low passage's floor at x: the cellar's, then up its steps to the room's. */
function passageFloor(x: number): number {
  const [a, b] = CELLAR.door.steps, f = CELLAR.cellar.floor;
  return f - f * Math.min(1, Math.max(0, (x - a) / (b - a)));
}

/**
 * The floor of the space (x, y, z) is in, for its colours (the column's own floor is the topmost
 * one, the house's, over the cellar): the hall's, the stair's, the passage's, the cellar's, 0
 * east of the house.
 */
function floorBelow(x: number, y: number, z: number): number {
  const C = CELLAR;
  if (y > C.house.floor - 0.1 && inPlan(x, z, C.house.x, C.house.z)) return C.house.floor;
  const st = stairFloorAt(x, z);
  if (st !== null) return st;
  if (inPlan(x, z, [C.cellar.x[1], C.door.x[1]], C.door.z)) return passageFloor(x);
  return x < C.house.x[1] ? C.cellar.floor : 0;
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

  /**
   * The floor: the topmost ground. The stair's own floor where it goes down through the house's
   * floor; her house's floor over the cellar (the house's plan contains the cellar's); the low
   * passage's steps and floor where it runs on east of the house, the room's and the chamber's
   * floor 0; the town's ground elsewhere. (The cellar's things are placed at their own heights, not
   * by this.)
   */
  private floorOf(x: number, z: number): number {
    const C = CELLAR, H = C.house, ch = C.chamber, st = stairFloorAt(x, z);
    if (st !== null) return st;
    if (inPlan(x, z, H.x, H.z)) return H.floor;
    if (inPlan(x, z, C.door.x, C.door.z)) return passageFloor(x);
    if (x >= H.x[1] && x <= ch.x + ch.r + 1 && Math.abs(z) <= ch.r + 0.3) return 0; // the room and the passage to the shaft
    return townGround(x, z).y;
  }

  /** Air in plan: how far inside the cellar's spaces (x, z) is (negative: in the walls). */
  private planAir(x: number, z: number): number {
    const C = CELLAR, S = C.stairs, rm = C.room, ch = C.chamber;
    return Math.max(
      plan(x, z, C.cellar.x, C.cellar.z),
      plan(x, z, C.house.x, C.house.z),
      plan(x, z, S.well.x, S.well.z),
      plan(x, z, S.foot.way.x, S.foot.way.z),
      plan(x, z, C.door.x, C.door.z),
      plan(x, z, C.door.mouth.x, C.door.mouth.z),
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

  /** The air of the cellar, the house, its stairwell and the two shops (as `at`, without the town outside). */
  private inside(_col: Column, x: number, y: number, z: number): number {
    const C = CELLAR, cel = C.cellar, S = C.stairs, P = C.door, rm = C.room, ch = C.chamber, H = C.house, D = TOWN.door;
    const top = H.floor + H.height, pf = passageFloor(x);
    // A flight's air: from its floor (level on past its ends: into the half-landing, and the upper one
    // a metre into the hall, so the way off its top is not pinched) up to the hall's ceiling, the
    // well being open to the hall; the half-landing joins the two flights.
    const flight = (f: Flight, back: number): number => Math.min(plan(x, z, [f.x[0] - back, S.well.x[1]], f.z), y - flightFloor(x, f), top - y);
    const air = Math.max(
      Math.min(plan(x, z, cel.x, cel.z), y - cel.floor, vault(z, (cel.z[1] - cel.z[0]) / 2, cel.spring, cel.crown) - y),
      Math.min(plan(x, z, H.x, H.z), y - H.floor, top - y),
      flight(S.upper, 1),
      flight(S.lower, 0),
      Math.min(plan(x, z, S.landing.x, S.landing.z), y - S.landing.y, top - y),
      // The cellar door's way through the wall, its floor rising with the lower flight's first steps.
      Math.min(plan(x, z, S.foot.way.x, S.foot.way.z), y - flightFloor(x, S.lower), cel.floor + S.foot.height + 0.1 - y),
      Math.min(plan(x, z, D.x, D.z), y - H.floor, H.floor + D.top - y),
      Math.min(Math.max(plan(x, z, P.x, P.z), plan(x, z, P.mouth.x, P.mouth.z)), y - pf, pf + P.height - y),
      Math.min(rm.r - Math.hypot(x - rm.x, z - rm.z), y, vault(Math.hypot(x - rm.x, z - rm.z), rm.r, rm.spring, rm.crown) - y),
      Math.min(plan(x, z, C.arch.x, C.arch.z), y, vault(z, C.arch.z[1], C.arch.spring, C.arch.crown) - y),
      Math.min(plan(x, z, C.passage.x, C.passage.z), y, C.passage.top - y),
      Math.min(ch.r - Math.hypot(x - ch.x, z - ch.z), y, ch.top - y),
      shopAir(x, y, z),
    );
    // Beyond the arch it is the mine's rock, not her bricks: rough.
    const wild = smoothstep(C.arch.x[1] - 0.2, C.arch.x[1] + 0.8, x);
    return air + wild * (this.grain.n3(x / 1.6, y / 1.6, z / 1.6) * 0.22 + this.grain.n3(x / 0.6, y / 0.6, z / 0.6) * 0.05) * smoothstep(0.1, 0.6, y);
  }

  /** Bricks in her part, flagstones on its floor, the mine's pick-marked rock beyond the arch; in the town cobbles on the streets, smooth plaster and ground elsewhere. */
  override surface(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    if (townAir(x, y, z) > this.inside(col, x, y, z)) putSurface(this.town(x, y, z).cobbles ? COBBLES : HOUSE_SURFACE, out, o);
    else if (x > CELLAR.arch.x[1] - 0.9) putSurface(MINE, out, o);
    else if (y > CELLAR.house.floor - 0.1 && x < CELLAR.house.x[1] + 0.4) putSurface(HOUSE_SURFACE, out, o);
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
    } else if (x > CELLAR.arch.x[1] - 0.9) {
      const band = 0.5 + 0.5 * Math.sin(y * 1.3 + x * 0.2);
      r = 0.42 + 0.05 * band; g = 0.38 + 0.045 * band; b = 0.32 + 0.035 * band;
      if (y < 0.3) { r += 0.06; g += 0.055; b += 0.05; }
    } else if (y > CELLAR.house.floor - 0.1 && x < CELLAR.house.x[1] + 0.4) {
      // The house: floorboards, faded striped wallpaper, a yellowed ceiling.
      const H = CELLAR.house, k = this.grain.n2(x * 3.1, z * 3.1) * 0.02;
      if (y - H.floor < 0.04) { const plank = 0.5 + 0.5 * Math.sin(z * 14); r = 0.26 + k + 0.03 * plank; g = 0.17 + k + 0.02 * plank; b = 0.1 + k; }
      else if (y > H.floor + H.height - 0.05) { r = 0.5 + k; g = 0.47 + k; b = 0.38 + k; }
      else { const stripe = 0.5 + 0.5 * Math.sin((x + z) * 9); r = 0.4 + k + 0.04 * stripe; g = 0.38 + k + 0.03 * stripe; b = 0.27 + k; }
    } else if (y - floorBelow(x, y, z) < 0.04) {
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
