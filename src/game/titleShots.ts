/**
 * The title screen's shots: a descent. The nobody stands somewhere worth seeing on one level after
 * another, each deeper than the last (grandma's street at night, the Quarry, the Salt Works, the
 * Foreman's hall, the Tall One's lair, then the strange strata below), with what lives there awake
 * in front of them. Chosen from the seed one plays, so the title shows the world one goes down into.
 *
 * Pure: the title draws them (src/game/title.ts), tests check them.
 */
import { Level } from '../gen/level';
import { Fauna } from '../creatures/fauna';
import { placesOn, type Place } from './debugPlaces';

/** The depths the title goes down through, in order (then it starts again at the top). */
export const TITLE_DEPTHS: readonly number[] = [0, 1, 3, 5, 8, 10, 17, 33, 64, 128];

/** One shot: the level, where the nobody stands and which way they look, and the caption. */
export interface Shot {
  readonly level: Level;
  readonly at: Place;
  readonly caption: string;
}

/** A level's name as the game shows it on arrival ("Level 5 · The Salt Works"). */
export function levelName(level: Level): string {
  return level.depth ? `Level ${level.depth} · ${level.band.name}` : level.band.name;
}

/**
 * The shot on level `depth`: on the street outside grandma's door at the top; below, the boss's hall
 * if the level has one, else one of the dens near the arrival (a different kind from level to level).
 */
export function shotAt(seed: number, depth: number): Shot {
  const level = new Level(seed, depth);
  const [x, , z] = level.arrival;
  const places = placesOn(level, new Fauna(level), x, z);
  const at = depth === 0
    ? places.find((p) => p.name.startsWith('The street')) ?? places[0]
    : places.find((p) => p.name.endsWith('(boss)')) ?? pick(places.filter(isDen), depth) ?? places[0];
  return { level, at, caption: depth === 0 ? 'Grandma\'s street, at night' : levelName(level) };
}

/** A den's place (debugPlaces names them with their distance). */
function isDen(p: Place): boolean {
  return / \(\d+ m\)$/.test(p.name);
}

function pick<T>(list: readonly T[], k: number): T | undefined {
  return list.length ? list[k % list.length] : undefined;
}
