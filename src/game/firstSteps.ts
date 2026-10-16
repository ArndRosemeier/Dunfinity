/**
 * First steps (the introduction's second half): after the prologue, a short list of things to do,
 * each ticked off when the player does it, so that a new player learns the basics by playing. In the
 * cellar one at a time (read the letter, her salt circle, the tin, the diary, the way down); on
 * level 1 all at once, in any order (stab, climb, pick up, a fire, the next way down). Then the
 * list says goodbye.
 *
 * Pure: the steps are data; `FirstSteps` knows which are done (kept in the family's save, so a new
 * family sees it again and later grandchildren do not) and which show.
 */

export type StepId = 'letter' | 'circle' | 'cook' | 'diary' | 'down' | 'stab' | 'climb' | 'pickup' | 'fire' | 'deeper';

export interface Step {
  readonly id: StepId;
  /** What to do, in a few words. */
  readonly text: string;
  /** The keys that do it, as shown on key caps ("WASD", "E", "click"). */
  readonly keys: readonly string[];
  /** A line under it, how. */
  readonly how: string;
}

/** The steps in their groups: a group shows once the one before it is done; in the cellar, one step at a time. */
export const STEP_GROUPS: readonly { readonly title: string; readonly oneByOne: boolean; readonly steps: readonly Step[] }[] = [
  {
    title: 'Grandma\'s cellar',
    oneByOne: true,
    steps: [
      { id: 'letter', text: 'Read the letter on her side table', keys: ['WASD', 'E'], how: 'Click the view to look round with the mouse; walk up to the table.' },
      { id: 'circle', text: 'Stand still in her salt circle', keys: [], how: 'Nothing comes into it. Resting there mends you, like a fire.' },
      { id: 'cook', text: 'Open her tin and cook a recipe card', keys: ['T', 'W', 'S', 'E'], how: 'The first card is a good start. Infused salt pays for it.' },
      { id: 'diary', text: 'Look into her diary', keys: ['J'], how: 'Most pages are torn out. She left them down there.' },
      { id: 'down', text: 'Go through the arch and down the old shaft', keys: ['E'], how: 'At the top of the ladder.' },
    ],
  },
  {
    title: 'Level 1, the Quarry',
    oneByOne: false,
    steps: [
      { id: 'stab', text: 'Stab something that bites', keys: ['click'], how: 'Tab picks a target.' },
      { id: 'climb', text: 'Climb a rock face', keys: ['W'], how: 'Walk into the rock. It costs stamina.' },
      { id: 'pickup', text: 'Pick something up', keys: ['E'], how: 'Ilse\'s pawn shop in town buys it.' },
      { id: 'fire', text: 'Light a fire and rest by it', keys: ['C'], how: 'It mends you, and her tin opens by it.' },
      { id: 'deeper', text: 'Find the way down to level 2', keys: [], how: 'Feel for the draft. The map is on M.' },
    ],
  },
];

/** Every step, in order. */
export const STEPS: readonly Step[] = STEP_GROUPS.flatMap((g) => g.steps);

/** Kept in the save: the steps done, or `true` when the list is over (played out or never wanted). */
export type FirstStepsData = readonly StepId[] | true;

export class FirstSteps {
  private readonly done = new Set<StepId>();
  /** The list is over (all done, or put away). */

  over = false;

  /** The list as kept (`data`). */
  static from(data: FirstStepsData): FirstSteps {
    const s = new FirstSteps();
    s.over = data === true;
    if (data !== true) for (const id of data) if (STEPS.some((x) => x.id === id)) s.done.add(id);
    return s;
  }

  get data(): FirstStepsData {
    return this.over ? true : [...this.done];
  }

  isDone(id: StepId): boolean {
    return this.over || this.done.has(id);
  }

  /** The group showing now (the first not all done), or -1 when every step is done. */
  get group(): number {
    return STEP_GROUPS.findIndex((g) => g.steps.some((s) => !this.done.has(s.id)));
  }

  /**
   * Mark `id` done. Steps done ahead of their turn count when it comes; the last step of a group (the
   * way on) finishes its group, done or not, so the list never lingers behind the player. Returns
   * whether it was newly ticked.
   */
  tick(id: StepId): boolean {
    if (this.over || this.done.has(id)) return false;
    this.done.add(id);
    const g = STEP_GROUPS.find((x) => x.steps[x.steps.length - 1].id === id);
    if (g) for (const s of g.steps) this.done.add(s.id);
    return true;
  }

  /** The steps on the card now: the group's done ones and, one by one or all at once, the open ones. */
  showing(): Step[] {
    const g = STEP_GROUPS[this.group];
    if (!g || this.over) return [];
    if (!g.oneByOne) return [...g.steps];
    const k = g.steps.findIndex((s) => !this.done.has(s.id));
    return g.steps.slice(0, k + 1);
  }

  /** Every step done (the card says goodbye, then the list is over). */
  get finished(): boolean {
    return !this.over && this.group < 0;
  }
}
