/**
 * The rats on screen (src/creatures/rats.ts): a fat, grizzled quarry rat modelled, rigged and animated
 * in Blender (AssetGenerator spec `creature_quarry_rat`, see src/render/creatures/rigged.ts), with
 * naked ears and a long ringed tail, orange incisors. The deep's have the salt in their eyes, glowing
 * blue (`BEAST_EYE`, `EYE_HALO`: no ordinary animals, Arnd 2026-10-17); the town's have ordinary dark ones.
 * Every action shows: sniffing about with its nose working, the pottering scurry, the bounding run at
 * you, up on its hind legs when it notices you, the bite (rearing back with the mouth wide, then the
 * snap with the paws flung out), a flinch when hit, and over onto its back with its legs curling when
 * it dies.
 *
 * Two fixed pools, built once and added with the Stage before play.
 */
import { RAT_COAT } from '../materials';
import type { Rat } from '../../creatures/rats';
import { RiggedFigure, WildAndTame, type ClipUse } from './rigged';

/** How many rats can be drawn at once: the deep's, and the town's. */
const POOL = { wild: 36, tame: 12 } as const;

/** The clips (AssetGenerator's quadruped rat_clips.py; strides there as STRIDES). */
const CLIPS: Record<string, ClipUse> = {
  Sniff: { loop: true },
  Scurry: { loop: true, stride: 0.22 },
  Run: { loop: true, stride: 0.45 },
  Rear: { loop: true },
  Graze: { loop: true },
  Sleep: { loop: true },
  Bite: { loop: false },
  Die: { loop: false },
};

/** Ground speeds (m/s, at size 1) where it changes gait: up past the first, back below the second. */
const MOVING = [0.25, 0.1] as const;
const RUNNING = [2.2, 1.6] as const;

class RatFigure extends RiggedFigure<Rat> {
  protected clipFor(r: Rat): string {
    const moving = this.faster('moving', MOVING), running = this.faster('run', RUNNING);
    switch (r.mode) {
      case 'dead': return 'Die';
      case 'bite': return 'Bite';
      case 'alert': return 'Rear';
    }
    // Feeding, or asleep with its nest (src/creatures/life.ts).
    if (r.pose === 'feed') return 'Graze';
    if (r.pose === 'rest') return 'Sleep';
    return moving ? (running ? 'Run' : 'Scurry') : 'Sniff';
  }

  protected travelled(r: Rat): number {
    return r.gait * 0.09;
  }
}

/** The deep's and the town's, drawn (`RatView.draw(wild, town, time, from)`). */
export type RatView = WildAndTame<Rat>;

export const RatView = {
  load: (): Promise<RatView> => WildAndTame.load('quarry_rat.glb', RAT_COAT, 'rats', POOL, (rig) => new RatFigure(rig, CLIPS)),
};
