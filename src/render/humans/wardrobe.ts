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
 * A held thing in grip space, from its parts: wood (or anything plain) and metal, built by `build`
 * into two PropBuilders, turned `tilt` radians about the fist's x.
 */
function held(build: (wood: PropBuilder, metal: PropBuilder) => void, tilt = 0): Object3D {
  const wood = new PropBuilder(), metal = new PropBuilder();
  build(wood, metal);
  const g = new Group();
  for (const [b, kind] of [[wood, VERTEX_COLOR_SOLID], [metal, METAL]] as const) {
    const data = b.build();
    if (!data) continue;
    const m: Mesh = meshFromData(data, kind);
    m.rotation.x = tilt;
    m.matrixAutoUpdate = true;
    g.add(m);
  }
  return g;
}

/**
 * Grandma's kitchen knife, in grip space (the fist round the handle at the origin, the blade up +y,
 * the edge towards -x): a dark wooden handle with two rivets, a steel blade with a curved belly.
 */
export function kitchenKnife(): Object3D {
  // Built blade up (+Y, out of the thumb side of the fist), edge along +Z, then turned about the
  // fist's x so the blade carries on the line of the forearm: held for a thrust, not like a hammer.
  return held((wood, steel) => {
    wood.upright(0, 0, 0, 0, 0.008, 0.055, 0.011, [0.12, 0.07, 0.04]);
    for (const y of [-0.025, 0.025]) wood.upright(0, y, 0, 0, 0.0085, 0.004, 0.004, [0.5, 0.48, 0.45]);
    steel.upright(0, 0.059, 0.001, 0, 0.006, 0.004, 0.012, [0.55, 0.56, 0.58]); // bolster
    // The blade: the spine straight along -z, the belly narrowing to the tip.
    const blade: [number, number, number][] = [[0.063, 0.16, 0.017], [0.16, 0.2, 0.0125], [0.2, 0.222, 0.0065], [0.222, 0.232, 0.0025]];
    for (const [y0, y1, hw] of blade) steel.box(0, (y0 + y1) / 2, -0.011 + hw, [0.0012, 0, 0], [0, (y1 - y0) / 2, 0], [0, 0, hw], [0.62, 0.63, 0.65]);
  }, KNIFE_TILT);
}

/**
 * A miner's pick, in grip space: held like a hammer, near the end of the ash handle (up +y from the
 * fist), the iron head across the top with a point at each end.
 */
function minersPick(): Object3D {
  return held((wood, iron) => {
    wood.upright(0, 0.28, 0, 0, 0.017, 0.38, 0.022, [0.3, 0.22, 0.14]);
    iron.upright(0, 0.64, 0, 0, 0.05, 0.03, 0.028, [0.2, 0.19, 0.18]); // the eye round the handle
    for (const s of [-1, 1]) {
      iron.beam(0, 0.64, 0, s * 0.2, 0.62, 0, 0.022, 0.024, [0.22, 0.21, 0.2]);
      iron.beam(s * 0.2, 0.62, 0, s * 0.31, 0.585, 0, 0.012, 0.012, [0.3, 0.29, 0.28]);
    }
  });
}

/**
 * A crowbar, in grip space: a bent iron bar held near its straight end, the claw hooked over at
 * the top (up +y from the fist).
 */
function crowbar(): Object3D {
  return held((_, iron) => {
    iron.tube(0, -0.08, 0, 0, 0.5, 0, 0.014, [0.24, 0.16, 0.12]);
    iron.tube(0, 0.5, 0, 0.035, 0.58, 0, 0.014, [0.24, 0.16, 0.12]);
    iron.tube(0.035, 0.58, 0, 0.1, 0.6, 0, 0.012, [0.3, 0.29, 0.28]); // the claw, worn bright
  });
}

/**
 * Grandma's pot lid, as a shield (grip space as the humanoid straps a shield to the forearm: its
 * face out along +z): dented blue enamel, a black rim and a wooden knob.
 */
function potLid(): Object3D {
  // Built face up (+y); the shield's face is +z.
  return held((wood, enamel) => {
    enamel.cylinder(0, 0, 0, 0.17, 0.008, [0.16, 0.24, 0.38], 20);
    enamel.cylinder(0, 0, 0, 0.175, 0.004, [0.05, 0.05, 0.06], 20);
    enamel.ellipsoid(0.06, 0.012, 0.03, 0.04, 0.006, 0.035, [0.12, 0.17, 0.26], 6); // the dent
    wood.cylinder(0, 0.025, 0, 0.022, 0.015, [0.2, 0.12, 0.06], 8);
  }, Math.PI / 2);
}

/** How far the knife is turned from blade-up in the fist, radians (checked side-on in the ready pose). */
const KNIFE_TILT = 2.7;

export const WARDROBE: Wardrobe = {
  resolve,
  itemDef: (defId) => (defId === 'knife' ? { visual: { shape: 'knife' }, category: 'weapon' } : defId === 'potlid' ? { visual: { shape: 'shield-potlid' }, category: 'shield' } : { visual: { shape: defId } }),
  buildItem: (defId) => {
    if (defId === 'knife') return kitchenKnife();
    if (defId === 'pick') return minersPick();
    if (defId === 'crowbar') return crowbar();
    if (defId === 'potlid') return potLid();
    throw new Error(`no held item "${defId}"`);
  },
  disposeItem: (o) => o.traverse((m) => (m as Mesh).geometry?.dispose()),
};

const visual = (seed: number, primary: Rgb, secondary: Rgb, wear: number): ItemVisual =>
  ({ shape: 'cloth', seed, primary, secondary, accent: secondary, material: 'cloth', glow: 0, wear });

/** An outfit: chest, legs and feet as (garment, primary, secondary, wear), and what is in the hand. */
interface Outfit {
  clothes: readonly (readonly ['chest' | 'legs' | 'feet', string, Rgb, Rgb, number])[];
  hand: readonly [string, Rgb, Rgb, number] | null;
}

/** What a grandchild goes down in, and Grandma's knife. */
const RAGS: Outfit = {
  clothes: [['chest', 'tunic', [0.36, 0.3, 0.22], [0.24, 0.22, 0.2], 0.6], ['legs', 'trousers', [0.2, 0.19, 0.17], [0.15, 0.14, 0.12], 0.55], ['feet', 'footwraps', [0.3, 0.2, 0.12], [0.2, 0.13, 0.08], 0.4]],
  hand: ['knife', [0.6, 0.6, 0.62], [0.12, 0.07, 0.04], 0.3],
};

/** What a Salt-Touched still wears from the day it went down (salt-crusted work clothes), and its pick. */
const MINER: Outfit = {
  clothes: [['chest', 'tunic', [0.2, 0.21, 0.22], [0.42, 0.44, 0.46], 0.9], ['legs', 'trousers', [0.14, 0.13, 0.13], [0.4, 0.41, 0.43], 0.85], ['feet', 'footwraps', [0.12, 0.1, 0.08], [0.35, 0.35, 0.36], 0.8]],
  hand: ['pick', [0.22, 0.21, 0.2], [0.3, 0.22, 0.14], 0.6],
};

/** What the scavengers wear (three looks: patched work clothes, a dyed coat, tarpaulin), and their crowbars. */
const SCAVENGERS: readonly Outfit[] = [
  { clothes: [['chest', 'tunic', [0.3, 0.33, 0.22], [0.22, 0.2, 0.15], 0.75], ['legs', 'trousers', [0.18, 0.2, 0.24], [0.13, 0.14, 0.16], 0.7], ['feet', 'footwraps', [0.22, 0.16, 0.1], [0.15, 0.11, 0.07], 0.6]], hand: ['crowbar', [0.3, 0.29, 0.28], [0.24, 0.16, 0.12], 0.7] },
  { clothes: [['chest', 'tunic', [0.42, 0.16, 0.12], [0.2, 0.12, 0.1], 0.7], ['legs', 'trousers', [0.16, 0.15, 0.13], [0.12, 0.11, 0.1], 0.75], ['feet', 'footwraps', [0.12, 0.1, 0.08], [0.1, 0.08, 0.06], 0.6]], hand: ['crowbar', [0.3, 0.29, 0.28], [0.24, 0.16, 0.12], 0.7] },
  { clothes: [['chest', 'tunic', [0.16, 0.24, 0.3], [0.12, 0.16, 0.18], 0.8], ['legs', 'trousers', [0.26, 0.24, 0.18], [0.18, 0.16, 0.12], 0.8], ['feet', 'footwraps', [0.3, 0.2, 0.12], [0.2, 0.13, 0.08], 0.65]], hand: ['crowbar', [0.3, 0.29, 0.28], [0.24, 0.16, 0.12], 0.7] },
];

/** What the goblins wear (stolen and cut down: a sack-cloth smock, a miner's jacket gone black, a dyed rag), and a stolen kitchen knife each. */
const GOBLINS: readonly Outfit[] = [
  { clothes: [['chest', 'tunic', [0.34, 0.29, 0.2], [0.25, 0.2, 0.13], 0.95], ['legs', 'trousers', [0.2, 0.16, 0.11], [0.14, 0.11, 0.08], 0.9]], hand: ['knife', [0.5, 0.48, 0.45], [0.1, 0.06, 0.03], 0.8] },
  { clothes: [['chest', 'tunic', [0.12, 0.12, 0.13], [0.3, 0.3, 0.3], 0.95], ['legs', 'trousers', [0.16, 0.13, 0.1], [0.1, 0.09, 0.07], 0.9]], hand: ['knife', [0.5, 0.48, 0.45], [0.1, 0.06, 0.03], 0.8] },
  { clothes: [['chest', 'tunic', [0.4, 0.14, 0.1], [0.22, 0.1, 0.08], 0.95], ['legs', 'trousers', [0.22, 0.2, 0.14], [0.15, 0.13, 0.1], 0.9], ['feet', 'footwraps', [0.2, 0.15, 0.1], [0.14, 0.1, 0.07], 0.9]], hand: ['knife', [0.5, 0.48, 0.45], [0.1, 0.06, 0.03], 0.8] },
];

/** Frau Weber's cardigan over a long dark skirt, and her slippers: nothing in her hands. */
const CARDIGAN: Outfit = {
  clothes: [['chest', 'tunic', [0.42, 0.33, 0.36], [0.3, 0.25, 0.27], 0.35], ['legs', 'trousers', [0.12, 0.12, 0.16], [0.1, 0.1, 0.12], 0.3], ['feet', 'footwraps', [0.3, 0.12, 0.14], [0.2, 0.08, 0.1], 0.3]],
  hand: null,
};

/** The Tall One's shroud: a long, dark, worn cloth, and nothing in the hand. */
const SHROUD: Outfit = {
  clothes: [['chest', 'tunic', [0.06, 0.06, 0.07], [0.04, 0.04, 0.05], 0.95], ['legs', 'trousers', [0.05, 0.05, 0.06], [0.04, 0.04, 0.05], 0.95]],
  hand: null,
};

function dressIn(o: Outfit, seed: number, lid = false): EquipmentVisuals {
  const eq: EquipmentVisuals = {};
  o.clothes.forEach(([slot, defId, a, b, wear], k) => { eq[slot] = { defId, visual: visual(seed + k, a, b, wear) }; });
  if (o.hand) {
    const [defId, a, b, wear] = o.hand;
    eq.mainhand = { defId, visual: { ...visual(seed + 3, a, b, wear), shape: defId, material: 'metal' } };
  }
  if (lid) eq.offhand = { defId: 'potlid', visual: { ...visual(seed + 4, [0.16, 0.24, 0.38], [0.05, 0.05, 0.06], 0.4), shape: 'shield-potlid', material: 'metal' } };
  return eq;
}

/** A grandchild's rags and grandma's knife; `lid`: and her pot lid (the Pot Lid card). */
export const rags = (seed: number, lid = false): EquipmentVisuals => dressIn(RAGS, seed, lid);
export const minersClothes = (seed: number): EquipmentVisuals => dressIn(MINER, seed);
export const scavengersClothes = (seed: number, look: number): EquipmentVisuals => dressIn(SCAVENGERS[look % SCAVENGERS.length], seed);
export const goblinsClothes = (seed: number, look: number): EquipmentVisuals => dressIn(GOBLINS[look % GOBLINS.length], seed);
export const shroud = (seed: number): EquipmentVisuals => dressIn(SHROUD, seed);
export const cardigan = (seed: number): EquipmentVisuals => dressIn(CARDIGAN, seed);
