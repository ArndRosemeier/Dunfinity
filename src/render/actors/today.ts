/**
 * Who people of today may be and what they wear, from what the Actors pack offers (pure: tests run it).
 */
import type { CharacterCatalog } from '@actors/generator';

/** Garments of a fantasy world (helmets, robes, gowns, horns...), not worn in a village of today. */
const FANTASY = /viking|wizard|witch|santa|knight|dragon|skull|horned|corinthian|monk|medieval|goddess|elven|priestess|ninja|pirate|gown|bodice|helmet/;

/**
 * What a person of today may be and wear: human, in everyday clothes, and only what is free to ship
 * without a credit line (garments and hair under CC-BY are left out). Outfit presets keep only
 * those whose garments are all left in.
 */
export function today(all: CharacterCatalog): CharacterCatalog {
  const garments = all.garments.filter((g) => !g.credit && !FANTASY.test(g.id));
  const ids = new Set(garments.map((g) => g.id));
  return {
    ...all,
    races: all.races.filter((r) => r.id === 'human'),
    garments,
    hair: all.hair.filter((h) => !h.credit),
    outfits: all.outfits.filter((o) => [...o.garments, ...(o.female ?? [])].every((g) => ids.has(g))),
  };
}
