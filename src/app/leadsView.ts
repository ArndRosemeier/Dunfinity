/**
 * The level's leads on screen (src/game/leads.ts): a small paper card under the meters, "Chalked by
 * the ladder", each place with which way it lies from where one looks now. A place come to is struck
 * through; when all are, the card fades. Hidden while there are none, in another world, or with
 * the map open.
 */
import { child, esc, panel } from './panel';
import type { Lead } from '../game/leads';

const STYLE = `
  #leads { position: fixed; left: 16px; top: 96px; z-index: 6; width: min(300px, calc(100vw - 28px)); pointer-events: none; box-sizing: border-box;
    padding: 8px 12px 9px; font: 14px/1.35 var(--ui-font-paper); box-shadow: var(--ui-shadow);
    transform: rotate(-0.5deg); opacity: 0; transition: opacity 0.8s var(--ui-ease); display: none; }
  #leads.open { display: block; }
  #leads.shown { opacity: 1; }
  #leads .ui-label { margin: 0 0 4px; }
  #leads .lead { padding: 2px 0; }
  #leads .lead .way { display: block; color: var(--ui-paper-dim); font-style: italic; font-size: 13px; }
  #leads .lead.found { color: var(--ui-paper-dim); text-decoration: line-through; text-decoration-color: var(--ui-paper-ink); }`;

/** One line of the card: the lead, which way it lies (words), whether it is found. */
export interface LeadLine {
  readonly lead: Lead;
  readonly way: string;
  readonly found: boolean;
}

export class LeadsView {
  private readonly el: HTMLDivElement;
  private readonly body: HTMLDivElement;
  private drawn = '';

  constructor(host: HTMLElement) {
    this.el = panel(host, 'div', 'leads', STYLE);
    this.el.className = 'ui-paper';
    child(this.el, 'div', 'ui-label', 'Chalked by the ladder');
    this.body = child(this.el, 'div');
  }

  /** Show `lines` (empty: hide). Redraws only on change. */
  chalk(lines: readonly LeadLine[]): void {
    const open = lines.length > 0 && !lines.every((l) => l.found);
    const key = open ? lines.map((l) => `${l.lead.id}|${l.way}|${l.found}`).join(';') : '';
    if (key === this.drawn) return;
    this.drawn = key;
    if (!open) { this.el.classList.remove('shown'); setTimeout(() => { if (!this.drawn) this.el.classList.remove('open'); }, 800); return; }
    this.body.innerHTML = lines.map((l) => `<div class="lead${l.found ? ' found' : ''}">${esc(l.lead.what)}${l.found ? '' : ` <span class="way">${esc(l.way)}</span>`}</div>`).join('');
    if (!this.el.classList.contains('open')) { this.el.classList.add('open'); requestAnimationFrame(() => this.el.classList.add('shown')); }
  }
}
