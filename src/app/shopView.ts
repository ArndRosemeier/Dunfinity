/**
 * A merchant's counter open (E at it): what they sell, with its price and what it does, beside what
 * of the pack they would buy and for how much; grandma's purse over it all. Any merchant (src/loot/shop.ts):
 * Kemal and Ilse in the town, whoever sets up shop below one day. Keys: W/S choose, E buy or sell
 * the line chosen, Escape close; by mouse or touch a line clicked is chosen, its button does it.
 */
import { FINDS, type Pack } from '../loot/finds';
import { GEAR } from '../loot/hardware';
import { itemName, type Kit } from '../loot/items';
import { rowPrice, shopRows, type Merchant } from '../loot/shop';
import { AskingModal, esc, keycap } from './panel';

const STYLE = `
  #shop { width: min(860px, calc(100vw - 32px)); }
  #shop > .ui-scroll { padding: 16px 20px 14px; }
  #shop h2 { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  #shop .purse { font: 500 15px var(--ui-font); color: var(--ui-ink-dim); }
  #shop .purse b { font: 700 18px var(--ui-font); color: var(--ui-accent); }
  #shop .greet { color: var(--ui-ink-dim); font-style: italic; margin: 0 0 6px; }
  #shop .cols { display: grid; grid-template-columns: 1.25fr 1fr; gap: 22px; align-items: start; }
  @media (max-width: 700px) { #shop .cols { grid-template-columns: 1fr; } }
  #shop .ui-label { margin: 10px 0 4px; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  #shop .row { cursor: pointer; padding: 4px 8px; display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; align-items: center; border-radius: 2px; border-left: 3px solid transparent; }
  :root.ui-touch #shop .row { padding: 9px 8px; }
  #shop .row.sel { background: var(--ui-dark-raised); border-left-color: var(--ui-accent); }
  #shop .row .n::first-letter { text-transform: uppercase; }
  #shop .row .w { grid-column: 1; color: var(--ui-ink-faint); font-size: 12.5px; }
  #shop .row .ui-btn { grid-row: 1 / span 2; grid-column: 2; min-width: 86px; font-variant-numeric: tabular-nums; }
  #shop .row.no .ui-btn { opacity: .45; }
  #shop .row.yours .n { color: var(--ui-ink-dim); }
  #shop .empty { color: var(--ui-ink-faint); font-style: italic; padding: 3px 8px; }
  #shop .said { color: var(--ui-good); min-height: 1.4em; margin-top: 10px; white-space: pre-line; }
  #shop .leave { margin-top: 10px; }`;

/** The keys as the player has them. */
export interface ShopKeys {
  readonly up: string;
  readonly down: string;
  readonly use: string;
  readonly close: string;
}

/** What was clicked: a line chosen (or done, by its button), every find sold, or the counter left. */
export type ShopClick = { readonly row: number; readonly act: boolean } | { readonly all: true } | { readonly close: true };

export class ShopView extends AskingModal<ShopClick> {
  constructor(host: HTMLElement) {
    super(host, 'shop', STYLE, 'dark');
  }

  protected read(t: HTMLElement): ShopClick | null {
    if (t.closest('[data-all]')) return { all: true };
    if (t.closest('[data-close]')) return { close: true };
    const row = t.closest<HTMLElement>('[data-row]');
    return row ? { row: Number(row.dataset.row), act: !!t.closest('button') } : null;
  }

  /** Open (or redraw) `m`'s counter with line `sel` of `shopRows(m, pack)` chosen; `greet`: what they said as one stepped up; `said`: what was just done. */
  show(m: Merchant, pack: Pack, kit: Kit, euros: number, sel: number, keys: ShopKeys, greet: string, said = ''): void {
    const rows = shopRows(m, pack);
    let goods = '', finds = '', spare = '';
    rows.forEach((r, i) => {
      const p = rowPrice(r, kit, pack, euros);
      const cls = `row${i === sel ? ' sel' : ''}${p.yours ? ' yours' : !p.can ? ' no' : ''}`;
      if (r.what === 'buy') {
        const g = GEAR[r.kind];
        goods += `<div class="${cls}" data-row="${i}"><span class="n">${esc(g.name)}</span><button class="ui-btn small${p.can ? ' primary' : ''}">${p.yours ? 'Yours' : `Buy €${p.price}`}</button><span class="w">${esc(g.what)}</span></div>`;
      } else {
        const name = r.what === 'find' ? FINDS[pack.items[r.i].kind].name : itemName(pack.spare[r.i]);
        const line = `<div class="${cls}" data-row="${i}"><span class="n">${esc(name)}</span><button class="ui-btn small">Sell €${p.price}</button><span class="w">${r.what === 'find' ? 'a find' : 'spare, from your pack'}</span></div>`;
        if (r.what === 'find') finds += line; else spare += line;
      }
    });
    let html = `<h2 class="ui-title">${esc(m.title)} <span class="purse">Grandma's purse <b>€${euros}</b></span></h2>`;
    if (greet) html += `<div class="greet">${esc(greet)}</div>`;
    html += `<div class="cols"><div><div class="ui-label">For sale</div>${goods || '<div class="empty">The shelves are bare today.</div>'}</div><div>`;
    if (m.buys !== true) html += `<div class="ui-label">${esc(m.who)} buys</div><div class="empty">${esc(m.buys)}</div>`;
    else {
      const all = pack.items.length > 1 ? `<button class="ui-btn small" data-all>Sell all finds €${pack.worth}</button>` : '';
      html += `<div class="ui-label"><span>Sell to ${esc(m.who)}</span>${all}</div>`;
      html += finds || spare ? finds + spare : `<div class="empty">Nothing in your pack ${esc(m.who)} would take. Old things from below fetch the most.</div>`;
    }
    html += `</div></div><div class="said">${esc(said)}</div>`;
    const sold = rows[sel]?.what === 'buy' ? 'buy' : 'sell';
    html += `<div class="ui-keys">${[keys.up, keys.down].map(keycap).join(' ')} choose · ${keycap(keys.use)} ${rows.length ? sold : ''} · ${keycap(keys.close)} leave the counter</div>`;
    html += `<div class="ui-touch-only leave"><button class="ui-btn" data-close>Leave the counter</button></div>`;
    this.showHtml(html);
  }
}
