/**
 * A level style (docs/design/level-styles.md): one kind of place (the excavation halls, grandma's
 * cellar; karst, rift and collapse to come), a pure, worker-safe field of its own. A level holds
 * one or more, and `StyledField` asks them and puts them together; nothing else asks a style
 * directly, except about what is that style's own business (an excavation working's pillar grid:
 * `StyledField.excavation`).
 *
 * Its column's `floor` and `ceiling` are its envelope: where it says the walkable ground and the
 * roof are (the edge contract blends these between styles, E1).
 */
import type { Column } from './quarry';
import type { Dress } from './styleProps';
import type { RockMix } from './rockTypes';

export type StyleId = 'excavation' | 'cellar' | 'karst' | 'rift' | 'collapse' | 'catacombs' | 'dungeon' | 'roots' | 'fungal' | 'lava' | 'geode' | 'basalt' | 'flooded' | 'dwarven';

export interface Style {
  readonly id: StyleId;
  /** Fill `col` with the y-independent part of the style at (x, z): its envelope and its own data. */
  column(x: number, z: number, col: Column): Column;
  /** Signed distance at height y in a column it filled, metres: positive in air. */
  at(col: Column, x: number, y: number, z: number): number;
  /** Rock colour at a surface point (linear RGB, into out at o). */
  color(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void;
  /**
   * How the rock's surface is worked at a surface point (`Surface`, four numbers into out at o), for
   * the rock shader's finer detail than the 1 m mesh can carry. Natural rough rock if left out.
   */
  surface?: (col: Column, x: number, y: number, z: number, out: Float32Array, o: number) => void;
  /**
   * Which rock it is cut through (src/gen/rockTypes.ts `RockMix`, e.g. `rockMix({ granite: 0.6, marble: 0.2 })`):
   * the shader shows the types in patches and beds. The band's rock (`band.rocks`) if left out.
   */
  readonly rocks?: RockMix;
  /**
   * What grows on or covers the rock at a surface point (`Cover`, four numbers into out at o): moss,
   * bark (a root), plaster, roof tiles. Bare rock if left out.
   */
  cover?: (col: Column, x: number, y: number, z: number, out: Float32Array, o: number) => void;
  /** Whether the rock nearest (x, y, z), a point in the air, can be climbed. */
  climbable(x: number, y: number, z: number): boolean;
  /**
   * Told by the field how much of the level is this style's at each point (1 in its own regions,
   * falling to 0 across an edge): it places its own things (pillars, props) only where that is at
   * least SHARE_OWN (E2, E5). Styles without such things need not listen.
   */
  share?: (x: number, z: number) => number;
  /** How its floor shows on the map (M): the shade of a level floor, 0–1 RGB. Worked stone if left out (`MAP_FLOOR`). */
  readonly mapFloor?: readonly [number, number, number];
  /**
   * Where a passage from another style's region may end in this one (E3): a point of its open
   * space near (x, z), a point well inside its region. Pure.
   */
  portal(x: number, z: number): [number, number];
  /**
   * Puts the style's own things (plants, bones, crystals) on its ground in one prop tile, with
   * `scatter` (src/gen/styleProps.ts), which offers only its own ground (E5). The excavation's are
   * its own business (src/gen/quarryProps.ts). Pure.
   */
  props?(d: Dress): void;
}

/**
 * How rock is worked, per surface point, as the rock shader reads it (src/render/materials.ts `ROCK`):
 * - `tooled`: how strongly it shows the miners' pick marks (above 0 it is worked rock: where the band's
 *   finish casts walls in concrete, these are);
 * - `masonry`: built of dressed blocks or bricks laid in courses, flagged floors;
 * - `flowstone`: smooth, creamy, wet-looking sheets and drips (natural caves);
 * - `course`: the height of a course of masonry, metres (0: the shader's own, big blocks).
 * All 0 is natural, broken rock. Blended across style edges like the colour.
 */
export type Surface = readonly [tooled: number, masonry: number, flowstone: number, course: number];

/**
 * What covers the rock, per surface point, as the rock shader draws it over the stone (each 0–1):
 * - `moss`: how lush moss grows here; the shader puts it on floors, ledges and the tops of things,
 *   thick in patches, thin and broken at its edges, a few tufts up the walls;
 * - `bark`: this is a root (or a trunk): furrowed bark instead of stone;
 * - `plaster`: a house wall, rendered (in the colour's paint), cracked and weathered;
 * - `tiles`: a roof of overlapping tiles (clay or slate: the colour says).
 * All 0 is bare rock. Blended across style edges like the colour.
 */
export type Cover = readonly [moss: number, bark: number, plaster: number, tiles: number];

/** Bare rock: nothing grows on it. */
export const BARE: Cover = [0, 0, 0, 0];

/**
 * Numbers per mesh vertex of the rock's surface (`Level.surfaces`, the rock shader's `surface`, `rocks`,
 * `rocks2` and `cover` attributes): its `Surface` (four), its `RockMix` (eight, src/gen/rockTypes.ts),
 * then its `Cover` (four).
 */
export const SURFACE_STRIDE = 16;

/** Natural rock: no tool marks, no masonry, no flowstone. */
export const NATURAL: Surface = [0, 0, 0, 0];

/** Write `s` into out at o. */
export function putSurface(s: Surface, out: Float32Array, o: number): void {
  out[o] = s[0]; out[o + 1] = s[1]; out[o + 2] = s[2]; out[o + 3] = s[3];
}

/** Worked stone on the map (M): the excavation's, and any style's that does not say. */
export const MAP_FLOOR = [0.59, 0.53, 0.44] as const;

/**
 * A style places its own things (pillars, props, dens, ways down) only where its share is at least
 * this (E5); there, the field is exactly its own (src/gen/styledField.ts).
 */
export const SHARE_OWN = 0.9;

/** Whether (x, z) is `style`'s own ground, where its things may stand (E5). */
export const owns = (style: Style, x: number, z: number): boolean => !style.share || style.share(x, z) >= SHARE_OWN;
