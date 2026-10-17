/**
 * Grandma's tin open by the fire (src/loot/recipes.ts): her dividers down the left, one per chapter
 * (how many of its cards are cooked), her cards laid out as little recipe cards
 * (cooked ranks as grains of salt, what the next costs, the bar slot it is in), every chapter in one
 * scrolling sheet under its heading (a divider jumps to it), and the chosen card
 * in full on the right (what you'll need, the method, her lines at each rank, in grey what it does)
 * with a button to cook it. Any number of cards fits: a chapter's cards wrap and scroll.
 *
 * It stands above the main bar, which stays shown while the tin is open: a cooked card is dragged
 * onto a slot (or, chosen, put there with 1–8), and a card dragged off the bar into the tin goes
 * back in it. Keys: W/S choose, A/D chapter, E cook, T or Escape close; or the mouse. What the
 * mouse asks for waits in `take()` for the game to do, the same as a key.
 */
import { SKILLS, type Practice, type Skill } from '../loot/practice';
import { BAR, SLOT_KEYS, abilityOf, type MainBar } from '../game/abilities';
import { CARDS, CHAPTERS, card, type CardId, type Cooked } from '../loot/recipes';
import type { Tin } from '../loot/tin';
import { AskingModal, esc, keycap } from './panel';

/** What the mouse asked of the tin: choose a card, cook the chosen one, close it, or put a card in (or take one off) a bar slot. */
export type TinAct = { kind: 'choose'; id: CardId } | { kind: 'cook' } | { kind: 'close' } | { kind: 'slot'; i: number; id: CardId | null } | { kind: 'tap'; i: number };

/** What is dragged (src/app/abilityBar.ts reads it too): a card from the tin, or the card in a bar slot. */
export const DRAG = { card: 'card:', slot: 'slot:', type: 'text/plain' } as const;

/** Each chapter's ink, from the theme's colours in turn. */
const INKS = ['--ui-paper-blue', '--ui-paper-red', '--ui-moss', '--ui-paper-dim', '--ui-vein-glow', '--ui-stamina', '--ui-blood'] as const;

/** How far below the top of the screen the tin stands, and the room it leaves under it for the main bar, px. */
const ROOM = { top: 16, bar: 112 } as const;

const STYLE = `
  #tin.ui-modal { top: ${ROOM.top}px; transform: translate(-50%, 8px); width: min(1180px, calc(100vw - 32px)); height: calc(100vh - ${ROOM.top + ROOM.bar}px); }
  #tin.ui-modal.open { transform: translate(-50%, 0); }
  #tin > .ui-scroll { height: 100%; max-height: none; overflow: hidden; padding: 16px 20px 12px; display: flex; flex-direction: column; }
  #tin h2 { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
  #tin .salt { font: 500 15px var(--ui-font); color: var(--ui-paper-blue); }
  #tin h2 .ui-btn { margin-left: auto; }
  #tin .salt b { font: 700 18px var(--ui-font); }
  #tin .cols { flex: 1; min-height: 0; display: grid; grid-template-columns: 190px 1fr minmax(300px, 380px); gap: 18px; }
  @media (max-width: 860px) { #tin .cols { grid-template-columns: 150px 1fr; } #tin .detail { grid-column: 1 / -1; } }
  #tin .col { min-height: 0; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--ui-paper-line) transparent; }

  #tin .tabs { display: flex; flex-direction: column; gap: 3px; padding-right: 4px; }
  #tin .tab { position: relative; display: flex; justify-content: space-between; align-items: baseline; gap: 6px; padding: 6px 10px 6px 14px; cursor: pointer; user-select: none;
    font: 500 14px/1.2 var(--ui-font); color: var(--ui-paper-dim); border-radius: 0 4px 4px 0; border: 1px solid transparent; transition: background .12s, color .12s; }
  #tin .tab::before { content: ''; position: absolute; left: 0; top: 4px; bottom: 4px; width: 4px; border-radius: 2px; background: var(--ink); opacity: .55; }
  #tin .tab:hover { color: var(--ui-paper-ink); background: color-mix(in srgb, var(--ui-paper-deep) 70%, transparent); }
  #tin .tab.sel { color: var(--ui-paper-ink); background: color-mix(in srgb, var(--ui-paper) 55%, white); border-color: var(--ui-paper-line); border-left-color: transparent; box-shadow: 1px 2px 0 color-mix(in srgb, var(--ui-paper-line) 50%, transparent); }
  #tin .tab.sel::before { opacity: 1; }
  #tin .tab .n { font: 12px var(--ui-font); color: var(--ui-paper-dim); white-space: nowrap; }
  #tin .practice { margin-top: 14px; padding-top: 8px; border-top: 1px dashed var(--ui-paper-line); font: 13px/1.6 var(--ui-font); }
  #tin .practice .cost { color: var(--ui-paper-dim); }

  #tin .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; align-content: start; padding: 6px 6px 10px 2px; }
  #tin .chapter { grid-column: 1 / -1; display: flex; align-items: baseline; gap: 10px; margin: 8px 0 -2px; padding-bottom: 2px; border-bottom: 1px solid color-mix(in srgb, var(--ink) 35%, transparent); scroll-margin-top: 4px; }
  #tin .chapter:first-child { margin-top: 0; }
  #tin .chapter .ui-title { margin: 0; font-size: 20px; color: color-mix(in srgb, var(--ink) 70%, var(--ui-paper-ink)); }
  #tin .tile { position: relative; padding: 10px 10px 8px 12px; min-height: 78px; cursor: pointer; user-select: none;
    background: color-mix(in srgb, var(--ui-paper) 55%, white); border: 1px solid var(--ui-paper-line); border-top: 4px solid color-mix(in srgb, var(--ink) 75%, transparent); border-radius: 2px;
    box-shadow: 2px 3px 0 color-mix(in srgb, var(--ui-paper-line) 45%, transparent); transform: rotate(var(--tilt)); transition: transform .12s var(--ui-ease), box-shadow .12s, border-color .12s; }
  #tin .tile:hover { transform: rotate(0deg) translateY(-2px); box-shadow: 3px 5px 0 color-mix(in srgb, var(--ui-paper-line) 55%, transparent); }
  #tin .tile.sel { transform: rotate(0deg) translateY(-2px); border-color: var(--ui-vein-glow); box-shadow: 0 0 0 1px var(--ui-vein-glow), 0 0 12px color-mix(in srgb, var(--ui-vein) 55%, transparent), 3px 5px 0 color-mix(in srgb, var(--ui-paper-line) 55%, transparent); }
  #tin .tile[draggable="true"] { cursor: grab; }
  #tin .tile.dragging { opacity: .45; }
  #tin .tile .cap { float: left; font: 400 38px/0.9 var(--ui-font-display); color: var(--ink); margin: 2px 6px 0 0; }
  #tin .tile .name { font: 700 15px/1.2 var(--ui-font-paper); color: var(--ui-paper-ink); }
  #tin .tile .pips { margin-top: 4px; letter-spacing: 3px; font-size: 11px; color: var(--ui-paper-line); }
  #tin .tile .pips i { font-style: normal; color: var(--ui-vein-glow); text-shadow: 0 0 4px color-mix(in srgb, var(--ui-vein) 70%, transparent); }
  #tin .tile .state { clear: left; margin-top: 6px; font: 13px var(--ui-font); color: var(--ui-paper-dim); }
  #tin .tile .state.can { color: var(--ui-paper-blue); font-weight: 700; }
  #tin .tile .badge { position: absolute; right: 6px; top: 6px; font: 11px var(--ui-font); color: var(--ui-paper-dim); }
  #tin .tile.new { opacity: .78; }
  #tin .tile.new .name { font-weight: 400; }
  #tin .tile.shut { opacity: .5; filter: grayscale(.8); cursor: default; }

  #tin .card { padding: 14px 16px 16px; background: color-mix(in srgb, var(--ui-paper) 55%, white); border: 1px solid var(--ui-paper-line); border-top: 5px solid color-mix(in srgb, var(--ink) 75%, transparent);
    box-shadow: 2px 3px 0 color-mix(in srgb, var(--ui-paper-line) 45%, transparent); transform: rotate(-.3deg); }
  #tin .card .head { display: flex; gap: 10px; align-items: center; margin-bottom: 4px; }
  #tin .card .cap { font: 400 54px/0.85 var(--ui-font-display); color: var(--ink); }
  #tin .card b { font: 400 22px/1.1 var(--ui-font-display); display: block; }
  #tin .card .ch { font: 13px var(--ui-font); color: var(--ui-paper-dim); }
  #tin .card .need, #tin .card .method { margin: 6px 0; }
  #tin .card .rank { font-style: italic; color: color-mix(in srgb, var(--ui-paper-ink) 70%, var(--ui-paper-red)); margin: 3px 0; }
  #tin .card .does { color: var(--ui-paper-dim); font: 14px/1.45 var(--ui-font); margin-top: 8px; padding-top: 6px; border-top: 1px dashed var(--ui-paper-line); }
  #tin .card .does .got { color: var(--ui-paper-ink); }
  #tin .card .why { color: var(--ui-paper-red); margin-top: 8px; font-weight: 700; }
  #tin .cook { margin-top: 12px; width: 100%; }
  #tin .cook:disabled { opacity: .5; cursor: default; box-shadow: none; }
  #tin .hint { margin-top: 10px; font: 13px/1.6 var(--ui-font); color: var(--ui-paper-dim); }
  #tin.drop-off { outline: 2px dashed var(--ui-vein-glow); outline-offset: -6px; }`;

export class TinView extends AskingModal<TinAct> {
  constructor(host: HTMLElement) {
    super(host, 'tin', STYLE);
    const frame = this.el.parentElement!;
    // A card dragged from the tin onto a bar slot (the bar takes the drop); a slot's card dragged back in here comes off the bar.
    this.el.addEventListener('dragstart', (e) => {
      const tile = (e.target as HTMLElement).closest<HTMLElement>('[data-id][draggable="true"]');
      if (!tile || !e.dataTransfer) return;
      e.dataTransfer.setData(DRAG.type, DRAG.card + tile.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
      tile.classList.add('dragging');
    });
    this.el.addEventListener('dragend', (e) => (e.target as HTMLElement).classList?.remove('dragging'));
    frame.addEventListener('dragover', (e) => {
      if (!TinView.dragging) return;
      e.preventDefault();
      frame.classList.add('drop-off');
    });
    frame.addEventListener('dragleave', (e) => { if (!frame.contains(e.relatedTarget as Node)) frame.classList.remove('drop-off'); });
    frame.addEventListener('drop', (e) => {
      frame.classList.remove('drop-off');
      const d = e.dataTransfer?.getData(DRAG.type) ?? '';
      if (!d.startsWith(DRAG.slot)) return;
      e.preventDefault();
      this.push({ kind: 'slot', i: Number(d.slice(DRAG.slot.length)), id: null });
    });
  }

  /** A slot's card being dragged off the bar (set by the bar while it drags one): the tin takes it back. */
  static dragging = false;

  private cooked: Cooked | null = null;
  /** The chapter last shown (the cards scroll to a chapter's heading when it changes). */
  private chapter = '';

  /** What the mouse asked for since the last call (oldest first); the bar's drops come in here too (`ask`). */
  protected read(t: HTMLElement): TinAct | null {
    const tile = t.closest<HTMLElement>('[data-id]'), tab = t.closest<HTMLElement>('[data-ch]'), act = t.closest<HTMLElement>('[data-act]');
    if (act) (act as HTMLButtonElement).blur();
    if (act?.dataset.act === 'cook') return (act as HTMLButtonElement).disabled ? null : { kind: 'cook' };
    if (act?.dataset.act === 'close') return { kind: 'close' };
    if (tile) return { kind: 'choose', id: tile.dataset.id as CardId };
    const first = tab ? TinView.chapterCards(tab.dataset.ch!, this.cooked)[0] : undefined;
    return first ? { kind: 'choose', id: first } : null;
  }

  /** Something asked of the tin from outside it (a card dropped on a bar slot). */
  ask(a: TinAct): void {
    this.push(a);
  }

  /** The cards the tin shows, in its order (only chapters that have cards; lost cards once found). */
  static order(cooked: Cooked): CardId[] {
    return CHAPTERS.flatMap((ch) => TinView.chapterCards(ch, cooked));
  }

  /** The cards chapter `ch` shows. */
  static chapterCards(ch: string, cooked: Cooked | null): CardId[] {
    return CARDS.filter((c) => c.chapter === ch && (!cooked || cooked.has(c.id))).map((c) => c.id);
  }

  /** The chapter `step` dividers on from the one `sel` is in (only chapters with cards), and its first card. */
  static chapterStep(cooked: Cooked, sel: CardId, step: number): CardId {
    const chs = CHAPTERS.filter((ch) => TinView.chapterCards(ch, cooked).length), at = chs.indexOf(card(sel).chapter);
    return TinView.chapterCards(chs[(at + step + chs.length) % chs.length], cooked)[0];
  }

  /** Open (or redraw) the tin with card `sel` chosen; `why`: why it could not be cooked, if that was tried. */
  show(cooked: Cooked, tin: Tin, sel: CardId, why: string | null, practice: Practice, bar: MainBar, keyName: (key: string) => string): void {
    this.cooked = cooked;
    const c = card(sel), r = cooked.rank(sel), shown = CHAPTERS.filter((ch) => TinView.chapterCards(ch, cooked).length);
    const ink = (ch: string): string => `--ink: var(${INKS[CHAPTERS.indexOf(ch) % INKS.length]})`;
    let html = `<h2 class="ui-title">Grandma's tin <span class="salt"><b>${tin.salt}</b> ${tin.salt === 1 ? 'pinch' : 'pinches'} of infused salt</span><button class="ui-btn small" data-act="close">Close ${keycap(keyName('KeyT'))}</button></h2><div class="cols">`;
    // The dividers, and what this grandchild has practised (recipe-box.md §3).
    html += '<div class="col"><div class="tabs">';
    for (const ch of shown) {
      const ids = TinView.chapterCards(ch, cooked), got = ids.filter((id) => cooked.rank(id) > 0).length;
      html += `<div class="tab${ch === c.chapter ? ' sel' : ''}" data-ch="${esc(ch)}" style="${ink(ch)}"><span>${esc(ch)}</span><span class="n">${got}/${ids.length}</span></div>`;
    }
    html += `</div><div class="practice"><div class="ui-label">Practice</div>${(Object.keys(SKILLS) as Skill[]).map((k) => `${esc(SKILLS[k].name)} ${practice.tier(k)} <span class="cost">(${Math.floor(practice.count(k))} ${esc(SKILLS[k].counts)})</span>`).join('<br>')}</div></div>`;
    // Every chapter's cards, under its heading (the dividers jump to one).
    html += '<div class="col"><div class="grid">';
    for (const ch of shown) {
      html += `<div class="chapter" data-for="${esc(ch)}" style="${ink(ch)}"><span class="ui-title">${esc(ch)}</span></div>`;
      TinView.chapterCards(ch, cooked).forEach((id, k) => {
        const t = card(id), rank = cooked.rank(id), cost = cooked.costOf(id), opens = t.opens ?? 0, shut = tin.deepest < opens, slot = bar.slotOf(id);
        const state = shut ? `opens at level ${opens}` : cost === null ? 'all of it' : `${rank ? 'next' : 'cook'}: ${cost} ${cost === 1 ? 'pinch' : 'pinches'}`;
        const can = !shut && cost !== null && cost <= tin.salt;
        const badge = rank === 0 ? '' : slot >= 0 ? keycap(keyName(SLOT_KEYS[slot])) : abilityOf(id) ? 'not on bar' : 'always on';
        const drag = rank > 0 && abilityOf(id) ? ' draggable="true"' : '';
        const tilt = ((k * 37 + ch.length) % 7 - 3) * 0.25;
        html += `<div class="tile${id === sel ? ' sel' : ''}${rank === 0 ? ' new' : ''}${shut ? ' shut' : ''}" data-id="${id}"${drag} style="${ink(ch)}; --tilt: ${tilt}deg" title="${esc(t.title)}${drag ? ': drag it onto your bar' : ''}">`
          + `<div class="badge">${badge}</div><div class="cap">${esc(t.title[0])}</div><div class="name">${esc(t.title)}</div>`
          + `<div class="pips">${t.cost.map((_, i) => (i < rank ? '<i>◆</i>' : '◇')).join('')}</div><div class="state${can ? ' can' : ''}">${state}</div></div>`;
      });
    }
    html += '</div></div>';
    // The chosen card in full, and cooking it.
    const cost = cooked.costOf(sel), cant = cooked.cantCook(sel, tin, tin.deepest);
    html += `<div class="col detail"><div class="card" style="${ink(c.chapter)}"><div class="head"><span class="cap">${esc(c.title[0])}</span><span><b>${esc(c.title)}</b><span class="ch">${esc(c.chapter)}${r ? ` · rank ${r} of ${c.cost.length}` : ''}</span></span></div>`
      + `<div class="need"><i>You'll need:</i> ${esc(c.need)}</div><div class="method"><i>Method:</i> ${esc(c.method)}</div>`
      + c.ranks.slice(0, Math.max(0, r - 1)).map((line, k) => `<div class="rank">Rank ${k + 2}: ${esc(line)}</div>`).join('')
      + `<div class="does">${c.does.map((d, k) => `<span class="${k < r ? 'got' : ''}">${k < r ? '✓' : '·'} rank ${k + 1}: ${esc(d)}</span>`).join('<br>')}</div>`
      + (why ? `<div class="why">${esc(why)}</div>` : '') + '</div>';
    if (cost !== null) html += `<button class="ui-btn primary cook" data-act="cook"${cant ? ` disabled title="${esc(cant)}"` : ''}>${r ? `Cook rank ${r + 1}` : 'Cook it'} · ${cost} ${cost === 1 ? 'pinch' : 'pinches'} ${keycap(keyName('KeyE'))}</button>`;
    // Where the chosen card stands on the main bar (src/game/abilities.ts).
    const slot = bar.slotOf(sel), slots = `${keycap(keyName(SLOT_KEYS[0]))}–${keycap(keyName(SLOT_KEYS[BAR - 1]))}`;
    if (r > 0 && abilityOf(sel)) html += `<div class="hint">${slot >= 0 ? `On your bar: ${keycap(keyName(SLOT_KEYS[slot]))}. ` : 'Not on your bar. '}<span class="ui-keys-only">Drag it onto a slot below, or press ${slots}. Drag a slot's card up here to take it off.</span><span class="ui-touch-only">Tap a slot below to put it there; tap it there again to take it off.</span></div>`;
    else if (r > 0) html += '<div class="hint">Works by itself: no slot needed.</div>';
    html += `<div class="hint ui-keys-only">${keycap(keyName('KeyW'))} ${keycap(keyName('KeyS'))} choose · ${keycap(keyName('KeyA'))} ${keycap(keyName('KeyD'))} chapter · ${keycap(keyName('KeyT'))} close</div></div></div>`;
    this.showHtml(html);
    if (c.chapter !== this.chapter) this.el.querySelector(`.chapter[data-for="${esc(c.chapter)}"]`)?.scrollIntoView({ block: 'start' });
    this.chapter = c.chapter;
    this.el.querySelector('.tile.sel')?.scrollIntoView({ block: 'nearest' });
  }
}
