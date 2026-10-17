import { deriveSeed, hash2i, hashToFloat } from '@futuremagic/core';
import type { Mix } from './regions';
import type { StyleId } from './style';
import { genome, stratumOf, workingsOf, type Workings } from './genome';
import type { RockType } from './rockTypes';

/**
 * The bands (docs/design/town-and-first-strata.md §4): the kinds of workings a stratum can be cut as
 * (the Quarry, the Salt Works, the Cisterns, the Threshold), and the numbers that make the
 * excavation field (src/gen/quarry.ts) and what lives and stands in it look like that place. Which
 * band a level has is its stratum's draw (`workingsOf`, src/gen/genome.ts), on any level: nothing
 * is kept for the deep (Arnd, 2026-10-17). A band is data.
 */
export interface Band {
  readonly id: 'cellar' | 'quarry' | 'salt' | 'cistern' | 'threshold';
  /** Shown on arrival: "Level 3 · The Salt Works". */
  readonly name: string;
  /** Workings: the chance of a grand hall (few, massive pillars) and of a cathedral (very tall). */
  readonly grand: number;
  readonly cathedral: number;
  /** Ordinary and grand pillar spacing ranges (min, extra), and the ceiling heights (min, extra) of ordinary, grand and cathedral workings. */
  readonly spacing: readonly [number, number];
  readonly grandSpacing: readonly [number, number];
  readonly height: readonly [number, number];
  readonly grandHeight: readonly [number, number];
  readonly cathedralHeight: readonly [number, number];
  /** How far apart the floors of neighbouring workings may lie, metres (one step up or down). */
  readonly step: number;
  /** Chance that a working has collapsed. */
  readonly collapse: number;
  /** Carved pillars: flutes cut into the sides (depth, metres; 0: plain cut stone), and how many per side (even: a ridge down the middle of each side, where a ladder can go). */
  readonly flutes: number;
  readonly fluteCount: number;
  /** The water table's base height and how far it wanders (brine lakes in the salt). */
  readonly water: readonly [number, number];
  /** The rock's colour: base, what the lighter layers add, the floor dust, and the natural rock between workings (a multiplier). */
  readonly rock: readonly [number, number, number];
  readonly layers: readonly [number, number, number];
  readonly dust: readonly [number, number, number];
  readonly natural: readonly [number, number, number];
  /** How strongly veins of glowing blue infused salt show in the rock (0: none). */
  readonly veins: number;
  /** How much of the rock was cut by hand: the miners' pick marks on its walls (1: every wall; 0: natural or built). */
  readonly tooled: number;
  /**
   * Which rock it is cut through (src/gen/rockTypes.ts): weights of the rock types, which the rock
   * shader shows in patches and beds 5-30 m across. Styles that do not name their own rock
   * (`Style.rocks`) are cut through this.
   */
  readonly rocks: Partial<Record<RockType, number>>;
  /**
   * The finish of its rock (the rock shader, src/render/materials.ts `ROCK_FINISH`): worked walls cast
   * in concrete against board shuttering, how wet it runs (0–1 each).
   */
  readonly finish: { readonly formwork: number; readonly wet: number };
  /** Loose stones, cut blocks and carvings: their colour. */
  readonly stone: readonly [number, number, number];
  /** What the miners left (src/gen/quarryProps.ts): the share of things against the rock that are carvings (statues of miners, chapels), and the chance per open spot of an electric lamp hanging from the roof. */
  readonly carvings: number;
  readonly hanging: number;
  /** The share of things against the rock that are waterworks fittings (pipes and valves, pumps, the wartime bunker's furniture). */
  readonly machines: number;
  /** Creatures: the chance per cell that one of the Salt-Touched works there (src/creatures/touched.ts). */
  readonly touched: number;
  /** The chance per cell of a group of cave crickets on the rock (src/creatures/crickets.ts). */
  readonly crickets: number;
  /** The chance per cell of a pack of feral dogs (src/creatures/dogs.ts). */
  readonly dogs: number;
  /** The chance per cell of brine eels in deep water there (src/creatures/eels.ts; from level 5). */
  readonly eels: number;
  /** The chance per cell of a scavengers' camp (src/creatures/scavengers.ts; from level 4). */
  readonly scavengers: number;
  /** The share of workings that are natural caverns instead (src/gen/quarry.ts), and the chance per spot against a cavern's rock of a ruin older than the mine (src/gen/quarryProps.ts). */
  readonly caverns: number;
  readonly ruins: number;
  /** The share of pillars that stand on an older pillar (src/gen/quarry.ts `OLDER`), and the chance per flooded spot against the rock of water running up it (src/gen/quarryProps.ts). */
  readonly older: number;
  readonly uphill: number;
  /** The chance per pillar of a chalk number on it (the Quarry): metres to the nearest way down, in tens (src/gen/quarryProps.ts). */
  readonly chalk: number;
  /** How bright a burning lamp is (1: the mines' lamps, hung to light a hall; less in small rooms). */
  readonly lamplight: number;
  /** The level's styles and how much of it each covers (docs/design/level-styles.md; src/gen/regions.ts). */
  readonly styles: Mix;
}

export const QUARRY: Band = {
  id: 'quarry', name: 'The Quarry',
  grand: 0.3, cathedral: 0.15,
  spacing: [14, 12], grandSpacing: [32, 22],
  height: [12, 26], grandHeight: [28, 22], cathedralHeight: [45, 20],
  step: 4, collapse: 0.3,
  flutes: 0, fluteCount: 0,
  water: [-3.7, 1.3],
  rock: [0.46, 0.42, 0.35], layers: [0.05, 0.045, 0.035], dust: [0.08, 0.075, 0.065], natural: [0.82, 0.82, 0.85],
  veins: 0, tooled: 1, rocks: { limestone: 1, sandstone: 0.6, shale: 0.45 }, finish: { formwork: 0, wet: 0.15 },
  stone: [0.4, 0.365, 0.3], carvings: 0, hanging: 0, machines: 0,
  touched: 0, crickets: 0.12, dogs: 0, eels: 0, scavengers: 0, caverns: 0, ruins: 0, older: 0, uphill: 0, chalk: 0.3,
  lamplight: 1,
  styles: [['excavation', 0.7], ['collapse', 0.15], ['karst', 0.15]],
};

/** The salt mine proper (levels 3–5): cathedral chambers carved by miners, fluted pillars, brine lakes, the first veins of infused salt. */
export const SALT: Band = {
  id: 'salt', name: 'The Salt Works',
  grand: 0.45, cathedral: 0.35,
  spacing: [16, 10], grandSpacing: [34, 18],
  height: [16, 22], grandHeight: [32, 20], cathedralHeight: [55, 25],
  step: 4, collapse: 0.15,
  flutes: 0.35, fluteCount: 4,
  water: [-2.4, 1.6],
  rock: [0.31, 0.32, 0.34], layers: [0.12, 0.12, 0.125], dust: [0.1, 0.1, 0.1], natural: [0.7, 0.72, 0.76],
  veins: 1, tooled: 0.7, rocks: { salt: 1, shale: 0.9, limestone: 0.25, sandstone: 0.3 }, finish: { formwork: 0, wet: 0 },
  stone: [0.4, 0.41, 0.43], carvings: 0.45, hanging: 0.05, machines: 0,
  touched: 0.35, crickets: 0.25, dogs: 0, eels: 0.5, scavengers: 0.3, caverns: 0, ruins: 0, older: 0, uphill: 0, chalk: 0,
  lamplight: 1,
  styles: [['excavation', 0.55], ['collapse', 0.25], ['karst', 0.1], ['rift', 0.1]],
};

/**
 * The Cisterns (levels 6–8): a forgotten water-works and wartime bunker built into the mine. Vast,
 * regular halls of plain concrete pillars, many of them flooded; pipes, valves and pumps along the
 * walls, and the bunker's 1940s furniture where it was dry.
 */
export const CISTERN: Band = {
  id: 'cistern', name: 'The Cisterns',
  grand: 0.5, cathedral: 0.2,
  spacing: [17, 4], grandSpacing: [26, 8],
  height: [14, 12], grandHeight: [24, 14], cathedralHeight: [40, 15],
  step: 1.2, collapse: 0.08,
  flutes: 0, fluteCount: 0,
  water: [-0.5, 0.6],
  rock: [0.37, 0.36, 0.33], layers: [0.025, 0.025, 0.022], dust: [0.06, 0.06, 0.055], natural: [0.62, 0.6, 0.56],
  veins: 0.1, tooled: 0.15, rocks: { limestone: 0.6, sandstone: 0.35, shale: 0.8, granite: 0.25 }, finish: { formwork: 1, wet: 0.7 },
  stone: [0.42, 0.41, 0.38], carvings: 0, hanging: 0.08, machines: 0.6,
  touched: 0.12, crickets: 0, dogs: 0.35, eels: 0.6, scavengers: 0.35, caverns: 0, ruins: 0, older: 0.14, uphill: 0.12, chalk: 0,
  lamplight: 1,
  styles: [['excavation', 0.4], ['karst', 0.2], ['collapse', 0.1], ['dungeon', 0.15], ['roots', 0.15], ['flooded', 0.12]],
};

/**
 * The Threshold (levels 9–10): natural caverns break through the last workings. Wide, rough, domed
 * caves with rock columns, stalagmites and stalactites, and between them the deepest, oldest
 * mine halls. The first ruins that are not modern stand here.
 */
export const THRESHOLD: Band = {
  id: 'threshold', name: 'The Threshold',
  grand: 0.45, cathedral: 0.3,
  spacing: [16, 10], grandSpacing: [30, 16],
  height: [16, 16], grandHeight: [28, 16], cathedralHeight: [44, 20],
  step: 4, collapse: 0.3,
  flutes: 0, fluteCount: 0,
  water: [-2.8, 1.8],
  rock: [0.33, 0.3, 0.27], layers: [0.06, 0.05, 0.04], dust: [0.07, 0.065, 0.055], natural: [0.78, 0.76, 0.74],
  veins: 0.5, tooled: 0.1, rocks: { granite: 1, shale: 0.6, slate: 0.4, sandstone: 0.3, limestone: 0.2 }, finish: { formwork: 0, wet: 0.45 },
  stone: [0.36, 0.33, 0.3], carvings: 0, hanging: 0.12, machines: 0,
  touched: 0.06, crickets: 0.3, dogs: 0, eels: 0.4, scavengers: 0.2, caverns: 0.5, ruins: 0.2, older: 0, uphill: 0, chalk: 0,
  lamplight: 1,
  styles: [['excavation', 0.2], ['karst', 0.2], ['rift', 0.15], ['collapse', 0.1], ['catacombs', 0.1], ['dungeon', 0.15], ['fungal', 0.1]],
};

/** Grandma's cellar (depth 0, src/gen/cellar.ts): hand-built, nothing generated in it. */
export const CELLAR_BAND: Band = {
  ...QUARRY,
  id: 'cellar', name: 'Grandma\'s cellar',
  touched: 0, crickets: 0, dogs: 0, eels: 0, scavengers: 0, caverns: 0, ruins: 0, older: 0, uphill: 0, chalk: 0, carvings: 0, hanging: 0, machines: 0, veins: 0, tooled: 0, rocks: { limestone: 1, sandstone: 0.7, shale: 0.2 }, finish: { formwork: 0, wet: 0.1 },
  lamplight: 0.12, // (bulbs in small brick rooms)
  styles: [['cellar', 1]],
};

/** A floor height over the highest the band's water table reaches (`water`: base plus all its wander), with a metre to spare: the built styles keep their floors dry from here up. */
export function dryAbove(band: Band): number {
  return band.water[0] + band.water[1] + 1;
}

/** How far each style's weight in a level's mix strays from its band's, either way (as a power of 2). */
const MIX_VARY = 0.5;

/**
 * A level's mix of styles: its stratum's genome, each weight scaled by up to 2^MIX_VARY either way, drawn
 * from (seed, depth), so no two levels of a stratum are alike. The first style stays first (the home
 * ground round the arrival). Level 1 stays easy to read, near the town: the workings round the ladder
 * and one other style, the stratum's strongest.
 */
export function mixOf(seed: number, depth: number): Mix {
  const stratum = stratumOf(depth);
  if (!stratum) return CELLAR_BAND.styles;
  let styles = genome(seed, stratum);
  if (depth === 1) {
    const [home, ...rest] = styles, wild = rest.reduce((a, b) => (b[1] > a[1] ? b : a));
    styles = [[home[0], 3 * wild[1]], wild];
  }
  const s = deriveSeed(seed, 'mix', depth);
  return styles.map(([id, w], i) => [id, w * 2 ** (MIX_VARY * (2 * hashToFloat(hash2i(s, i, 0)) - 1))] as const);
}

const BANDS: Readonly<Record<Workings, Band>> = { quarry: QUARRY, salt: SALT, cistern: CISTERN, threshold: THRESHOLD };

/** What a stratum is called after the style it is most made of; the workings' own name where that is one of the plain caves (karst, collapse, dungeon rooms). */
const NAMES: Readonly<Partial<Record<StyleId, string>>> = {
  catacombs: 'The Ossuaries', bones: 'The Bone Fields', dwarven: 'The Old Halls', elven: 'The Old Halls', goblin: 'The Warrens',
  rift: 'The Rifts', flooded: 'The Drowned Works', roots: 'The Root Hollows', fungal: 'The Grottoes', geode: 'The Geodes',
  lava: 'The Burning Deep', basalt: 'The Columns', organic: 'The Living Rock', glyph: 'The Written Halls', floating: 'The Hanging Stones',
};

const named = new Map<string, Band>();

/** The band of level `depth` in world `seed`: grandma's cellar at 0, else its stratum's workings, named for what the stratum is most made of. One object per stratum. */
export function bandOf(seed: number, depth: number): Band {
  const stratum = stratumOf(depth);
  if (!stratum) return CELLAR_BAND;
  const key = `${seed}:${stratum.from}`;
  let b = named.get(key);
  if (!b) {
    const band = BANDS[workingsOf(seed, stratum)], [, ...drawn] = genome(seed, stratum);
    const lead = drawn.reduce((a, c) => (c[1] > a[1] ? c : a))[0];
    named.set(key, (b = { ...band, name: NAMES[lead] ?? band.name }));
  }
  return b;
}
