/**
 * Grandma's key (docs/design/lore.md §4.4, decision LO3): the letters of each old script the family
 * has worked out, pencilled into a page in her tin. It stays with the tin, so every grandchild finds
 * the letters the ones before learned. Each inscription read for the first time teaches one more.
 *
 * Pure data and rules; the save keeps `KeyData`.
 */
import { kerfSpell, threadSpell } from './scripts';

export type Script = 'kerf' | 'thread';

/** The letters known of each script (rune and letter ids as src/lore/scripts.ts spells them: 'th', 'sh', 'a', ...). */
export interface KeyData {
  readonly kerf: readonly string[];
  readonly thread: readonly string[];
  /** The inscriptions already read (their ids), which teach nothing more. */
  readonly read?: readonly string[];
}

/** The letters of `text` in `script`, word by word: a rune each in Kerf, a consonant and its vowels in Thread. */
export function lettersOf(script: Script, text: string): string[][] {
  return script === 'kerf' ? kerfSpell(text) : threadSpell(text).map((w) => w.flatMap((s) => [...(s.c ? [s.c] : []), ...s.v]));
}

/** The runes grandma was sure of, pencilled over a rubbing she folded into her note at the Threshold camp. */
export const GRANDMA_KERF: readonly string[] = ['t', 'h', 'th', 'e', 'o', 'a', 'n', 's', 'd'];

export class Key {
  private readonly known: Record<Script, Set<string>>;
  private readonly seen: Set<string>;

  constructor(data?: KeyData) {
    this.known = { kerf: new Set(data?.kerf ?? []), thread: new Set(data?.thread ?? []) };
    this.seen = new Set(data?.read ?? []);
  }

  get data(): KeyData {
    return { kerf: [...this.known.kerf], thread: [...this.known.thread], read: [...this.seen] };
  }

  knows(script: Script, letter: string): boolean {
    return this.known[script].has(letter);
  }

  /** What can be made out of `text`: known letters as themselves, the rest as '_' (one per letter). */
  makeOut(script: Script, text: string): string {
    return lettersOf(script, text).map((w) => w.map((l) => (this.knows(script, l) ? l : '_')).join('')).join(' ');
  }

  /** Pencil in `letters` (grandma's rubbing): how many were new. */
  pencil(script: Script, letters: readonly string[]): number {
    const before = this.known[script].size;
    for (const l of letters) this.known[script].add(l);
    return this.known[script].size - before;
  }

  /** Read the inscription `id`: the first time, it teaches a letter (see `learn`). The letter learned, or null. */
  read(id: string, script: Script, text: string): string | null {
    if (this.seen.has(id)) return null;
    this.seen.add(id);
    return this.learn(script, text);
  }

  /** Pencil in the unknown letter `text` uses most (the first seen breaks a tie). The letter, or null if it was all known. */
  learn(script: Script, text: string): string | null {
    const count = new Map<string, number>();
    for (const l of lettersOf(script, text).flat()) if (!this.knows(script, l)) count.set(l, (count.get(l) ?? 0) + 1);
    let best: string | null = null;
    for (const [l, n] of count) if (best === null || n > count.get(best)!) best = l;
    if (best) this.known[script].add(best);
    return best;
  }
}
