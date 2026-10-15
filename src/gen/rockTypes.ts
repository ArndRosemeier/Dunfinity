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
