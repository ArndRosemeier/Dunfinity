/**
 * Something read on a level held in the hands (`level.writing`): the notary's letter, grandma's
 * note at her camp, a page torn out of her diary (with the page as she painted it). Its paragraphs
 * on paper; E or Escape puts it down, and so does walking away.
 */
import { Modal, esc, keycap } from './panel';

const STYLE = `
  #letter { width: min(620px, calc(100vw - 32px)); }
  #letter > .ui-scroll { padding: 22px 30px 14px; }
  #letter .head { margin-bottom: 10px; }
  #letter p { margin: 0 0 10px; white-space: pre-line; }
  #letter img { display: block; width: 100%; margin: 4px 0 12px; box-shadow: 0 2px 8px #4a3a2055; }
  #letter .aside { font: 15px/1.45 var(--ui-font); color: var(--ui-paper-blue); }`;

export class LetterView extends Modal {
  constructor(host: HTMLElement) {
    super(host, 'letter', STYLE);
  }

  /** Show `text` (paragraphs split by blank lines) under `head`; `image`, a picture of it; `asides`, what one does with it (in another hand). */
  show(head: string, text: string, image: string | null = null, asides: readonly string[] = []): void {
    this.showHtml(`<div class="head ui-label">${esc(head)}</div>${image ? `<img src="${esc(image)}" alt="">` : ''}`
      + text.split(/\n\n+/).map((p) => `<p>${esc(p)}</p>`).join('')
      + asides.map((a) => `<p class="aside">${esc(a)}</p>`).join('')
      + `<div class="ui-keys">${keycap('E')} or ${keycap('Esc')} put it down</div>`);
  }
}
