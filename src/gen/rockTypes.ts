/**
 * The kinds of rock the rock shader can draw (src/render/materials.ts `ROCK`), and a mix of them: how
 * much of each a style's (or a band's) rock is. The shader lays the types of a mix out in patches
 * and beds 5-30 m across; the mix is per vertex, blended across style edges like the colour
 * (`StyledField.rocks`), so a style says only which rock it is cut through, and in what proportions.
 */
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
