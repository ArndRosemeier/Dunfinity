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
import { Basalt } from './basalt';
import { Flooded, type WaterTable } from './flooded';
import { Dwarven } from './dwarven';
import { Elven } from './elven';
import { Goblin } from './goblin';
import { Bones } from './bones';
import type { Style, StyleId } from './style';
import type { Traits } from './genes';

/** Makes the style for a level, from the level's seed and band, its water table (the excavation's, one per level, E5) and its genes (src/gen/genes.ts). */
type Make = (seed: number, band: Band, water: WaterTable, traits: Traits) => Style;

const MAKE: Partial<Record<StyleId, Make>> = {
  karst: (seed, band, _w, traits) => new Karst(seed, band, traits),
  rift: (seed, band, _w, traits) => new Rift(seed, band, traits),
  collapse: (seed, band) => new Collapse(seed, band),
  catacombs: (seed, band) => new Catacombs(seed, band),
  dungeon: (seed, band) => new Dungeon(seed, band),
  roots: (seed, band, _w, traits) => new Roots(seed, band, traits),
  fungal: (seed, band, _w, traits) => new Fungal(seed, band, traits),
  lava: (seed, band) => new Lava(seed, band),
  geode: (seed, band) => new Geode(seed, band),
  basalt: (seed, band) => new Basalt(seed, band),
  flooded: (seed, band, water) => new Flooded(seed, band, water),
  dwarven: (seed, band) => new Dwarven(seed, band),
  elven: (seed, band) => new Elven(seed, band),
  goblin: (seed, band) => new Goblin(seed, band),
  bones: (seed, band) => new Bones(seed, band),
};

/** The styles that can be asked for by name (`?style=`), the excavation and the cellar aside. */
export const NAMED_STYLES = Object.keys(MAKE) as StyleId[];

/** The styles of `mix`, in its order: the excavation (or cellar) for its own id, the rest made here with the level's genes. */
export function stylesOf(mix: Mix, excavation: QuarryField, seed: number, band: Band, traits: Traits): Style[] {
  return mix.map(([id]) => {
    if (id === excavation.id) return excavation;
    const make = MAKE[id];
    if (!make) throw new Error(`no style '${id}' (src/gen/styles.ts)`);
    return make(seed, band, (x, z) => excavation.water(x, z), traits);
  });
}

/**
 * A level all of one style, for trying it out (`?style=<id>`): the style everywhere but in the
 * region where one arrives, which stays the excavation's (its ladder up is there).
 */
export function onlyMix(id: StyleId, excavation: StyleId): Mix {
  return id === excavation ? [[id, 1]] : [[excavation, 0.001], [id, 1]];
}
