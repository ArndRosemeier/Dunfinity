/**
 * Dunfinity's wardrobe for the humanoid package (its `Wardrobe` hook): which clothes exist and how
 * they sit, as garment shells the package fits to any body: the rags a grandchild goes down in,
 * what they put on of their kit (src/loot/items.ts), and Grandma's kitchen knife in the hand.
 */
import type { BodyFit, EquipmentVisuals, ItemVisual, ShellLayer, ShellMaterial, WearableSpec } from '@futuremagic/humanoid';
import type { Wardrobe } from '@futuremagic/humanoid/three';
import { Group, type Mesh, type Object3D } from 'three/webgpu';
import { PropBuilder } from '../../gen/propMesh';
import { propModel } from '../../gen/models';
import { meshFromData } from '../meshes';
import { METAL, VERTEX_COLOR_SOLID } from '../materials';
import { QUALITY, type Item, type ItemKind } from '../../loot/items';
import type { OutfitSpec } from '../../loot/outfit';

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
    /** Kemal's miner's helmet: the modelled hard hat (dented green enamel, brim, lamp; `wear_hard_hat`) on the head, the hair tucked under. */
    case 'miners-helmet': return { layers: [{ kind: 'rigid', socket: 'head', build: hardHat }], hideHair: true };
    /** Work gloves: leather over the hands, a cuff over the wrist. */
    case 'work-gloves': return shell([{ region: 'hand.L' }, { region: 'hand.R' }, { region: 'forearm.L', from: 0.85 }, { region: 'forearm.R', from: 0.85 }], 0.006, 3, cloth(v, 'leather', { roughness: 0.7 }));
    default: return everyday(defId, v);
  }
}

/** Both sleeves or trouser legs covering `to` of the limb (0..1: the upper part first, then the lower). */
const limbs = (upper: 'upperarm' | 'thigh', lower: 'forearm' | 'shin', to: number): ShellLayer['regions'] => [
  { region: `${upper}.L`, to: Math.min(1, to * 2) }, { region: `${upper}.R`, to: Math.min(1, to * 2) },
  ...(to > 0.5 ? [{ region: `${lower}.L` as const, to: (to - 0.5) * 2 }, { region: `${lower}.R` as const, to: (to - 0.5) * 2 }] : []),
];
const ARMS = (to: number): ShellLayer['regions'] => limbs('upperarm', 'forearm', to);
const LEGS = (to: number): ShellLayer['regions'] => [{ region: 'pelvis' }, { region: 'buttocks' }, ...limbs('thigh', 'shin', to)];
const FEET: ShellLayer['regions'] = [{ region: 'foot.L' }, { region: 'foot.R' }];
const shade = (c: Rgb, k: number): Rgb => [c[0] * k, c[1] * k, c[2] * k];

/**
 * Today's clothes (Scale's city wardrobe, src/loot/outfit.ts names them): the item's
 * pattern in `visual.material` ('cloth' is plain), the fine cut from its seed. Null: not one of these.
 */
function everyday(defId: string, v: ItemVisual): WearableSpec | null {
  const c = v.primary, c2 = v.secondary;
  const pat = (v.material === 'cloth' ? 'plain' : v.material) as ShellMaterial['pattern'];
  const fab = (pattern: ShellMaterial['pattern'], o: Partial<ShellMaterial> = {}): ShellMaterial => cloth(v, pattern, { roughness: 0.85, sheen: 0.3, ...o });
  switch (defId) {
    case 'tshirt': return shell([...TORSO, ...ARMS(0.22)], 0.004, 1, fab(pat, { roughness: 0.9 }), { trim: { width: 0.006, color: c2 } });
    case 'shirt': return shell([...TORSO, ...ARMS(0.97)], 0.004, 1, fab(pat, { roughness: 0.75, sheen: 0.2 }), { trim: { width: 0.01, color: shade(c, 0.9) } });
    case 'sweater': return shell([...TORSO, { region: 'neck', to: 0.3 }, ...ARMS(0.95)], 0.008, 2, fab(pat === 'plain' ? 'quilted' : pat, { roughness: 0.95, patternScale: 14, sheen: 0.5 }), { trim: { width: 0.015, color: c2 } });
    /** A hoodie: thick plain fleece to the wrists, a ribbed band at the hem and cuffs. */
    case 'hoodie': return shell([...TORSO, { region: 'neck', to: 0.45 }, ...ARMS(0.97)], 0.01, 2, fab(pat, { roughness: 0.97, sheen: 0.45 }), { trim: { width: 0.022, color: shade(c, 0.8) } });
    case 'dress': return shell([...TORSO, { region: 'pelvis' }, { region: 'buttocks' }, ...ARMS(v.seed % 2 ? 0.2 : 0)], 0.006, 2, fab(pat, { roughness: 0.75, sheen: 0.5 }), { skirt: { length: 0.55 + (v.seed % 3) * 0.1, flare: 0.35 } });
    case 'jacket': return shell([...TORSO, ...ARMS(0.95)], 0.014, 3, fab(pat, { roughness: pat === 'leather' ? 0.55 : 0.8 }), { trim: { width: 0.02, color: c2 } });
    /** A rain jacket: shiny, to the waist. */
    case 'raincoat': return shell([...TORSO, ...ARMS(0.97)], 0.016, 3, fab('plain', { roughness: 0.3, sheen: 0.1 }), { trim: { width: 0.02, color: shade(c, 0.75) } });
    case 'blazer': return shell([...TORSO, ...ARMS(0.97)], 0.012, 3, fab('plain', { roughness: 0.7, sheen: 0.35 }), { skirt: { length: 0.22, flare: 0.05, slits: 1 }, trim: { width: 0.02, color: shade(c, 0.7) } });
    case 'coat': return shell([...TORSO, ...ARMS(0.97)], 0.02, 4, fab(pat, { roughness: 0.9, sheen: 0.4 }), { skirt: { length: 0.72, flare: 0.25, slits: 1 }, trim: { width: 0.03, color: c2 } });
    case 'jeans': return shell(LEGS(0.97), 0.006, 1, fab('plain', { roughness: 0.92 }));
    case 'chinos': return shell(LEGS(0.98), 0.007, 1, fab(pat, { roughness: 0.8 }));
    case 'shorts': return shell(LEGS(0.4), 0.006, 1, fab(pat));
    case 'skirt': return shell([{ region: 'pelvis', from: 0.5 }, { region: 'buttocks', from: 0.4 }], 0.008, 2, fab(pat, { roughness: 0.8 }), { skirt: { length: 0.45 + (v.seed % 3) * 0.12, flare: 0.3 } });
    case 'sneakers': return shell(FEET, 0.012, 1, fab('plain', { roughness: 0.7 }), { trim: { width: 0.02, color: [0.95, 0.95, 0.95] } });
    case 'shoes': return shell(FEET, 0.01, 1, fab('leather', { roughness: 0.4 }));
    case 'boots': return shell([...FEET, { region: 'shin.L', from: 0.65 }, { region: 'shin.R', from: 0.65 }], 0.012, 2, fab('leather', { roughness: 0.5 }));
    /** A knitted beanie (Scale's): a dome over the crown on the head socket, the hair tucked under. */
    case 'beanie': return { layers: [{ kind: 'rigid', socket: 'head', build: (fit) => beanie(fit, c) }], hideHair: true };
    /** A baseball cap (Scale's): a shallow dome and a stiff peak forward, on the head socket. */
    case 'cap': return { layers: [{ kind: 'rigid', socket: 'head', build: (fit) => cap(fit, c) }], hideHair: true };
    default: return null;
  }
}

/**
 * A beanie in head-socket space (+z forward, y up, from between the ears): a dome over the skull
 * (whose centre sits a little up and back from there), its rim tipped up at the brow and down at the nape.
 */
function beanie(fit: BodyFit, c: Rgb): Object3D {
  const r = fit.headRadius;
  return held((knit) => knit.ellipsoid(0, r * 0.3, -r * 0.08, r * 1.12, r * 1.25, r * 1.22, c, 18, -0.25, 0.5));
}

/** A cap in head-socket space: a shallow dome over the skull and a flat peak over the brow (half inside the dome). */
function cap(fit: BodyFit, c: Rgb): Object3D {
  const r = fit.headRadius;
  return held((cloth) => {
    cloth.ellipsoid(0, r * 0.35, -r * 0.06, r * 1.1, r * 1.12, r * 1.18, c, 18, -0.15, 0.5);
    cloth.ellipsoid(0, r * 0.42, r * 1.1, r * 0.8, 0.006, r * 0.62, shade(c, 0.85), 16, 0.15);
  });
}

/** What each worn item looks like on the body: its slot, colours and how worn it is when sound. Items not here are not seen (held ones are). */
const WORN: Partial<Record<ItemKind, readonly ['head' | 'hands', Rgb, Rgb, number]>> = {
  'miners-helmet': ['head', [0.24, 0.28, 0.22], [0.1, 0.1, 0.09], 0.55],
  'work-gloves': ['hands', [0.42, 0.3, 0.17], [0.28, 0.2, 0.11], 0.4],
};

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
 * A modelled tool held in the fist (the hatchet, pick and crowbar from AssetGenerator's Blender
 * props: origin at the butt of the handle, the handle up +y), stamped so the fist closes a hand's
 * breadth above the butt.
 */
function tool(name: 'held_hatchet' | 'held_pick' | 'held_crowbar'): Object3D {
  return held((paint) => paint.stamp(propModel(name), 0, -GRIP_UP, 0, 0));
}

/** How far above the butt of a modelled tool's handle the fist holds it, metres. */
const GRIP_UP = 0.07;

/** What each held item is built from (its defId, as the Salt-Touched's pick and the scavengers' crowbars use too), and its shape (for the grip). */
const TOOLS: Readonly<Record<string, readonly ['held_hatchet' | 'held_pick' | 'held_crowbar', string]>> = {
  hatchet: ['held_hatchet', 'axe-hatchet'],
  pick: ['held_pick', 'pick'],
  crowbar: ['held_crowbar', 'crowbar'],
};

/**
 * Kemal's flashlight, in grip space like the knife (along the forearm, the lamp end forward): a
 * black rubber barrel with a ridged grip and a chrome head round the glass.
 */
function flashlight(): Object3D {
  return held((rubber, chrome) => {
    rubber.tube(0, -0.07, 0, 0, 0.1, 0, 0.017, [0.06, 0.06, 0.065]);
    for (const y of [-0.04, -0.01, 0.02]) rubber.tube(0, y, 0, 0, y + 0.012, 0, 0.0185, [0.1, 0.1, 0.11]);
    chrome.tube(0, 0.1, 0, 0, 0.145, 0, 0.025, [0.62, 0.63, 0.66]);
    rubber.tube(0, 0.143, 0, 0, 0.147, 0, 0.022, [0.9, 0.88, 0.7]); // the glass
  }, KNIFE_TILT);
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

/**
 * The miner's hard hat on the head socket (its frame is the body's: +z forward): the packed model
 * (origin at the brim's centre underneath, lamp forward, made for a head of radius 0.1 m) scaled to
 * this head and lifted from the socket at ear height to sit on the crown.
 */
function hardHat(fit: BodyFit): Object3D {
  const k = fit.headRadius / HAT.radius;
  return held((paint) => paint.stamp(propModel('wear_hard_hat'), 0, fit.headRadius * HAT.lift, HAT.forward * fit.headRadius, 0, { scale: k }));
}

/** The hard hat's fit: the head it was made for, how far above the socket its brim sits and how far forward (both in head radii). */
const HAT = { radius: 0.1, lift: 0.3, forward: 0.05 } as const;

/** How far the knife is turned from blade-up in the fist, radians (checked side-on in the ready pose). */
const KNIFE_TILT = 2.7;

export const WARDROBE: Wardrobe = {
  resolve,
  itemDef: (defId) => (defId === 'knife' ? { visual: { shape: 'knife' }, category: 'weapon' } : defId === 'potlid' ? { visual: { shape: 'shield-potlid' }, category: 'shield' } : { visual: { shape: defId } }),
  buildItem: (defId) => {
    if (defId === 'knife') return kitchenKnife();
    if (TOOLS[defId]) return tool(TOOLS[defId][0]);
    if (defId === 'potlid') return potLid();
    if (defId === 'flashlight') return flashlight();
    throw new Error(`no held item "${defId}"`);
  },
  disposeItem: (o) => o.traverse((m) => (m as Mesh).geometry?.dispose()),
};

const visual = (seed: number, primary: Rgb, secondary: Rgb, wear: number, pattern = 'cloth'): ItemVisual =>
  ({ shape: 'cloth', seed, primary, secondary, accent: secondary, material: pattern, glow: 0, wear });

/** An outfit: head, chest, outer layer (back), legs and feet as (garment, primary, secondary, wear, pattern?), and what is in the hand. */
interface Outfit {
  clothes: readonly (readonly ['head' | 'chest' | 'back' | 'legs' | 'feet', string, Rgb, Rgb, number, string?])[];
  hand: readonly [string, Rgb, Rgb, number] | null;
}

/** What a grandchild goes down in, and Grandma's knife. */
const RAGS: Outfit = {
  clothes: [['chest', 'tunic', [0.36, 0.3, 0.22], [0.24, 0.22, 0.2], 0.6], ['legs', 'trousers', [0.2, 0.19, 0.17], [0.15, 0.14, 0.12], 0.55], ['feet', 'footwraps', [0.3, 0.2, 0.12], [0.2, 0.13, 0.08], 0.4]],
  hand: ['knife', [0.6, 0.6, 0.62], [0.12, 0.07, 0.04], 0.3],
};

/** What a Salt-Touched's bones still wear from the day it went down (its hard hat, the salt-crusted work trousers rotting off them), and its pick. */
const MINER: Outfit = {
  clothes: [['head', 'miners-helmet', [0.24, 0.28, 0.22], [0.1, 0.1, 0.09], 0.9], ['legs', 'trousers', [0.14, 0.13, 0.13], [0.4, 0.41, 0.43], 1]],
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

/** What the ghosts of the old races wear (seen through, in their tint): a dwarf's work clothes and boots, an elf's long pale robe; nothing in the hand. */
const GHOSTS: Readonly<Record<'dwarf' | 'elf', Outfit>> = {
  dwarf: { clothes: [['chest', 'tunic', [0.3, 0.26, 0.2], [0.42, 0.34, 0.2], 0.5], ['legs', 'trousers', [0.22, 0.2, 0.17], [0.16, 0.14, 0.12], 0.5], ['feet', 'footwraps', [0.2, 0.15, 0.1], [0.14, 0.1, 0.07], 0.5]], hand: null },
  elf: { clothes: [['chest', 'tunic', [0.7, 0.72, 0.76], [0.55, 0.6, 0.68], 0.3], ['legs', 'trousers', [0.62, 0.64, 0.7], [0.5, 0.52, 0.58], 0.3]], hand: null },
};

/** The stranger at Ilse's: a long dark travelling coat over dark trousers, worn boots. */
const TRAVELLER: Outfit = {
  clothes: [['chest', 'tunic', [0.14, 0.13, 0.12], [0.24, 0.2, 0.15], 0.7], ['legs', 'trousers', [0.12, 0.11, 0.1], [0.1, 0.09, 0.08], 0.7], ['feet', 'footwraps', [0.22, 0.16, 0.1], [0.15, 0.11, 0.07], 0.75]],
  hand: null,
};

/** Frau Weber's cardigan over a long dark skirt, and her slippers: nothing in her hands. */
const CARDIGAN: Outfit = {
  clothes: [['chest', 'tunic', [0.42, 0.33, 0.36], [0.3, 0.25, 0.27], 0.35], ['legs', 'trousers', [0.12, 0.12, 0.16], [0.1, 0.1, 0.12], 0.3], ['feet', 'footwraps', [0.3, 0.12, 0.14], [0.2, 0.08, 0.1], 0.3]],
  hand: null,
};

/** The shopkeepers: Kemal's brown shop coat over grey work trousers; Ilse's bottle-green cardigan over a dark skirt. Nothing in their hands. */
const KEEPERS: Readonly<Record<'hardware' | 'pawn', Outfit>> = {
  hardware: { clothes: [['chest', 'tunic', [0.34, 0.24, 0.14], [0.2, 0.15, 0.1], 0.35], ['legs', 'trousers', [0.24, 0.24, 0.25], [0.16, 0.16, 0.17], 0.4], ['feet', 'footwraps', [0.12, 0.09, 0.07], [0.08, 0.06, 0.05], 0.3]], hand: null },
  pawn: { clothes: [['chest', 'tunic', [0.14, 0.26, 0.18], [0.1, 0.18, 0.13], 0.3], ['legs', 'trousers', [0.13, 0.11, 0.12], [0.1, 0.08, 0.09], 0.3], ['feet', 'footwraps', [0.16, 0.08, 0.06], [0.1, 0.05, 0.04], 0.3]], hand: null },
};
/** The townsfolk out by day, people of today: jeans and a grey hoodie, a yellow rain jacket, a navy puffer and black leggings, a green fleece and chinos, a red parka, a white shirt and dark suit trousers; trainers and boots; nothing in the hand. */
const TOWNSFOLK: readonly Outfit[] = [
  { clothes: [['chest', 'tunic', [0.42, 0.43, 0.45], [0.3, 0.31, 0.33], 0.15], ['legs', 'trousers', [0.16, 0.24, 0.42], [0.12, 0.18, 0.32], 0.2], ['feet', 'footwraps', [0.85, 0.85, 0.83], [0.6, 0.6, 0.6], 0.15]], hand: null },
  { clothes: [['chest', 'tunic', [0.85, 0.66, 0.1], [0.6, 0.45, 0.08], 0.1], ['legs', 'trousers', [0.12, 0.12, 0.14], [0.09, 0.09, 0.1], 0.15], ['feet', 'footwraps', [0.3, 0.2, 0.12], [0.2, 0.13, 0.08], 0.2]], hand: null },
  { clothes: [['chest', 'tunic', [0.1, 0.13, 0.25], [0.07, 0.09, 0.18], 0.1], ['legs', 'trousers', [0.05, 0.05, 0.06], [0.04, 0.04, 0.05], 0.1], ['feet', 'footwraps', [0.9, 0.9, 0.9], [0.7, 0.3, 0.3], 0.1]], hand: null },
  { clothes: [['chest', 'tunic', [0.18, 0.36, 0.26], [0.12, 0.26, 0.18], 0.15], ['legs', 'trousers', [0.62, 0.55, 0.4], [0.45, 0.4, 0.3], 0.15], ['feet', 'footwraps', [0.22, 0.15, 0.1], [0.15, 0.1, 0.07], 0.2]], hand: null },
  { clothes: [['chest', 'tunic', [0.62, 0.12, 0.12], [0.2, 0.2, 0.22], 0.1], ['legs', 'trousers', [0.2, 0.28, 0.45], [0.14, 0.2, 0.32], 0.2], ['feet', 'footwraps', [0.12, 0.12, 0.13], [0.8, 0.8, 0.8], 0.15]], hand: null },
  { clothes: [['chest', 'tunic', [0.86, 0.87, 0.88], [0.7, 0.72, 0.75], 0.05], ['legs', 'trousers', [0.12, 0.13, 0.16], [0.09, 0.1, 0.12], 0.05], ['feet', 'footwraps', [0.08, 0.06, 0.05], [0.05, 0.04, 0.04], 0.05]], hand: null },
];

/** The Tall One's shroud: a long, dark, worn cloth, and nothing in the hand. */
const SHROUD: Outfit = {
  clothes: [['chest', 'tunic', [0.06, 0.06, 0.07], [0.04, 0.04, 0.05], 0.95], ['legs', 'trousers', [0.05, 0.05, 0.06], [0.04, 0.04, 0.05], 0.95]],
  hand: null,
};

function dressIn(o: Outfit, seed: number, lid = false, items: readonly Item[] = []): EquipmentVisuals {
  const eq: EquipmentVisuals = {};
  o.clothes.forEach(([slot, defId, a, b, wear, pattern], k) => { eq[slot] = { defId, visual: visual(seed + k, a, b, wear, pattern) }; });
  // The kit goes on over the clothes (the hard hat in place of a cap).
  for (const it of items) {
    const look = WORN[it.kind];
    if (!look) continue;
    const [slot, a, b, wear] = look;
    eq[slot] = { defId: it.kind, visual: visual(seed + 7, a, b, Math.min(1, wear / QUALITY[it.quality].factor)) };
  }
  const weapon = items.find((it) => TOOLS[it.kind]);
  if (weapon) eq.mainhand = { defId: weapon.kind, visual: { ...visual(seed + 3, [0.3, 0.29, 0.28], [0.3, 0.22, 0.14], Math.min(1, 0.5 / QUALITY[weapon.quality].factor)), shape: TOOLS[weapon.kind][1], material: 'metal' } };
  else if (o.hand) {
    const [defId, a, b, wear] = o.hand;
    eq.mainhand = { defId, visual: { ...visual(seed + 3, a, b, wear), shape: TOOLS[defId]?.[1] ?? defId, material: 'metal' } };
  }
  if (!lid && items.some((it) => it.kind === 'flashlight')) eq.offhand = { defId: 'flashlight', visual: { ...visual(seed + 4, [0.06, 0.06, 0.065], [0.62, 0.63, 0.66], 0.3), shape: 'flashlight', material: 'metal' } };
  if (lid) eq.offhand = { defId: 'potlid', visual: { ...visual(seed + 4, [0.16, 0.24, 0.38], [0.05, 0.05, 0.06], 0.4), shape: 'shield-potlid', material: 'metal' } };
  return eq;
}

/** Whether any of `items` worn hides the hair (a helmet). */
export const hidesHair = (items: readonly Item[]): boolean =>
  items.some((it) => !!WORN[it.kind] && !!resolve(it.kind, visual(0, [0, 0, 0], [0, 0, 0], 0))?.hideHair);

/** A grandchild's rags and grandma's knife; `lid`: and her pot lid (the Pot Lid card); `items`: what of their kit they have on. */
export const rags = (seed: number, lid = false, items: readonly Item[] = []): EquipmentVisuals => dressIn(RAGS, seed, lid, items);

/**
 * A grandchild in the clothes chosen in the creator (src/loot/outfit.ts; none: the rags),
 * grandma's knife in hand, `lid` and the kit `items` as with the rags.
 */
export function grandchildsClothes(outfit: OutfitSpec | undefined, seed: number, lid = false, items: readonly Item[] = []): EquipmentVisuals {
  if (!outfit) return rags(seed, lid, items);
  const o = outfit, wear = 0.15, s = o.seed >>> 0;
  const clothes: Outfit['clothes'][number][] = [['chest', o.top, o.topColor, o.topColor2, wear, o.topPattern]];
  if (o.top !== 'dress') clothes.push(['legs', o.bottom, o.bottomColor, o.bottomColor, o.bottom === 'jeans' ? 0.35 : wear]);
  if (o.outer !== 'none') clothes.push(['back', o.outer, o.outerColor, shade(o.outerColor, 0.8), wear, o.outerLeather && o.outer === 'jacket' ? 'leather' : 'plain']);
  clothes.push(['feet', o.shoes, o.shoesColor, [1, 1, 1], wear]);
  if (o.hat !== 'none') clothes.push(['head', o.hat, o.hatColor, o.hatColor, wear]);
  return dressIn({ clothes, hand: RAGS.hand }, s, lid, items);
}
export const minersClothes = (seed: number): EquipmentVisuals => dressIn(MINER, seed);
export const scavengersClothes = (seed: number, look: number): EquipmentVisuals => dressIn(SCAVENGERS[look % SCAVENGERS.length], seed);
export const goblinsClothes = (seed: number, look: number): EquipmentVisuals => dressIn(GOBLINS[look % GOBLINS.length], seed);
export const ghostsClothes = (seed: number, race: 'dwarf' | 'elf'): EquipmentVisuals => dressIn(GHOSTS[race], seed);
export const travellersClothes = (seed: number): EquipmentVisuals => dressIn(TRAVELLER, seed);
export const shroud = (seed: number): EquipmentVisuals => dressIn(SHROUD, seed);
export const cardigan = (seed: number): EquipmentVisuals => dressIn(CARDIGAN, seed);
export const keepersClothes = (seed: number, shop: 'hardware' | 'pawn'): EquipmentVisuals => dressIn(KEEPERS[shop], seed);
export const townsfolksClothes = (seed: number, look: number): EquipmentVisuals => dressIn(TOWNSFOLK[look % TOWNSFOLK.length], seed);
