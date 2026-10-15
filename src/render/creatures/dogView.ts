/**
 * The feral dogs on screen (src/creatures/dogs.ts): a gaunt, rough-coated street dog modelled, rigged
 * and animated in Blender (AssetGenerator spec `creature_feral_dog`, see src/render/creatures/rigged.ts).
 * Its clips: lying up at the den, standing, a trot, a gallop round you, the low stalk as it circles,
 * down on its haunches before a lunge (the tell), the lunge with the jaw wide, the snap, a flinch when
 * stabbed, and the fall onto its side when it dies. Eyes in the glow kind throw the headlamp back.
 *
 * A fixed pool, built once and added with the Stage before play.
 */
import { FigurePool } from './figures';
import { DOG_COAT } from '../materials';
import type { Dog } from '../../creatures/dogs';
import { Rigged, RiggedFigure, type ClipUse } from './rigged';

/** How many can be drawn at once. */
const POOL = 16;

/** The clips (AssetGenerator's quadruped clips.py; strides there as STRIDES). */
const CLIPS: Record<string, ClipUse> = {
  Idle: { loop: true },
  Trot: { loop: true, stride: 1.0 },
  Gallop: { loop: true, stride: 1.9 },
  Stalk: { loop: true, stride: 0.55 },
  Lie: { loop: true },
  Crouch: { loop: true },
  Lunge: { loop: false },
  Bite: { loop: false },
  Die: { loop: false },
};

/** Ground speeds (m/s, at size 1) where it changes gait: up past the first, back below the second. */
const MOVING = [0.35, 0.15] as const;
const GALLOP = [3.4, 2.6] as const;

class DogFigure extends RiggedFigure<Dog> {
  protected clipFor(g: Dog): string {
    const moving = this.faster('moving', MOVING), galloping = this.faster('gallop', GALLOP);
    switch (g.mode) {
      case 'dead': return 'Die';
      case 'crouch': return 'Crouch';
      case 'lunge': return 'Lunge';
      case 'back': return 'Bite';
      case 'circle': return galloping ? 'Gallop' : 'Stalk';
      case 'rest': return moving ? 'Trot' : 'Lie';
      default: return moving ? (galloping ? 'Gallop' : 'Trot') : 'Idle';
    }
  }

  protected travelled(g: Dog): number {
    return g.gait * 0.16;
  }
}

export class DogView extends FigurePool<Dog> {
  private constructor(rig: Rigged) {
    super('dogs', POOL, () => new DogFigure(rig, CLIPS));
  }

  /** Load the model (before the warm-up, so its coat's maps are there when the shaders build). */
  static async create(): Promise<DogView> {
    return new DogView(await Rigged.fetch('feral_dog.glb', DOG_COAT));
  }
}
