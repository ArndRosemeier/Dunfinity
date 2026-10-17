/**
 * The slimes on screen (src/creatures/slimes.ts), modelled, rigged and animated in Blender
 * (AssetGenerator specs `creature_lumen_slime` and `creature_murk_slime`, see
 * src/render/creatures/rigged.ts): Lumen, a pale jelly with glowing motes in its skin, and Murk, a
 * black, lumpy, oily one. They slump and tremble at rest, crawl in pulses (heaping up, then pouring
 * forward, the front lobe first), squash down before a blow (the tell) and throw themselves forward
 * with it, quiver when hit, and melt into a puddle when they die.
 *
 * A fixed pool per faction, added with the Stage once.
 */
import { Group } from 'three/webgpu';
import { LUMEN_COAT, MURK_COAT } from '../materials';
import type { Slime } from '../../creatures/slimes';
import { FigurePool } from './figures';
import { Rigged, RiggedFigure, type ClipUse } from './rigged';

/** How many of each faction can be drawn at once. */
const POOL = 16;

/** The clips (AssetGenerator's quadruped slime_clips.py). Ooze is one pulse, played by the slime's own. */
const CLIPS: Record<string, ClipUse> = {
  Rest: { loop: true },
  Ooze: { loop: true, stride: 1 },
  Feed: { loop: true },
  Sleep: { loop: true },
  Blow: { loop: false },
  Die: { loop: false },
};

/** Where in the Ooze clip its pour is at the top of the game's pulse (sin(phase) = 1). */
const POUR = 0.45;

class SlimeFigure extends RiggedFigure<Slime> {
  protected clipFor(s: Slime): string {
    // Spread over its food, or asleep with its colony (src/creatures/life.ts).
    if (s.pose === 'feed') return 'Feed';
    if (s.pose === 'rest') return 'Sleep';
    switch (s.mode) {
      case 'dead': return 'Die';
      case 'blow': return 'Blow';
      case 'go': case 'ooze': return 'Ooze';
      default: return 'Rest';
    }
  }

  /** Pulses, not metres: one Ooze cycle per pulse. */
  protected travelled(s: Slime): number {
    return s.phase / (Math.PI * 2) + POUR;
  }
}

/** Both factions' pools: Lumen and Murk. */
export class SlimeView {
  readonly root = new Group();

  private constructor(readonly lumen: FigurePool<Slime>, readonly murk: FigurePool<Slime>) {
    this.root.add(lumen.root, murk.root);
  }

  /** Load the models (before the warm-up, so their skins' maps are there when the shaders build). */
  static async create(): Promise<SlimeView> {
    const [lumen, murk] = await Promise.all([Rigged.fetch('lumen_slime.glb', LUMEN_COAT), Rigged.fetch('murk_slime.glb', MURK_COAT)]);
    return new SlimeView(
      new FigurePool<Slime>('lumen', POOL, () => new SlimeFigure(lumen, CLIPS)),
      new FigurePool<Slime>('murk', POOL, () => new SlimeFigure(murk, CLIPS)),
    );
  }
}
