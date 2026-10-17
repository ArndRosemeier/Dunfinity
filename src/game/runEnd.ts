/**
 * The end of a run (decision D11, permadeath): what killed the grandchild, and what of them the family
 * keeps. Grandma's tin goes back to the armchair with its salt, her diary with the pages found, her
 * key with every letter pencilled in, her purse, and the finds stay taken; what they cooked, practised,
 * bought and carried goes down with them. The death screen (src/app/deathView.ts) shows it. Pure.
 */
import { CARDS, type Cooked } from '../loot/recipes';
import { SKILLS, type Practice, type Skill } from '../loot/practice';
import { itemName, type Kit } from '../loot/items';
import type { Pack } from '../loot/finds';
import type { Tin } from '../loot/tin';
import type { KeyData } from '../lore/key';
import { PAGES } from '../lore/diary';

/** What hurt you, per cause (`Body.lastCause`): the HUD line, and the death line. */
export const HURT: Readonly<Record<string, readonly [string, string]>> = {
  rat: ['a rat bites', 'The rats got you.'],
  cricket: ['a cave cricket', 'The cave crickets got you.'],
  dog: ['a feral dog bites', 'The dogs pulled you down.'],
  'village dog': ['a dog bites', 'You should have left the dogs alone.'],
  eel: ['a brine eel strikes', 'Something in the water took you.'],
  lumen: ['a Lumen slime', 'The Lumen did not forgive you.'],
  toadstool: ['a toadstool slams', 'A toadstool crushed you. It was only a mushroom.'],
  spores: ['spores burn', 'The spores filled your lungs.'],
  murk: ['a Murk slime burns', 'The Murk swallowed you.'],
  'salt-touched': ['a Salt-Touched strikes', 'A Salt-Touched brought its pick down on you.'],
  foreman: ['the Foreman strikes', 'The Foreman brought his pick down on you.'],
  scavenger: ['a scavenger strikes', 'A scavenger had what you carried, in the end.'],
  goblin: ['a goblin jabs', 'The goblins picked you over.'],
  snapdragon: ['your snapdragon bites', 'Your own snapdragon got you. She did say to step back.'],
  flour: ['the flour goes up', 'You went up with the flour. She did say to get out of it first.'],
  critter: ['an animal strikes back', 'You picked a fight with something that lives down here, and lost.'],
  colossus: ['the giant strikes back', 'You attacked something the size of a house.'],
  hunter: ['an animal attacks', 'Something that hunts down here found you.'],
  'tall-one': ['the Tall One reaches', 'The Tall One reached you outside the salt.'],
  fall: ['a hard landing', 'You fell to your death.'],
};

/** The HUD line for a blow of `cause`. */
export const hurtLine = (cause: string): string => HURT[cause]?.[0] ?? 'a hard landing';
/** The first line of the death screen for `cause`. */
export const deathLine = (cause: string): string => HURT[cause]?.[1] ?? 'You fell to your death.';

/** What a run comes to: the lines of what the family keeps, and of what went down with the grandchild. */
export interface RunEnd {
  readonly kept: readonly string[];
  readonly lost: readonly string[];
}

export interface RunState {
  readonly tin: Tin;
  /** The salt the tin held when this grandchild picked it up. */
  readonly saltAtStart: number;
  readonly key: KeyData;
  readonly euros: number;
  /** Finds taken by the whole family, all levels. */
  readonly taken: number;
  readonly pack: Pack;
  readonly cooked: Cooked;
  readonly practice: Practice;
  readonly kit: Kit;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function runEnd(s: RunState): RunEnd {
  const gained = s.tin.salt - s.saltAtStart;
  const pages = PAGES.filter((p) => p.depth !== null && s.tin.hasPage(p.depth)).length;
  const letters = s.key.kerf.length + s.key.thread.length;
  const kept = [
    `Grandma's tin, back on the armchair: ${plural(s.tin.salt, 'pinch', 'pinches')} of infused salt${gained > 0 ? ` (${gained} more than when they took it up)` : ''}.`,
    s.tin.deepest ? `The family has been down to level ${s.tin.deepest}; her cards open as deep as that.` : '',
    pages ? `Her diary, with ${plural(pages, 'page')} put back.` : '',
    letters ? `Her key to the old scripts, ${plural(letters, 'letter')} pencilled in.` : '',
    s.euros ? `Her purse: €${s.euros}.` : '',
    s.taken ? `What the family took stays taken: ${plural(s.taken, 'find')}.` : '',
  ].filter(Boolean);
  const cards = CARDS.filter((c) => s.cooked.rank(c.id) > 0).map((c) => `${c.title}${s.cooked.rank(c.id) > 1 ? ` (rank ${s.cooked.rank(c.id)})` : ''}`);
  const skills = (Object.keys(SKILLS) as Skill[]).filter((k) => s.practice.tier(k) > 0).map((k) => `${SKILLS[k].name} ${s.practice.tier(k)}`);
  // (Not a plain kitchen knife: the block in her kitchen has an endless supply of them, D11.)
  const worn = s.kit.items.filter((i) => i.kind !== 'kitchen-knife' || i.quality !== 'sound');
  const lost = [
    cards.length ? `What they had cooked: ${cards.join(', ')}.` : '',
    skills.length ? `What they had practised: ${skills.join(', ')}.` : '',
    worn.length ? `What they wore and held: ${worn.map(itemName).join(', ')}.` : '',
    s.pack.spare.length ? `Spare in their pack: ${s.pack.spare.map(itemName).join(', ')}.` : '',
    s.pack.items.length ? `Their pack: ${plural(s.pack.items.length, 'find')}, about €${s.pack.worth} at Ilse's.` : '',
  ].filter(Boolean);
  if (!lost.length) lost.push('Nothing much. They had only just started.');
  return { kept, lost };
}
