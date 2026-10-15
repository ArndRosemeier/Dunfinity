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

export type StyleId = 'excavation' | 'cellar';

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
}
