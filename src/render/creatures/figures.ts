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

/** Show a figure's root at a creature: at its feet, turned by its yaw (unless `yaw` is null: the pose turns it), scaled by its size. */
export function placeFigure(root: Object3D, c: { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number; readonly size: number }, yaw: number | null = c.yaw): void {
  root.visible = true;
  root.position.set(c.x, c.y, c.z);
  if (yaw !== null) root.rotation.y = yaw;
  root.scale.setScalar(c.size);
}

export class FigurePool<T extends { readonly x: number; readonly z: number }> {
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

  /** Pose the pool after `list` (as many as it holds: the nearest to `from`, if given); the rest is hidden. */
  draw(list: readonly T[], time: number, from?: { readonly x: number; readonly z: number }): void {
    if (from && list.length > this.figures.length) list = [...list].sort((a, b) => Math.hypot(a.x - from.x, a.z - from.z) - Math.hypot(b.x - from.x, b.z - from.z));
    let k = 0;
    for (const t of list) if (k < this.figures.length) this.figures[k++].pose(t, time);
    for (; k < this.figures.length; k++) this.figures[k].root.visible = false;
  }
}
