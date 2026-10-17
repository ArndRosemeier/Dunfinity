/**
 * How players reach the makers: the Futuremagic board, opened in a new tab (the game stays where it is).
 */

/** Where players write to the makers. */
const BOARD = 'https://board.futuremagic.de/';

/** Open the makers' board in a new tab. */
export function writeToUs(): void {
  window.open(BOARD, '_blank', 'noopener');
}
