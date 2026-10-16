/**
 * Grandma's tin and the infused salt in it (docs/design/recipe-box.md §4): pale blue salt that forms
 * where something happens for the first time and drifts into the tin. The first of a kind killed,
 * a depth nobody of the family has reached, one of grandma's camps. It rewards variety, not
 * grinding: the second and third of a kind give less, the fifth, tenth and twentieth a pinch, then
 * nothing.
 *
 * The tin outlives each grandchild (it goes back to the armchair), so it is kept by the game, not
 * by the body. Pure.
 */

export const SALT = {
  /** What the tin holds at the start (recipe-box.md §8: three pinches). */
  start: 3,
  /** The first kill of a kind, per population name (src/creatures/*). */
  kills: { rats: 1, crickets: 2, 'slimes-lumen': 2, 'slimes-murk': 2, dogs: 3, eels: 3, toadstools: 3, puffcaps: 3, scavengers: 3, goblins: 3, touched: 4, foreman: 15, 'tall-one': 25 } as Readonly<Record<string, number>>,
  /** A new depth: base, and per level of depth. */
  depth: [2, 0.5] as const,
  /** One of grandma's camps, its note read. */
  camp: 6,
  /** Later kills of a kind that still give a pinch. */
  pinch: [5, 10, 20] as const,
};

/** What each kind is called on the HUD. */
const KIND: Readonly<Record<string, string>> = {
  rats: 'rat', crickets: 'cave cricket', 'slimes-lumen': 'Lumen slime', 'slimes-murk': 'Murk slime', dogs: 'feral dog', eels: 'brine eel', toadstools: 'toadstool', puffcaps: 'puffcap',
  scavengers: 'scavenger', goblins: 'goblin', touched: 'Salt-Touched', foreman: 'Foreman', 'tall-one': 'Tall One',
};

/** Pinches for the k-th time (1-based) of something worth `base` the first time. */
export function pinches(k: number, base: number): number {
  if (k <= 3) return Math.ceil(base / k);
  return (SALT.pinch as readonly number[]).includes(k) ? 1 : 0;
}

export interface Gain {
  readonly amount: number;
  /** What the HUD says. */
  readonly why: string;
}

/** What a tin holds, to keep (src/persist/save.ts). */
export interface TinData {
  readonly salt: number;
  readonly deepest: number;
  readonly times: readonly (readonly [string, number])[];
}

export class Tin {
  salt = SALT.start;
  /** The deepest level any of the family has reached (chapters of recipes open with it). */
  deepest = 0;
  private readonly times = new Map<string, number>();

  /** A kill of `kind` (a population name). */
  killed(kind: string): Gain | null {
    const k = this.nth(`kill:${kind}`), a = pinches(k, SALT.kills[kind] ?? 1), name = KIND[kind] ?? kind;
    return this.add(a, k === 1 ? `The first ${name} you have killed.` : `Another ${name}.`);
  }

  /** Arriving at `depth`: salt only the first time anyone of the family gets there. */
  reached(depth: number): Gain | null {
    this.deepest = Math.max(this.deepest, depth);
    if (depth <= 0 || this.nth(`depth:${depth}`) > 1) return null;
    return this.add(Math.round(SALT.depth[0] + SALT.depth[1] * depth), `Level ${depth}: deeper than any of you has been.`);
  }

  /** One of grandma's camps found (its note read): once. */
  camp(depth: number): Gain | null {
    if (this.nth(`camp:${depth}`) > 1) return null;
    return this.add(SALT.camp, 'Grandma was here.');
  }

  /** What the tin holds, to keep; `Tin.from` puts it back. */
  get data(): TinData {
    return { salt: this.salt, deepest: this.deepest, times: [...this.times] };
  }

  static from(d: TinData): Tin {
    const t = new Tin();
    t.salt = d.salt;
    t.deepest = d.deepest;
    for (const [k, n] of d.times) t.times.set(k, n);
    return t;
  }

  private nth(key: string): number {
    const k = (this.times.get(key) ?? 0) + 1;
    this.times.set(key, k);
    return k;
  }

  private add(amount: number, why: string): Gain | null {
    if (amount <= 0) return null;
    this.salt += amount;
    return { amount, why };
  }
}
