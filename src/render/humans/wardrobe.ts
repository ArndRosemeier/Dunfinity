/**
 * Dunfinity's wardrobe for the humanoid package (its `Wardrobe` hook): which clothes exist and how
 * they sit, as garment shells the package fits to any body: the rags a grandchild goes down in,
 * and Grandma's kitchen knife in the hand.
 */
import type { EquipmentVisuals, ItemVisual, ShellLayer, ShellMaterial, WearableSpec } from '@futuremagic/humanoid';
import type { Wardrobe } from '@futuremagic/humanoid/three';
import { Group, type Mesh, type Object3D } from 'three/webgpu';
import { PropBuilder } from '../../gen/propMesh';
import { meshFromData } from '../meshes';
import { METAL, VERTEX_COLOR_SOLID } from '../materials';

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

/**
 * Grandma's kitchen knife, in grip space (the fist round the handle at the origin, the blade up +y,
 * the edge towards -x): a dark wooden handle with two rivets, a steel blade with a curved belly.
 */
function kitchenKnife(): Object3D {
  const steel = new PropBuilder(), wood = new PropBuilder();
  wood.upright(0, 0, 0, 0, 0.011, 0.055, 0.008, [0.12, 0.07, 0.04]);
  for (const y of [-0.025, 0.025]) wood.upright(0, y, 0, 0, 0.004, 0.004, 0.0085, [0.5, 0.48, 0.45]);
  steel.upright(0.001, 0.059, 0, 0, 0.012, 0.004, 0.006, [0.55, 0.56, 0.58]); // bolster
  // The blade: the spine straight along +x, the belly narrowing to the tip.
  const blade: [number, number, number][] = [[0.063, 0.16, 0.017], [0.16, 0.2, 0.0125], [0.2, 0.222, 0.0065], [0.222, 0.232, 0.0025]];
  for (const [y0, y1, hw] of blade) steel.box(0.011 - hw, (y0 + y1) / 2, 0, [hw, 0, 0], [0, (y1 - y0) / 2, 0], [0, 0, 0.0012], [0.62, 0.63, 0.65]);
  const g = new Group();
  for (const [b, kind] of [[wood, VERTEX_COLOR_SOLID], [steel, METAL]] as const) {
    const m: Mesh = meshFromData(b.build()!, kind);
    g.add(m);
  }
  return g;
}

export const WARDROBE: Wardrobe = {
  resolve,
  itemDef: (defId) => (defId === 'knife' ? { visual: { shape: 'knife' }, category: 'weapon' } : { visual: { shape: defId } }),
  buildItem: (defId) => {
    if (defId === 'knife') return kitchenKnife();
    throw new Error(`no held item "${defId}"`);
  },
  disposeItem: (o) => o.traverse((m) => (m as Mesh).geometry?.dispose()),
};

const visual = (seed: number, primary: Rgb, secondary: Rgb, wear: number): ItemVisual =>
  ({ shape: 'cloth', seed, primary, secondary, accent: secondary, material: 'cloth', glow: 0, wear });

/** What a grandchild goes down in, and Grandma's knife. */
export function rags(seed: number): EquipmentVisuals {
  return {
    chest: { defId: 'tunic', visual: visual(seed, [0.36, 0.3, 0.22], [0.24, 0.22, 0.2], 0.6) },
    legs: { defId: 'trousers', visual: visual(seed + 1, [0.2, 0.19, 0.17], [0.15, 0.14, 0.12], 0.55) },
    feet: { defId: 'footwraps', visual: visual(seed + 2, [0.3, 0.2, 0.12], [0.2, 0.13, 0.08], 0.4) },
    mainhand: { defId: 'knife', visual: { ...visual(seed + 3, [0.6, 0.6, 0.62], [0.12, 0.07, 0.04], 0.3), shape: 'knife', material: 'metal' } },
  };
}
