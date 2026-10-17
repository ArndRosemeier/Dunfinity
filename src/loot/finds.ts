/**
 * Finds: what the miners left behind on the floor of the Quarry and in their sheds (on the table, the
 * shelf, the bunk: src/gen/sheds.ts), and what the rats dragged into their nests (rats hoard shiny things). Nobody's treasure, but the pawn shop up top buys it
 * (town-and-first-strata.md: euros from selling loot buy mundane gear).
 *
 * Pure and seeded: the plane is cut into cells of FIND.cell metres (the rats' cells, so a cell's
 * nest and its hoard line up). A cell may hold a find or two on open floor, and its nest, if any,
 * a hoard. Taken finds stay taken (`taken`, kept by the game per level: the same dungeon across
 * runs, D13).
 */
import { deriveSeed, hash3f } from '@futuremagic/core';
import type { Level } from '../gen/level';
import { CellMemo } from '../gen/cellMemo';
import { SHED_SPOTS, shedPoint } from '../gen/sheds';
import type { Item } from './items';

/** Where a find lies: on open floor, in a rat's hoard, in a miners' shed. */
type Where = 'floor' | 'hoard' | 'shed';

export type FindKind = 'coin' | 'token' | 'chisel' | 'pipe' | 'tin' | 'spoon' | 'lamp' | 'medal' | 'watch' | 'ring' | 'crystal';

export interface FindDef {
  /** What the HUD calls it. */
  name: string;
  /** What the pawn shop might pay, euros. */
  value: readonly [number, number];
  /** How often it turns up on the floor, in a hoard and in a miners' shed (relative). */
  floor: number;
  hoard: number;
  shed: number;
}

export const FINDS: Record<FindKind, FindDef> = {
  coin: { name: 'an old Pfennig', value: [1, 3], floor: 10, hoard: 8, shed: 3 },
  token: { name: 'a brass tally token', value: [4, 8], floor: 6, hoard: 5, shed: 6 },
  chisel: { name: 'a rusted stone chisel', value: [2, 5], floor: 6, hoard: 0, shed: 3 },
  pipe: { name: 'a clay pipe', value: [3, 6], floor: 4, hoard: 1, shed: 5 },
  tin: { name: 'a tobacco tin', value: [5, 12], floor: 4, hoard: 2, shed: 5 },
  spoon: { name: 'a silver spoon', value: [12, 25], floor: 1, hoard: 4, shed: 1 },
  lamp: { name: 'a carbide lamp', value: [15, 30], floor: 2, hoard: 0, shed: 4 },
  medal: { name: 'a tarnished medal', value: [20, 45], floor: 0.6, hoard: 2, shed: 0.6 },
  watch: { name: 'a pocket watch, stopped at ten past three', value: [30, 60], floor: 0.4, hoard: 1.5, shed: 1.5 },
  ring: { name: 'a gold ring', value: [40, 90], floor: 0, hoard: 1.2, shed: 0.2 },
  /** Only ever the gift waiting in a thin place's pocket (src/world/thinPlaces.ts `Pocket.gift`), never lying about. */
  crystal: { name: 'a crystal from a deeper world, still faintly glowing', value: [45, 110], floor: 0, hoard: 0, shed: 0 },
};

export const FIND = {
  /** Cell size, metres: the rats' cells. */
  cell: 36,
  /** Chance of a find on open floor per cell, and of a second one. */
  chance: 0.55,
  second: 0.25,
  /** Finds in a shed (the slots after the hoard's: at most three a cell), and the chance of its second. */
  shed: [5, 8] as const,
  shedSecond: 0.5,
  /** Finds in a nest's hoard, and how far from the nest they lie. */
  hoard: [1, 3] as const,
  spread: 0.9,
  /** None this close to the arrival. */
  quiet: 12,
  /** How close the nobody must stand to pick one up, metres, and how far over its feet it reaches (a shed's shelf). */
  reach: 1.3,
  over: 1.7,
};

export interface Find {
  /** Stable over runs: the cell's key and its slot. */
  readonly id: number;
  readonly kind: FindKind;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  /** What the pawn shop might pay, euros. */
  readonly value: number;
}

/** A rat nest, as far as finds care. */
export interface Hoard { x: number; y: number; z: number }

export class Finds {
  private readonly seed: number;
  private readonly cells: CellMemo<Find[]>;
  /** Finds dropped on this visit (`drop`), not yet picked up again. */
  private readonly loose: Find[] = [];

  /**
   * `nestAt(i, j)`: the nest in cell (i, j) (Rats.denAt), whose hoard lies round it.
   * `taken`: ids already picked up on this level (kept by the caller, added to by `take`).
   */
  constructor(private readonly level: Level, private readonly nestAt: (i: number, j: number) => Hoard | null, readonly taken: Set<number>) {
    this.seed = deriveSeed(level.seed, 'finds', level.depth);
    this.cells = new CellMemo((i, j, key) => this.fill(i, j, key));
  }

  /** Finds not yet taken whose cell lies within `r` metres of (x, z). */
  near(x: number, z: number, r: number, out: Find[] = []): Find[] {
    out.length = 0;
    const c = FIND.cell;
    for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++) {
      for (const f of this.cells.at(i, j)) if (!this.taken.has(f.id) && Math.hypot(f.x - x, f.z - z) < r) out.push(f);
    }
    for (const f of this.loose) if (Math.hypot(f.x - x, f.z - z) < r) out.push(f);
    return out;
  }

  /** The find the nobody at (x, y, z) can pick up, the nearest within reach, or null. */
  inReach(x: number, y: number, z: number): Find | null {
    let best: Find | null = null, bd = FIND.reach;
    for (const f of this.near(x, z, FIND.reach)) {
      const d = Math.hypot(f.x - x, f.z - z);
      if (d < bd && f.y - y > -1.2 && f.y - y < FIND.over) { bd = d; best = f; }
    }
    return best;
  }

  /** Pick f up: it is gone from this level for good. */
  take(f: Find): void {
    this.taken.add(f.id);
    const k = this.loose.indexOf(f);
    if (k >= 0) this.loose.splice(k, 1);
  }

  /** Whether `f` still lies about to be picked up. */
  lying(f: Find): boolean {
    return this.loose.includes(f) || !this.taken.has(f.id);
  }

  /** Lay `f` (taken before: something of the pack, dropped where a goblin thief died) on the floor at (x, z) for this visit. */
  drop(f: Find, x: number, z: number): Find {
    const y = this.level.groundAt(x, z), laid = { ...f, x, y: Number.isFinite(y) ? y : f.y, z };
    this.loose.push(laid);
    return laid;
  }

  /** What lies in cell (i, j): finds on its floor and its nest's hoard. */
  private fill(i: number, j: number, key: number): Find[] {
    const s = this.seed, c = FIND.cell, out: Find[] = [];
    const [ax, , az] = this.level.arrival;
    const add = (x: number, z: number, y: number, slot: number, where: Where) => {
      const kind = pick(hash3f(s, key, slot, 1), where), [lo, hi] = FINDS[kind].value;
      const value = Math.round(lo + (hi - lo) * hash3f(s, key, slot, 3));
      out.push({ id: key * 8 + slot, kind, x, y, z, yaw: hash3f(s, key, slot, 2) * Math.PI * 2, value });
    };
    // On open, dry floor somewhere in the cell.
    const floor = hash3f(s, i, j, 0) < FIND.chance ? (hash3f(s, i, j, 1) < FIND.second ? 2 : 1) : 0;
    for (let slot = 0, k = 0; slot < floor && k < 8; k++) {
      const x = (i + 0.1 + 0.8 * hash3f(s, i, j, 10 + 2 * k)) * c, z = (j + 0.1 + 0.8 * hash3f(s, i, j, 11 + 2 * k)) * c;
      const y = this.open(x, z);
      if (y === null || Math.hypot(x - ax, z - az) < FIND.quiet) continue;
      add(x, z, y, slot++, 'floor');
    }
    // The nest's hoard, round the nest.
    const nest = this.nestAt(i, j);
    if (nest) {
      const n = FIND.hoard[0] + Math.floor(hash3f(s, i, j, 40) * (FIND.hoard[1] - FIND.hoard[0] + 1));
      for (let k = 0; k < n; k++) {
        const a = hash3f(s, i, j, 41 + k) * Math.PI * 2, d = FIND.spread * (0.3 + 0.7 * hash3f(s, i, j, 50 + k));
        const x = nest.x + Math.cos(a) * d, z = nest.z + Math.sin(a) * d;
        const y = this.open(x, z);
        if (y !== null) add(x, z, y, 2 + k, 'hoard');
      }
    }
    // The miners' things in the sheds standing in the cell: on the table, the shelf, the bunk.
    let slot = FIND.shed[0];
    for (const sh of this.level.sheds.standingIn(i * c, j * c, (i + 1) * c, (j + 1) * c)) {
      const n = hash3f(s, sh.id, 1, 60) < FIND.shedSecond ? 2 : 1, first = Math.floor(hash3f(s, sh.id, 2, 61) * SHED_SPOTS.length);
      for (let k = 0; k < n && slot < FIND.shed[1]; k++) {
        const [sd, fw, up] = SHED_SPOTS[(first + k) % SHED_SPOTS.length], [x, z] = shedPoint(sh, sd, fw);
        add(x, z, sh.y + up, slot++, 'shed');
      }
    }
    return out;
  }

  /** The ground height at (x, z) if a find can lie there (open, dry, not in a shaft), else null. */
  private open(x: number, z: number): number | null {
    const l = this.level, y = l.groundAt(x, z);
    if (y < l.waterAt(x, z) + 0.02 || l.sdf(x, y + 0.5, z) < 0.3 || l.descents.at(x, z, 2)) return null;
    return y;
  }
}

/** The kind at random number r (0..1) for finds lying `where`. */
function pick(r: number, where: Where): FindKind {
  const kinds = Object.keys(FINDS) as FindKind[];
  let total = 0;
  for (const k of kinds) total += FINDS[k][where];
  let t = r * total;
  for (const k of kinds) if ((t -= FINDS[k][where]) < 0) return k;
  return 'coin';
}

/**
 * How many things (finds and spare items together) a plain rucksack holds, and the pockets without
 * one: past that, something has to be left behind. A bigger or stranger rucksack holds more
 * (src/loot/items.ts `ItemDef.room`, `Kit.room`).
 */
export const PACK = { room: 8, pockets: 2 } as const;

/** What the nobody carries up: finds, spare items (src/loot/items.ts), at most `room` of them together (what their rucksack holds), and what the finds might fetch. Lost with the nobody. */
export class Pack {
  readonly items: Find[] = [];
  readonly spare: Item[] = [];

  /** `roomOf`: how many things there is room for now (the rucksack worn: `Kit.room`). */
  constructor(private readonly roomOf: () => number = () => PACK.room) {}

  /** How many things there is room for. */
  get room(): number {
    return this.roomOf();
  }

  /** How many things are in it. */
  get count(): number {
    return this.items.length + this.spare.length;
  }

  get worth(): number {
    let w = 0;
    for (const f of this.items) w += f.value;
    return w;
  }

  get full(): boolean {
    return this.count >= this.room;
  }

  /** Put `f` in, if there is room: whether it went in. */
  add(f: Find): boolean {
    if (this.full) return false;
    this.items.push(f);
    return true;
  }

  /** Put a spare `item` in, if there is room: whether it went in. */
  stow(item: Item): boolean {
    if (this.full) return false;
    this.spare.push(item);
    return true;
  }

  /** Take out the `i`th find (to leave it on the floor), or null. */
  takeOut(i: number): Find | null {
    return i >= 0 && i < this.items.length ? this.items.splice(i, 1)[0] : null;
  }

  /** Take out the `i`th spare item (to put it on), or null. */
  unstow(i: number): Item | null {
    return i >= 0 && i < this.spare.length ? this.spare.splice(i, 1)[0] : null;
  }
}
