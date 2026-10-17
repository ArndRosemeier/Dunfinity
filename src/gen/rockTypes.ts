/**
 * The kinds of rock the rock shader can draw (src/render/materials.ts `ROCK`), and a mix of them: how
 * much of each a style's (or a band's) rock is. The shader lays the types of a mix out in patches
 * and beds 5-30 m across; the mix is per vertex, blended across style edges like the colour
 * (`StyledField.rocks`), so a style says only which rock it is cut through, and in what proportions.
 */
import { express, gene, type Gene } from './genes';
import { SHALLOW } from './genome';

export const ROCK_TYPES = ['limestone', 'sandstone', 'shale', 'granite', 'salt', 'basalt', 'marble', 'slate'] as const;
export type RockType = (typeof ROCK_TYPES)[number];

/** Weights of the rock types, in `ROCK_TYPES` order (eight numbers; their sum does not matter). */
export type RockMix = readonly number[];

/** A mix from weights by name (missing types: 0). */
export function rockMix(w: Partial<Record<RockType, number>>): RockMix {
  return ROCK_TYPES.map((t) => w[t] ?? 0);
}

/** Write a mix into out at o (eight numbers). */
export function putRocks(m: RockMix, out: Float32Array, o: number): void {
  for (let i = 0; i < ROCK_TYPES.length; i++) out[o + i] = m[i];
}

/**
 * A rock's look, as the rock shader draws it in one of its slots (src/render/materials.ts
 * `ROCK_RECIPES`): data, not shader code, so a level can carry any stone without a new shader.
 * Colours multiply the band's rock colour (1 is the band's own).
 * - `base`: its colour; `bedColor`, `bed`: beds a hand thick shading from the base towards this (0–1);
 * - `laminae`: thin dark partings every few centimetres, how dark (shale);
 * - `veinColor`, `vein`: veins of this colour, how strongly (marble), and `glow`: how brightly they shine;
 * - `spots`: its crystals, pale (above 0, basalt's specks) or dark (below 0, granite's);
 * - `cleavage`: how dark its slanting cleavage planes are (slate);
 * - `salt`: how much it is rock salt (pale and dark beds, clay partings, the cutting machines' rings).
 */
export interface RockRecipe {
  base: Rgb;
  bed: number;
  bedColor: Rgb;
  laminae: number;
  veinColor: Rgb;
  vein: number;
  spots: number;
  cleavage: number;
  salt: number;
  glow: number;
}

/** Linear RGB, a multiplier of the band's rock colour. */
export type Rgb = readonly [number, number, number];

/** Numbers per packed recipe (four vec4s in the shader). */
export const RECIPE_SIZE = 16;

/** How many recipes a level loads at once: one per rock-type weight of a vertex (`RockMix`). */
export const ROCK_SLOTS = ROCK_TYPES.length;

const plain = { bed: 0, laminae: 0, vein: 0, spots: 0, cleavage: 0, salt: 0, glow: 0 };

/** Today's rock types as recipes, the slots' defaults (as the shader drew them before recipes). */
export const ROCK_PRESETS: Record<RockType, RockRecipe> = {
  limestone: { ...plain, base: [1.14, 1.1, 1.0], bedColor: [1.14, 1.1, 1.0], veinColor: [1.14, 1.1, 1.0] },
  sandstone: { ...plain, base: [1.126, 0.862, 0.581], bedColor: [1.408, 1.078, 0.726], bed: 1, veinColor: [1.28, 0.98, 0.66] },
  shale: { ...plain, base: [0.5, 0.48, 0.47], bedColor: [0.5, 0.48, 0.47], laminae: 0.5, veinColor: [0.5, 0.48, 0.47] },
  granite: { ...plain, base: [0.86, 0.82, 0.86], bedColor: [0.86, 0.82, 0.86], spots: -1.4, veinColor: [0.86, 0.82, 0.86] },
  salt: { ...plain, base: [1, 1, 1], bedColor: [1, 1, 1], salt: 1, veinColor: [1, 1, 1] },
  basalt: { ...plain, base: [0.2, 0.2, 0.22], bedColor: [0.2, 0.2, 0.22], spots: 0.8, veinColor: [0.2, 0.2, 0.22] },
  marble: { ...plain, base: [1.55, 1.52, 1.45], bedColor: [1.55, 1.52, 1.45], veinColor: [0.8525, 0.836, 0.7975], vein: 1 },
  slate: { ...plain, base: [0.5, 0.56, 0.64], bedColor: [0.5, 0.56, 0.64], cleavage: 0.4, veinColor: [0.5, 0.56, 0.64] },
};

/** The recipe as the shader reads it: base, bed; bedColor, laminae; veinColor, vein; spots, cleavage, salt, glow. */
export function packRecipe(r: RockRecipe, out: Float32Array | number[], o: number): void {
  const v = [...r.base, r.bed, ...r.bedColor, r.laminae, ...r.veinColor, r.vein, r.spots, r.cleavage, r.salt, r.glow];
  for (let k = 0; k < RECIPE_SIZE; k++) out[o + k] = v[k];
}

/**
 * The knobs a stratum may turn on its stone (docs/design/generative-depth.md §5): over the whole stratum
 * its hue and whether its veins glow; per slot a stone's hue, brightness and colourfulness, its beds,
 * laminae, veins (their hue and brightness), crystals and cleavage. Hue in turns around grey, the others
 * as multipliers or amounts. Salt stays what it is: a salt slot is the Salt Works' own.
 */
const STRATUM_GENES = {
  hue: gene('rock.hue', 0, [-0.04, 0.04], [-0.5, 0.5]),
  glow: gene('rock.glow', 0, [0, 0], [0, 1.5]),
};

interface SlotGenes { readonly [k: string]: Gene }

function slotGenes(t: RockType): SlotGenes {
  const p = ROCK_PRESETS[t], n = (k: string) => `rock.${t}.${k}`;
  // An amount's safe range: the preset nudged by `d` either way, inside [lo, hi].
  const amount = (k: string, v: number, d: number, lo: number, hi: number) =>
    gene(n(k), v, [Math.max(lo, v - d), Math.min(hi, v + d)], [lo, hi]);
  return {
    hue: gene(n('hue'), 0, [-0.05, 0.05], [-0.5, 0.5]),
    value: gene(n('value'), 1, [0.85, 1.18], [0.35, 1.9]),
    chroma: gene(n('chroma'), 1, [0.6, 1.5], [0, 4]),
    bed: amount('bed', p.bed, 0.3, 0, 1),
    bedValue: gene(n('bedValue'), 1, [0.85, 1.2], [0.4, 2]),
    laminae: amount('laminae', p.laminae, 0.2, 0, 0.9),
    vein: amount('vein', p.vein, 0.25, 0, 1),
    veinHue: gene(n('veinHue'), 0, [-0.05, 0.05], [-0.5, 0.5]),
    veinValue: gene(n('veinValue'), 1, [0.8, 1.25], [0.3, 3]),
    spots: amount('spots', p.spots, 0.4, -2, 2),
    cleavage: amount('cleavage', p.cleavage, 0.15, 0, 0.8),
  };
}

const SLOT_GENES: Record<RockType, SlotGenes> = Object.fromEntries(ROCK_TYPES.map((t) => [t, slotGenes(t)])) as Record<RockType, SlotGenes>;

/** A colour turned `hue` turns around the grey axis, its distance from grey times `chroma`, all times `value` (never below 0). */
function shade(c: Rgb, hue: number, chroma: number, value: number): Rgb {
  const g = (c[0] + c[1] + c[2]) / 3, a = hue * Math.PI * 2, cos = Math.cos(a), sin = Math.sin(a) / Math.sqrt(3);
  const d = [c[0] - g, c[1] - g, c[2] - g];
  // Rodrigues about (1,1,1)/√3: the grey part stays, the rest turns (d has no component along the axis).
  const r = [0, 1, 2].map((i) => d[i] * cos + (d[(i + 2) % 3] - d[(i + 1) % 3]) * sin);
  return [0, 1, 2].map((i) => Math.max(0, (g + r[i] * chroma) * value)) as unknown as Rgb;
}

/**
 * The eight recipes of level `depth` in world `seed`, in `ROCK_TYPES` order. Levels 1–10 (and the
 * cellar) carry the presets; a stratum (level 11 on) draws its stone from the genes: presets nudged
 * inside safe ranges, and where it pushes a gene, new stone (green and glassy, banded, gold-veined,
 * glowing). Every level of a stratum carries the same stone. Pure: a function of (seed, depth).
 */
export function rockRecipesOf(seed: number, depth: number): RockRecipe[] {
  if (depth <= SHALLOW) return ROCK_TYPES.map((t) => ROCK_PRESETS[t]);
  const x = (g: Gene) => express(g, seed, depth);
  const hue = x(STRATUM_GENES.hue), glow = x(STRATUM_GENES.glow);
  return ROCK_TYPES.map((t) => {
    const p = ROCK_PRESETS[t], g = SLOT_GENES[t];
    const h = hue + x(g.hue), chroma = x(g.chroma), value = x(g.value);
    const base = shade(p.base, h, chroma, value);
    // A stone without veins of its own grows them darker than itself, and glowing rock shows its glow in them.
    const vein = Math.max(x(g.vein), glow > 0.05 ? 0.5 : 0);
    const veinColor = p.vein > 0 ? p.veinColor : p.base.map((v) => v * 0.6) as unknown as Rgb;
    return {
      base,
      bed: x(g.bed),
      bedColor: shade(p.bedColor, h, chroma, value * x(g.bedValue)),
      laminae: x(g.laminae),
      veinColor: shade(veinColor, h + x(g.veinHue), chroma, value * x(g.veinValue)),
      vein,
      spots: x(g.spots),
      cleavage: x(g.cleavage),
      salt: p.salt,
      glow,
    };
  });
}
