/**
 * The television report the title screen plays (src/app/tvSet.ts): a late-evening "unexplained
 * phenomena" programme from September 1966, the only one that covered what came up the night
 * grandma came home the fast way (docs/design/grandmas-diary.md, 2–4 September 1966; lore.md, "What
 * happened in 1966"). Sensational, half-mocking, and true. Its pictures are grainy press stills
 * (painted by tools/lore/reportStills.ts into public/report/<id>.webp), panned slowly; the words
 * are its captions.
 *
 * Pure data.
 */

export interface ReportShot {
  /** The still (public/report/<id>.webp), or null: the programme's own card, drawn as text. */
  readonly still: string | null;
  /** Seconds on screen. */
  readonly seconds: number;
  /** The words over it (the presenter's, or the reporter's). */
  readonly caption: string;
  /** A name strap at the bottom, if any. */
  readonly strap?: string;
  /** What the still shows, for the painter (a 1966 press photograph; never any writing in it). */
  readonly shows?: string;
  /** The presenter's voice for the shot (a sound id: the whole caption) and the line (`linesOf`) it starts with. */
  readonly voice?: { readonly id: string; readonly line: number };
}

/** The programme's name and the evening it went out. */
export const PROGRAMME = { name: 'THE UNEXPLAINED', date: 'Saturday 10 September 1966, 23.15' };

/** The report, in order; it loops (`onAir`), with snow between airings. */
export const REPORT: readonly ReportShot[] = [
  { still: null, seconds: 6, caption: '' },
  {
    still: 'presenter', seconds: 10.0, voice: { id: 'report_1', line: 0 }, strap: 'Horst Weidner',
    caption: 'Good evening. Tonight, a small salt-mining town that has asked us not to say its name, and what walked down its streets eight nights ago.',
    shows: 'a television presenter in his forties in a dark suit and thin tie, sitting at a plain studio desk with a desk microphone, looking into the camera, a dark studio behind him',
  },
  {
    still: 'street', seconds: 13.7, voice: { id: 'report_2', line: 0 }, strap: 'Lindenstraße, 3 September, 2 a.m.',
    caption: 'A baker on his way to the ovens saw it under the last street lamp. "Taller than the lamp," he says. "Thin as a rake. It walked with its head bent, as if the sky was a ceiling."',
    shows: 'a narrow cobbled street of old stone houses at night, one street lamp, and far away at the end of the street, half in shadow, a very tall thin figure with its head bowed, much taller than the lamp post; motion blur, taken in a hurry',
  },
  {
    still: 'dogs', seconds: 8.4, voice: { id: 'report_3', line: 0 },
    caption: 'Every dog in the town howled until it was light. Two of them ran into the river and would not come out.',
    shows: 'two farm dogs standing in a shallow river at dawn, up to their chests in the water, staring back at the bank, mist on the water',
  },
  {
    still: 'grating', seconds: 10.5, voice: { id: 'report_4', line: 0 }, strap: 'A neighbour',
    caption: 'A light came up through a cellar grating, she says. Blue, like the hands of a watch in the dark. It was gone before our camera came.',
    shows: 'a low iron cellar grating in the wall of an old house at pavement level at night, a pale glow coming up through the bars and lighting the cobbles',
  },
  {
    still: 'milk', seconds: 6.9, voice: { id: 'report_5', line: 0 },
    caption: 'On Sunday morning the milk on three doorsteps had turned to salt. The milkman is changing his round.',
    shows: 'three glass milk bottles on a stone doorstep in morning light, each one filled with coarse white salt crystals instead of milk, crystals crusting over the caps',
  },
  {
    still: 'tracks', seconds: 9.8, voice: { id: 'report_6', line: 0 },
    caption: 'In the salt dust by the old mine gate, footprints. Each one as long as a man\'s arm, and nineteen paces apart.',
    shows: 'very long narrow bare footprints pressed into a thin layer of pale dust on cobbles beside a closed iron gate, a man\'s hand laid next to one for scale, flash photograph at night',
  },
  {
    still: 'mine', seconds: 11.4, voice: { id: 'report_7', line: 0 }, strap: 'The salt mine, closed since 1947',
    caption: 'The mine has been shut since 1947, when a whole shift went down and did not come up. The company\'s answer to our questions: no comment.',
    shows: 'the steel headframe of a small old salt mine against an overcast sky, a chain-link fence and a padlocked gate in front, weeds growing',
  },
  {
    still: 'cellar', seconds: 10.4, voice: { id: 'report_8', line: 0 },
    caption: 'At four in the morning a young woman was bricking up the arch in her cellar. She would not talk to us. She did not stop working while we were there.',
    shows: 'a young woman in her twenties in a headscarf and work apron, seen from behind and the side, laying bricks with a trowel to close an old arched opening in a stone cellar wall, a bucket of mortar at her feet, lit by one bare bulb, her face turned away from the camera',
  },
  {
    still: 'police', seconds: 6.5, voice: { id: 'report_9', line: 0 }, strap: 'The mayor',
    caption: 'The police found nothing. The mayor calls it a prank by students from the city.',
    shows: 'a portly small-town mayor in a suit and a policeman in a 1960s German police uniform and peaked cap standing on the steps of a small town hall, the mayor shrugging',
  },
  {
    still: 'presenter', seconds: 9.1, voice: { id: 'report_10', line: 0 }, strap: 'Horst Weidner',
    caption: 'And yet, eight days on, no dog in that town will walk down Lindenstraße. Good night.',
  },
];

/** How fast the words go by (characters a second; each shot stays at least that long), and the snow between one airing and the next (seconds). */
export const PACE = { read: 14, linger: 1.5, snow: 3, line: 90 };

/** How long a shot is on screen: its own seconds, or long enough to read its words. */
export function shotSeconds(s: ReportShot): number {
  return Math.max(s.seconds, s.caption.length / PACE.read + PACE.linger);
}

/** One airing, snow included (seconds); the report loops. */
export const AIRING = REPORT.reduce((n, s) => n + shotSeconds(s), 0) + PACE.snow;

/** Where shot `i` begins in the airing (seconds). */
export function shotStart(i: number): number {
  return REPORT.slice(0, i).reduce((n, s) => n + shotSeconds(s), 0);
}

/** A caption cut into the lines shown one after another: whole sentences, joined while they fit `PACE.line` characters. */
export function linesOf(caption: string): string[] {
  const sentences = caption.split(/(?<=[.!?]["”]?)\s+(?=["“]?[A-Z])/).filter(Boolean);
  const out: string[] = [];
  for (const s of sentences) {
    const last = out.length - 1;
    if (last >= 0 && out[last].length + 1 + s.length <= PACE.line) out[last] += ` ${s}`;
    else out.push(s);
  }
  return out;
}

/** What is on the air `time` seconds into the programme: the shot (-1: snow), how far into it, and the line of words showing. */
export interface OnAir {
  readonly shot: number;
  readonly t: number;
  readonly line: string;
}

/** What is on the air at `time` (seconds; it loops). Each line of a shot's words stays for its share of the shot, by length. */
export function onAir(time: number): OnAir {
  let u = ((time % AIRING) + AIRING) % AIRING;
  for (let i = 0; i < REPORT.length; i++) {
    const s = REPORT[i], len = shotSeconds(s);
    if (u < len) {
      const lines = linesOf(s.caption), total = lines.reduce((n, l) => n + l.length, 0);
      let at = u / len * total, line = '';
      for (const l of lines) { line = l; if ((at -= l.length) < 0) break; }
      return { shot: i, t: u, line };
    }
    u -= len;
  }
  return { shot: -1, t: u, line: '' };
}

/** The voice (a sound id) that begins with the line on the air, if one does. */
export function voiceOf(air: OnAir): string | null {
  const v = REPORT[air.shot]?.voice;
  return v && air.line && linesOf(REPORT[air.shot].caption)[v.line] === air.line ? v.id : null;
}
