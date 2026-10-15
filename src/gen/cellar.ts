/**
 * Grandma's cellar (depth 0; docs/design/town-and-first-strata.md §1 and §3, dunfinity-plan.md §4.1):
 * where every grandchild starts. A vaulted brick cellar under the house, the stairs up to the house
 * door at its west end; through a low doorway in the east wall, the strange small room (her
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
import { QuarryField, type Column, type Working } from './quarry';
import type { Shaft } from './descents';

/** The places of the cellar, metres (floor at y = 0, the house to the west, the way down to the east). */
export const CELLAR = {
  /** The brick cellar: its walls, and its barrel vault (height at the walls, at the crown). */
  cellar: { x: [-4.5, 3.4], z: [-2.6, 2.6], spring: 1.9, crown: 2.6 },
  /** The stairs up to the house, rising westwards to the door. */
  stairs: { x: [-8.2, -4.4], z: [-0.65, 0.65], top: 2.7, head: 2.3 },
  /** The low doorway from the cellar into the strange room. */
  door: { x: [3.2, 4.6], z: [-0.5, 0.5], top: 1.95 },
  /** The strange small room: round, domed. */
  room: { x: 6.6, z: 0, r: 2.3, spring: 2.0, crown: 2.6 },
  /** The infused-salt circle on its floor (the one fire that is always safe), and the armchair inside it. */
  circle: { x: 6.4, z: 0.1, r: 1.15 },
  chair: { x: 6.2, z: -0.25, yaw: -1.9 },
  /** The notary's letter, on her side table (src/gen/notary.ts). */
  letter: { x: 5.94, y: 0.645, z: 0.62 },
  /** The arch she bricked up, broken through: a round arch in the room's east wall. */
  arch: { x: [8.6, 9.6], z: [-0.7, 0.7], spring: 1.4, crown: 2.0 },
  /** The passage beyond, rough rock, and the chamber round the old shaft. */
  passage: { x: [9.4, 13.4], z: [-0.85, 0.85], top: 2.1 },
  chamber: { x: 15, z: 0, r: 2.9, top: 2.8 },
  /** Where a grandchild comes to: by the armchair, facing the arch. */
  start: { x: 4.8, z: 0.2, yaw: -Math.PI / 2 },
} as const;

/** The old shaft: the way down to the Quarry, its ladder on the far (east) side. */
export const CELLAR_SHAFT: Shaft = { x: 15, z: 0, r: 1.25, top: 0, bottom: -40, ladder: 0, up: false, floor: 0 };

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

export class CellarField extends QuarryField {
  private readonly grain: Noise;

  /** (No seed: the cellar is the same for every seed.) */
  constructor() {
    super(CELLAR_SEED, CELLAR_BAND);
    this.grain = new Noise(deriveSeed(CELLAR_SEED, 'cellar', 'grain'));
  }

  workingAt(): Working {
    return HOME;
  }

  /** The floor: level everywhere but the stairs. */
  private floorOf(x: number): number {
    const S = CELLAR.stairs;
    return x < S.x[1] ? Math.min(S.top, ((S.x[1] - x) / (S.x[1] - S.x[0])) * S.top) : 0;
  }

  /** Air in plan: how far inside the cellar's spaces (x, z) is (negative: in the walls). */
  private planAir(x: number, z: number): number {
    const C = CELLAR, rm = C.room, ch = C.chamber;
    return Math.max(
      plan(x, z, C.cellar.x, C.cellar.z),
      plan(x, z, C.stairs.x, C.stairs.z),
      plan(x, z, C.door.x, C.door.z),
      rm.r - Math.hypot(x - rm.x, z - rm.z),
      plan(x, z, C.arch.x, C.arch.z),
      plan(x, z, C.passage.x, C.passage.z),
      ch.r - Math.hypot(x - ch.x, z - ch.z),
    );
  }

  column(x: number, z: number, col: Column): Column {
    col.working = HOME;
    col.floor = this.floorOf(x);
    col.ceiling = col.floor + 2.4;
    col.pillarD = Infinity;
    col.stumpTop = Infinity;
    col.stubBottom = -Infinity;
    col.wall = this.planAir(x, z);
    col.rubble = 0;
    col.border = 100;
    col.collapse = 0;
    col.cavern = 0;
    col.olderTop = -Infinity;
    col.squareD = Infinity;
    return col;
  }

  at(col: Column, x: number, y: number, z: number): number {
    const C = CELLAR, rm = C.room, ch = C.chamber, f = col.floor;
    const air = Math.max(
      Math.min(plan(x, z, C.cellar.x, C.cellar.z), y, vault(z, 2.6, C.cellar.spring, C.cellar.crown) - y),
      Math.min(plan(x, z, C.stairs.x, C.stairs.z), y - f, f + C.stairs.head - y),
      Math.min(plan(x, z, C.door.x, C.door.z), y, C.door.top - y),
      Math.min(rm.r - Math.hypot(x - rm.x, z - rm.z), y, vault(Math.hypot(x - rm.x, z - rm.z), rm.r, rm.spring, rm.crown) - y),
      Math.min(plan(x, z, C.arch.x, C.arch.z), y, vault(z, 0.7, C.arch.spring, C.arch.crown) - y),
      Math.min(plan(x, z, C.passage.x, C.passage.z), y, C.passage.top - y),
      Math.min(ch.r - Math.hypot(x - ch.x, z - ch.z), y, ch.top - y),
    );
    // Beyond the arch it is the mine's rock, not her bricks: rough.
    const wild = smoothstep(9.2, 10.2, x);
    return air + wild * (this.grain.n3(x / 1.6, y / 1.6, z / 1.6) * 0.22 + this.grain.n3(x / 0.6, y / 0.6, z / 0.6) * 0.05) * smoothstep(0.1, 0.6, y);
  }

  /** Bricks in her part (walls and vaults), flagstones on its floor, the mine's rock beyond the arch. */
  color(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    let r: number, g: number, b: number;
    if (x > 9.3) {
      const band = 0.5 + 0.5 * Math.sin(y * 1.3 + x * 0.2);
      r = 0.42 + 0.05 * band; g = 0.38 + 0.045 * band; b = 0.32 + 0.035 * band;
      if (y < 0.3) { r += 0.06; g += 0.055; b += 0.05; }
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
