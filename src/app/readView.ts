/**
 * Reading an inscription in the old scripts (docs/design/lore.md §4.4): the glyphs drawn large, under
 * them what can be made out with the letters in grandma's key, and a line about where it is.
 * E or Escape closes it, and so does walking away.
 */
import { letteringBlock } from '../lore/svg';
import type { Lettering } from '../lore/scripts';
import { Modal, esc, keycap } from './panel';

const STYLE = `
  #read { width: min(900px, calc(100vw - 32px)); }
  #read > .ui-scroll { padding: 18px 24px 14px; }
  #read .where { font-style: italic; color: var(--ui-paper-dim); margin-bottom: 10px; }
  #read .glyphs { padding: 8px 0; border-top: 1px solid var(--ui-paper-line); border-bottom: 1px solid var(--ui-paper-line); }
  #read .glyphs svg { max-width: 100%; height: auto; display: block; margin: 6px auto; }
  #read .out { font: 19px/1.6 ui-monospace, monospace; letter-spacing: 0.12em; color: #3a2c1c; margin: 12px 0 6px; text-align: center; }
  #read .learned { color: var(--ui-paper-blue); text-align: center; }`;

export class ReadView extends Modal {
  constructor(host: HTMLElement) {
    super(host, 'read', STYLE);
  }

  /** Show an inscription: its lines of glyphs in `ink`, the line about where it is, what the key reads of it, and the line about a letter just pencilled in (or null). */
  show(lines: readonly Lettering[], ink: string, where: string, madeOut: string, learned: string | null): void {
    this.showHtml(`<div class="where">${esc(where)}</div><div class="glyphs">${letteringBlock(lines, { scale: 34, colour: ink, width: 3.5 }, 22)}</div>`
      + `<div class="out">${esc(madeOut)}</div>${learned ? `<div class="learned">${esc(learned)}</div>` : ''}<div class="ui-keys">${keycap('E')} or ${keycap('Esc')} stop reading</div>`);
  }
}
