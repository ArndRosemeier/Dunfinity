/**
 * The notary's letters (docs/design/town-and-first-strata.md §2): each grandchild finds one, Herr
 * Brüggemann's, telling them they have inherited grandma's house. He grows wearier with every heir.
 * The first grandchild's letter is formal; by the tenth he has given up on most of it.
 */
import { hash3f } from '@futuremagic/core';

const NAMES = ['Okafor-Lindqvist', 'Brandt', 'Kowalczyk', 'Haddad', 'Ferreira', 'Nakamura', 'Lindgren', 'Moreau', 'Petrović', 'Yilmaz', 'Schulte', 'Andersson', 'Rossi', 'Novak', 'Mensah', 'Weber'];
const TITLES = ['Ms.', 'Mr.'];

/** What he writes to the `heir`-th grandchild (1: the first), for the game seeded `seed`. */
export function notaryLetter(heir: number, seed: number): string {
  const name = `${TITLES[Math.floor(hash3f(seed, heir, 1, 0) * TITLES.length)]} ${NAMES[Math.floor(hash3f(seed, heir, 2, 0) * NAMES.length)]}`;
  const before = heir - 1;
  const body = heir === 1
    ? [
      `Dear ${name},`,
      'It is my duty to inform you that under the will of your late grandmother you have inherited her house, with its contents, the cellar included.',
      'She asked me to add one thing, in her words: "The tin is on the chair. Start with the first card. Mind the arch."',
      'I do not know what this means. I trust you will.',
    ]
    : heir === 2
      ? [
        `Dear ${name},`,
        'I regret to inform you that you have inherited a house. Your cousin, who inherited it before you, has not been seen since going down to look at the cellar.',
        'I would ask you not to go into the cellar.',
      ]
      : heir < 6
        ? [
          `Dear ${name},`,
          `I regret to inform you that you have inherited a house. ${before} of your cousins inherited it before you. None of them came back up from the cellar.`,
          'Please do not go into the cellar. I say this to everyone now.',
        ]
        : [
          `${name}. House. Yours.`,
          `${before} before you. The cellar. You know already, don't you.`,
          'The tin is on the chair.',
        ];
  return [...body, heir < 6 ? 'Yours faithfully,\nH. Brüggemann, Notary' : 'H. B.'].join('\n\n');
}
