/**
 * The pack open (I): the finds the grandchild carries, what Ilse might pay for each and for all of
 * them, how much room is left, and what they carry besides (the kitchen knife, Kemal's gear). A
 * find chosen can be left on the floor to make room. Keys: W/S choose, E leave it here, I or Escape
 * close. It all goes down with the grandchild; the purse and the tin stay with the family.
 */
import { GEAR, GEAR_ORDER, type Gear } from '../loot/hardware';
import { FINDS, PACK, type Pack } from '../loot/finds';
import { Modal, esc, keycap } from './panel';

const STYLE = `
  #pack { width: min(520px, calc(100vw - 32px)); }
  #pack > .ui-scroll { padding: 16px 20px 14px; }
  #pack h2 { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  #pack .room { font: 500 15px var(--ui-font); color: var(--ui-ink-dim); }
  #pack .room.full { color: var(--ui-accent); }
  #pack .ui-label { margin: 12px 0 4px; }
  #pack .row { padding: 3px 8px; display: flex; justify-content: space-between; gap: 10px; border-radius: 2px; border-left: 3px solid transparent; }
  #pack .row.sel { background: var(--ui-dark-raised); border-left-color: var(--ui-accent); }
  #pack .row > span:first-child::first-letter { text-transform: uppercase; }
  #pack .row .v { color: var(--ui-ink-dim); white-space: nowrap; font-variant-numeric: tabular-nums; }
  #pack .empty { color: var(--ui-ink-faint); font-style: italic; padding: 3px 8px; }
  #pack .note { color: var(--ui-ink-dim); font-size: 14px; margin-top: 10px; }`;

/** The keys as the player has them. */
export interface PackKeys {
  readonly up: string;
  readonly down: string;
  readonly leave: string;
  readonly close: string;
}

export class PackView extends Modal {
  constructor(host: HTMLElement) {
    super(host, 'pack', STYLE, 'dark');
  }

  /** Open (or redraw) the pack with find `sel` chosen; `said`: a line under it (what was just left). */
  show(pack: Pack, gear: Gear, sel: number, keys: PackKeys, said = ''): void {
    const n = pack.items.length;
    let html = `<h2 class="ui-title">Your pack <span class="room${pack.full ? ' full' : ''}">${n} of ${PACK.room} finds${pack.full ? ' · full' : ''}</span></h2>`;
    html += `<div class="ui-label">Finds${n ? ` · Ilse might give about €${pack.worth}` : ''}</div>`;
    html += n ? pack.items.map((f, i) => `<div class="row${i === sel ? ' sel' : ''}"><span>${esc(FINDS[f.kind].name)}</span><span class="v">€${f.value}</span></div>`).join('')
      : '<div class="empty">Nothing yet. What the miners left lies about down there.</div>';
    html += '<div class="ui-label">Carried</div>'
      + `<div class="row"><span>Grandma's kitchen knife</span><span class="v">${gear.owned.has('whetstone') ? 'honed' : ''}</span></div>`
      + GEAR_ORDER.filter((k) => gear.owned.has(k)).map((k) => `<div class="row"><span>${esc(GEAR[k].name)}</span><span class="v">${esc(GEAR[k].what)}</span></div>`).join('');
    html += `<div class="note">${said ? `${esc(said)} ` : ''}All of it goes down with you. A find left on the floor lies there until you leave the level.</div>`;
    const help = [...(n ? [`${[keys.up, keys.down].map(keycap).join(' ')} choose`, `${keycap(keys.leave)} leave it here`] : []), `${keycap(keys.close)} close`];
    html += `<div class="ui-keys">${help.join(' · ')}</div>`;
    this.showHtml(html);
  }
}

