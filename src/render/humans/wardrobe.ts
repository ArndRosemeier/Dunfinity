/**
 * Dunfinity's wardrobe for the humanoid package (its `Wardrobe` hook): which clothes exist and how
 * they sit, as garment shells the package fits to any body. For now the rags a grandchild goes
 * down in; held items (the kitchen knife) come with the first fight.
 */
import type { EquipmentVisuals, ItemVisual, ShellLayer, ShellMaterial, WearableSpec } from '@futuremagic/humanoid';
import type { Wardrobe } from '@futuremagic/humanoid/three';

type Rgb = [number, number, number];

const cloth = (v: ItemVisual, pattern: ShellMaterial['pattern'], o: Partial<ShellMaterial> = {}): ShellMaterial => ({
  color: v.primary,
  color2: v.secondary,
  pattern,
  patternScale: o.patternScale ?? 6,
  roughness: o.roughness ?? 0.92,
  metalness: 0,
  sheen: o.sheen ?? 0.25,
  glow: 0,
  glowColor: [0, 0, 0],
  wear: v.wear ?? 0.5,
});

const TORSO: ShellLayer['regions'] = [{ region: 'chest' }, { region: 'belly' }, { region: 'back' }];
const shell = (regions: ShellLayer['regions'], offset: number, layer: number, material: ShellMaterial, more: Partial<ShellLayer> = {}): WearableSpec =>
  ({ layers: [{ kind: 'shell', regions, offset, layer, material, ...more } as ShellLayer] });

function resolve(defId: string, v: ItemVisual): WearableSpec | null {
  const dark: Rgb = [v.primary[0] * 0.6, v.primary[1] * 0.6, v.primary[2] * 0.6];
  switch (defId) {
    /** A loose patched tunic hanging over the hips, sleeves to the forearm. */
    case 'tunic': return shell([...TORSO, { region: 'upperarm.L' }, { region: 'upperarm.R' }, { region: 'forearm.L', to: 0.55 }, { region: 'forearm.R', to: 0.55 }], 0.016, 2,
      cloth(v, 'patchwork', { patternScale: 4 }), { trim: { width: 0.012, color: dark }, skirt: { length: 0.09, flare: 0.03 } });
    /** Worn trousers to mid-shin. */
    case 'trousers': return shell([{ region: 'pelvis' }, { region: 'buttocks' }, { region: 'thigh.L' }, { region: 'thigh.R' }, { region: 'shin.L', to: 0.8 }, { region: 'shin.R', to: 0.8 }], 0.009, 1, cloth(v, 'plain'));
    /** Leather wrapped round the feet and ankles. */
    case 'footwraps': return shell([{ region: 'foot.L' }, { region: 'foot.R' }, { region: 'shin.L', from: 0.6 }, { region: 'shin.R', from: 0.6 }], 0.012, 2, cloth(v, 'leather', { roughness: 0.75 }));
    default: return null;
  }
}

export const WARDROBE: Wardrobe = {
  resolve,
  itemDef: (defId) => ({ visual: { shape: defId } }),
  buildItem: () => { throw new Error('no held items yet'); },
  disposeItem: () => undefined,
};

const visual = (seed: number, primary: Rgb, secondary: Rgb, wear: number): ItemVisual =>
  ({ shape: 'cloth', seed, primary, secondary, accent: secondary, material: 'cloth', glow: 0, wear });

/** What a grandchild goes down in. */
export function rags(seed: number): EquipmentVisuals {
  return {
    chest: { defId: 'tunic', visual: visual(seed, [0.36, 0.3, 0.22], [0.24, 0.22, 0.2], 0.6) },
    legs: { defId: 'trousers', visual: visual(seed + 1, [0.2, 0.19, 0.17], [0.15, 0.14, 0.12], 0.55) },
    feet: { defId: 'footwraps', visual: visual(seed + 2, [0.3, 0.2, 0.12], [0.2, 0.13, 0.08], 0.4) },
  };
}
