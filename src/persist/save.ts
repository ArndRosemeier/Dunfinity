/**
 * The game kept between visits (decision D11: permadeath): the family's state that outlives every
 * grandchild (grandma's tin, her purse, which grandchild is next, the finds taken), and the grandchild now
 * down there, if one is alive: where, how hurt, what they cooked, practised and picked up. A dead
 * grandchild is not kept, so a reload sends the next one down.
 *
 * In the browser's localStorage (only ever touched in src/persist/), one save per seed. Reading never throws: a missing, blocked or
 * broken save is no save.
 */
import type { TinData } from '../loot/tin';
import type { Find } from '../loot/finds';
import type { Fallen } from '../gen/notary';
import type { KeyData } from '../lore/key';
import type { FirstStepsData } from '../game/firstSteps';

export interface GrandchildData {
  readonly depth: number;
  readonly pos: readonly [number, number, number];
  readonly facing: number;
  readonly health: number;
  readonly stamina: number;
  /** The deepest level this grandchild reached. */
  readonly reached: number;
  readonly cooked: Partial<Record<string, number>>;
  readonly practice: Partial<Record<string, number>>;
  readonly pack: readonly Find[];
  /** What they bought at Kemal's (src/loot/hardware.ts). */
  readonly gear?: readonly string[];
  /** What they have seen of each level (src/world/explored.ts). */
  readonly explored?: Record<string, readonly number[]>;
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
}

const key = (seed: number) => `dunfinity:save:${seed}`;

export function readSave(seed: number): SaveData | null {
  try {
    const raw = localStorage.getItem(key(seed));
    const d = raw ? (JSON.parse(raw) as SaveData) : null;
    return d && d.v === 1 && d.tin && Array.isArray(d.taken) ? d : null;
  } catch {
    return null;
  }
}

export function writeSave(seed: number, d: SaveData): void {
  try {
    localStorage.setItem(key(seed), JSON.stringify(d));
  } catch {
    // (storage full or blocked: the game goes on unsaved)
  }
}
