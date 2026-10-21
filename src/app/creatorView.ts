/**
 * The character creator's overlay (src/game/creator.ts plays it): beside the grandchild standing in
 * grandma's round room, a panel with Actors' character editor (body, look, today's clothes; in the
 * game's colours), a dice for a stranger, and "Go down", which wakes once the game's shaders are all
 * built. Dragging on the room turns the grandchild; the wheel (or the Face / Body buttons) looks at
 * the face or the whole body.
 *
 * The editor edits a model character of its own, never drawn (`model`); the game hears of each
 * change and shows it on the grandchild once it is compiled.
 */
import { CharacterEditor, type Character, type CharacterConfig, type CharacterPatch } from '@actors/generator';
import { addStyle, button, child } from './panel';
import { growOn } from './growth';

export type Framing = 'body' | 'face';

/** What the editor leaves out: other races' parts, anatomy, a skin's pattern, the mesh detail. */
const HIDDEN = ['anatomy', 'skinColor', 'eyeGlow', 'pupil', 'skinPattern', 'patternStrength', 'patternColor', 'horns', 'hornSize', 'hornColor', 'tusks', 'tail', 'tailLength', 'detail'];

const CSS = `
  #creator { position: fixed; inset: 0; z-index: 21; font-family: var(--ui-font); color: var(--ui-ink); }
  #creator .room { position: absolute; inset: 0; cursor: grab; touch-action: none; }
  #creator .room:active { cursor: grabbing; }
  #creator .shade { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(to left, rgba(0,0,0,0.7), rgba(0,0,0,0.25) 34%, transparent 50%); }
  #creator .bar { position: absolute; left: 24px; bottom: 22px; display: flex; gap: 8px; align-items: center; }
  #creator .bar .ui-btn.on { border-color: var(--ui-accent); color: #fff3d6; }
  #creator .hint { font: italic 13px/1.3 var(--ui-font); color: var(--ui-ink-faint); text-shadow: var(--ui-text-shadow); margin-left: 6px; }
  #creator .side { position: absolute; right: clamp(12px, 3vw, 40px); top: 50%; transform: translateY(-50%); width: min(380px, 42vw);
    height: min(720px, calc(100vh - 48px)); display: flex; flex-direction: column; }
  #creator .side > .ui-scroll { flex: 1; min-height: 0; max-height: none; padding: 4px 18px 10px; }
  #creator .head { padding: 18px 18px 6px; }
  #creator .head .ui-title { margin: 0; }
  #creator .head p { margin: 4px 0 0; font-style: italic; color: var(--ui-ink-dim); }
  #creator .foot { display: flex; align-items: center; gap: 8px; padding: 12px 18px 16px; border-top: 1px solid var(--ui-line); }
  #creator .foot .lamps { flex: 1; font: italic 13px/1.3 var(--ui-font); color: var(--ui-ink-faint); }
  #creator .foot .go { position: relative; }
  #creator .ui-btn[disabled] { color: var(--ui-ink-faint); border-color: var(--ui-line); box-shadow: none; cursor: default; }
  /* At first only the short card: who they are by the dice, and Go down; the tabs open on asking. */
  #creator .side.simple { height: auto; }
  #creator .side.simple > .ui-scroll { display: none; }
  #creator .side:not(.simple) .quick, #creator .side.simple .foot .dice { display: none; }
  #creator .quick { padding: 6px 18px 14px; display: flex; flex-direction: column; gap: 8px; }
  #creator .quick p { margin: 0 0 4px; color: var(--ui-ink-dim); font-size: 14px; }
  /* Actors' editor in the game's own colours (its CSS variables), on the panel's own background. */
  #creator .actors-editor { --ae-panel: transparent; --ae-text: var(--ui-ink); --ae-muted: var(--ui-ink-dim); --ae-accent: var(--ui-accent); --ae-border: var(--ui-line);
    font-family: var(--ui-font); padding: 0; overflow: visible; }
  #creator .actors-editor > header { display: none; }
  #creator .actors-editor select, #creator .actors-editor button, #creator .actors-editor input[type="search"] { background: rgba(0,0,0,0.35); }
  #creator .actors-editor footer { display: none; }
  #creator .black { position: absolute; inset: 0; background: #000; pointer-events: none; opacity: 1; }
  #creator.leaving { pointer-events: none; }
  /* The game's own HUD waits under it, as under the title (src/app/titleScreen.ts). */
  body:has(#creator) :is(#game-hud, #hud, #bar, #menu-button, #settings-open, #version) { visibility: hidden; }
  @media (orientation: portrait) {
    #creator .shade { background: linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0.3) 45%, transparent 60%); }
    #creator .side { top: auto; bottom: 10px; right: 10px; left: 10px; width: auto; transform: none; height: 52vh; }
    #creator .bar { top: 16px; bottom: auto; left: 12px; }
  }
`;

/** What the creator tells the game. */
export interface CreatorHooks {
  /** The look changed (the grandchild is shown in it once it is compiled). */
  changed(look: CharacterConfig): void;
  /** Turn the grandchild by `by` radians (dragged). */
  turn(by: number): void;
  /** Look at the whole body or the face. */
  frame(f: Framing): void;
  /** A stranger's look (the dice): seeded by the game. */
  someoneElse(): Promise<CharacterPatch>;
}

export class CreatorView {
  private readonly root: HTMLDivElement;
  private readonly black: HTMLDivElement;
  private readonly framing: HTMLButtonElement[] = [];
  private readonly go: HTMLButtonElement;
  private readonly lamps: HTMLDivElement;
  private readonly editor: CharacterEditor;
  private readonly unsubscribe: () => void;
  /** The look made, once "Go down" is pressed. */
  readonly done: Promise<CharacterConfig>;

  /** `model`: the character the editor edits (not drawn). */
  constructor(host: HTMLElement, private readonly model: Character, private readonly hooks: CreatorHooks) {
    addStyle(CSS);
    this.root = child(host, 'div');
    this.root.id = 'creator';
    const room = child(this.root, 'div', 'room');
    child(this.root, 'div', 'shade');
    this.dragToTurn(room);
    const bar = child(this.root, 'div', 'bar');
    for (const [f, text] of [['body', 'Body'], ['face', 'Face']] as const) this.framing.push(button(bar, text, () => this.setFocus(f), 'ui-btn small'));
    child(bar, 'span', 'hint', 'Drag to turn · scroll to the face');

    const side = child(this.root, 'div', 'side ui-panel');
    const head = child(side, 'div', 'head');
    child(head, 'h2', 'ui-title', 'The grandchild');
    child(head, 'p', '', 'Before the notary’s letter came: who are you?');
    // At first a short card: the dice for someone else, a way into the full editor, and Go down.
    side.classList.add('simple');
    const quick = child(side, 'div', 'quick');
    child(quick, 'p', '', 'This is the grandchild the letter found. Roll the dice for someone else, or shape them yourself.');
    button(quick, '\u{1F3B2} Someone else', () => this.dice(), 'ui-btn');
    button(quick, 'Shape them yourself', () => side.classList.remove('simple'), 'ui-btn');
    const scroll = child(side, 'div', 'ui-scroll');
    this.editor = new CharacterEditor(model, scroll, {
      title: 'The grandchild', sections: ['body', 'look', 'outfit'], buttons: [], hide: HIDDEN, mode: 'simple',
      randomize: () => hooks.someoneElse(),
    });
    this.unsubscribe = model.onChange((c) => hooks.changed(c));
    const foot = child(side, 'div', 'foot');
    button(foot, '\u{1F3B2} Someone else', () => this.dice(), 'ui-btn small dice');
    this.lamps = child(foot, 'div', 'lamps', 'Lighting the lamps…');
    let resolve!: (c: CharacterConfig) => void;
    this.done = new Promise((r) => { resolve = r; });
    this.go = button(foot, 'Go down', () => { this.root.classList.add('leaving'); resolve(model.config); }, 'ui-btn primary go');
    this.go.disabled = true; // until the game's shaders are all built (src/render/stage.ts warmLater): play must not stutter
    growOn(side, 'creator', { amount: 0.7 });
    side.classList.add('ui-grown');
    this.black = child(this.root, 'div', 'black');
    this.setFocus('body');
  }

  /** A stranger by the dice. */
  private dice(): void {
    void this.hooks.someoneElse().then((p) => this.model.set(p));
  }

  /** The game is ready to play: "Go down" wakes up. */
  ready(): void {
    this.go.disabled = false;
    this.lamps.textContent = '';
  }

  /** How black the screen is, 0..1 (it fades in from black, and out to it). */
  set dark(v: number) { this.black.style.opacity = String(v); }

  close(): void {
    this.unsubscribe();
    this.editor.dispose();
    this.root.remove();
  }

  private dragToTurn(room: HTMLElement): void {
    let last: number | null = null;
    room.addEventListener('pointerdown', (e) => { last = e.clientX; room.setPointerCapture(e.pointerId); });
    room.addEventListener('pointermove', (e) => {
      if (last === null) return;
      this.hooks.turn((e.clientX - last) * 0.012);
      last = e.clientX;
    });
    room.addEventListener('pointerup', () => { last = null; });
    room.addEventListener('pointercancel', () => { last = null; });
    room.addEventListener('wheel', (e) => { e.preventDefault(); this.setFocus(e.deltaY < 0 ? 'face' : 'body'); }, { passive: false });
  }

  private setFocus(f: Framing): void {
    this.framing.forEach((b, i) => b.classList.toggle('on', (i === 0) === (f === 'body')));
    this.hooks.frame(f);
  }
}
