/**
 * The doors on screen (src/world/doors.ts): each a panel hung from its hinge, turned to its yaw
 * every frame. Inner doors of painted panels, her green front door with its letterbox, and the
 * cellar door: near-black, iron-banded, seven little locks down its edge and her salt signs on both
 * faces, faintly alight.
 *
 * Meshes built once per kind (`doorParts`) and cloned per door; added with the Stage.
 */
import { Group, type Object3D } from 'three/webgpu';
import type { DoorKind, DoorSpec } from '../../gen/doorways';
import type { PropBuilder, Rgb } from '../../gen/propMesh';
import type { Door } from '../../world/doors';
import { DOOR } from '../../world/doors';
import { meshOf as mesh } from '../meshes';
import { GLOW, VERTEX_COLOR_SOLID } from '../materials';

const CREAM: Rgb = [0.62, 0.58, 0.48], GREEN: Rgb = [0.13, 0.24, 0.17], BRASS: Rgb = [0.62, 0.48, 0.2];
const BLACK: Rgb = [0.07, 0.055, 0.05], IRON: Rgb = [0.16, 0.16, 0.17], SALT: Rgb = [0.55, 0.75, 0.85];

/** A door's leaf in its own frame: the hinge at the origin, its length along +x, its faces to ±z. */
function leaf(b: PropBuilder, w: number, h: number, kind: DoorKind): void {
  const t = DOOR.half, paint = kind === 'front' ? GREEN : kind === 'cellar' ? BLACK : CREAM;
  b.upright(w / 2, h / 2, 0, 0, w / 2, h / 2, t, paint);
  for (const side of [-1, 1]) {
    const z = side * (t + 0.008);
    if (kind === 'cellar') {
      for (const y of [0.25, h / 2, h - 0.25]) b.upright(w / 2, y, z, 0, w / 2, 0.05, 0.008, IRON); // the bands
      for (let k = 0; k < 7; k++) b.upright(w - 0.11, 0.55 + k * 0.17, z, 0, 0.04, 0.05, 0.012, BRASS); // the seven locks
    } else {
      // Two tall panels and two short ones, raised a little.
      for (const [y, hy] of [[0.55, 0.38], [1.45, 0.4]] as const) for (const x of [0.3, 0.7]) b.upright(x * w, y * (h / 2), z, 0, w * 0.17, hy * (h / 2) * 0.9, 0.006, paint.map((c) => c * 0.85) as unknown as Rgb);
      b.ellipsoid(w - 0.1, 0.98, side * (t + 0.05), 0.035, 0.035, 0.035, BRASS, 8); // the knob
      if (kind === 'front' && side < 0) b.upright(w / 2, 1.2, z, 0, 0.14, 0.025, 0.006, BRASS); // the letterbox
    }
  }
}

/** The cellar door's salt signs, both faces: a ring, a cross through it, a hand's breadth of ticks. */
function signs(b: PropBuilder, w: number, h: number): void {
  const cx = w / 2 - 0.05, cy = h * 0.62, r = 0.28, t = DOOR.half + 0.018;
  for (const side of [-1, 1]) {
    const z = side * t;
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      b.box(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z, [Math.sin(a) * 0.04, -Math.cos(a) * 0.04, 0], [Math.cos(a) * 0.008, Math.sin(a) * 0.008, 0], [0, 0, 0.004], SALT);
    }
    b.upright(cx, cy, z, 0, 0.01, r * 1.25, 0.004, SALT);
    b.upright(cx, cy, z, 0, r * 1.25, 0.01, 0.004, SALT);
    for (let k = 0; k < 5; k++) b.upright(cx - 0.2 + k * 0.1, cy - r - 0.16, z, 0, 0.008, 0.04, 0.004, SALT);
    b.upright(w - 0.11, 1.05, side * (t + 0.008), 0, 0.012, 0.025, 0.004, [1, 0.8, 0.45]); // a keyhole with light behind it
  }
}

export class DoorView {
  readonly root = new Group();
  private shown: { door: Door; pivot: Object3D }[] = [];

  /** Show these doors (a new level's; none below the town). */
  hang(doors: readonly Door[]): void {
    for (const s of this.shown) this.root.remove(s.pivot);
    this.shown = doors.map((door) => {
      const pivot = new Group();
      pivot.add(...parts(door.spec));
      pivot.position.set(door.spec.x, door.spec.y, door.spec.z);
      this.root.add(pivot);
      return { door, pivot };
    });
  }

  /** Turn each to where its door has swung. */
  draw(): void {
    for (const s of this.shown) s.pivot.rotation.y = s.door.yaw;
  }
}

const built = new Map<string, Object3D[]>();

/** The meshes of a door of this kind and size (built once, cloned). */
function parts(s: DoorSpec): Object3D[] {
  const key = `${s.kind}:${s.width}:${s.height}`;
  let p = built.get(key);
  if (!p) {
    p = [mesh((b) => leaf(b, s.width, s.height, s.kind), VERTEX_COLOR_SOLID)];
    if (s.kind === 'cellar') p.push(mesh((b) => signs(b, s.width, s.height), GLOW));
    built.set(key, p);
  }
  return p.map((m) => m.clone());
}
