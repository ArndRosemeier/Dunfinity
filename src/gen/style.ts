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

export type StyleId = 'excavation' | 'cellar' | 'karst' | 'rift' | 'collapse';

export interface Style {
  readonly id: StyleId;
  /** Fill `col` with the y-independent part of the style at (x, z): its envelope and its own data. */
  column(x: number, z: number, col: Column): Column;
  /** Signed distance at height y in a column it filled, metres: positive in air. */
  at(col: Column, x: number, y: number, z: number): number;
  /** Rock colour at a surface point (linear RGB, into out at o). */
  color(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void;
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
