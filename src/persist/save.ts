/**
 * The game kept between visits (decision D11: permadeath): the family's state that outlives every
 * grandchild (grandma's tin, her purse, which grandchild is next, the finds taken), and the grandchild now
 * down there, if one is alive: where, how hurt, what they cooked, practised and picked up. A dead
 * grandchild is not kept, so a reload sends the next one down.
 *
 * In the browser's localStorage (only ever touched in src/persist/). Several families can be kept side
 * by side, each in its own mode (`GameMode`); the list of them is the title's Load. Reading never
 * throws: a missing, blocked or broken save is no save.
 */
import type { TinData } from '../loot/tin';
import type { Item } from '../loot/items';
import type { Find } from '../loot/finds';
import type { Fallen } from '../gen/notary';
import type { KeyData } from '../lore/key';
import type { FirstStepsData } from '../game/firstSteps';
import type { PetData } from '../creatures/pets';
import type { HumanoidAppearance } from '@futuremagic/humanoid';
import type { OutfitSpec } from '../loot/outfit';
import { names, recall, remember } from './store';

export interface GrandchildData {
  readonly depth: number;
  readonly pos: readonly [number, number, number];
  readonly facing: number;
  readonly health: number;
  readonly stamina: number;
  /** The deepest level this grandchild reached. */
  readonly reached: number;
  readonly cooked: Partial<Record<string, number>>;
  /** Their main bar: the card in each slot (src/game/abilities.ts `MainBar`; none in an older save). */
  readonly bar?: readonly (string | null)[];
  readonly practice: Partial<Record<string, number>>;
  readonly pack: readonly Find[];
  /** What they bought at Kemal's (src/loot/hardware.ts): older saves, before the kit. */
  readonly gear?: readonly string[];
  /** What they wear and hold (src/loot/items.ts), and the spare items in the pack. */
  readonly kit?: readonly Item[];
  readonly spare?: readonly Item[];
  /** What they have seen of each level (src/world/explored.ts). */
  readonly explored?: Record<string, readonly number[]>;
  /** Their salt pet, if one is with them (src/creatures/pets.ts). */
  readonly pet?: PetData;
  /** The salt in grandma's tin when they took it up (the death screen says what they added). */
  readonly saltAtStart?: number;
}

export interface SaveData {
  readonly v: 1;
  readonly heir: number;
  readonly tin: TinData;
  /** Finds taken, per depth. */
  readonly taken: readonly (readonly [number, readonly number[]])[];
  readonly child: GrandchildData | null;
  /** The notary's list: the grandchildren who did not come back. */
  readonly fallen?: readonly Fallen[];
  /** Grandma's purse: euros from Ilse's pawn shop (src/loot/pawn.ts). */
  readonly euros?: number;
  /** Grandma's key to the old scripts, with every grandchild's pencil marks (src/lore/key.ts). */
  readonly key?: KeyData;
  /** The first steps done (src/game/firstSteps.ts), or true when the list is over. A save without it is a family from before the list: over. */
  readonly steps?: FirstStepsData;
  /** The grandchildren's look, made in the character creator (src/game/creator.ts); none: the seed's own. */
  readonly look?: HumanoidAppearance;
  /** What they wear, chosen in the creator (src/loot/outfit.ts); none: the rags. */
  readonly outfit?: OutfitSpec;
  /** How the family plays (none: from before modes, Rogue like). */
  readonly mode?: GameMode;
}

/** How a family plays (chosen when it begins): Rogue like keeps one save that a grandchild's death
 * ends; Adventure also keeps saves made by hand that can be gone back to at any time. */
export type GameMode = 'rogue' | 'adventure';
export const GAME_MODES: readonly GameMode[] = ['rogue', 'adventure'];
export const MODE_NAMES: Readonly<Record<GameMode, string>> = { rogue: 'Rogue like', adventure: 'Adventure' };

/** A family in the list of families kept (the title's Load): which, how it plays, how far it got, when it was last kept. */
export interface FamilyEntry {
  readonly id: string;
  readonly seed: number;
  readonly mode: GameMode;
  /** The grandchild now down there (their number in the family), or the next to go. */
  readonly heir: number;
  /** Where the living grandchild is (null: none alive, the next waits). */
  readonly depth: number | null;
  /** The deepest level the family has reached. */
  readonly deepest: number;
  /** When it was last kept (ms since 1970). */
  readonly savedAt: number;
}

/** A save made by hand in an Adventure: when, and the whole family as it stood. */
export interface ManualSave {
  readonly at: number;
  readonly entry: FamilyEntry;
  readonly data: SaveData;
}

/** How many saves by hand an Adventure family keeps (the oldest goes). */
export const MANUAL_SAVES = 8;

const INDEX = 'families', ACTIVE = 'active', STRAIGHT = 'straight-in', NEW_GAME = 'new-game';
const familyKey = (id: string) => `family:${id}`;
const savesKey = (id: string) => `family:${id}:saves`;

const valid = (d: SaveData | null): d is SaveData => !!d && d.v === 1 && !!d.tin && Array.isArray(d.taken);

/** The list entry for a family's save. */
function entryOf(id: string, seed: number, d: SaveData, at: number): FamilyEntry {
  return { id, seed, mode: d.mode ?? 'rogue', heir: d.heir, depth: d.child?.depth ?? null, deepest: d.tin.deepest ?? 0, savedAt: at };
}

/** Every family kept, the last played first (families kept the old way, one per seed under `dunfinity:save:<seed>`, are taken in once). */
export function families(): FamilyEntry[] {
  let index = recall<FamilyEntry[]>(INDEX);
  if (!Array.isArray(index)) {
    index = [];
    for (const name of names()) {
      const m = /^save:(\d+)$/.exec(name);
      const d = m ? recall<SaveData>(name) : null;
      if (!m || !valid(d)) continue;
      const id = `seed${m[1]}`;
      remember(familyKey(id), d);
      index.push(entryOf(id, Number(m[1]), d, 0));
    }
    remember(INDEX, index);
    if (index[0]) remember(ACTIVE, index[0].id);
  }
  return [...index].sort((a, b) => b.savedAt - a.savedAt);
}

/** The family played last (null: none). */
export function activeFamily(): FamilyEntry | null {
  const all = families(), id = recall<string>(ACTIVE);
  return all.find((f) => f.id === id) ?? null;
}

/** Play `id` from now on (the next start goes on with it). */
export function setActiveFamily(id: string): void { remember(ACTIVE, id); }

/**
 * The seed of a new family's world: each new family gets its own, kept in its save so a reload finds
 * the same world. The one number in the game not drawn from a seed (everything else derives from this).
 */
export function freshWorldSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}

/** A new family playing `mode` on world `seed`, made the one played; its id. */
export function newFamily(seed: number, mode: GameMode, now: number): string {
  const all = families();
  let n = 0, id = '';
  do id = `${now.toString(36)}${n ? `-${n}` : ''}`, n++; while (all.some((f) => f.id === id));
  remember(INDEX, [...all, { id, seed, mode, heir: 0, depth: null, deepest: 0, savedAt: now }]);
  remember(ACTIVE, id);
  return id;
}

/** A family's save (null: none yet, or broken). */
export function readFamily(id: string): SaveData | null {
  const d = recall<SaveData>(familyKey(id));
  return valid(d) ? d : null;
}

/** Keep a family as it stands (its list entry follows). */
export function writeFamily(id: string, seed: number, d: SaveData, now: number): void {
  remember(familyKey(id), d);
  remember(INDEX, families().filter((f) => f.id !== id).concat(entryOf(id, seed, d, now)));
}

/** Forget a family, its saves by hand too. */
export function deleteFamily(id: string): void {
  remember(familyKey(id), null);
  remember(savesKey(id), null);
  remember(INDEX, families().filter((f) => f.id !== id));
  if (recall<string>(ACTIVE) === id) remember(ACTIVE, null);
}

/** An Adventure family's saves by hand, the newest first. */
export function manualSaves(id: string): ManualSave[] {
  const made = recall<ManualSave[]>(savesKey(id));
  return Array.isArray(made) ? made.filter((m) => valid(m.data)).sort((a, b) => b.at - a.at) : [];
}

/** Make a save by hand of the family as it stands (keeping the newest `MANUAL_SAVES`). */
export function saveByHand(id: string, seed: number, d: SaveData, now: number): void {
  remember(savesKey(id), [{ at: now, entry: entryOf(id, seed, d, now), data: d }, ...manualSaves(id)].slice(0, MANUAL_SAVES));
}

/** Go back to the save by hand made at `at`: it becomes the family's own save. False: no such save. */
export function loadByHand(id: string, at: number, now: number): boolean {
  const m = manualSaves(id).find((s) => s.at === at);
  if (!m) return false;
  writeFamily(id, m.entry.seed, m.data, now);
  return true;
}

/** The next start skips the title and goes straight on with the family played (after a load, or New Game). */
export function goStraightIn(on: boolean): void { remember(STRAIGHT, on || null); }

/** Does this start skip the title? (Asked once: the flag is cleared.) */
export function takeStraightIn(): boolean {
  const on = recall<boolean>(STRAIGHT) === true;
  if (on) remember(STRAIGHT, null);
  return on;
}

/** New Game over a kept family: the next start begins a new family playing `mode` on a world of its own, past the title. */
export function goNewGame(mode: GameMode): void { remember(NEW_GAME, mode); goStraightIn(true); }

/** Does this start begin a new family, and playing what? (Asked once: the wish is cleared.) */
export function takeNewGame(): GameMode | null {
  const m = recall<GameMode>(NEW_GAME);
  if (m !== null) remember(NEW_GAME, null);
  return m === 'rogue' || m === 'adventure' ? m : null;
}
