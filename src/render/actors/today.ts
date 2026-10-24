/**
 * Who the game's people may be and what they wear, from what the Actors pack offers (pure: tests run it).
 */
import type { CharacterCatalog } from '@actors/generator';

/** Garments of a fantasy world (helmets, robes, gowns, horns...) or of the far future (Commonwear 3026), not worn in a village of today. */
const FANTASY = /future|viking|wizard|witch|santa|knight|dragon|skull|horned|corinthian|monk|medieval|goddess|elven|priestess|ninja|pirate|gown|bodice|helmet/;

/**
 * What the game may draw of the pack at all: every people, and only what is free to ship without a
 * credit line (garments and hair under CC-BY are left out). Outfit presets keep only those whose
 * garments are all left in.
 */
export function uncredited(all: CharacterCatalog): CharacterCatalog {
  return keep(all, all.garments.filter((g) => !g.credit), all.races);
}

/** What a person of today may be and wear: human, in everyday clothes, and nothing credited (`uncredited`). */
export function today(all: CharacterCatalog): CharacterCatalog {
  return keep(all, all.garments.filter((g) => !g.credit && !FANTASY.test(g.id)), all.races.filter((r) => r.id === 'human'));
}

function keep(all: CharacterCatalog, garments: CharacterCatalog['garments'], races: CharacterCatalog['races']): CharacterCatalog {
  const ids = new Set(garments.map((g) => g.id));
  return {
    ...all,
    races,
    garments,
    hair: all.hair.filter((h) => !h.credit),
    outfits: all.outfits.filter((o) => [...o.garments, ...(o.female ?? [])].every((g) => ids.has(g))),
  };
}
