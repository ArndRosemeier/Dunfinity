/**
 * The pack open (I): what the grandchild wears and holds, slot by slot (src/loot/items.ts), beside
 * what they carry: finds, with what Ilse might pay, and spare items, with the room left. A line
 * chosen can be used: a find left on the floor, a spare item put on, a worn one taken off. Keys:
 * W/S choose, E use, I or Escape close; by touch a line tapped is chosen, tapped again used (`take()`). It all goes down with the grandchild; the purse and the
 * tin stay with the family.
 */
import { FINDS, type Pack } from '../loot/finds';
import { ITEMS, SLOT_NAME, itemName, packRows, rowUse, type Kit } from '../loot/items';
import { Modal, esc, keycap } from './panel';

const STYLE = `
  #pack { width: min(820px, calc(100vw - 32px)); }
  #pack > .ui-scroll { padding: 16px 20px 14px; }
  #pack .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; align-items: start; }
  @media (max-width: 680px) { #pack .cols { grid-template-columns: 1fr; } }
  #pack h2 { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  #pack .room { font: 500 15px var(--ui-font); color: var(--ui-ink-dim); }
  #pack .room.full { color: var(--ui-accent); }
  #pack .ui-label { margin: 10px 0 4px; }
  :root.ui-touch #pack .row { padding: 10px 8px; }
  #pack .row { cursor: pointer; padding: 3px 8px; display: flex; justify-content: space-between; gap: 10px; border-radius: 2px; border-left: 3px solid transparent; }
  #pack .row.sel { background: var(--ui-dark-raised); border-left-color: var(--ui-accent); }
  #pack .row > span::first-letter { text-transform: uppercase; }
  #pack .row .v { color: var(--ui-ink-dim); white-space: nowrap; font-variant-numeric: tabular-nums; text-align: right; }
  #pack .row .slot { color: var(--ui-ink-faint); min-width: 74px; }
  #pack .row.bare > span:last-child { color: var(--ui-ink-faint); }
  #pack .empty { color: var(--ui-ink-faint); font-style: italic; padding: 3px 8px; }
  #pack .said { color: var(--ui-good); min-height: 1.4em; margin-top: 8px; }
  #pack .note { color: var(--ui-ink-dim); font-size: 14px; margin-top: 4px; }`;

/** The keys as the player has them. */
export interface PackKeys {
  readonly up: string;
  readonly down: string;
  readonly use: string;
  readonly close: string;
}

export class PackView extends Modal {
  private tapped: number[] = [];

  constructor(host: HTMLElement) {
    super(host, 'pack', STYLE, 'dark');
    this.el.addEventListener('click', (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>('[data-row]');
      if (row) this.tapped.push(Number(row.dataset.row));
    });
  }

  /** The lines tapped since the last call, in order. */
  take(): number[] {
    const t = this.tapped;
    this.tapped = [];
    return t;
  }

  /** Open (or redraw) the pack with line `sel` of `packRows(pack)` chosen; `said`: what was just done. */
  show(pack: Pack, kit: Kit, sel: number, keys: PackKeys, said = ''): void {
    const rows = packRows(pack), n = pack.count;
    const line = (i: number, cls: string, inner: string) => `<div class="row${i === sel ? ' sel' : ''}${cls}" data-row="${i}">${inner}</div>`;
    let worn = '', finds = '', spare = '';
    rows.forEach((r, i) => {
      if (r.what === 'slot') {
        const it = r.slot === 'main' ? kit.hand : kit.worn[r.slot];
        worn += line(i, it ? '' : ' bare', `<span class="slot">${SLOT_NAME[r.slot]}</span><span>${it ? esc(itemName(it)) : '·'}</span>`);
      } else if (r.what === 'find') {
        const f = pack.items[r.i];
        finds += line(i, '', `<span>${esc(FINDS[f.kind].name)}</span><span class="v">€${f.value}</span>`);
      } else {
        const it = pack.spare[r.i];
        spare += line(i, '', `<span>${esc(itemName(it))}</span><span class="v">${esc(ITEMS[it.kind].what)}</span>`);
      }
    });
    const use = rows[sel] ? rowUse(rows[sel], kit) : '';
    let html = `<h2 class="ui-title">Your pack <span class="room${pack.full ? ' full' : ''}">${n} of ${pack.room}${pack.full ? ' · full' : ''}</span></h2><div class="cols">`;
    html += `<div><div class="ui-label">Worn and held</div>${worn}</div><div>`;
    html += `<div class="ui-label">Finds${pack.items.length ? ` · Ilse might give about €${pack.worth}` : ''}</div>`
      + (finds || '<div class="empty">Nothing yet. What the miners left lies about down there.</div>');
    if (spare) html += `<div class="ui-label">Spare</div>${spare}`;
    html += '</div></div>';
    html += `<div class="said">${esc(said)}</div><div class="note">All of it goes down with you. A find left on the floor lies there until you leave the level.</div>`;
    const help = [`${[keys.up, keys.down].map(keycap).join(' ')} choose`, ...(use ? [`${keycap(keys.use)} ${esc(use)}`] : []), `${keycap(keys.close)} close`];
    html += `<div class="ui-keys">${help.join(' · ')}</div>`;
    html += `<div class="ui-touch-only note">Tap a line to choose it${use ? `, tap it again: ${esc(use)}` : ''}.</div>`;
    this.showHtml(html);
  }
}
