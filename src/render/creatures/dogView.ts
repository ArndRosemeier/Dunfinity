/**
 * The feral dogs on screen (src/creatures/dogs.ts): a gaunt, rough-coated street dog modelled, rigged
 * and animated in Blender (AssetGenerator spec `creature_feral_dog`, see src/render/creatures/rigged.ts).
 * Its clips: lying up at the den, standing, a trot, a gallop round you, the low stalk as it circles,
 * down on its haunches before a lunge (the tell), the lunge with the jaw wide, the snap, a flinch when
 * stabbed, and the fall onto its side when it dies. Eyes in the glow kind throw the headlamp back.
 *
 * A fixed pool, built once and added with the Stage before play.
 */
import { FigurePool, placeFigure, type Figure } from './figures';
import { Group } from 'three/webgpu';
import { DOG_COAT } from '../materials';
import type { Dog } from '../../creatures/dogs';
import { groundSpeed } from '../../creatures/creature';
import { Animator, Rigged, type ClipUse } from './rigged';

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

/** Ground speeds (m/s, at size 1) where it changes gait: up past the first, back below the second, so it never flickers between two. */
const MOVING = [0.35, 0.15] as const;
const GALLOP = [3.4, 2.6] as const;

/** One drawn dog: its own copy of the model and its clips. */
class DogFigure implements Figure<Dog> {
  readonly root = new Group();
  private readonly anim: Animator;
  private who: Dog | null = null;
  private last = 0;
  private hurtT = 9;
  private moving = false;
  private galloping = false;

  constructor(rig: Rigged) {
    const model = rig.figure();
    this.root.add(model);
    this.anim = new Animator(model, rig, CLIPS, 'Hurt');
  }

  pose(g: Dog, time: number): void {
    placeFigure(this.root, g);
    const dt = Math.min(0.1, Math.max(0, time - this.last));
    this.last = time;
    const fresh = g !== this.who;
    if (fresh) { this.who = g; this.hurtT = g.hurtT; }
    const speed = groundSpeed(g) / g.size;
    this.moving = speed > MOVING[this.moving ? 1 : 0];
    this.galloping = speed > GALLOP[this.galloping ? 1 : 0];
    const clip = this.clipFor(g);
    if (fresh) this.anim.fade = 0;
    this.anim.play(clip);
    this.anim.fade = 0.22;
    if (CLIPS[clip].stride) this.anim.pace(clip, g.gait * 0.16, CLIPS[clip].stride!);
    // Stabbed: the flinch, on top.
    if (g.hurtT < this.hurtT && !fresh && !g.dead) this.anim.hurt();
    this.hurtT = g.hurtT;
    this.anim.update(fresh ? 0 : dt);
  }

  private clipFor(g: Dog): string {
    switch (g.mode) {
      case 'dead': return 'Die';
      case 'crouch': return 'Crouch';
      case 'lunge': return 'Lunge';
      case 'back': return 'Bite';
      case 'circle': return this.galloping ? 'Gallop' : 'Stalk';
      case 'rest': return this.moving ? 'Trot' : 'Lie';
      default: return this.moving ? (this.galloping ? 'Gallop' : 'Trot') : 'Idle';
    }
  }
}

export class DogView extends FigurePool<Dog> {
  private constructor(rig: Rigged) {
    super('dogs', POOL, () => new DogFigure(rig));
  }

  /** Load the model (before the warm-up, so its coat's maps are there when the shaders build). */
  static async create(): Promise<DogView> {
    return new DogView(await Rigged.fetch('feral_dog.glb', DOG_COAT));
  }
}
