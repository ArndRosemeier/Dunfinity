/**
 * The feral dogs on screen (src/creatures/dogs.ts): a gaunt, rough-coated street dog modelled, rigged
 * and animated in Blender (AssetGenerator spec `creature_feral_dog`, see src/render/creatures/rigged.ts).
 * Its clips: lying up at the den, standing, a trot, a gallop round you, the low stalk as it circles,
 * down on its haunches before a lunge (the tell), the lunge with the jaw wide, the snap, a flinch when
 * stabbed, and the fall onto its side when it dies. The deep's have the salt in their eyes, glowing
 * blue (`BEAST_EYE`, `EYE_HALO`); the town's village dogs have ordinary dark ones.
 *
 * Two fixed pools, built once and added with the Stage before play.
 */
import { DOG_COAT } from '../materials';
import type { Dog } from '../../creatures/dogs';
import { RiggedFigure, WildAndTame, type ClipUse } from './rigged';

/** How many can be drawn at once: the deep's, and the town's. */
const POOL = { wild: 16, tame: 8 } as const;

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

/** The deep's and the town's, drawn (`DogView.draw(wild, town, time, from)`). */
export type DogView = WildAndTame<Dog>;

export const DogView = {
  load: (): Promise<DogView> => WildAndTame.load('feral_dog.glb', DOG_COAT, 'dogs', POOL, (rig) => new DogFigure(rig, CLIPS)),
};
