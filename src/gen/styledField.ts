/**
 * The level's one field, put together from its styles (docs/design/level-styles.md §1): what bodies,
 * creatures, meshes and props read through `Level`. For now each level is one style all over (the
 * excavation halls, or grandma's cellar); the region map and the edge contract come with the
 * second style, and land here.
 *
 * Pure, like the styles.
 */
import type { Column, QuarryField } from './quarry';
import type { Style } from './style';

export class StyledField {
  private readonly style: Style;

  /** `excavation`: the excavation style, for what is its own business (workings, the pillar grid). */
  constructor(readonly excavation: QuarryField) {
    this.style = excavation;
  }

  /** The styles of this level. */
  get styles(): readonly Style[] {
    return [this.style];
  }

  /** Fill `col` with the y-independent part of the field at (x, z). */
  column(x: number, z: number, col: Column): Column {
    return this.style.column(x, z, col);
  }

  /** Signed distance at height y in a column filled by `column`: positive in air. */
  at(col: Column, x: number, y: number, z: number): number {
    return this.style.at(col, x, y, z);
  }

  color(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    this.style.color(col, x, y, z, out, o);
  }

  climbable(x: number, y: number, z: number): boolean {
    return this.style.climbable(x, y, z);
  }

  /** The water table at (x, z): one for the whole level, whatever the style (E5). */
  water(x: number, z: number): number {
    return this.excavation.water(x, z);
  }
}
