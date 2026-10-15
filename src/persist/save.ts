/**
 * The game kept between visits (decision D11: permadeath): the family's state that outlives every
 * grandchild (grandma's tin, which grandchild is next, the finds taken), and the grandchild now
 * down there, if one is alive: where, how hurt, what they cooked, practised and picked up. A dead
 * grandchild is not kept, so a reload sends the next one down.
 *
 * In the browser's localStorage (only ever touched in src/persist/), one save per seed. Reading never throws: a missing, blocked or
 * broken save is no save.
 */
import type { TinData } from '../loot/tin';
import type { Find } from '../loot/finds';
import type { Fallen } from '../gen/notary';

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
