/**
 * The registry of level styles (docs/design/level-styles.md): how each style is made for a level.
 * A new style is a file implementing `Style` (src/gen/style.ts), its id in `StyleId`, and one entry
 * here; a band's mix (src/gen/bands.ts) then gives it a share of levels.
 *
 * The excavation is not made here: every level has one (the workings' own business, the water
 * table), and the cellar stands in for it at depth 0.
 */
import type { Band } from './bands';
import type { QuarryField } from './quarry';
import type { Mix } from './regions';
import { Karst } from './karst';
import { Rift } from './rift';
import { Collapse } from './collapse';
import { Catacombs } from './catacombs';
import { Dungeon } from './dungeon';
import { Roots } from './roots';
import { Fungal } from './fungal';
import { Lava } from './lava';
import { Geode } from './geode';
import type { Style, StyleId } from './style';

/** Makes the style for a level, from the level's seed and band. */
type Make = (seed: number, band: Band) => Style;

const MAKE: Partial<Record<StyleId, Make>> = {
  karst: (seed, band) => new Karst(seed, band),
  rift: (seed, band) => new Rift(seed, band),
  collapse: (seed, band) => new Collapse(seed, band),
  catacombs: (seed, band) => new Catacombs(seed, band),
  dungeon: (seed, band) => new Dungeon(seed, band),
  roots: (seed, band) => new Roots(seed, band),
  fungal: (seed, band) => new Fungal(seed, band),
  lava: (seed, band) => new Lava(seed, band),
  geode: (seed, band) => new Geode(seed, band),
};

/** The styles that can be asked for by name (`?style=`), the excavation and the cellar aside. */
export const NAMED_STYLES = Object.keys(MAKE) as StyleId[];

/** The styles of `mix`, in its order: the excavation (or cellar) for its own id, the rest made here. */
export function stylesOf(mix: Mix, excavation: QuarryField, seed: number, band: Band): Style[] {
  return mix.map(([id]) => {
    if (id === excavation.id) return excavation;
    const make = MAKE[id];
    if (!make) throw new Error(`no style '${id}' (src/gen/styles.ts)`);
    return make(seed, band);
  });
}

/**
 * A level all of one style, for trying it out (`?style=<id>`): the style everywhere but in the
 * region where one arrives, which stays the excavation's (its ladder up is there).
 */
export function onlyMix(id: StyleId, excavation: StyleId): Mix {
  return id === excavation ? [[id, 1]] : [[excavation, 0.001], [id, 1]];
}
