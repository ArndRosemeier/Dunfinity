/**
 * Grandma's tin open by the fire (src/loot/recipes.ts): her cards by chapter, the deeper cards whose
 * divider will not open yet, and the chosen card in full (what you'll need, the method, the lines she added at
 * each rank, and in grey what it does). Keys: W/S choose, E cook, T or Escape close.
 */
import { SKILLS, type Practice, type Skill } from '../loot/practice';
import { CARDS, CHAPTERS, type CardId, type Cooked } from '../loot/recipes';
import type { Tin } from '../loot/tin';
import { Modal, esc, keycap } from './panel';

const STYLE = `
  #tin { width: min(940px, calc(100vw - 32px)); }
  #tin > .ui-scroll { padding: 18px 24px 14px; }
  #tin .cols { display: grid; grid-template-columns: 1fr 1.1fr; gap: 24px; align-items: start; }
  @media (max-width: 720px) { #tin .cols { grid-template-columns: 1fr; } }
  #tin h2 { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  #tin .salt { font: 500 15px var(--ui-font); color: var(--ui-paper-blue); }
  #tin .divider { margin: 12px 0 4px; padding-bottom: 2px; border-bottom: 1px solid var(--ui-paper-line); }
  #tin .row { padding: 3px 8px; display: flex; justify-content: space-between; gap: 10px; border-radius: 2px; border-left: 3px solid transparent; }
  #tin .row.sel { background: #d2c094aa; border-left-color: var(--ui-paper-ink); }
  #tin .row.shut { color: #a8987c; }
  #tin .row .cost { color: var(--ui-paper-dim); font: 14px var(--ui-font); white-space: nowrap; }
  #tin .practice { margin-top: 12px; font-size: 14px; }
  #tin .card { padding: 14px 16px; background: #f8f2e2; border: 1px solid #c9b78f; box-shadow: 2px 3px 0 #b9a58255; transform: rotate(-.3deg); }
  #tin .card b { font: 400 20px var(--ui-font-display); }
  #tin .card .need, #tin .card .method { margin: 6px 0; }
  #tin .card .rank { font-style: italic; color: #5a3e1e; margin: 3px 0; }
  #tin .card .does { color: #6f6555; font: 14px/1.45 var(--ui-font); margin-top: 8px; padding-top: 6px; border-top: 1px dashed var(--ui-paper-line); }
  #tin .card .why { color: var(--ui-paper-red); margin-top: 8px; font-weight: 700; }`;

export class TinView extends Modal {
  constructor(host: HTMLElement) {
    super(host, 'tin', STYLE);
  }

  /** The cards the tin shows, in its order (only chapters that have cards; lost cards once found). */
  static order(cooked: Cooked): CardId[] {
    return CHAPTERS.flatMap((ch) => CARDS.filter((c) => c.chapter === ch && cooked.has(c.id)).map((c) => c.id));
  }

  /** Open (or redraw) the tin with card `sel` chosen; `why`: why it could not be cooked, if that was tried. */
  show(cooked: Cooked, tin: Tin, sel: CardId, why: string | null, practice: Practice): void {
    let html = `<h2 class="ui-title">Grandma's tin <span class="salt">· ${tin.salt} ${tin.salt === 1 ? 'pinch' : 'pinches'} of infused salt</span></h2><div class="cols"><div>`;
    for (const ch of CHAPTERS) {
      const cards = CARDS.filter((c) => c.chapter === ch && cooked.has(c.id));
      if (!cards.length) continue;
      html += `<div class="divider ui-label">${esc(ch)}</div>`;
      for (const c of cards) {
        const r = cooked.rank(c.id), cost = cooked.costOf(c.id), opens = c.opens ?? 0;
        const state = tin.deepest < opens ? `opens at level ${opens}` : cost === null ? `rank ${r}, all of it` : r ? `rank ${r} · next: ${cost} pinches` : `${cost} pinches`;
        html += `<div class="row${c.id === sel ? ' sel' : ''}${tin.deepest < opens ? ' shut' : ''}"><span>${esc(c.title)}</span><span class="cost">${state}</span></div>`;
      }
    }
    const c = CARDS.find((k) => k.id === sel)!, r = cooked.rank(sel);
    html += `</div><div><div class="card"><b>${esc(c.title)}</b> <i>(${esc(c.chapter)})</i>`
      + `<div class="need"><i>You'll need:</i> ${esc(c.need)}</div><div class="method"><i>Method:</i> ${esc(c.method)}</div>`
      + c.ranks.slice(0, Math.max(0, r - 1)).map((line, k) => `<div class="rank">Rank ${k + 2}: ${esc(line)}</div>`).join('')
      + `<div class="does">${c.does.map((d, k) => `${k < r ? '✓' : '·'} rank ${k + 1}: ${esc(d)}`).join('<br>')}</div>`
      + (why ? `<div class="why">${esc(why)}</div>` : '') + '</div>';
    // What this grandchild has practised (recipe-box.md §3).
    html += `<div class="practice"><div class="ui-label">Practice</div>${(Object.keys(SKILLS) as Skill[]).map((k) => `${esc(SKILLS[k].name)} ${practice.tier(k)} <span class="cost">(${Math.floor(practice.count(k))} ${esc(SKILLS[k].counts)})</span>`).join('<br>')}</div>`;
    html += `<div class="ui-keys">${keycap('W')} ${keycap('S')} choose · ${keycap('E')} cook · ${keycap('T')} close</div></div></div>`;
    this.showHtml(html);
    this.el.querySelector('.row.sel')?.scrollIntoView({ block: 'nearest' });
  }
}
