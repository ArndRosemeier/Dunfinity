/**
 * The cave crickets on screen (src/creatures/crickets.ts): a pale, humped cave cricket modelled, rigged
 * and animated in Blender (AssetGenerator spec `creature_cave_cricket`, see src/render/creatures/rigged.ts),
 * with great chevroned hind femurs, spined shins and feelers longer than its body. On the rock it
 * clings head down, feelers sweeping (quick and twitchy once it is after you). Every move shows: the
 * six-legged scuttle and the hops along the floor, sinking onto its hind legs before a leap (the
 * tell), flying with them kicked out behind, the bite (rearing back, then the head driven down with
 * the mandibles working), a flinch when hit, and over onto its back with its legs folding when dead.
 *
 * A fixed pool, built once and added with the Stage before play.
 */
import { Matrix4, Vector3 } from 'three/webgpu';
import { FigurePool, placeFigure } from './figures';
import { CRICKET_COAT } from '../materials';
import type { Cricket } from '../../creatures/crickets';
import { Rigged, RiggedFigure, type ClipUse } from './rigged';

/** How many can be drawn at once. */
const POOL = 24;

/** The clips (AssetGenerator's quadruped cricket_clips.py; strides there as STRIDES). */
const CLIPS: Record<string, ClipUse> = {
  Idle: { loop: true },
  Alert: { loop: true },
  Scuttle: { loop: true, stride: 0.32 },
  Hop: { loop: true, stride: 0.7 },
  Crouch: { loop: true },
  Graze: { loop: true },
  Rest: { loop: true },
  Leap: { loop: false },
  Bite: { loop: false },
  Die: { loop: false },
};

/** Ground speeds (m/s, at size 1) where it changes gait: up past the first, back below the second. */
const MOVING = [0.25, 0.1] as const;
const HOPPING = [1.4, 1.0] as const;

const _m = new Matrix4(), _x = new Vector3(), _y = new Vector3(), _z = new Vector3(), _f = new Vector3();

class CricketFigure extends RiggedFigure<Cricket> {
  /** Up off the surface it is on; forward along its yaw, or head down on a wall. */
  protected place(c: Cricket): void {
    placeFigure(this.root, c, null);
    _y.set(c.up[0], c.up[1], c.up[2]).normalize();
    if (_y.y > 0.7) _f.set(-Math.sin(c.yaw), 0, -Math.cos(c.yaw));
    else _f.set(0, -1, 0);
    _f.addScaledVector(_y, -_f.dot(_y)).normalize();
    _z.copy(_f).negate();
    _x.crossVectors(_y, _z).normalize();
    this.root.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
  }

  protected clipFor(c: Cricket): string {
    const moving = this.faster('moving', MOVING), hopping = this.faster('hop', HOPPING);
    switch (c.mode) {
      case 'dead': return 'Die';
      case 'bite': return 'Bite';
      case 'crouch': return 'Crouch';
      case 'leap': return 'Leap';
    }
    // Nibbling its rock's salt, or asleep on it (src/creatures/life.ts).
    if (c.pose === 'feed' && !moving) return 'Graze';
    if (c.pose === 'rest' && !moving) return 'Rest';
    switch (c.mode) {
      case 'perch': return c.angry ? 'Alert' : 'Idle';
      default: return moving ? (hopping ? 'Hop' : 'Scuttle') : c.angry ? 'Alert' : 'Idle';
    }
  }

  protected travelled(c: Cricket): number {
    return c.gait * 0.12;
  }
}

export class CricketView extends FigurePool<Cricket> {
  private constructor(rig: Rigged) {
    super('crickets', POOL, () => new CricketFigure(rig, CLIPS));
  }

  /** Load the model (before the warm-up, so its shell's maps are there when the shaders build). */
  static async create(): Promise<CricketView> {
    return new CricketView(await Rigged.fetch('cave_cricket.glb', CRICKET_COAT));
  }
}
