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
import { hash3f } from '@futuremagic/core';

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

/**
 * What grandma chalked under the list, in her own words (the core-loop pass: more of her writing,
 * near where one arrives): a line about the first thing on it, else about the level. The same
 * level always says the same. Pure.
 */
export const GRANDMA_CHALK: Readonly<Record<Lead['id'] | 'none', readonly string[]>> = {
  page: ['I left a page here. Read it before you go on.', 'One of my pages is down here. I wrote it sitting on a stone, so look low.', 'There is a page of mine on this level. I was younger than you when I wrote it.'],
  camp: ['My camp. The fire pit still draws. Sit a while.', 'I slept here more nights than I told your great-grandmother.'],
  lair: ['It stands at the top of the stair. Stay in my circles and it will only look.', 'It has stood there since 1963. Do not keep it company.'],
  shed: ['The miners left their shed unlocked. Shut the door behind you and sleep.', 'There is a dry shed. Take what is useful; they will not mind now.'],
  goblins: ['Goblins. Count your spoons afterwards.', 'The little people keep what they steal. Get it back off them, or let it go.'],
  scavengers: ['Smoke means scavengers. They are only hungry. So are you.', 'There are people at a fire. They are not nice people.'],
  beast: ['Something big lives here. You do not have to fight everything that is bigger than you.', 'A big one. Leave it be unless you are cleverer than me.', 'I watched the big one for an hour once. It never noticed me. Be like that.'],
  none: ['Nothing worth chalking on this level. Go down.', 'Mind the water here. It is deeper than it looks.', 'Rest when you can. The rock does not get tired, but you do.'],
};

/** Grandma's chalked line for `level`, going by its leads. */
export function grandmasChalk(level: Level, leads: readonly Lead[]): string {
  const pool = GRANDMA_CHALK[leads[0]?.id ?? 'none'];
  return pool[Math.floor(hash3f(level.seed, level.depth, 1966, 3) * pool.length) % pool.length];
}
