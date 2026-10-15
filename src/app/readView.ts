/**
 * Reading an inscription in the old scripts (docs/design/lore.md §4.4): the glyphs drawn large, under
 * them what can be made out with the letters in grandma's key, and a line about where it is.
 * E or Escape closes it, and so does walking away.
 */
import { letteringBlock } from '../lore/svg';
import type { Lettering } from '../lore/scripts';
import { esc, panel } from './panel';

const STYLE = `
  #read { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 9; width: min(900px, calc(100vw - 32px)); max-height: calc(100vh - 64px); overflow: auto;
    background: #e9dfc6f2; color: #2b2116; border: 1px solid #8a7656; border-radius: 4px; padding: 14px 18px; font: 15px/1.4 Georgia, serif; display: none; box-shadow: 0 6px 30px #000a; }
  #read.open { display: block; }
  #read .where { font-style: italic; color: #5a4a35; margin-bottom: 8px; }
  #read .glyphs svg { max-width: 100%; height: auto; display: block; margin: 6px 0; }
  #read .out { font: 18px/1.6 ui-monospace, monospace; letter-spacing: 0.12em; color: #3a2c1c; margin: 8px 0; }
  #read .learned { color: #2f5d7a; }
  #read .keys { margin-top: 10px; font: 12px system-ui, sans-serif; color: #6d5a3d; }`;

export class ReadView {
  private readonly el: HTMLDivElement;

  constructor(host: HTMLElement) {
    this.el = panel(host, 'div', 'read', STYLE);
  }

  get open(): boolean {
    return this.el.classList.contains('open');
  }

  /** Show an inscription: its lines of glyphs in `ink`, the line about where it is, what the key reads of it, and the line about a letter just pencilled in (or null). */
  show(lines: readonly Lettering[], ink: string, where: string, madeOut: string, learned: string | null): void {
    this.el.innerHTML = `<div class="where">${esc(where)}</div><div class="glyphs">${letteringBlock(lines, { scale: 34, colour: ink, width: 3.5 }, 22)}</div>`
      + `<div class="out">${esc(madeOut)}</div>${learned ? `<div class="learned">${esc(learned)}</div>` : ''}<div class="keys">E or Escape: stop reading</div>`;
    this.el.classList.add('open');
  }

  hide(): void {
    this.el.classList.remove('open');
  }
}
