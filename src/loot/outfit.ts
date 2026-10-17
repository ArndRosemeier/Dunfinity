/**
 * What a grandchild wears (Scale's city outfits, brought over with the character creator; no hero
 * tights or masks): a small editable spec of garments and colours, kept in the save, that the
 * wardrobe (src/render/humans/wardrobe.ts) turns into clothes. The kit they put on below (the hard
 * hat, the gloves) goes over it.
 *
 * Today's clothes (the game is set in 2026): what someone would put on to look at grandma's cellar.
 */
import { Rng, deriveSeed } from '@futuremagic/core';

export type Rgb = [number, number, number];

export const TOPS = ['tshirt', 'shirt', 'sweater', 'hoodie', 'dress'] as const;
export const OUTERS = ['none', 'jacket', 'raincoat', 'blazer', 'coat'] as const;
export const BOTTOMS = ['jeans', 'chinos', 'shorts', 'skirt'] as const;
export const SHOES = ['sneakers', 'shoes', 'boots'] as const;
export const HATS = ['none', 'cap', 'beanie'] as const;
export const PATTERNS = ['plain', 'stripes', 'checks'] as const;

export interface OutfitSpec {
  top: (typeof TOPS)[number];
  topColor: Rgb;
  /** The top's trim and pattern colour. */
  topColor2: Rgb;
  topPattern: (typeof PATTERNS)[number];
  outer: (typeof OUTERS)[number];
  outerColor: Rgb;
  /** A leather jacket (the jacket only). */
  outerLeather: boolean;
  /** Not worn under a dress. */
  bottom: (typeof BOTTOMS)[number];
  bottomColor: Rgb;
  shoes: (typeof SHOES)[number];
  shoesColor: Rgb;
  hat: (typeof HATS)[number];
  hatColor: Rgb;
  /** The fine cut: a skirt's or a dress's length, a dress's sleeves. */
  seed: number;
}

/** Fabric colours to pick from: darks, greys, naturals and a few brights. */
export const FABRIC: readonly Rgb[] = [
  [0.12, 0.13, 0.16], [0.2, 0.22, 0.3], [0.3, 0.3, 0.32], [0.55, 0.55, 0.56], [0.85, 0.85, 0.82], [0.95, 0.92, 0.85],
  [0.55, 0.12, 0.12], [0.75, 0.22, 0.17], [0.9, 0.55, 0.6], [0.85, 0.64, 0.23], [0.7, 0.6, 0.2],
  [0.15, 0.35, 0.2], [0.35, 0.48, 0.23], [0.2, 0.35, 0.55], [0.3, 0.55, 0.79], [0.3, 0.2, 0.35], [0.55, 0.42, 0.3], [0.35, 0.3, 0.25],
];
export const DENIM: readonly Rgb[] = [[0.18, 0.25, 0.42], [0.12, 0.16, 0.28], [0.3, 0.38, 0.55], [0.08, 0.08, 0.1], [0.42, 0.49, 0.6]];
export const SHOE: readonly Rgb[] = [[0.08, 0.08, 0.08], [0.25, 0.15, 0.08], [0.9, 0.9, 0.9], [0.4, 0.3, 0.2], [0.15, 0.18, 0.3], [0.55, 0.12, 0.12], [0.7, 0.63, 0.48]];

/**
 * Everyday clothes of today for someone going to look at a cellar (seeded): warm tops and an outer
 * layer more often than not, jeans or chinos, boots or trainers; now and then a beanie or a cap.
 * `woman`: a skirt or a dress sometimes.
 */
export function everydayOutfit(seed: number, woman: boolean): OutfitSpec {
  const r = new Rng(deriveSeed(seed, 'outfit'));
  const top = r.weighted(TOPS, (t) => (t === 'dress' ? (woman ? 0.4 : 0) : t === 'tshirt' ? 1 : t === 'hoodie' || t === 'sweater' ? 2.5 : 1.5));
  const bottom = r.weighted(BOTTOMS, (b) => (b === 'jeans' ? 3 : b === 'chinos' ? 2 : b === 'skirt' ? (woman ? 0.8 : 0) : 0.3));
  const outer = r.weighted(OUTERS, (o) => (o === 'none' ? 2 : o === 'jacket' || o === 'raincoat' ? 2 : o === 'coat' ? 1 : 0.4));
  return {
    top, topColor: r.pick(FABRIC), topColor2: r.pick(FABRIC), topPattern: r.weighted(PATTERNS, (p) => (p === 'plain' ? 6 : 1)),
    outer, outerColor: r.pick(FABRIC), outerLeather: outer === 'jacket' && r.chance(0.25),
    bottom, bottomColor: bottom === 'jeans' ? r.pick(DENIM) : r.pick(FABRIC),
    shoes: r.weighted(SHOES, (s) => (s === 'boots' ? 3 : s === 'sneakers' ? 2.5 : 0.8)), shoesColor: r.pick(SHOE),
    hat: r.weighted(HATS, (h) => (h === 'none' ? 6 : 1)), hatColor: r.pick(FABRIC),
    seed: r.int(0, 1 << 30),
  };
}
