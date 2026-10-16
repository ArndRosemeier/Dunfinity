/**
 * The main bar (src/game/abilities.ts): along the bottom of the screen, its eight slots, each with its
 * key (1–8 unless moved), the card in it and how soon it can be used again; the cards that take no
 * slot listed under it. A click on a slot uses it (with the mouse free: Escape).
 *
 * While grandma's tin is open (src/app/tinView.ts) the bar is for arranging: a card dragged from the
 * tin onto a slot goes in it, a slot's card dragged onto another slot swaps with it, and one dragged
 * up into the tin comes off the bar.
 */
import { SLOT_KEYS, type Ability } from '../game/abilities';
import { DRAG, TinView } from './tinView';
import { card, type CardId } from '../loot/recipes';
import { growOn } from './growth';
import { child, panel } from './panel';

const STYLE = `
  #bar { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 5; display: flex; flex-direction: column; align-items: center; gap: 5px; color: var(--ui-ink); pointer-events: none; }
  #bar .slots { position: relative; display: flex; gap: 5px; padding: 5px; background: #0b0907b0; border: 1px solid var(--ui-line); border-radius: 6px; box-shadow: 0 4px 18px #0009, inset 0 1px 0 #ffffff0d; }
  #bar .slot { position: relative; width: 66px; height: 54px; background: linear-gradient(180deg, #2a231a, #16120d); border: 1px solid var(--ui-line-bright); border-radius: 4px; overflow: hidden; cursor: pointer; pointer-events: auto; user-select: none;
    box-shadow: inset 0 1px 0 #ffffff14, inset 0 -8px 14px #0006; transition: border-color .12s, box-shadow .12s, transform .08s; }
  #bar.editing .slot { cursor: grab; }
  #bar.editing .slot.empty { cursor: default; }
  #bar .slot.over { border-color: var(--ui-vein); border-style: solid; box-shadow: 0 0 0 1px var(--ui-vein-glow), 0 0 14px var(--ui-vein-glow); }
  #bar .slot.empty { cursor: default; background: #16120d80; border-style: dashed; border-color: var(--ui-line); box-shadow: none; }
  #bar .slot:hover { border-color: var(--ui-accent); }
  #bar .slot:active { transform: translateY(1px); }
  #bar .slot .wait { position: absolute; left: 0; right: 0; top: 0; background: linear-gradient(180deg, #000c, #000a); }
  #bar .slot .n { position: absolute; left: 3px; top: 3px; font: 700 10px/14px var(--ui-font); min-width: 14px; text-align: center; color: var(--ui-ink); background: #0008; border: 1px solid var(--ui-line); border-radius: 3px; }
  #bar .slot .k { position: absolute; right: 4px; top: 3px; color: var(--ui-ink-faint); font: 500 11px var(--ui-font); }
  #bar .slot .t { position: absolute; left: 2px; right: 2px; bottom: 4px; text-align: center; font: 500 12px/1.1 var(--ui-font); text-shadow: 0 1px 2px #000; }
  #bar .slot .c { position: absolute; left: 0; right: 0; top: 18px; text-align: center; color: var(--ui-salt); font: 700 11px var(--ui-font); }
  #bar .slot.on { border-color: var(--ui-accent); box-shadow: var(--ui-glow), inset 0 0 14px #e9b85c44; }
  #bar .slot.on .t { color: #fff3d6; }
  #bar .slot.dim .t { color: var(--ui-ink-faint); }
  #bar .passive { font: 13px var(--ui-font); color: var(--ui-ink-dim); text-shadow: var(--ui-text-shadow); }
  #bar .passive b { font-weight: 500; color: var(--ui-accent); letter-spacing: .08em; text-transform: uppercase; font-size: 11px; margin-right: 4px; }`;

/** How a slot stands this frame: how far it is to ready (1: ready), whether it is on, whether it can't be used now, and a count. */
export interface SlotState {
  ready: number;
  on: boolean;
  dim: boolean;
  count?: string;
}

export class AbilityBar {
  private readonly el: HTMLDivElement;
  /** The row of slots (salt grows on it) and the line of cards that are always on. */
  private readonly row: HTMLDivElement;
  private readonly passive: HTMLDivElement;
  private shown = '';
  private slots: { root: HTMLDivElement; wait: HTMLDivElement; c: HTMLDivElement }[] = [];

  /** Whether the bar is being arranged (grandma's tin is open), and the cards in its slots as shown. */
  private editing = false;
  private cards: (CardId | null)[] = [];

  /** `use(i)`: slot i was clicked; `place(i, id)`: card `id` was dropped on slot i while arranging; `tapped(i)`: slot i was tapped while arranging; `keyName`: what a slot's key is called now (the player may have moved it). */
  constructor(host: HTMLElement, private readonly use: (i: number) => void, private readonly place: (i: number, id: CardId) => void, private readonly tapped: (i: number) => void, private readonly keyName: (key: string) => string) {
    this.el = panel(host, 'div', 'bar', STYLE);
    this.row = child(this.el, 'div', 'slots ui-grown');
    growOn(this.row, 'bar', { amount: 0.7, moss: false });
    this.passive = child(this.el, 'div', 'passive');
  }

  /** Show the bar's slots `bar` (null: empty; their states in `states`) and the passives; hidden while `hide`, or while there is nothing to show; `editing`: being arranged (shown even empty). */
  paint(bar: readonly (Ability | null)[], states: readonly (SlotState | null)[], passives: readonly CardId[], hide: boolean, editing = false): void {
    this.editing = editing;
    this.el.classList.toggle('editing', editing);
    this.cards = bar.map((a) => a?.card ?? null);
    const any = bar.some(Boolean) || editing;
    this.el.style.display = hide || (!any && !passives.length) ? 'none' : 'flex';
    const key = bar.map((a, i) => `${a?.card ?? ''}:${this.keyName(SLOT_KEYS[i])}`).join() + '|' + passives.join();
    if (key !== this.shown) {
      this.shown = key;
      this.row.querySelectorAll('.slot').forEach((s) => s.remove());
      const row = this.row;
      this.row.style.display = any ? 'flex' : 'none';
      this.slots = bar.map((a, i) => {
        const root = child(row, 'div', a ? 'slot' : 'slot empty'), wait = child(root, 'div', 'wait');
        const label = this.keyName(SLOT_KEYS[i]);
        root.title = a ? `${card(a.card).title}: ${a.hold ? 'hold' : 'press'} ${label}${a.hold ? ' (a click holds it until the next)' : ''}` : `Slot ${label}: empty (put a card here at the fire, in grandma's tin)`;
        child(root, 'div', 'n', label);
        const c = child(root, 'div', 'c');
        child(root, 'div', 't', a?.short ?? '');
        if (a) root.addEventListener('pointerdown', (e) => { if (this.editing) return; e.stopPropagation(); e.preventDefault(); this.use(i); });
        this.droppable(root, i, !!a);
        root.addEventListener('click', () => { if (this.editing) this.tapped(i); });
        return { root, wait, c };
      });
      this.passive.textContent = '';
      if (passives.length) {
        child(this.passive, 'b', '', 'Always on');
        this.passive.append(passives.map((id) => card(id).title).join(' · '));
      }
    }
    states.forEach((s, i) => {
      const slot = this.slots[i];
      if (!slot || !s) return;
      slot.wait.style.height = `${Math.round((1 - Math.max(0, Math.min(1, s.ready))) * 100)}%`;
      slot.root.classList.toggle('on', s.on);
      slot.root.classList.toggle('dim', s.dim);
      slot.c.textContent = s.count ?? '';
    });
  }

  /** Slot `root` (number i, holding a card if `full`) as a place to drop a card on, and to drag its card from, while arranging. */
  private droppable(root: HTMLDivElement, i: number, full: boolean): void {
    root.draggable = full;
    root.addEventListener('dragstart', (e) => {
      if (!this.editing || !e.dataTransfer) { e.preventDefault(); return; }
      e.dataTransfer.setData(DRAG.type, DRAG.slot + i);
      e.dataTransfer.effectAllowed = 'move';
      TinView.dragging = true;
    });
    root.addEventListener('dragend', () => { TinView.dragging = false; });
    root.addEventListener('dragover', (e) => { if (!this.editing) return; e.preventDefault(); root.classList.add('over'); });
    root.addEventListener('dragleave', () => root.classList.remove('over'));
    root.addEventListener('drop', (e) => {
      root.classList.remove('over');
      TinView.dragging = false;
      if (!this.editing) return;
      e.preventDefault();
      e.stopPropagation();
      const d = e.dataTransfer?.getData(DRAG.type) ?? '';
      const id = d.startsWith(DRAG.card) ? (d.slice(DRAG.card.length) as CardId) : d.startsWith(DRAG.slot) ? this.cards[Number(d.slice(DRAG.slot.length))] : null;
      if (id) this.place(i, id);
    });
  }
}
