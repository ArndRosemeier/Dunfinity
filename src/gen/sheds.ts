/**
 * The quarrymen's site sheds: where they stand (at quiet crossings of a working's aisles, where no
 * track runs), how they are laid out inside, and their doors. One answer for everyone: the props
 * tiles draw them (src/gen/quarryProps.ts), the game hangs their doors and asks whether the nobody
 * is shut in one (a shelter: nothing outside notices you, and you can rest), and the finds put the
 * miners' things on their tables and shelves (src/loot/finds.ts).
 *
 * A shed's own frame is (side, fwd) as `local`: its door is in the front wall, at +fwd. Pure and
 * seeded: the decisions are the props seed's (src/gen/propGrid.ts), so a seed always gives the same
 * sheds.
 */
import type { Level } from './level';
import type { Working } from './quarry';
import type { DoorSpec } from './doorways';
import { CellMemo } from './cellMemo';
import { local, unlocal } from './propMesh';
import { PROP_TILE, gridBounds, hasRail, propRoll, propSeed, workingsIn } from './propGrid';

/**
 * The shed (AssetGenerator's prop_shack: 4.4 × 3.2 m, 2.4 m to the plate) in its own frame:
 * its half sizes, height; the doorway's sides and top; a wall's half thickness as something in the
 * way; and where its things stand inside: the stove under the stovepipe (back left), the bunk under
 * the window (right), the table and the shelf over it against the back wall, each as (side, fwd)
 * of its middle, half sizes and height.
 */
export const SHED = {
  half: [2.2, 1.6],
  height: 2.4,
  door: [0.15, 1.05],
  doorTop: 1.88,
  wall: 0.08,
  stove: { at: [-1.7, -1.2], half: [0.27, 0.27], top: 0.72 },
  bunk: { at: [1.78, -0.45], half: [0.32, 0.95], top: 0.45 },
  table: { at: [-0.1, -1.15], half: [0.5, 0.3], top: 0.78 },
  shelf: { at: [-0.1, -1.46], half: [0.55, 0.11], top: 1.48 },
} as const;

/** Where the miners' things may lie in a shed: (side, fwd, height over the floor). */
export const SHED_SPOTS: readonly (readonly [number, number, number])[] = [
  [-0.35, -1.12, SHED.table.top + 0.01],
  [0.2, -1.2, SHED.table.top + 0.01],
  [-0.4, -1.46, SHED.shelf.top + 0.01],
  [1.78, -1.0, SHED.bunk.top + 0.01],
];

/** What a shed's door says the first time it is opened: what one sees inside. */
const INSIDE = [
  'Two tin cups on the table, one of them still half full.',
  'The calendar on the wall is still on March 1947.',
  'Coal stacked by the stove, ready for a morning shift that never came.',
  'A tally of days chalked on the inside of the door, and then none.',
  'A blanket folded square on the bunk, the boots under it still laced.',
  'Scratched into the door frame: a ring with a cross through it. Grandma drew the same on her cellar door.',
];
/** ...and a shed whose lamp is burning. */
const LIT = 'The lamp on its hook is burning. Somebody filled it, and not in 1947.';

export interface Shed {
  /** Stable over runs: its working and crossing. */
  readonly id: number;
  readonly working: Working;
  readonly iu: number;
  readonly iv: number;
  /** The middle of its floor, and its turn (its +fwd, the door's way, is (sin yaw, cos yaw)). */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  /** Its boards' shade, and whether its lamp burns. */
  readonly tint: number;
  readonly lit: boolean;
  readonly door: DoorSpec;
}

export class Sheds {
  private readonly seed: number;
  private readonly tiles: CellMemo<Shed[]>;

  constructor(private readonly level: Level) {
    this.seed = propSeed(level);
    this.tiles = new CellMemo((tx, tz) => this.plan(tx, tz));
  }

  /** The sheds standing in props tile (tx, tz). */
  ofTile(tx: number, tz: number): readonly Shed[] {
    return this.tiles.at(tx, tz);
  }

  /** The sheds whose middle lies within x0..x1, z0..z1. */
  standingIn(x0: number, z0: number, x1: number, z1: number, out: Shed[] = []): Shed[] {
    out.length = 0;
    for (let tz = Math.floor(z0 / PROP_TILE); tz <= Math.floor(z1 / PROP_TILE); tz++) for (let tx = Math.floor(x0 / PROP_TILE); tx <= Math.floor(x1 / PROP_TILE); tx++) {
      for (const s of this.tiles.at(tx, tz)) if (s.x >= x0 && s.x < x1 && s.z >= z0 && s.z < z1) out.push(s);
    }
    return out;
  }

  /** The shed whose inside (`margin` in from its walls) holds (x, z), on its floor at y (any y if not given), or null. */
  holding(x: number, z: number, y?: number, margin = 0): Shed | null {
    const r = SHED.half[0] + 0.5;
    for (let tz = Math.floor((z - r) / PROP_TILE); tz <= Math.floor((z + r) / PROP_TILE); tz++) for (let tx = Math.floor((x - r) / PROP_TILE); tx <= Math.floor((x + r) / PROP_TILE); tx++) {
      for (const s of this.tiles.at(tx, tz)) {
        if (y !== undefined && Math.abs(y - s.y) > 1.2) continue;
        const [side, fwd] = inFrame(s, x, z);
        if (Math.abs(side) < SHED.half[0] - margin && Math.abs(fwd) < SHED.half[1] - margin) return s;
      }
    }
    return null;
  }

  /** The sheds of tile (tx, tz): one per quiet crossing that passes (the old site shacks' rules, unchanged). */
  private plan(tx: number, tz: number): Shed[] {
    const l = this.level, out: Shed[] = [];
    if (l.depth === 0) return out;
    const x0 = tx * PROP_TILE, z0 = tz * PROP_TILE;
    for (const w of workingsIn(l, x0, z0, PROP_TILE)) {
      if (w.collapse > 0 || w.cavern) continue;
      const [umin, umax, vmin, vmax] = gridBounds(l, w, x0, z0, PROP_TILE), s = w.spacing;
      for (let iu = Math.floor(umin / s) - 1; iu <= Math.ceil(umax / s); iu++) for (let iv = Math.floor(vmin / s) - 1; iv <= Math.ceil(vmax / s); iv++) {
        const shed = this.shedAt(w, iu, iv, x0, z0);
        if (shed) out.push(shed);
      }
    }
    return out;
  }

  /** The shed at crossing (iu·s, iv·s) of w, if one stands there and in the tile at (x0, z0). */
  private shedAt(w: Working, iu: number, iv: number, x0: number, z0: number): Shed | null {
    const l = this.level, dice = (a: number) => propRoll(this.seed, w, a, iu, iv), s = w.spacing;
    if (s - w.pillar < 7.5 || hasRail(this.seed, w, 0, iu) || hasRail(this.seed, w, 1, iv) || dice(50) > 0.07) return null;
    const [x, z] = l.field.excavation.fromGrid(w, iu * s, iv * s);
    if (x < x0 || x >= x0 + PROP_TILE || z < z0 || z >= z0 + PROP_TILE || l.descents.at(x, z, 6)) return null;
    // Square to the pillar grid (its +v is yaw = angle), the door to any of the four aisles.
    const yaw = w.angle + Math.floor(dice(51) * 4) * (Math.PI / 2);
    const at = local(x, z, yaw);
    let g = Infinity;
    for (const [sd, fw] of [[0, 0], [-2.5, -2], [2.5, -2], [-2.5, 2], [2.5, 2]]) {
      const [cx, cz] = at(sd, fw);
      const col = l.columnAt(cx, cz);
      if (col.working.id !== w.id || col.pillarD < 0.5 || col.border < 6 || col.rubble > 0.03) return null;
      g = Math.min(g, l.groundAt(cx, cz));
      if (g < l.waterAt(cx, cz) + 0.2) return null;
    }
    if (l.sdf(x, g + 3.6, z) < 1.2) return null;
    const lit = dice(53) < 0.6;
    // Its door, hung on the hinge side of the doorway, opening out.
    const [hx, hz] = at(SHED.door[0], SHED.half[1]);
    const says = lit && dice(70) < 0.5 ? LIT : INSIDE[Math.floor(dice(71) * INSIDE.length)];
    const door: DoorSpec = { x: hx, y: g, z: hz, width: SHED.door[1] - SHED.door[0], height: SHED.doorTop, shut: yaw, swing: -Math.PI / 2, kind: 'shed', name: 'the shed door', says };
    return { id: (w.id * 7919 + iu * 104729 + iv * 15485863) | 0, working: w, iu, iv, x, y: g, z, yaw, tint: 0.8 + 0.4 * dice(52), lit, door };
  }
}

/** (x, z) in shed s's own frame: [side, fwd]. */
export function inFrame(s: Shed, x: number, z: number): [number, number] {
  return unlocal(x, z, s.x, s.z, s.yaw);
}

/** A point (side, fwd) of shed s in the world: [x, z]. */
export function shedPoint(s: Shed, side: number, fwd: number): [number, number] {
  return local(s.x, s.z, s.yaw)(side, fwd);
}
