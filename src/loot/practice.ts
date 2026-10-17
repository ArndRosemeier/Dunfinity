/**
 * Practice, the second axis of grandma's recipe box (docs/design/recipe-box.md §3): cooking a card
 * unlocks it, using things improves the numbers. Each skill counts what it did (blows that landed,
 * metres climbed...) and goes up a tier at a few low marks, so it never feels like grinding.
 *
 * What a grandchild has practised is theirs, like the cards they cooked: the next one starts at 0.
 * Pure: counts and multipliers the game reads.
 */

export type Skill = 'knife' | 'throwing' | 'footwork' | 'climbing' | 'guard';

/** Each skill: its name in the tin, what it counts, what a tier does (per tier), and what she would say. */
export const SKILLS: Readonly<Record<Skill, { readonly name: string; readonly counts: string; readonly per: number; readonly line: string }>> = {
  knife: { name: 'Kitchen Work', counts: 'blows that land', per: 0.06, line: 'The knife sits in your hand like it grew there.' },
  throwing: { name: 'Throwing', counts: 'knives that hit', per: 0.08, line: 'Your knives go where you look now, mostly.' },
  footwork: { name: 'Footwork', counts: 'rolls', per: 0.1, line: 'Rolling winds you less.' },
  climbing: { name: 'Climbing', counts: 'metres climbed', per: 0.07, line: 'Your fingers have stopped complaining about the rock.' },
  guard: { name: 'Guard', counts: 'blows stopped', per: 0.12, line: 'The lid weighs less on your arm.' },
};

/** The counts at which a skill goes up a tier. */
export const TIERS = [10, 30, 70] as const;

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

  count(s: Skill): number {
    return this.counts.get(s) ?? 0;
  }

  /** 0 … TIERS.length, and `plus` on top (tiers that what is worn gives: src/loot/items.ts `Kit.gift`). */
  tier(s: Skill, plus = 0): number {
    const n = this.count(s);
    return TIERS.filter((t) => n >= t).length + plus;
  }

  /** Count `n` more for `s`. Returns the new tier if it went up, else 0. */
  use(s: Skill, n = 1): number {
    const before = this.tier(s);
    this.counts.set(s, this.count(s) + n);
    const after = this.tier(s);
    return after > before ? after : 0;
  }

  /** What practice (and `plus` tiers worn) does to a number that grows with it (damage): 1 + per × tier. */
  more(s: Skill, plus = 0): number {
    return 1 + SKILLS[s].per * this.tier(s, plus);
  }

  /** What practice (and `plus` tiers worn) does to a cost that shrinks with it (stamina): 1 − per × tier. */
  less(s: Skill, plus = 0): number {
    return 1 - SKILLS[s].per * this.tier(s, plus);
  }
}
