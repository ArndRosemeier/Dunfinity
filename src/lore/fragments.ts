/**
 * What the old peoples wrote, by where it stands (docs/design/lore.md §2, §3): authored lines that
 * carry the story, drawn deterministically per place. Every line is plain English (decision LO2);
 * the script spells it.
 *
 * Pure data.
 */

/**
 * Cut over the doors of the crypt fronts at the Threshold (levels 9–10), in Kerf runes, worn: the
 * dwarves came up this far once, and what they left is warning. The first sight of their writing.
 */
export const THRESHOLD_LINTELS: readonly string[] = [
  'this stair is not ours',
  'do not wake the tall',
  'they climb at night',
  'the long ones came up here',
  'we sealed this door',
  'here the worlds lie close',
  'go down not up',
  'salt holds them',
];

/**
 * Inlaid in the friezes of the dwarven halls (levels 21–40), in Kerf: the diggers' own account. They
 * dug down on purpose, world after world, after the first fire, and believed the climbers come up
 * to take back what was taken (lore.md §3). Each line is short enough to fill a wall panel in runes
 * a forearm long.
 */
export const DIGGERS: readonly string[] = [
  'we dug for the first fire',
  'each world lies on another',
  'the fire lies under all',
  'they come up to take back',
  'what we take they follow',
  'the long ones do not tire',
  'we were not first to dig',
  'the keepers sang it shut',
  'never trust the keepers',
  'the salt is an old sea',
  'keep the count of the steps',
  'below us is older stone',
];

/** What dwarven halls are called: "hall of the ...". */
const HALL_OF = ['anvil', 'first fire', 'long stair', 'nine kings', 'deep bell', 'broken hammer', 'salt', 'red seam', 'sleepers', 'last count', 'iron door', 'high forge'];

/** Dwarves' names (invented words, the one thing in the scripts that is not English). */
const DWARF_NAMES = ['bram', 'dunna', 'hild', 'orrik', 'tova', 'grend', 'ulla', 'baldo', 'kettil', 'runa', 'stig', 'morna'];

/** Numbers as the dwarves cut them: spelled out (one to ninety nine). */
export function numberWords(n: number): string {
  const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]} ${ONES[n % 10]}`.trim();
}

/** The name of a dwarven hall, from `r` in [0, 1). */
export function hallName(r: number): string {
  return `hall of the ${HALL_OF[Math.floor(r * HALL_OF.length)]}`;
}

/**
 * A frieze in a dwarven hall: one of the diggers' lines, or (filler) a record of the hall: who cut
 * it, who fell in it, how far down the fire is. `r(k)` gives a number in [0, 1) for each k (k < 4).
 */
export function frieze(r: (k: number) => number): string {
  const name = DWARF_NAMES[Math.floor(r(1) * DWARF_NAMES.length)], pick = r(0);
  if (pick < 0.55) return DIGGERS[Math.floor(r(2) * DIGGERS.length)];
  if (pick < 0.7) return `${name} cut this hall`;
  if (pick < 0.85) return `here ${name} fell`;
  return `${numberWords(20 + 10 * Math.floor(r(3) * 5))} fathoms to the fire`;
}

/**
 * Written along the ribs of the elven vaults (levels 21–40), in Thread script: the keepers' account.
 * They grew the vaults over the crack and sang the doors shut, and believed the climbers are only
 * going home (lore.md §3). Wards, laments, the names of the lost.
 */
export const KEEPERS: readonly string[] = [
  'they are only going home',
  'sleep now and do not climb',
  'we sang the doors shut for their sake and for ours',
  'the diggers woke the fire and the fire woke them',
  'keep the way shut and keep it kind',
  'we grew this roof over the crack',
  'what comes up is not angry it is lost',
  'every world is a door that someone closed',
  'salt of the first sea holds the line',
  'the tall ones were old when we were young',
  'do not follow the diggers down',
  'here the thread is thin so sing',
];

/** Elves' names (invented words). */
const ELF_NAMES = ['aelin', 'sirith', 'maelor', 'lune', 'tavrin', 'elowen', 'nimra', 'ithiel', 'oren', 'faleth'];

/** A line along an elven rib: one of the keepers' lines, or (filler) a lament for one of the lost. `r(k)` gives a number in [0, 1) for each k (k < 3). */
export function ribLine(r: (k: number) => number): string {
  const name = ELF_NAMES[Math.floor(r(1) * ELF_NAMES.length)];
  if (r(0) < 0.7) return KEEPERS[Math.floor(r(2) * KEEPERS.length)];
  return r(0) < 0.85 ? `remember ${name} who went down singing` : `${name} kept this door and did not come back`;
}
