/**
 * The ability bar (src/game/abilities.ts): along the bottom of the screen, a slot per cooked card that
 * is used by a key, with its number, its key, and how soon it can be used again; the cards that
 * work by themselves listed under it. A click on a slot uses it (with the mouse free: Escape).
 */
import { SLOT_LABELS, type Ability } from '../game/abilities';
import { card, type CardId } from '../loot/recipes';
import { child, panel } from './panel';

const STYLE = `
  #bar { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 5; display: flex; flex-direction: column; align-items: center; gap: 4px; font: 12px system-ui, sans-serif; color: #e8e2d4; pointer-events: none; }
  #bar .slots { display: flex; gap: 6px; }
  #bar .slot { position: relative; width: 64px; height: 52px; background: #14110ddd; border: 1px solid #6d5a3d; border-radius: 5px; overflow: hidden; cursor: pointer; pointer-events: auto; user-select: none; }
  #bar .slot .wait { position: absolute; left: 0; right: 0; top: 0; background: #000b; }
  #bar .slot .n { position: absolute; left: 4px; top: 2px; color: #b9a582; }
  #bar .slot .k { position: absolute; right: 4px; top: 2px; color: #8d8270; font-size: 11px; }
  #bar .slot .t { position: absolute; left: 0; right: 0; bottom: 4px; text-align: center; line-height: 1.1; }
  #bar .slot .c { position: absolute; left: 0; right: 0; top: 17px; text-align: center; color: #b9d6ea; font-size: 11px; }
  #bar .slot.on { border-color: #f0c860; box-shadow: 0 0 8px #f0c86088; }
  #bar .slot.dim .t { color: #7d7466; }
  #bar .passive { color: #b9a582; text-shadow: 0 1px 2px #000; }`;

/** How a slot stands this frame: how far it is to ready (1: ready), whether it is on, whether it can't be used now, and a count. */
export interface SlotState {
  ready: number;
  on: boolean;
  dim: boolean;
  count?: string;
}

export class AbilityBar {
  private readonly el: HTMLDivElement;
  private shown = '';
  private slots: { root: HTMLDivElement; wait: HTMLDivElement; c: HTMLDivElement }[] = [];

  /** `use(i)`: slot i was clicked; `keyName`: what an ability's key is called now (the player may have moved it). */
  constructor(host: HTMLElement, private readonly use: (i: number) => void, private readonly keyName: (key: string) => string) {
    this.el = panel(host, 'div', 'bar', STYLE);
  }

  /** Show `bar` (its states in `states`) and the passives; hidden while `hide`. */
  paint(bar: readonly Ability[], states: readonly SlotState[], passives: readonly CardId[], hide: boolean): void {
    this.el.style.display = hide || (!bar.length && !passives.length) ? 'none' : 'flex';
    const key = bar.map((a) => `${a.card}:${this.keyName(a.key)}`).join() + '|' + passives.join();
    if (key !== this.shown) {
      this.shown = key;
      this.el.textContent = '';
      const row = child(this.el, 'div', 'slots');
      this.slots = bar.map((a, i) => {
        const root = child(row, 'div', 'slot'), wait = child(root, 'div', 'wait');
        const label = this.keyName(a.key);
        root.title = `${card(a.card).title}: ${a.hold ? 'hold' : 'press'} ${label} or ${SLOT_LABELS[i]}${a.hold ? ' (a click holds it until the next)' : ''}`;
        child(root, 'div', 'n', SLOT_LABELS[i]);
        child(root, 'div', 'k', label);
        const c = child(root, 'div', 'c');
        child(root, 'div', 't', a.short);
        root.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); this.use(i); });
        return { root, wait, c };
      });
      if (passives.length) child(this.el, 'div', 'passive', `Always on: ${passives.map((id) => card(id).title).join(' · ')}`);
    }
    states.forEach((s, i) => {
      const slot = this.slots[i];
      if (!slot) return;
      slot.wait.style.height = `${Math.round((1 - Math.max(0, Math.min(1, s.ready))) * 100)}%`;
      slot.root.classList.toggle('on', s.on);
      slot.root.classList.toggle('dim', s.dim);
      slot.c.textContent = s.count ?? '';
    });
  }
}
