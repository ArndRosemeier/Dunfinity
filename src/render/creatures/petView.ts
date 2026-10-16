/**
 * Grandma's salt pets on screen (src/creatures/pets.ts): the quarry rat's and the feral dog's own
 * models and clips (src/render/creatures/ratView.ts, dogView.ts), worn in a coat of salt with the
 * rock's blue veins glowing through it (`SALT_RAT_COAT`, `SALT_DOG_COAT`). It grows up out of its
 * heap of salt when poured, trots at heel, runs, rears and snaps, flinches when hit, and when it
 * dies falls over and slumps back into salt.
 *
 * Two small fixed pools (one pet at a time; a second while the last one crumbles), built once and
 * added with the Stage before play.
 */
import { FigurePool } from './figures';
import { SALT_DOG_COAT, SALT_RAT_COAT } from '../materials';
import { clamp, smoothstep } from '@futuremagic/core';
import { PET, type Pet } from '../../creatures/pets';
import { Rigged, RiggedFigure, type ClipUse } from './rigged';

/** Pets drawn at once, of each kind. */
const POOL = 2;

/** The rat's clips and gaits (as src/render/creatures/ratView.ts plays them). */
const RAT_CLIPS: Record<string, ClipUse> = {
  Sniff: { loop: true },
  Scurry: { loop: true, stride: 0.22 },
  Run: { loop: true, stride: 0.45 },
  Rear: { loop: true },
  Bite: { loop: false },
  Die: { loop: false },
};

/** The dog's clips and gaits (as src/render/creatures/dogView.ts plays them). */
const DOG_CLIPS: Record<string, ClipUse> = {
  Idle: { loop: true },
  Trot: { loop: true, stride: 1.0 },
  Gallop: { loop: true, stride: 1.9 },
  Crouch: { loop: true },
  Lunge: { loop: false },
  Bite: { loop: false },
  Die: { loop: false },
};

/** Ground speeds (m/s, at size 1) where it changes gait: up past the first, back below the second. */
const MOVING = [0.3, 0.12] as const;
const RUNNING = { rat: [2.2, 1.6], dog: [3.4, 2.6] } as const;

/** How big it stands as it grows out of the salt, and as it slumps back into it, dead. */
function grown(p: Pet): number {
  if (p.dead) return 1 - 0.85 * smoothstep(PET.crumble * 0.4, PET.crumble, p.deadT);
  return p.mode === 'form' ? 0.15 + 0.85 * smoothstep(0, 1, clamp(p.t / PET.form, 0, 1)) : 1;
}

class PetFigure extends RiggedFigure<Pet> {
  protected clipFor(p: Pet): string {
    const moving = this.faster('moving', MOVING), running = this.faster('run', RUNNING[p.kind]);
    if (p.kind === 'rat') {
      switch (p.mode) {
        case 'dead': return 'Die';
        case 'bite': return 'Bite';
        case 'form': return 'Rear';
        default: return moving ? (running ? 'Run' : 'Scurry') : 'Sniff';
      }
    }
    switch (p.mode) {
      case 'dead': return 'Die';
      case 'bite': return p.biteT < 0.3 ? 'Crouch' : 'Lunge';
      case 'form': return 'Idle';
      default: return moving ? (running ? 'Gallop' : 'Trot') : 'Idle';
    }
  }

  protected travelled(p: Pet): number {
    return p.gait * PET.stride[p.kind];
  }

  protected posed(p: Pet): void {
    this.root.scale.setScalar(p.size * grown(p));
  }
}

export class PetView {
  private constructor(private readonly rats: FigurePool<Pet>, private readonly dogs: FigurePool<Pet>) {}

  /** The pools' roots (added once with the Stage). */
  get roots(): readonly [FigurePool<Pet>['root'], FigurePool<Pet>['root']] {
    return [this.rats.root, this.dogs.root];
  }

  /** Load the models in their salt coats (before the warm-up, so the coats' maps are there when the shaders build). */
  static async load(): Promise<PetView> {
    const [rat, dog] = await Promise.all([Rigged.fetch('quarry_rat.glb', SALT_RAT_COAT), Rigged.fetch('feral_dog.glb', SALT_DOG_COAT)]);
    return new PetView(new FigurePool('salt rats', POOL, () => new PetFigure(rat, RAT_CLIPS)), new FigurePool('salt dogs', POOL, () => new PetFigure(dog, DOG_CLIPS)));
  }

  draw(pets: readonly Pet[], time: number): void {
    this.rats.draw(pets.filter((p) => p.kind === 'rat'), time);
    this.dogs.draw(pets.filter((p) => p.kind === 'dog'), time);
  }
}
