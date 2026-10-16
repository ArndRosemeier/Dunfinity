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
import type { Sowing } from '../combat/snapdragon';
import type { Dusting } from '../combat/flour';

export type CardId = 'hold-it' | 'helpings' | 'duck' | 'spring' | 'candle' | 'soup' | 'kneading' | 'tiptoe' | 'way-home' | 'tenderising' | 'pot-lid' | 'stove-flame' | 'cold-larder' | 'rolling-pin' | 'snapdragon' | 'flour-bag' | 'matchstick' | 'salt-line';

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
    id: 'spring', title: 'Spring in Your Step', chapter: 'Footwork',
    need: 'knees, both. A pinch of the good salt in each shoe.',
    method: 'Bend, then go up like the bread does. Your grandfather could clear the garden fence in one go, until the night he didn\'t.',
    ranks: ['And once more off nothing at all. Don\'t ask me how, it\'s the salt.'],
    cost: [4, 8],
    does: ['Space: jump about twice as high (2 m); costs 1 stamina', 'and jump again once in mid-air'],
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
    id: 'stove-flame', title: 'Stove Flame', chapter: 'Fire & Frost',
    need: 'a match, a pinch of the good salt between finger and thumb. Not near the curtains.',
    method: 'Strike the match, sprinkle the salt over it, and blow. Like lighting the old gas stove, only it goes the other way. Eyebrows grow back.',
    ranks: ['A bigger pinch. Lean back.'],
    cost: [4, 8],
    does: ['R: a gout of flame 4 m ahead, 6–10 damage to everything in it; costs 3 stamina; every 2.5 s', 'flame 5.5 m ahead, 9–14 damage; every 1.8 s'],
  },
  {
    id: 'cold-larder', title: 'Cold Larder', chapter: 'Fire & Frost',
    need: 'the larder door, open. A pinch of salt on the cold shelf. A cardigan.',
    method: 'Open the door and let the cold out round your feet. Whatever is near you goes slow and stupid, like your uncle after Sunday lunch.',
    ranks: ['Leave the door open longer. Mind the milk.'],
    cost: [4, 8],
    does: ['K: things within 4 m of you move at 40% for 4 s; costs 3 stamina; every 8 s', 'within 5.5 m, at 30% for 6 s'],
  },
  {
    id: 'rolling-pin', title: 'Rolling Pin', chapter: 'Force',
    need: 'the rolling pin (don\'t touch it, just think of it), salt on your palms.',
    method: 'Roll it out flat, away from you, firmly. The dough does not need to be in arm\'s reach. Neither does the other fellow.',
    ranks: ['Firmer. From the shoulders.'],
    cost: [4, 8],
    does: ['P: shove everything 3.5 m in front of you back, hard (2–4 damage); costs 2.5 stamina; every 3 s', 'reaches 4.5 m and shoves twice as hard'],
  },
  {
    id: 'snapdragon', title: 'Snapdragons', chapter: 'The Garden',
    need: 'one seed from the brown envelope at the back of the shed, the one I wrote NO on. A pinch of the good salt on it.',
    method: 'Throw it, then step back. Further than that. It comes up before you can say Jack Robinson and bites whatever is nearest, and it does not care whose grandchild you are. Your grandfather lost a slipper to one.',
    ranks: ['A bigger seed, and a bigger step back. Don\'t feed it.'],
    cost: [5, 9],
    does: ['U: toss a seed that comes up in 1.6 s and for 12 s bites the nearest living thing within 2.2 m, you too (5–8 damage, about every 1.1 s); costs 2 stamina; every 15 s', 'bites within 3 m (7–11 damage, about every 0.9 s) for 15 s; every 13 s'],
  },
  {
    id: 'flour-bag', title: 'Flour Bag', chapter: 'Baking',
    need: 'a bag of the good flour, the fine one for cakes, with a pinch of salt shaken in. Not the wholemeal, that is for eating.',
    method: 'Throw it hard at whatever it is, so the bag splits. In the cloud they cannot see their own feet, and they cannot see you either. Do not breathe in, and do not tell me where the flour went.',
    ranks: ['The two-kilo bag. From the shoulder.'],
    cost: [4, 8],
    does: ['Y: throw a bag of flour (at a creature up to 16 m off) that bursts into a cloud 3 m round for 6 s; anything in it loses you, stumbles about and cannot land a blow on you, until 2.5 s after it gets out; costs 2 stamina; every 6 s', 'a cloud 4.5 m round for 9 s, blind 3.5 s after'],
  },
  {
    id: 'matchstick', title: 'Matchstick', chapter: 'Baking',
    need: 'one long match, the kind for the oven. A cloud of flour, still hanging. Nerve.',
    method: 'The mill in my mother\'s village went up in 1925, and not one sack had caught fire: it was the dust in the air. Flick the match into the cloud and get out of it first. I mean it: out of it FIRST.',
    ranks: ['Two matches, struck together. Your grandfather\'s trick. He lost his eyebrows anyway.'],
    cost: [4, 8],
    does: ['middle mouse: flick a match at the nearest flour cloud up to 16 m ahead; it goes up all at once, 18–28 damage to everything in it, you too, and a shove out of it; a match that finds no cloud does 2–4; every 3 s', 'the cloud goes up for 24–36 damage and shoves twice as hard'],
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
  'Heavy Things', 'Quiet', 'Way Home', 'Guard', 'Fire & Frost', 'Force', 'The Garden', 'Baking',
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

  /** What `id` does at the rank cooked: `ranks[rank - 1]`, or null if not cooked. */
  private at<T>(id: CardId, ranks: readonly T[]): T | null {
    return ranks[this.rank(id) - 1] ?? null;
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
    return this.at('helpings', [1.4, 0.8]);
  }

  /** The roll (Q), if cooked: its stamina cost and the seconds of it that blows miss. */
  get duck(): { stamina: number; safe: readonly [number, number] } | null {
    const r = this.rank('duck');
    return r === 0 ? null : r === 1 ? { stamina: 4, safe: [0.08, 0.42] } : { stamina: 2.5, safe: [0.04, 0.52] };
  }

  /** Grandma's Spring in Your Step, if cooked: a jump's speed off the floor, m/s, the jumps it may take in mid-air, and the stamina each costs. */
  get spring(): { jump: number; air: number; cost: number } | null {
    return this.at('spring', [{ jump: 8.5, air: 0, cost: 1 }, { jump: 8.5, air: 1, cost: 1 }]);
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
    return this.at('tiptoe', [{ speed: 1.6, hush: 0.5 }, { speed: 2.2, hush: 0.33 }]);
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
    return this.at('pot-lid', [{ through: 0.3, cost: 1.5 }, { through: 0.1, cost: 1 }]);
  }

  /** Grandma's Salt Line (L), if cooked: the circle's radius, metres, and how long it keeps, seconds. */
  get saltLine(): { readonly r: number; readonly keeps: number } | null {
    return SALT_RINGS[this.rank('salt-line') - 1] ?? null;
  }

  /** Grandma's Stove Flame (R), if cooked: how far the flame reaches, metres, its damage, and the seconds between. */
  get flame(): { reach: number; damage: readonly [number, number]; every: number } | null {
    return this.at('stove-flame', [{ reach: 4, damage: [6, 10], every: 2.5 }, { reach: 5.5, damage: [9, 14], every: 1.8 }]);
  }

  /** Grandma's Cold Larder (K), if cooked: how far round you the cold goes, metres, what it slows things to, for how long, seconds. */
  get larder(): { r: number; slow: number; lasts: number } | null {
    return this.at('cold-larder', [{ r: 4, slow: 0.4, lasts: 4 }, { r: 5.5, slow: 0.3, lasts: 6 }]);
  }

  /** Grandma's Rolling Pin (P), if cooked: how far in front it reaches, metres, and how hard it shoves, m/s. */
  get pin(): { reach: number; knock: number } | null {
    return this.at('rolling-pin', [{ reach: 3.5, knock: 9 }, { reach: 4.5, knock: 18 }]);
  }

  /** Grandma's Snapdragons (U), if cooked: what a plant does (src/combat/snapdragon.ts), and the seconds between seeds. */
  get snapdragon(): (Sowing & { between: number }) | null {
    return this.at('snapdragon', [{ lasts: 12, reach: 2.2, damage: [5, 8] as const, every: 1.1, between: 15 }, { lasts: 15, reach: 3, damage: [7, 11] as const, every: 0.9, between: 13 }]);
  }

  /** Grandma's Flour Bag (Y), if cooked: the cloud's radius, metres, how long it hangs, how long what was in it stays blind, and the seconds between bags (src/combat/flour.ts). */
  get flour(): (Dusting & { every: number }) | null {
    return this.at('flour-bag', [{ r: 3, hangs: 6, blind: 2.5, every: 6 }, { r: 4.5, hangs: 9, blind: 3.5, every: 6 }]);
  }

  /** Grandma's Matchstick (middle mouse), if cooked: what a flour cloud going up does, and the seconds between matches. */
  get match(): { damage: readonly [number, number]; knock: number; every: number } | null {
    return this.at('matchstick', [{ damage: [18, 28] as const, knock: 9, every: 3 }, { damage: [24, 36] as const, knock: 18, every: 3 }]);
  }

  /** What climbing costs in stamina (a share of the plain cost). */
  get climbing(): number {
    return [1, 0.65, 0.4][this.rank('kneading')];
  }
}
