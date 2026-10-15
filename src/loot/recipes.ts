/**
 * Grandma's recipe cards (docs/design/recipe-box.md): skills, cooked at a fire with infused salt from
 * her tin (src/loot/tin.ts). Cooking a card unlocks it; cooking it again (rank 2, 3) changes how it
 * works, and grandma adds a line. Chapters open with depth: the tin will not open past a divider
 * until one of the family has been that deep.
 *
 * What a grandchild has cooked is theirs: the next one starts with none (the salt in the tin stays).
 * Pure: the cards are data, `Cooked` is a grandchild's ranks, and the effects are numbers the game
 * reads.
 */
import type { Tin } from './tin';

export type CardId = 'hold-it' | 'helpings' | 'duck' | 'candle' | 'soup' | 'kneading' | 'tiptoe' | 'way-home';

export interface Card {
  readonly id: CardId;
  readonly title: string;
  readonly chapter: string;
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
];

/** The chapters in the tin's order, and the depth each opens at (recipe-box.md §6). */
export const CHAPTERS: readonly (readonly [string, number])[] = [
  ['Kitchen Work', 0], ['Throwing', 0], ['Footwork', 0], ['Climbing & Water', 0], ['Light', 0], ['Grandma\'s Remedies', 0],
  ['Heavy Things', 5], ['Quiet', 5], ['Way Home', 8], ['Guard', 10], ['Fire & Frost', 15], ['Force', 25],
];

export function card(id: CardId): Card {
  return CARDS.find((c) => c.id === id)!;
}

/** What one grandchild has cooked. */
export class Cooked {
  private readonly ranks = new Map<CardId, number>();

  rank(id: CardId): number {
    return this.ranks.get(id) ?? 0;
  }

  /** The salt the next rank of `id` costs, or null at the last rank. */
  costOf(id: CardId): number | null {
    return card(id).cost[this.rank(id)] ?? null;
  }

  /** Why `id` cannot be cooked now (null: it can). `deepest`: the deepest level the family has reached. */
  cantCook(id: CardId, tin: Tin, deepest: number): string | null {
    const c = card(id), cost = this.costOf(id), opens = CHAPTERS.find(([n]) => n === c.chapter)?.[1] ?? 0;
    if (deepest < opens) return `The tin won't open past the ${c.chapter} divider yet.`;
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

  /** What climbing costs in stamina (a share of the plain cost). */
  get climbing(): number {
    return [1, 0.65, 0.4][this.rank('kneading')];
  }
}
