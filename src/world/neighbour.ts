/**
 * Old Frau Weber, across the street (town-and-first-strata.md §3): she stands on her doorstep at
 * night, turns to whoever comes near, and talks when called on (E at her door): hints and rumours,
 * the more of them the deeper the family has been. She knew grandma sixty years; she never asks what
 * you are doing in that cellar, and she always knows. Pure.
 */
import { homeDoor } from '../gen/town';
import { Townsperson } from './townsperson';

/** Her blocker's key. */
export const WEBER_KEY = 'weber';

export const WEBER = {
  /** How near her one must stand to talk. */
  reach: 2.0,
  /** How near one must come for her to turn to you, and how fast she turns (radians a second). */
  notice: 9,
  turn: 2.2,
  /** Seconds she goes on talking (her hands moving) after one calls on her. */
  talk: 5,
} as const;

/** What she knows to talk of: from the first call; then hints and rumours, each once the family has been as deep as `from`. */
const RUMOURS: readonly { from: number; line: string }[] = [
  { from: 0, line: 'Your grandmother bought salt by the sack. Coarse, from the farm shop. Every month for sixty years. I never asked her what for.' },
  { from: 0, line: "When the wind comes off the quarry you can hear the old pump at night. They switched it off in 1947." },
  { from: 0, line: "Don't sell Ilse anything that hums. She keeps those, you know. In the back." },
  { from: 0, line: 'Kemal will tell you that you need a helmet. Kemal is right about once a year. This may be the year.' },
  { from: 1, line: "You've been down. You smell of chalk and cold. Grete smelled like that, the summer of '63." },
  { from: 1, line: 'The chalk numbers on the pillars? The miners counted the way home. Down there it counts the other way, she said.' },
  { from: 3, line: "The salt down there isn't white, is it. She said it glowed like a church window." },
  { from: 5, line: 'There was a foreman, Pohl. A bell on his belt so his men could always find him. She said they still can.' },
  { from: 6, line: 'The waterworks under the hill were finished in 1939 and never switched on. Then the water started running anyway.' },
  { from: 9, line: 'She went further than anyone. She came back in 1966 and bricked up the cellar that same week. She stopped going to church after.' },
  { from: 10, line: "Tall. Yes. She said it was tall. That's all she would ever say, and she said it looking at the floor." },
];

/** What the family has done that she knows of. */
export interface Known {
  /** The deepest level any grandchild has reached; how many have not come back. */
  readonly deepest: number;
  readonly fallen: number;
}

export class Neighbour extends Townsperson {
  /** How many times she has been called on (this grandchild), and how many of the fallen she has spoken of. */
  private calls = 0;
  private mourned = 0;

  constructor() {
    const d = homeDoor('weber');
    // On her doorstep, in her lit doorway, looking out at the street.
    super(d.x - d.nx * 0.4, d.z - d.nz * 0.4, Math.atan2(-d.nx, -d.nz), WEBER);
  }

  /** Call on her at `now`: what she says. */
  talk(known: Known, now: number): string {
    this.talkAt = now;
    const n = this.calls++;
    if (n === 0 && known.fallen === 0) return "So you're Grete's. You have her chin. I don't sleep much; come by whenever you like.";
    if (known.fallen > this.mourned) {
      this.mourned = known.fallen;
      return known.fallen === 1
        ? "Another one of Grete's. The notary's car was outside again. I made soup for your cousin; nobody came for it."
        : `The notary's car again. That's ${known.fallen} of you now. I've stopped making soup. Come in for a minute, at least.`;
    }
    const open = RUMOURS.filter((r) => r.from <= known.deepest);
    return open[(n - 1 + open.length) % open.length].line;
  }
}
