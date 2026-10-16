/**
 * Grandma's ghost (docs/design/grandmas-ghost.md, Arnd's pick A): Grete died in her armchair in the
 * round room and is still keeping the circle. She is not there most of the time. When a grandchild
 * comes into the room, the first time or back up from below, and she has something to say, she rises
 * beside her chair, turns to them, says one line and fades. She never explains what is down there
 * (her diary is the only voice of the depths), never answers, never helps.
 *
 * What she says: to a new grandchild, a word for the cousin who fell before them (or, to the first,
 * that she is still here); to one back up from below, the newest of her few lines the family's depth
 * has opened, once each per grandchild; otherwise nothing. Pure.
 */
import { CELLAR } from '../gen/cellar';
import { heirName, type Fallen } from '../gen/notary';
import { Townsperson } from './townsperson';

export const GRANDMA = {
  /** Where she rises: beside her chair, between it and the arch, in the round room. */
  x: 6.95,
  z: -0.95,
  /** She comes when a grandchild is this near (and on her floor), and turns to them; she waits this long after they arrive. */
  notice: 3.4,
  reach: 3.4,
  quiet: 2.5,
  /** Seconds she takes to rise, talks, takes to fade; how fast she turns (radians a second). */
  rising: 1.5,
  talk: 6,
  fading: 3,
  turn: 1.6,
} as const;

/** What she knows: the family's deepest level, the fallen (the notary's list), the game's seed (their names). */
export interface Kin {
  readonly deepest: number;
  readonly fallen: readonly Fallen[];
  readonly seed: number;
}

/** Her lines to one back up from below (as shown, quotes and all), each once the family has been as deep as `from`; only ever what her pages have told. */
const BACK: readonly { from: number; line: string }[] = [
  { from: 1, line: '"You came back up. Good. Most days that is all it is."' },
  { from: 3, line: '"Don\'t eat the blue salt to see in the dark. I did. It doesn\'t stop being in you."' },
  { from: 5, line: '"If one of them stops when you say a name, don\'t say it again. They listen too hard."' },
  { from: 8, line: '"Papa\'s name is on a list down there. Don\'t tick it."' },
  { from: 10, line: '"I didn\'t break it." She is looking at the arch, not at you. "I want you to know that."' },
  { from: 11, line: '"You\'ve seen the town. Don\'t go into that house. I did."' },
  { from: 21, line: '"Chalk. He always had chalk in his pockets. Mother hated it."' },
];

/** "the Haddad girl": how she names a grandchild (the notary's "Ms. Haddad"). */
export function kinName(heir: number, seed: number): string {
  const [title, ...rest] = heirName(heir, seed).split(' ');
  return `the ${rest.join(' ')} ${title === 'Ms.' ? 'girl' : 'boy'}`;
}

/** Her word for the last of the fallen, the `n`-th: where they fell, not how. */
function mourn(f: Fallen, n: number, seed: number): string {
  const who = kinName(f.heir, seed), Who = who[0].toUpperCase() + who.slice(1), at = f.depth ? `level ${f.depth}` : 'the cellar';
  if (n >= 5) return `That's ${n} of you now. I counted the miners for sixty years. I can count you.`;
  const lines = [
    `${Who} went down to ${at}. Nobody comes back up to tell me. I just know.`,
    `I felt ${who} go, on ${at}. Like a draught under a door.`,
    `${Who}. ${at[0].toUpperCase() + at.slice(1)}. I write them down, you know. Somebody has to.`,
    `${Who} got as far as ${at}. Further than I'd have bet.`,
  ];
  return lines[(n - 1) % lines.length];
}

export class Grandma extends Townsperson {
  /** On the cellar's floor, not the street's. */
  override readonly y: number = 0;
  /** 'away' (not there), or rising, speaking, fading since `since` (seconds, the game's clock). */
  mode: 'away' | 'rise' | 'speak' | 'fade' = 'away';
  since = 0;
  /** What she said last (the game shows it as she begins to speak), and how many times she has spoken. */
  said = '';
  calls = 0;
  /** The grandchild she is waiting for, since when, whether they have had her first word, and which of her lines from below they have heard. */
  private heir = 0;
  private waiting = false;
  private arrivedAt = 0;
  private greeted = false;
  private readonly heard = new Set<number>();

  constructor() {
    // Facing the doorway the grandchildren come in by.
    super(GRANDMA.x, GRANDMA.z, Math.atan2(-(CELLAR.door.x[1] - GRANDMA.x), GRANDMA.z), GRANDMA);
  }

  /** A grandchild `heir` has come into the cellar: the first time, or back up from below (her quiet counts from the next step). */
  arrive(heir: number): void {
    if (heir !== this.heir) {
      this.heir = heir;
      this.greeted = false;
      this.heard.clear();
    }
    this.waiting = true;
    this.arrivedAt = -1;
  }

  /** How much of her shows (0..1). */
  seen(now: number): number {
    const t = now - this.since;
    if (this.mode === 'rise') return Math.min(1, t / GRANDMA.rising);
    if (this.mode === 'speak') return 1;
    if (this.mode === 'fade') return Math.max(0, 1 - t / GRANDMA.fading);
    return 0;
  }

  /** What she would say now, or null (and nothing more to say to this grandchild this visit). */
  private line(kin: Kin): string | null {
    if (!this.greeted) {
      this.greeted = true;
      const last = kin.fallen[kin.fallen.length - 1];
      return `"${last ? mourn(last, kin.fallen.length, kin.seed) : "You have the tin. Good. I'm not going anywhere. I never did."}"`;
    }
    for (let i = BACK.length - 1; i >= 0; i--) {
      if (BACK[i].from > kin.deepest || this.heard.has(i)) continue;
      this.heard.add(i);
      return BACK[i].line;
    }
    return null;
  }

  /**
   * Step by `dt` at `now` with the grandchild at (px, py, pz) in the cellar: she rises once they come
   * near (if she has a word for them), turns to them, speaks, fades. Returns her line the moment she
   * begins to speak, else null.
   */
  keep(dt: number, now: number, px: number, py: number, pz: number, kin: Kin): string | null {
    if (this.arrivedAt < 0) this.arrivedAt = now;
    if (this.mode !== 'away') this.turn(px, pz, dt);
    const t = now - this.since;
    if (this.mode === 'away' && this.waiting && this.canHear(px, py, pz) && now - this.arrivedAt > GRANDMA.quiet) {
      this.waiting = false;
      const l = this.line(kin);
      if (l) { this.said = l; this.mode = 'rise'; this.since = now; this.yaw = Math.atan2(-(px - this.x), -(pz - this.z)); }
    } else if (this.mode === 'rise' && t >= GRANDMA.rising) {
      this.mode = 'speak'; this.since = this.talkAt = now; this.calls++;
      return this.said;
    } else if (this.mode === 'speak' && t >= GRANDMA.talk) {
      this.mode = 'fade'; this.since = now;
    } else if (this.mode === 'fade' && t >= GRANDMA.fading) {
      this.mode = 'away';
    }
    return null;
  }
}
