/**
 * What is worth walking to on a level (the core-loop pass, Arnd 2026-10-17: "give the run a shape"):
 * a few places, chalked by the ladder where one arrives, so going sideways has goals and not only
 * distance. Story first (a page of grandma's diary, her camp, where the Tall One stands), then what
 * pays to find: a miners' shed (things left inside), a goblin camp (they keep what they steal), a
 * scavengers' fire, and the biggest animal that lives near (a new kind is a first in her tin).
 *
 * Each lead is found once one comes within `LEADS.found` metres of it. Pure: the level's generator
 * and its populations' dens, nothing random.
 */
import type { Level } from '../gen/level';
import type { Fauna } from '../creatures/fauna';
import { speciesName, SPECIES_SALT } from '../creatures/bestiary';

export const LEADS = {
  /** How far from the arrival a lead is looked for, metres (story leads anywhere on the level). */
  near: 320,
  /** At most this many on the board. */
  most: 3,
  /** This close and it counts as found, metres; the tall one and a big animal are found once seen from further off. */
  found: 9,
  seen: { lair: 45, beast: 22 } as Readonly<Partial<Record<string, number>>>,
} as const;

/** A place on the level worth walking to. */
export interface Lead {
  /** What kind of place (one lead of each kind at most). */
  readonly id: 'page' | 'camp' | 'lair' | 'shed' | 'goblins' | 'scavengers' | 'beast';
  /** How the chalk says it. */
  readonly what: string;
  readonly x: number;
  readonly z: number;
}

/** The leads chalked for `level`, nearest of each kind to the arrival, story first. */
export function leadsOf(level: Level, fauna: Fauna): Lead[] {
  if (level.depth === 0) return [];
  const [ax, , az] = level.arrival, out: Lead[] = [];
  const page = level.page, camp = level.camp, lair = level.lair;
  if (camp) out.push({ id: 'camp', what: "Grandma's camp", x: camp.x, z: camp.z });
  else if (page) out.push({ id: 'page', what: 'A page of her diary', x: page.x, z: page.z });
  if (lair) out.push({ id: 'lair', what: 'Where the tall one stands', x: lair.x, z: lair.z });
  const near = <T extends { x: number; z: number }>(list: readonly T[]): T | null => {
    let best: T | null = null, bd: number = LEADS.near;
    for (const t of list) { const d = Math.hypot(t.x - ax, t.z - az); if (d < bd) { bd = d; best = t; } }
    return best;
  };
  // The biggest animal near: the most salt as a first, and a sight.
  const herds = fauna.critters.densNear(ax, az, LEADS.near).filter((h) => SPECIES_SALT[h.species.role] >= 4);
  herds.sort((a, b) => SPECIES_SALT[b.species.role] - SPECIES_SALT[a.species.role] || Math.hypot(a.x - ax, a.z - az) - Math.hypot(b.x - ax, b.z - az));
  const beast = herds[0];
  const shed = near(level.sheds.standingIn(ax - LEADS.near, az - LEADS.near, ax + LEADS.near, az + LEADS.near));
  const goblins = near(fauna.goblins.densNear(ax, az, LEADS.near));
  const fire = near(fauna.scavengers.densNear(ax, az, LEADS.near));
  if (shed) out.push({ id: 'shed', what: 'A miners\' shed, things left inside', x: shed.x, z: shed.z });
  if (goblins) out.push({ id: 'goblins', what: 'A goblin camp; they keep what they steal', x: goblins.x, z: goblins.z });
  if (beast) out.push({ id: 'beast', what: `Something big: a ${speciesName(beast.species)}`, x: beast.x, z: beast.z });
  if (fire) out.push({ id: 'scavengers', what: 'Scavengers at a fire', x: fire.x, z: fire.z });
  return out.slice(0, LEADS.most);
}

/** The leads one has come to so far on a visit: ticked off as one walks near them. */
export class Leads {
  readonly found = new Set<Lead['id']>();

  constructor(readonly list: readonly Lead[]) {}

  /** The nobody is at (x, z): the leads newly found here. */
  walk(x: number, z: number): Lead[] {
    const now: Lead[] = [];
    for (const l of this.list) if (!this.found.has(l.id) && Math.hypot(l.x - x, l.z - z) < (LEADS.seen[l.id] ?? LEADS.found)) { this.found.add(l.id); now.push(l); }
    return now;
  }

  get over(): boolean {
    return this.list.every((l) => this.found.has(l.id));
  }
}
