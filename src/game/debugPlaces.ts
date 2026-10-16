/**
 * The debug menu's places: everything worth checking out on a level (grandma's house and the street
 * at depth 0; the way up, the nearest way down, the bosses, grandma's camp, the nearest living
 * stalagmite and the nearest den of every kind of creature below), and a spot to stand near each.
 */
import { CELLAR, CELLAR_SHAFT } from '../gen/cellar';
import { TOWN, homeDoor, shopDoor } from '../gen/town';
import { HOUSE_DOORS } from '../gen/doorways';
import { ladderTop, type Shaft } from '../gen/descents';
import { openFloor } from '../gen/searchOut';
import type { Level } from '../gen/level';
import { REGIONS, shareOf } from '../gen/regions';
import { mixOf } from '../gen/bands';
import { owns, type StyleId } from '../gen/style';
import { NAMED_STYLES } from '../gen/styles';
import type { Fauna } from '../creatures/fauna';

/** A place to go: what it is, where one stands (feet), which way one looks. */
export interface Place {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
}

/** How many rings of den cells out from the nobody the nearest den is looked for. */
const DEN_RINGS = 8;

/** The yaw that looks from (x, z) at (tx, tz) (forward is (-sin yaw, -cos yaw)). */
function towards(x: number, z: number, tx: number, tz: number): number {
  return Math.atan2(-(tx - x), -(tz - z));
}

/** A place on the open floor `near`–`far` metres from (x, z), looking at it (the point itself if none is open). */
function standBy(level: Level, name: string, x: number, z: number, near = 3, far = 7): Place {
  for (let r = near; r <= far; r += 1) for (let a = 0; a < 12; a++) {
    const t = (a / 12) * Math.PI * 2, px = x + Math.cos(t) * r, pz = z + Math.sin(t) * r, y = level.groundAt(px, pz);
    if (openFloor(level, [[px, pz]], y, 0.5, 1.2, 0.5)) return { name, x: px, y, z: pz, yaw: towards(px, pz, x, z) };
  }
  return { name, x, y: level.groundAt(x, z), z, yaw: 0 };
}

/** Where one gets on shaft s's ladder, looking at it. */
function atLadder(name: string, s: Shaft): Place {
  const [x, z] = ladderTop(s);
  return { name, x, y: s.floor, z, yaw: towards(x, z, s.x, s.z) };
}

/** The places of grandma's house, the cellar and the street (depth 0, the same for every seed). */
function home(level: Level): Place[] {
  /** Before a house's door on the street, facing it. */
  const out = (name: string, d: ReturnType<typeof shopDoor>): Place => ({ name, x: d.x, y: level.groundAt(d.x, d.z), z: d.z, yaw: towards(d.x, d.z, d.x - d.house.faces, d.z) });
  const street = TOWN.street.x[1] - 1.5;
  const door = HOUSE_DOORS[0], house = CELLAR.house;
  return [
    { name: 'Grandma\'s armchair (start)', x: CELLAR.start.x, y: 0, z: CELLAR.start.z, yaw: CELLAR.start.yaw },
    { name: 'The notary\'s letter', x: CELLAR.letter.x - 0.6, y: 0, z: CELLAR.letter.z - 0.6, yaw: towards(CELLAR.letter.x - 0.6, CELLAR.letter.z - 0.6, CELLAR.letter.x, CELLAR.letter.z) },
    { name: 'The strange cellar door', x: door.x + 1.4, y: 0, z: 0, yaw: Math.PI / 2 },
    { name: 'Grandma\'s hall (upstairs)', x: (house.x[0] + house.x[1]) / 2, y: house.floor, z: 0, yaw: Math.PI / 2 },
    { name: 'The street outside her door', x: street, y: level.groundAt(street, 0), z: 0, yaw: -Math.PI / 2 },
    out('Ilse\'s pawn shop', shopDoor('pawn')),
    out('Kemal\'s hardware store', shopDoor('hardware')),
    out('Frau Weber', homeDoor('weber')),
    atLadder('The old shaft (way down)', CELLAR_SHAFT),
  ];
}

/** Everything worth checking out on `level`, dens nearest (x, z) first found. */
export function placesOn(level: Level, fauna: Fauna, x: number, z: number): Place[] {
  if (level.depth === 0) return home(level);
  const out: Place[] = [];
  const up = level.ascent;
  if (up) out.push(atLadder('The way up (arrival)', up));
  else out.push({ name: 'The arrival', x: level.arrival[0], y: level.groundAt(level.arrival[0], level.arrival[2]), z: level.arrival[2], yaw: 0 });
  const down = level.descents.nearest(x, z, 5000);
  if (down) out.push(atLadder('The nearest way down', down));
  const hall = fauna.foreman.hall;
  if (hall) out.push(standBy(level, 'The Foreman\'s hall (boss)', hall.x, hall.z, 8, 14));
  const lair = level.lair;
  if (lair) {
    out.push(standBy(level, 'The Tall One\'s lair (boss)', lair.x, lair.z, 10, 16));
    const c = lair.circles[0];
    if (c) out.push({ name: 'One of grandma\'s salt circles', x: c.x, y: c.y, z: c.z, yaw: towards(c.x, c.z, lair.x, lair.z) });
  }
  const camp = level.camp;
  if (camp) out.push(standBy(level, 'Grandma\'s camp and her note', camp.note[0], camp.note[2], 1.2, 3));
  const dens: [string, { nearestDen(x: number, z: number, rings?: number): { x: number; z: number } | null }][] = [
    ['A rat nest', fauna.rats], ['Salt-Touched at work', fauna.touched], ['Cave crickets', fauna.crickets],
    ['A Lumen slime colony', fauna.lumen], ['A Murk slime colony', fauna.murk], ['A feral dog pack', fauna.dogs],
    ['Brine eels', fauna.eels], ['A scavenger camp', fauna.scavengers], ['A goblin den', fauna.goblins], ['A ghost', fauna.ghosts], ['Toadstools', fauna.toadstools], ['Puffcaps', fauna.puffcaps],
  ];
  const drip = level.drips.nearest(x, z);
  if (drip) out.push(standBy(level, `A living stalagmite (${Math.round(Math.hypot(drip.x - x, drip.z - z))} m)`, drip.x, drip.z, 2.5, 5));
  for (const [name, pop] of dens) {
    const d = pop.nearestDen(x, z, DEN_RINGS);
    if (d) out.push(standBy(level, `${name} (${Math.round(Math.hypot(d.x - x, d.z - z))} m)`, d.x, d.z, 6, 10));
  }
  return out;
}

/** Every level style one can be sent to: the excavation, then the registry's (src/gen/styles.ts). */
export const DEBUG_STYLES: readonly StyleId[] = ['excavation', ...NAMED_STYLES];

/** How far out (metres) a style's ground is looked for on a level, and how many levels up and down for one that has it. */
const STYLE_SEARCH = { far: 3000, levels: 200 } as const;

/**
 * A place on the open floor inside the nearest region of style `id` on `level` from (x, z): out in
 * rings a region's half-width apart, the first region of that style whose open space (its portal)
 * has floor to stand on. Null if there is none within `STYLE_SEARCH.far`.
 */
export function styleSpot(level: Level, id: StyleId, x: number, z: number): Place | null {
  const f = level.field, at = f.styles.findIndex((s) => s.id === id);
  if (at < 0) return null;
  const style = f.styles[at], step = REGIONS.size / 3, tried = new Set<number>();
  for (let r = 0; r <= STYLE_SEARCH.far; r += step) {
    const n = Math.max(1, Math.ceil((2 * Math.PI * r) / step));
    for (let k = 0; k < n; k++) {
      const t = (k / n) * Math.PI * 2, sx = x + Math.cos(t) * r, sz = z + Math.sin(t) * r;
      if (f.regions.styleAt(sx, sz) !== at) continue;
      const region = f.regions.regionAt(sx, sz);
      if (tried.has(region.id)) continue;
      tried.add(region.id);
      for (const [cx, cz] of [style.portal(region.px, region.pz), style.portal(sx, sz)]) {
        if (!owns(style, cx, cz)) continue;
        const p = standBy(level, '', cx, cz, 0, 8);
        if (openFloor(level, [[p.x, p.z]], p.y, 0.5, 1.2, 0.5)) return { ...p, name: `${id} (${Math.round(Math.hypot(p.x - x, p.z - z))} m)` };
      }
    }
  }
  return null;
}

/** The level nearest `depth` (itself first, then one up, one down, ...) whose mix has style `id`, or null. */
export function depthWithStyle(seed: number, depth: number, id: StyleId): number | null {
  for (let k = 0; k <= STYLE_SEARCH.levels; k++) for (const d of k ? [depth - k, depth + k] : [depth]) {
    if (d >= 1 && shareOf(mixOf(seed, d), id) > 0) return d;
  }
  return null;
}
