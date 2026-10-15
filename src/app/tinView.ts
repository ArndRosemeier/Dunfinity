/**
 * Grandma's tin open by the fire (src/loot/recipes.ts): her cards by chapter, the dividers that will
 * not open yet, and the chosen card in full (what you'll need, the method, the lines she added at
 * each rank, and in grey what it does). Keys: W/S choose, E cook, T or Escape close.
 */
import { CARDS, CHAPTERS, type CardId, type Cooked } from '../loot/recipes';
import type { Tin } from '../loot/tin';

const STYLE = `
  #tin { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 9; width: min(560px, calc(100vw - 32px)); max-height: calc(100vh - 64px); overflow-y: auto;
    background: #e9dfc6f2; color: #2b2116; border: 1px solid #8a7656; border-radius: 4px; padding: 14px 18px; font: 15px/1.4 Georgia, serif; display: none; box-shadow: 0 6px 30px #000a; }
  #tin.open { display: block; }
  #tin h2 { font-size: 17px; margin: 0 0 8px; }
  #tin .salt { color: #2f5d7a; }
  #tin .divider { margin: 10px 0 3px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #6d5a3d; border-bottom: 1px solid #b9a582; }
  #tin .divider.shut { color: #a8987c; }
  #tin .row { padding: 2px 6px; display: flex; justify-content: space-between; border-radius: 3px; }
  #tin .row.sel { background: #d6c59f; }
  #tin .row .cost { color: #6d5a3d; font-size: 13px; }
  #tin .card { margin-top: 12px; padding: 10px 12px; background: #f6efdc; border: 1px solid #c9b78f; }
  #tin .card .need, #tin .card .method { margin: 4px 0; }
  #tin .card .rank { font-style: italic; color: #5a3e1e; margin: 2px 0; }
  #tin .card .does { color: #7b7262; font: 12px/1.4 system-ui, sans-serif; margin-top: 6px; }
  #tin .card .why { color: #8a2a1a; margin-top: 6px; }
  #tin .keys { margin-top: 10px; font: 12px system-ui, sans-serif; color: #6d5a3d; }`;

export class TinView {
  private readonly el = document.createElement('div');

  constructor(host: HTMLElement) {
    const style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);
    this.el.id = 'tin';
    host.appendChild(this.el);
  }

  get open(): boolean {
    return this.el.classList.contains('open');
  }

  /** The cards the tin shows, in its order (only chapters that have cards). */
  static order(): CardId[] {
    return CHAPTERS.flatMap(([ch]) => CARDS.filter((c) => c.chapter === ch).map((c) => c.id));
  }

  /** Open (or redraw) the tin with card `sel` chosen; `why`: why it could not be cooked, if that was tried. */
  show(cooked: Cooked, tin: Tin, sel: CardId, why: string | null): void {
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    let html = `<h2>Grandma's tin <span class="salt">· ${tin.salt} ${tin.salt === 1 ? 'pinch' : 'pinches'} of infused salt</span></h2>`;
    for (const [ch, opens] of CHAPTERS) {
      const cards = CARDS.filter((c) => c.chapter === ch);
      const shut = tin.deepest < opens;
      if (!cards.length && !shut) continue;
      html += `<div class="divider${shut ? ' shut' : ''}">${esc(ch)}${shut ? ` · opens at level ${opens}` : ''}</div>`;
      if (shut) continue;
      for (const c of cards) {
        const r = cooked.rank(c.id), cost = cooked.costOf(c.id);
        const state = cost === null ? `rank ${r}, all of it` : r ? `rank ${r} · next: ${cost} pinches` : `${cost} pinches`;
        html += `<div class="row${c.id === sel ? ' sel' : ''}"><span>${esc(c.title)}</span><span class="cost">${state}</span></div>`;
      }
    }
    const c = CARDS.find((k) => k.id === sel)!, r = cooked.rank(sel);
    html += `<div class="card"><b>${esc(c.title)}</b> <i>(${esc(c.chapter)})</i>`
      + `<div class="need"><i>You'll need:</i> ${esc(c.need)}</div><div class="method"><i>Method:</i> ${esc(c.method)}</div>`
      + c.ranks.slice(0, Math.max(0, r - 1)).map((line, k) => `<div class="rank">Rank ${k + 2}: ${esc(line)}</div>`).join('')
      + `<div class="does">${c.does.map((d, k) => `${k < r ? '✓' : '·'} rank ${k + 1}: ${esc(d)}`).join('<br>')}</div>`
      + (why ? `<div class="why">${esc(why)}</div>` : '') + '</div>';
    html += '<div class="keys">W / S choose · E cook · T close</div>';
    this.el.innerHTML = html;
    this.el.classList.add('open');
  }

  hide(): void {
    this.el.classList.remove('open');
  }
}
