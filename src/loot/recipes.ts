/**
 * Grandma's recipe cards (docs/design/recipe-box.md): skills, cooked at a fire with infused salt from
 * her tin (src/loot/tin.ts). Cooking a card unlocks it; cooking it again (rank 2, 3) changes how it
 * works, and grandma adds a line. Every chapter opens from the start, so every way of playing has
 * its first cards at once; a chapter's stronger cards open with depth (`Card.opens`): the tin keeps
 * them behind a divider until one of the family has been that deep.
 *
 * Lost cards (recipe-box.md §7) are not in the tin: torn-out pages found down there. Found, one is
 * the grandchild's and is cooked like any other; the next grandchild has to find it again.
 *
 * What a grandchild has cooked is theirs: the next one starts with none (the salt in the tin stays).
 * Pure: the cards are data, `Cooked` is a grandchild's ranks, and the effects are numbers the game
 * reads.
 */
import type { Tin } from './tin';

export type CardId = 'hold-it' | 'helpings' | 'duck' | 'candle' | 'soup' | 'kneading' | 'tiptoe' | 'way-home' | 'tenderising' | 'pot-lid' | 'salt-line';

export interface Card {
  readonly id: CardId;
  readonly title: string;
  readonly chapter: string;
  /** A lost card: cooked only once found (`Cooked.find`). */
  readonly lost?: true;
  /** The depth one of the family must have reached before it can be cooked (none: from the start). */
  readonly opens?: number;
  /** "You'll need", the method, and the line she adds at each rank after the first. */
  readonly need: string;
  readonly method: string;
  readonly ranks: readonly string[];
  /** Salt to cook each rank. */
  readonly cost: readonly number[];
  /** What each rank does, in numbers (the tooltip; never in her text). */
  readonly does: readonly string[];
}

export const CARDS: readonly Card[] = [
  {
    id: 'hold-it', title: 'Hold It Properly', chapter: 'Kitchen Work',
    need: 'one kitchen knife (any, I have plenty), three pinches of the good salt.',
    method: 'Pointy end goes in the other fellow. That\'s it. Took your grandfather two years.',
    ranks: ['Now faster.', 'Show-off.'],
    cost: [3, 6, 10],
    does: ['knife damage +30%', 'and stabs 20% faster', 'knife damage +60%, stabs 20% faster'],
  },
  {
    id: 'helpings', title: 'Second Helpings', chapter: 'Throwing',
    need: 'the knife block. There are always more knives in it. Don\'t ask me how, I stopped asking in 1974.',
    method: 'Throw one. Then another. Don\'t throw the bread knife, it\'s sentimental.',
    ranks: ['Then another. Quicker.'],
    cost: [4, 8],
    does: ['right mouse: throw a kitchen knife (9–13 damage), one every 1.4 s', 'one every 0.8 s'],
  },
  {
    id: 'duck', title: 'Duck', chapter: 'Footwork',
    need: 'one coward, alive. Serves one.',
    method: 'When something big swings at you, don\'t be there. Dust yourself off afterwards, you\'re not an animal.',
    ranks: ['Earlier. Lower. Again.'],
    cost: [4, 8],
    does: ['Q: roll away; blows miss you for most of it; costs 4 stamina', 'blows miss you for nearly all of it; costs 2.5 stamina'],
  },
  {
    id: 'candle', title: 'Sunday Candle', chapter: 'Light',
    need: 'a candle from the sideboard drawer, a match. Sundays only, in principle.',
    method: 'Light it. Throw it. Things that live in the dark hate it the way your uncle hates vegetables.',
    ranks: ['Two candles. It\'s a special occasion.'],
    cost: [3, 7],
    does: ['G: toss a lit candle that burns 40 s; rats and crickets keep 6 m away from it; one at a time', 'two at a time'],
  },
  {
    id: 'soup', title: 'Chicken Soup', chapter: 'Grandma\'s Remedies',
    need: 'a fire, a pot, whatever is in the pot.',
    method: 'Cures everything except death, and I\'ve had my suspicions about that too.',
    ranks: ['Second bowl. Don\'t argue.'],
    cost: [4, 8],
    does: ['resting by a fire heals twice as fast', 'three times as fast'],
  },
  {
    id: 'kneading', title: 'Kneading', chapter: 'Climbing & Water',
    need: 'two hands, ten fingers, preferably all still attached.',
    method: 'Like kneading dough, except the dough is a cliff and if you stop you die. Warm up first.',
    ranks: ['Knead from the shoulders, not the wrists.'],
    cost: [5, 9],
    does: ['climbing tires you 35% less', 'climbing tires you 60% less'],
  },
  {
    id: 'tiptoe', title: 'Tiptoe', chapter: 'Quiet',
    need: 'soft soles, or socks. Shoes in your hand.',
    method: 'Like coming home late in 1962. My mother never found out. Neither will they.',
    ranks: ['Heel last. Breathe through your nose.'],
    cost: [6, 10],
    does: ['hold Z: tiptoe at 1.6 m/s; things notice you from half as far', 'tiptoe at 2.2 m/s; from a third as far'],
  },
  {
    id: 'way-home', title: 'Way Home', chapter: 'Way Home',
    need: 'a quiet moment. Nothing after you. Eyes shut.',
    method: 'For when you\'ve overstayed your welcome. Close your eyes, think of my armchair. Do NOT bring back anything that is still moving.',
    ranks: ['And back again, if you must. Think of where you were. Wrap up warm.'],
    cost: [12, 20],
    does: ['H: after 4 s still, with nothing after you, you are back by her armchair', 'and H in her salt circle takes you back to the deepest level you reached'],
  },
  {
    id: 'tenderising', title: 'Tenderising', chapter: 'Heavy Things',
    need: 'the knife, turned round. The handle end. Both hands.',
    method: 'Like a schnitzel. Not the pointy end, the other one, and put your back into it. They go flat and they go far.',
    ranks: ['Everything on the board gets it, not just the one piece.'],
    cost: [5, 9],
    does: ['V: an overhead blow with the knife\'s handle, 14–20 damage, knocks it far back; costs 3 stamina', '18–26 damage to everything in reach'],
  },
  {
    id: 'pot-lid', title: 'Pot Lid', chapter: 'Guard',
    need: 'the lid of the big pot, the one with the dent. Your grandfather made the dent. The other fellow came off worse.',
    method: 'Hold it up between you and whatever it is. Things that bite get a mouthful of enamel.',
    ranks: ['Lean into it. Don\'t flinch, it\'s only a lid.'],
    cost: [8, 14],
    does: ['hold X: raise the lid; blows from in front do 30% and knock you less; each one costs 1.5 stamina', 'blows from in front do 10%; each costs 1 stamina'],
  },
  {
    id: 'salt-line', title: 'Salt Line', chapter: 'Lost Cards', lost: true,
    need: 'the good salt, a steady hand, and nerve.',
    method: 'Pour it round you in one go, no gaps. They won\'t cross it. Mostly. (Smudged:) Except the tall one. Must find out about the tall one.',
    ranks: ['Wider. Thicker. It keeps longer if you don\'t skimp.'],
    cost: [6, 11],
    does: ['L: kneel and pour a circle of salt round you (2.2 m) that lasts 60 s; animals will not cross it, the Salt-Touched and people will; one at a time', 'a 3 m circle that lasts 120 s'],
  },
];

/** The chapters in the tin's order (recipe-box.md §6). Every one is open from the start; its stronger cards open with depth (`Card.opens`). */
export const CHAPTERS: readonly string[] = [
  'Kitchen Work', 'Throwing', 'Footwork', 'Climbing & Water', 'Light', 'Grandma\'s Remedies',
  'Heavy Things', 'Quiet', 'Way Home', 'Guard', 'Fire & Frost', 'Force',
  'Lost Cards',
];

/** Grandma's Salt Line at each rank: the circle's radius, metres, and how long it keeps once closed, seconds. */
export const SALT_RINGS = [{ r: 2.2, keeps: 60 }, { r: 3, keeps: 120 }] as const;

export function card(id: CardId): Card {
  return CARDS.find((c) => c.id === id)!;
}

/** What one grandchild has cooked. */
export class Cooked {
  private readonly ranks = new Map<CardId, number>();
  /** The lost cards found (cooked or not). */
  private readonly found = new Set<CardId>();

  rank(id: CardId): number {
    return this.ranks.get(id) ?? 0;
  }

  /** Whether this grandchild has `id` in hand: every card of the tin, a lost card once found. */
  has(id: CardId): boolean {
    return !card(id).lost || this.found.has(id);
  }

  /** A lost card found. Returns false if it was already. */
  find(id: CardId): boolean {
    if (this.found.has(id)) return false;
    this.found.add(id);
    return true;
  }

  /** The ranks cooked, to keep (src/persist/save.ts), a lost card found but not cooked as rank 0; `Cooked.from` puts them back (unknown cards are dropped). */
  get data(): Partial<Record<CardId, number>> {
    return { ...Object.fromEntries([...this.found].map((id) => [id, 0])), ...Object.fromEntries(this.ranks) };
  }

  static from(d: Partial<Record<string, number>>): Cooked {
    const c = new Cooked();
    for (const [id, r] of Object.entries(d)) {
      const k = CARDS.find((x) => x.id === id);
      if (!k || r === undefined) continue;
      if (k.lost) c.found.add(k.id);
      if (r) c.ranks.set(k.id, r);
    }
    return c;
  }

  /** The salt the next rank of `id` costs, or null at the last rank. */
  costOf(id: CardId): number | null {
    return card(id).cost[this.rank(id)] ?? null;
  }

  /** Why `id` cannot be cooked now (null: it can). `deepest`: the deepest level the family has reached. */
  cantCook(id: CardId, tin: Tin, deepest: number): string | null {
    const c = card(id), cost = this.costOf(id), opens = c.opens ?? 0;
    if (!this.has(id)) return 'That card is not in the tin.';
    if (deepest < opens) return `The tin won't open past the level ${opens} divider in ${c.chapter} yet.`;
    if (cost === null) return 'Nothing more to learn from that card.';
    if (tin.salt < cost) return `Not enough salt: it needs ${cost} pinches.`;
    return null;
  }

  /** Cook the next rank of `id` with salt from `tin` (check `cantCook` first). Returns the new rank. */
  cook(id: CardId, tin: Tin): number {
    tin.salt -= this.costOf(id) ?? 0;
    const r = this.rank(id) + 1;
    this.ranks.set(id, r);
    return r;
  }

  /** The knife: damage multiplier and how long a stab takes (a share of the plain one). */
  get knife(): { damage: number; time: number } {
    const r = this.rank('hold-it');
    return { damage: r >= 3 ? 1.6 : r >= 1 ? 1.3 : 1, time: r >= 2 ? 0.8 : 1 };
  }

  /** Seconds between thrown knives (right mouse), if cooked. */
  get helpings(): number | null {
    return [null, 1.4, 0.8][this.rank('helpings')];
  }

  /** The roll (Q), if cooked: its stamina cost and the seconds of it that blows miss. */
  get duck(): { stamina: number; safe: readonly [number, number] } | null {
    const r = this.rank('duck');
    return r === 0 ? null : r === 1 ? { stamina: 4, safe: [0.08, 0.42] } : { stamina: 2.5, safe: [0.04, 0.52] };
  }

  /** How many Sunday candles may burn at once (G), 0 if not cooked. */
  get candles(): number {
    return this.rank('candle');
  }

  /** How much faster wounds close resting by a fire. */
  get soup(): number {
    return [1, 2, 3][this.rank('soup')];
  }

  /** Tiptoeing (hold Z), if cooked: its speed, m/s, and how far off things notice you then (a share). */
  get tiptoe(): { speed: number; hush: number } | null {
    return [null, { speed: 1.6, hush: 0.5 }, { speed: 2.2, hush: 0.33 }][this.rank('tiptoe')];
  }

  /** Grandma's Way Home: 0 not cooked, 1 home to the armchair, 2 and back down again. */
  get wayHome(): number {
    return this.rank('way-home');
  }

  /** Grandma's Tenderising (V), if cooked: its damage range, and whether it hits everything in reach. */
  get tenderising(): { damage: readonly [number, number]; all: boolean } | null {
    const r = this.rank('tenderising');
    return r === 0 ? null : r === 1 ? { damage: [14, 20], all: false } : { damage: [18, 26], all: true };
  }

  /** Grandma's Pot Lid (hold X), if cooked: the share of a blow from in front that gets through, and the stamina each costs. */
  get lid(): { through: number; cost: number } | null {
    return [null, { through: 0.3, cost: 1.5 }, { through: 0.1, cost: 1 }][this.rank('pot-lid')];
  }

  /** Grandma's Salt Line (L), if cooked: the circle's radius, metres, and how long it keeps, seconds. */
  get saltLine(): { readonly r: number; readonly keeps: number } | null {
    return SALT_RINGS[this.rank('salt-line') - 1] ?? null;
  }

  /** What climbing costs in stamina (a share of the plain cost). */
  get climbing(): number {
    return [1, 0.65, 0.4][this.rank('kneading')];
  }
}
