import type { Mix } from './regions';

/**
 * The bands of levels 1–10 (docs/design/town-and-first-strata.md §4): which kind of place a depth is,
 * the styles it is made of and how much of each (docs/design/level-styles.md), and the numbers that
 * make each style (the excavation field, src/gen/quarry.ts) look like that place. A band is data.
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
  veins: 0, tooled: 1,
  stone: [0.4, 0.365, 0.3], carvings: 0, hanging: 0, machines: 0,
  touched: 0, crickets: 0.22, dogs: 0, eels: 0, scavengers: 0, caverns: 0, ruins: 0, older: 0, uphill: 0, chalk: 0.3,
  lamplight: 1,
  styles: [['excavation', 0.8], ['karst', 0.2]],
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
  veins: 1, tooled: 0.7,
  stone: [0.4, 0.41, 0.43], carvings: 0.45, hanging: 0.05, machines: 0,
  touched: 0.35, crickets: 0.25, dogs: 0, eels: 0.5, scavengers: 0.3, caverns: 0, ruins: 0, older: 0, uphill: 0, chalk: 0,
  lamplight: 1,
  styles: [['excavation', 0.85], ['karst', 0.15]],
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
  veins: 0.1, tooled: 0.15,
  stone: [0.42, 0.41, 0.38], carvings: 0, hanging: 0.08, machines: 0.6,
  touched: 0.12, crickets: 0, dogs: 0.35, eels: 0.6, scavengers: 0.35, caverns: 0, ruins: 0, older: 0.14, uphill: 0.12, chalk: 0,
  lamplight: 1,
  styles: [['excavation', 0.65], ['karst', 0.35]],
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
  veins: 0.5, tooled: 0.1,
  stone: [0.36, 0.33, 0.3], carvings: 0, hanging: 0.12, machines: 0,
  touched: 0.06, crickets: 0.3, dogs: 0, eels: 0.4, scavengers: 0.2, caverns: 0.5, ruins: 0.2, older: 0, uphill: 0, chalk: 0,
  lamplight: 1,
  styles: [['excavation', 0.4], ['karst', 0.6]],
};

/** The band a depth belongs to. Deeper bands land here as they are built; until then the deepest built one continues. */
/** Grandma's cellar (depth 0, src/gen/cellar.ts): hand-built, nothing generated in it. */
export const CELLAR_BAND: Band = {
  ...QUARRY,
  id: 'cellar', name: 'Grandma\'s cellar',
  touched: 0, crickets: 0, dogs: 0, eels: 0, scavengers: 0, caverns: 0, ruins: 0, older: 0, uphill: 0, chalk: 0, carvings: 0, hanging: 0, machines: 0, veins: 0, tooled: 0,
  lamplight: 0.12, // (bulbs in small brick rooms)
  styles: [['cellar', 1]],
};

export function bandOf(depth: number): Band {
  return depth <= 0 ? CELLAR_BAND : depth >= 9 ? THRESHOLD : depth >= 6 ? CISTERN : depth >= 3 ? SALT : QUARRY;
}
