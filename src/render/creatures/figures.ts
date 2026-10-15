/**
 * A fixed pool of drawn creatures (rats, cave crickets): built once and added with the Stage before
 * play, posed after the creatures each frame; the figures left over are hidden.
 */
import { Group, type Object3D } from 'three/webgpu';

/** One drawn creature: posed after `t` each frame. */
export interface Figure<T> {
  readonly root: Object3D;
  pose(t: T, time: number): void;
}

export class FigurePool<T> {
  /** Put into the scene once (Stage.add), after the warm-up. */
  readonly root = new Group();
  private readonly figures: Figure<T>[] = [];

  constructor(name: string, count: number, make: () => Figure<T>) {
    this.root.name = name;
    for (let k = 0; k < count; k++) {
      const f = make();
      this.figures.push(f);
      this.root.add(f.root);
    }
  }

  /** Pose the pool after `list` (as many as it holds); the rest is hidden. */
  draw(list: readonly T[], time: number): void {
    let k = 0;
    for (const t of list) if (k < this.figures.length) this.figures[k++].pose(t, time);
    for (; k < this.figures.length; k++) this.figures[k].root.visible = false;
  }
}
