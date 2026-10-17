/**
 * Practice, the second axis of grandma's recipe box (docs/design/recipe-box.md §3): cooking a card
 * unlocks it, using it makes it better. Every ability has a skill (Arnd 2026-10-17): the knife,
 * throwing, rolling, climbing, the lid, running, swimming, jumping, and each of her other cards.
 *
 * Skills are open-ended and get progressively (not exponentially) harder: level n takes `step × n`
 * more uses, so level L takes `step × L(L+1)/2` in all. Each level adds a small fixed step to what
 * grows (`per`: damage, how long a thing lasts) and divides what shrinks by as much (cooldowns,
 * stamina), so a cost never reaches zero. Only uses that did something count (a blow that landed,
 * a flame that burnt something), never a swing at the air.
 *
 * What a grandchild has practised is theirs, like the cards they cooked: lost when they die, the
 * next one starts at 0. Pure: counts, levels and multipliers the game reads.
 */
import type { CardId } from './recipes';

export type Skill =
  | 'knife' | 'throwing' | 'footwork' | 'climbing' | 'guard' | 'running' | 'swimming' | 'leaping'
  | 'candle' | 'soup' | 'tiptoe' | 'way-home' | 'flame' | 'frost' | 'force' | 'roots' | 'sowing' | 'flour' | 'match' | 'pet' | 'salt-line';

export interface SkillDef {
  /** Its name in the tin, and what it counts. */
  readonly name: string;
  readonly counts: string;
  /** Uses level 1 takes; level n takes `step × n` more. */
  readonly step: number;
  /** What a level does: + this share to what grows; what shrinks is divided by as much. */
  readonly per: number;
  /** Grandma's cards it makes better (src/loot/recipes.ts `Cooked.trained`). */
  readonly cards: readonly CardId[];
  /** The property it is on gear found below (src/loot/items.ts `GIFTS`): "... of the butcher". */
  readonly of: string;
  /** What she would say at level 1. */
  readonly line: string;
}

export const SKILLS: Readonly<Record<Skill, SkillDef>> = {
  knife: { name: 'Kitchen Work', counts: 'blows that land', step: 3, per: 0.03, cards: ['hold-it', 'tenderising'], of: 'of the butcher', line: 'The knife sits in your hand like it grew there.' },
  throwing: { name: 'Throwing', counts: 'knives that hit', step: 2, per: 0.03, cards: ['helpings'], of: 'of the darts club', line: 'Your knives go where you look now, mostly.' },
  footwork: { name: 'Footwork', counts: 'rolls', step: 2, per: 0.03, cards: ['duck'], of: 'of the dance hall', line: 'Rolling winds you less.' },
  climbing: { name: 'Climbing', counts: 'metres climbed', step: 8, per: 0.025, cards: ['kneading'], of: 'of the chimney sweep', line: 'Your fingers have stopped complaining about the rock.' },
  guard: { name: 'Guard', counts: 'blows stopped', step: 2, per: 0.03, cards: ['pot-lid'], of: 'of the goalkeeper', line: 'The lid weighs less on your arm.' },
  running: { name: 'Running', counts: 'metres run', step: 60, per: 0.012, cards: [], of: 'of the postman', line: 'You run longer before your chest burns.' },
  swimming: { name: 'Swimming', counts: 'metres swum', step: 15, per: 0.025, cards: [], of: 'of the lido', line: 'The cold water bothers you less.' },
  leaping: { name: 'Leaping', counts: 'jumps', step: 6, per: 0.012, cards: ['spring'], of: 'of the high jumper', line: 'Your knees have remembered they are springs.' },
  candle: { name: 'Sunday Candle', counts: 'candles thrown', step: 2, per: 0.05, cards: ['candle'], of: 'of the sexton', line: 'Your candles burn longer. Mine always did.' },
  soup: { name: 'Soup', counts: 'wounds mended by a fire', step: 20, per: 0.04, cards: ['soup'], of: 'of the sickroom', line: 'You mend quicker by the fire.' },
  tiptoe: { name: 'Tiptoe', counts: 'metres tiptoed', step: 12, per: 0.025, cards: ['tiptoe'], of: 'of the cat burglar', line: 'Your feet find the quiet stones.' },
  'way-home': { name: 'Way Home', counts: 'ways home', step: 1, per: 0.04, cards: ['way-home'], of: 'of the homing pigeon', line: 'The way home opens a little sooner.' },
  flame: { name: 'Stove Flame', counts: 'flames that burn something', step: 2, per: 0.03, cards: ['stove-flame'], of: 'of the stoker', line: 'The flame comes quicker and hotter.' },
  frost: { name: 'Cold Larder', counts: 'things chilled', step: 3, per: 0.03, cards: ['cold-larder'], of: 'of the ice house', line: 'The cold stays in them longer.' },
  force: { name: 'Rolling Pin', counts: 'things shoved', step: 3, per: 0.03, cards: ['rolling-pin'], of: 'of the baker', line: 'You shove harder.' },
  roots: { name: 'Horseradish', counts: 'roots set', step: 2, per: 0.03, cards: ['horseradish'], of: 'of the allotment', line: 'Your roots bite deeper.' },
  sowing: { name: 'Snapdragons', counts: 'seeds sown', step: 2, per: 0.03, cards: ['snapdragon'], of: 'of the seed merchant', line: 'Your snapdragons last longer and bite harder.' },
  flour: { name: 'Flour Bag', counts: 'bags thrown', step: 2, per: 0.03, cards: ['flour-bag'], of: 'of the mill', line: 'Your clouds hang longer.' },
  match: { name: 'Matchstick', counts: 'clouds set off', step: 2, per: 0.03, cards: ['matchstick'], of: 'of the fireworks', line: 'Your clouds go up with more of a bang.' },
  pet: { name: 'Salt Pet', counts: 'pets raised', step: 1, per: 0.04, cards: ['salt-pet'], of: 'of the shepherd', line: 'The salt stands up for you sooner.' },
  'salt-line': { name: 'Salt Line', counts: 'circles poured', step: 1, per: 0.05, cards: ['salt-line'], of: 'of the sacristan', line: 'Your circles keep longer.' },
};

/** Uses that level `l` of `s` takes in all: step × l(l+1)/2. */
export function usesFor(s: Skill, l: number): number {
  return (SKILLS[s].step * l * (l + 1)) / 2;
}

/** The skill that makes card `id` better, if any. */
export function skillOf(id: CardId): Skill | null {
  return (Object.keys(SKILLS) as Skill[]).find((s) => SKILLS[s].cards.includes(id)) ?? null;
}

/** What practice does to a card's numbers: × `more` what grows, × `less` what shrinks. */
export interface Trained {
  readonly more: number;
  readonly less: number;
}

export const UNTRAINED: Trained = { more: 1, less: 1 };

export class Practice {
  private readonly counts = new Map<Skill, number>();

  /** The counts, to keep (src/persist/save.ts); `Practice.from` puts them back (unknown skills are dropped). */
  get data(): Partial<Record<Skill, number>> {
    return Object.fromEntries(this.counts);
  }

  static from(d: Partial<Record<string, number>>): Practice {
    const p = new Practice();
    for (const [s, n] of Object.entries(d)) if (s in SKILLS && n) p.counts.set(s as Skill, n);
    return p;
  }

  /** The skills practised at all so far. */
  get practised(): Skill[] {
    return [...this.counts.keys()];
  }

  count(s: Skill): number {
    return this.counts.get(s) ?? 0;
  }

  /** The level practised (0 and up, no end), and `plus` on top (levels what is worn gives: src/loot/items.ts `Kit.gift`). */
  level(s: Skill, plus = 0): number {
    // The largest l with usesFor(s, l) <= count: l = floor((sqrt(1 + 8n/step) − 1) / 2), nudged for rounding.
    const n = this.count(s);
    let l = Math.max(0, Math.floor((Math.sqrt(1 + (8 * n) / SKILLS[s].step) - 1) / 2));
    while (usesFor(s, l + 1) <= n) l++;
    while (l > 0 && usesFor(s, l) > n) l--;
    return l + plus;
  }

  /** How far towards the next level, 0 … 1. */
  progress(s: Skill): number {
    const l = this.level(s), from = usesFor(s, l);
    return (this.count(s) - from) / (usesFor(s, l + 1) - from);
  }

  /** Count `n` more for `s`. Returns the new level if it went up, else 0. */
  use(s: Skill, n = 1): number {
    const before = this.level(s);
    this.counts.set(s, this.count(s) + n);
    const after = this.level(s);
    return after > before ? after : 0;
  }

  /** What practice (and `plus` levels worn) does to a number that grows with it (damage): 1 + per × level. */
  more(s: Skill, plus = 0): number {
    return 1 + SKILLS[s].per * this.level(s, plus);
  }

  /** What practice (and `plus` levels worn) does to a cost that shrinks with it (stamina, cooldowns): 1 / more, never 0. */
  less(s: Skill, plus = 0): number {
    return 1 / this.more(s, plus);
  }

  /** What practice does to card `id`'s numbers, `plus(s)` levels worn on top. */
  trained(id: CardId, plus: (s: Skill) => number = () => 0): Trained {
    const s = skillOf(id);
    return s ? { more: this.more(s, plus(s)), less: this.less(s, plus(s)) } : UNTRAINED;
  }
}
