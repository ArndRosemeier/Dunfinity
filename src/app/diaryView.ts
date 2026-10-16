/**
 * Grandma's diary open (docs/design/grandmas-diary.md): the pages in the book in date order, the
 * ones she tore out as stubs until someone of the family finds them. Her young, fast hand for the
 * pages from down there, her careful old one for those written at home: each page as painted in her
 * hand (public/diary, tools/lore/diaryPages.ts), its text under it. J or Escape closes it.
 */
import { COVER, PAGES, pageId, theBook } from '../lore/diary';
import { Modal, esc, keycap } from './panel';

const STYLE = `
  #diary { width: min(740px, calc(100vw - 32px)); }
  #diary > .ui-scroll { padding: 20px 28px 14px; }
  #diary .count { margin-bottom: 10px; }
  #diary .cover { font-style: italic; color: var(--ui-paper-dim); margin-bottom: 14px; }
  #diary .page { margin: 14px 0; }
  #diary .date { font: 400 17px var(--ui-font-display); color: var(--ui-paper-dim); margin-bottom: 4px; }
  #diary .young { font-style: italic; color: #24304a; }
  #diary img { display: block; width: 100%; margin: 4px 0 8px; border-radius: 1px; box-shadow: 0 2px 8px #4a3a2055; }
  #diary .page img + div { font-size: 13px; }
  #diary .stub { color: #a8987c; font-size: 14px; border-left: 3px solid var(--ui-paper-line); padding-left: 10px; }`;

export class DiaryView extends Modal {
  constructor(host: HTMLElement) {
    super(host, 'diary', STYLE);
  }

  /** Open the book, with the torn-out pages `found` back in it. */
  show(found: (depth: number) => boolean): void {
    const torn = PAGES.filter((p) => p.depth !== null), back = torn.filter((p) => found(p.depth!)).length;
    let html = `<h2 class="ui-title">Grandma's diary</h2><div class="count ui-label">${back} of ${torn.length} torn-out pages back in the book</div><div class="cover">${esc(COVER)}</div>`;
    for (const { page, text } of theBook(found)) {
      html += text === null
        ? `<div class="page stub">${esc(page.date)}: torn out</div>`
        : `<div class="page"><div class="date">${esc(page.date)}</div><img src="${import.meta.env.BASE_URL}diary/${pageId(page)}.webp" alt="${esc(text).replace(/"/g, '&quot;')}" loading="lazy"><div class="${page.depth === null ? 'old' : 'young'}">${esc(text)}</div></div>`;
    }
    this.showHtml(`${html}<div class="ui-keys">${keycap('J')} or ${keycap('Esc')} close</div>`);
  }
}
