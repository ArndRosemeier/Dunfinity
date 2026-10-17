/**
 * How players reach the makers: the address, kept scrambled in the code and the built game (so
 * address-harvesting bots reading the source find nothing) and put together only when asked, then a
 * mail opened to it with the version in the subject.
 */

/** The address, each character mixed with a key and its place. */
const MIXED = [23, 9, 56, 69, 48, 137, 162, 214, 255, 54, 55, 43, 68, 120, 201, 160, 216, 229, 3, 61, 84, 46, 118, 138];
const KEY = 'salt-veins';

/** The address, unscrambled. */
export function contactAddress(): string {
  return String.fromCharCode(...MIXED.map((b, i) => b ^ KEY.charCodeAt(i % KEY.length) ^ ((i * 29) & 255)));
}

/** Open a mail to the makers, about `version`. */
export function writeToUs(version: string): void {
  location.href = `mailto:${contactAddress()}?subject=${encodeURIComponent(`Dunfinity ${version} (alpha)`)}`;
}
