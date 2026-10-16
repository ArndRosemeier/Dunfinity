/**
 * Grandma's diary open (docs/design/grandmas-diary.md): the pages in the book in date order, the
 * ones she tore out as stubs until someone of the family finds them. Her young, fast hand for the
 * pages from down there, her careful old one for those written at home: each page as painted in her
 * hand (public/diary, tools/lore/diaryPages.ts), its text under it. J or Escape closes it.
 */
import { COVER, PAGES, pageId, theBook } from '../lore/diary';
import { esc, panel } from './panel';

const STYLE = `
  #diary { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 9; width: min(720px, calc(100vw - 32px)); max-height: calc(100vh - 64px); overflow-y: auto;
    background: #ece3cbf2; color: #2b2116; border: 1px solid #8a7656; border-radius: 4px; padding: 14px 22px; font: 15px/1.5 Georgia, serif; display: none; box-shadow: 0 6px 30px #000a; }
  #diary.open { display: block; }
  #diary h2 { font-size: 17px; margin: 0 0 4px; }
  #diary .count { font: 12px system-ui, sans-serif; color: #6d5a3d; margin-bottom: 8px; }
  #diary .cover { font-style: italic; color: #5a4a35; margin-bottom: 12px; }
  #diary .page { margin: 10px 0; }
  #diary .date { font-size: 13px; color: #6d5a3d; }
  #diary .young { font-style: italic; color: #24304a; }
  #diary img { display: block; width: 100%; margin: 4px 0; border-radius: 2px; }
  #diary .page img + div { font-size: 12px; }
  #diary .stub { color: #a8987c; font-size: 13px; border-left: 3px solid #c9b78f; padding-left: 8px; }
  #diary .keys { margin-top: 10px; font: 12px system-ui, sans-serif; color: #6d5a3d; }`;

export class DiaryView {
  private readonly el: HTMLDivElement;

  constructor(host: HTMLElement) {
    this.el = panel(host, 'div', 'diary', STYLE);
  }

  get open(): boolean {
    return this.el.classList.contains('open');
  }

  /** Open the book, with the torn-out pages `found` back in it. */
  show(found: (depth: number) => boolean): void {
    const torn = PAGES.filter((p) => p.depth !== null), back = torn.filter((p) => found(p.depth!)).length;
    let html = `<h2>Grandma's diary</h2><div class="count">${back} of ${torn.length} torn-out pages back in the book</div><div class="cover">${esc(COVER)}</div>`;
    for (const { page, text } of theBook(found)) {
      html += text === null
        ? `<div class="page stub">${esc(page.date)}: torn out</div>`
        : `<div class="page"><div class="date">${esc(page.date)}</div><img src="${import.meta.env.BASE_URL}diary/${pageId(page)}.webp" alt="${esc(text).replace(/"/g, '&quot;')}" loading="lazy"><div class="${page.depth === null ? 'old' : 'young'}">${esc(text)}</div></div>`;
    }
    this.el.innerHTML = `${html}<div class="keys">J or Escape: close</div>`;
    this.el.classList.add('open');
  }

  hide(): void {
    this.el.classList.remove('open');
  }
}
