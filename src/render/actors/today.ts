/**
 * Who the game's people may be and what they wear, from what the Actors pack offers (pure: tests run it).
 */
import { filterCatalog, type CharacterCatalog } from '@actors/generator';

/** The settings of today's village in Actors' theme tags: modern clothes and grandma's vintage ones; no real-world religious symbols. */
const NOW = { themes: ['modern', 'vintage'], without: ['real-faith'] };

/** Garments the tags call modern that are still not worn about the village: helmets (motorcycle, army) and gowns. */
const NOT_EVERYDAY = /helmet|gown/;

/**
 * What the game may draw of the pack at all: every people, and only what is free to ship without a
 * credit line (garments and hair under CC-BY are left out). Outfit presets keep only those whose
 * garments are all left in.
 */
export function uncredited(all: CharacterCatalog): CharacterCatalog {
  return keep(all, all.garments.filter((g) => !g.credit), all.races);
}

/** What a person of today may be and wear: human, in everyday clothes (`NOW`, less `NOT_EVERYDAY`), and nothing credited (`uncredited`). */
export function today(every: CharacterCatalog): CharacterCatalog {
  const all = filterCatalog(every, NOW);
  return keep(all, all.garments.filter((g) => !g.credit && !NOT_EVERYDAY.test(g.id)), all.races.filter((r) => r.id === 'human'));
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
