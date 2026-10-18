/**
 * The character creator's overlay (src/game/creator.ts plays it; adapted from Scale's, which came
 * from Norgo's): beside the grandchild standing in grandma's round room, a panel of tabs (body, face,
 * hair, skin and eyes, clothes) with sliders, choices and colours, a dice for a stranger, and "Go down",
 * which wakes once the game's shaders are all built. Dragging on the room turns the grandchild;
 * the wheel (or the Face / Body buttons) looks at the face or the whole body.
 *
 * It only edits a look (`HumanoidAppearance`) and an outfit (today's clothes, src/loot/outfit.ts)
 * and says when they changed; the game rebuilds the figure.
 */
import { BEARD_STYLES, BROW_STYLES, HAIR_STYLES, type HumanoidAppearance } from '@futuremagic/humanoid';
import { clamp } from '@futuremagic/core';
import { addStyle, button, child } from './panel';
import { growOn } from './growth';
import { BOTTOMS, DENIM, FABRIC, HATS, OUTERS, PATTERNS, SHOE, SHOES, TOPS, type OutfitSpec } from '../loot/outfit';

type Look = HumanoidAppearance;
type FaceKey = keyof Look['face'];
type BodyKey = keyof Look['body'];
type Tab = 'body' | 'face' | 'hair' | 'skin' | 'clothes';
/** What the creator makes: a look and what they wear. */
export interface Made { look: Look; outfit: OutfitSpec }
type Rgb = [number, number, number];
export type Framing = 'body' | 'face';

const TABS: readonly [Tab, string][] = [['body', 'Body'], ['face', 'Face'], ['hair', 'Hair'], ['skin', 'Skin & eyes'], ['clothes', 'Clothes']];
const FACE: readonly [FaceKey, string][] = [
  ['headRound', 'Head shape'], ['foreheadSlope', 'Forehead'], ['browRidge', 'Brow ridge'], ['eyeSize', 'Eye size'], ['eyeSpacing', 'Eye spacing'],
  ['noseSize', 'Nose size'], ['noseWidth', 'Nose width'], ['noseBridge', 'Nose bridge'], ['cheekbones', 'Cheekbones'], ['jaw', 'Jaw'],
  ['chin', 'Chin'], ['mouthWidth', 'Mouth width'], ['lipFullness', 'Lips (thin to full)'], ['earSize', 'Ears'],
  ['cheekFullness', 'Cheeks (lean to full)'], ['faceWidth', 'Face width'], ['smile', 'Expression (stern to smiling)'],
];
const BODY: readonly [BodyKey, string][] = [
  ['shoulders', 'Shoulders'], ['chest', 'Chest'], ['waist', 'Waist'], ['hips', 'Hips'], ['belly', 'Belly'], ['neck', 'Neck'],
  ['armLength', 'Arm length'], ['legLength', 'Leg length'], ['hands', 'Hands'], ['feet', 'Feet'],
];
/** The fantasy races' options are left out: grandma's family is human. */
const HAIR = HAIR_STYLES.filter((s) => s !== 'leaves' && s !== 'crest');
const BROW = BROW_STYLES.filter((s) => s !== 'scaled');
const MARKS: readonly [string, string][] = [
  ['scar_cheek', 'Cheek scar'], ['scar_brow', 'Brow scar'], ['scar_lip', 'Lip scar'], ['scar_eye', 'Eye scar'], ['scar_chin', 'Chin scar'],
  ['freckle_patch', 'Freckle patch'], ['tattoo_face', 'Face tattoo'],
];
const LABEL: Record<string, string> = {
  none: 'None', mustache: 'Moustache', mutton: 'Mutton chops', chinstrap: 'Chinstrap', unibrow: 'Unibrow',
  tshirt: 'T-shirt', raincoat: 'Rain jacket', sneakers: 'Trainers',
};

/** Skin, eye and hair colours to pick from (the character's own colours, not the interface's). */
const SKIN = ['#f6dcc8', '#efcdb4', '#eac2a1', '#ddae8a', '#d9a47c', '#c99068', '#bf8560', '#a8734f', '#9c6644', '#865637', '#7a4b2f', '#5a3522', '#4a2c1c', '#3f2519'];
const EYES = ['#3f2410', '#1f120a', '#6b5224', '#47693d', '#4770a8', '#75848f', '#94662a', '#2e4a6e'];
const HAIR_COL = ['#0a0908', '#1c120c', '#341f12', '#5c3f26', '#85663f', '#bc9e6b', '#ddd0b0', '#6b2410', '#9e4c1e', '#8a8a86', '#d8d8d4', '#7a3a6a', '#2a4a7a'];

const hex = (c: readonly number[]): string => '#' + c.map((v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('');
const rgb = (s: string): Rgb => [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255];
const named = (s: string): string => LABEL[s] ?? s.charAt(0).toUpperCase() + s.slice(1);

/** The MakeHuman age parameter in years (0.1875: 11, 0.5: 25, 1: 90). */
export const ageYears = (a: number): number => Math.round(a < 0.5 ? 11 + ((a - 0.1875) / 0.3125) * 14 : 25 + ((a - 0.5) / 0.5) * 65);
/** About how tall they stand, cm (the body build's own estimate). */
export const heightCm = (a: Look): number => Math.round(172 * a.scale * (0.88 + a.height * 0.24));

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
  #creator .tabs { display: flex; gap: 4px; padding: 10px 14px 6px; border-bottom: 1px solid var(--ui-line); }
  #creator .tabs .ui-btn { padding: 6px 10px; font-size: 13px; }
  #creator .tabs .ui-btn.on { border-color: var(--ui-accent); color: #fff3d6; box-shadow: var(--ui-glow); }
  #creator section { margin: 12px 0 4px; }
  #creator section > .ui-label { margin-bottom: 6px; }
  #creator .slider { display: grid; grid-template-columns: 1fr auto; gap: 0 8px; margin: 5px 0; font-size: 13px; }
  #creator .slider .val { color: var(--ui-ink-dim); font-variant-numeric: tabular-nums; }
  #creator .slider input { grid-column: 1 / -1; width: 100%; margin: 2px 0 0; accent-color: var(--ui-accent); }
  #creator .field { margin: 8px 0; }
  #creator .field > div:first-child { font-size: 13px; color: var(--ui-ink-dim); margin-bottom: 4px; }
  #creator .chips { display: flex; flex-wrap: wrap; gap: 4px; }
  #creator .chips .ui-btn { padding: 4px 8px; font-size: 12px; }
  #creator .chips .ui-btn.on { border-color: var(--ui-accent); color: #fff3d6; background: linear-gradient(180deg, #4a3a20, #2a2114); }
  #creator .swatches { display: flex; flex-wrap: wrap; gap: 5px; }
  #creator .swatch { width: 24px; height: 24px; border-radius: 50%; border: 1px solid var(--ui-line); cursor: pointer; padding: 0; }
  #creator .swatch.on { outline: 2px solid var(--ui-accent); outline-offset: 2px; }
  #creator .note { font-size: 12px; color: var(--ui-ink-faint); font-style: italic; margin: 8px 0; }
  #creator .foot { display: flex; align-items: center; gap: 8px; padding: 12px 18px 16px; border-top: 1px solid var(--ui-line); }
  #creator .foot .lamps { flex: 1; font: italic 13px/1.3 var(--ui-font); color: var(--ui-ink-faint); }
  #creator .foot .go { position: relative; }
  #creator .ui-btn[disabled] { color: var(--ui-ink-faint); border-color: var(--ui-line); box-shadow: none; cursor: default; }
  /* At first only the short card: who they are by the dice, and Go down; the tabs open on asking. */
  #creator .side.simple { height: auto; }
  #creator .side.simple .tabs, #creator .side.simple > .ui-scroll { display: none; }
  #creator .side:not(.simple) .quick, #creator .side.simple .foot .dice { display: none; }
  #creator .quick { padding: 6px 18px 14px; display: flex; flex-direction: column; gap: 8px; }
  #creator .quick p { margin: 0 0 4px; color: var(--ui-ink-dim); font-size: 14px; }
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
  /** The look or the clothes changed (the figure is rebuilt in them). */
  changed(made: Made): void;
  /** Turn the grandchild by `by` radians (dragged). */
  turn(by: number): void;
  /** Look at the whole body or the face. */
  frame(f: Framing): void;
  /** A stranger's look and clothes (the dice): seeded by the game. */
  someoneElse(): Made;
}

interface Slider { readonly el: HTMLElement; set(v: number): void }

export class CreatorView {
  private readonly root: HTMLDivElement;
  private readonly black: HTMLDivElement;
  private readonly tabs: HTMLDivElement;
  private readonly editor: HTMLDivElement;
  private readonly framing: HTMLButtonElement[] = [];
  private readonly go: HTMLButtonElement;
  private readonly lamps: HTMLDivElement;
  private tab: Tab = 'body';
  /** The look and clothes made, once "Go down" is pressed. */
  readonly done: Promise<Made>;
  private look: Look;
  private outfit: OutfitSpec;

  constructor(host: HTMLElement, made: Made, private readonly hooks: CreatorHooks) {
    addStyle(CSS);
    this.look = structuredClone(made.look);
    this.outfit = structuredClone(made.outfit);
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
    button(quick, 'Shape them yourself', () => { side.classList.remove('simple'); this.render(); }, 'ui-btn');
    this.tabs = child(side, 'div', 'tabs');
    for (const [t, text] of TABS) button(this.tabs, text, () => this.setTab(t), 'ui-btn small').dataset.tab = t;
    this.editor = child(side, 'div', 'ui-scroll');
    const foot = child(side, 'div', 'foot');
    button(foot, '\u{1F3B2} Someone else', () => this.dice(), 'ui-btn small dice');
    this.lamps = child(foot, 'div', 'lamps', 'Lighting the lamps…');
    let resolve!: (m: Made) => void;
    this.done = new Promise((r) => { resolve = r; });
    this.go = button(foot, 'Go down', () => { this.root.classList.add('leaving'); resolve(structuredClone({ look: this.look, outfit: this.outfit })); }, 'ui-btn primary go');
    this.go.disabled = true; // until the game's shaders are all built (src/render/stage.ts warmLater): play must not stutter
    growOn(side, 'creator', { amount: 0.7 });
    side.classList.add('ui-grown');
    this.black = child(this.root, 'div', 'black');
    this.setFocus('body');
    this.setTab('body');
  }

  /** A stranger by the dice. */
  private dice(): void {
    const m = structuredClone(this.hooks.someoneElse());
    this.look = m.look; this.outfit = m.outfit;
    this.edited(); this.render();
  }

  /** The game is ready to play: "Go down" wakes up. */
  ready(): void {
    this.go.disabled = false;
    this.lamps.textContent = '';
  }

  /** How black the screen is, 0..1 (it fades in from black, and out to it). */
  set dark(v: number) { this.black.style.opacity = String(v); }

  close(): void {
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

  private setTab(t: Tab): void {
    this.tab = t;
    for (const b of this.tabs.querySelectorAll<HTMLElement>('button')) b.classList.toggle('on', b.dataset.tab === t);
    this.render();
    this.editor.scrollTop = 0;
    this.setFocus(t === 'body' || t === 'clothes' ? 'body' : 'face');
  }

  /** A change made: the game hears of it. */
  private edited(): void {
    this.hooks.changed({ look: this.look, outfit: this.outfit });
  }

  private set<K extends keyof Look>(k: K, v: Look[K]): void {
    this.look[k] = v;
    this.edited();
  }

  /** Change a garment or a colour; `again`: show the tab anew (what can be chosen depends on it). */
  private pickGarment<K extends keyof OutfitSpec>(k: K, v: OutfitSpec[K], again = false): void {
    this.outfit[k] = v;
    this.edited();
    if (again) this.render();
  }

  private render(): void {
    const a = this.look;
    const pct = (v: number) => `${Math.round(v * 100)}`;
    const signed = (v: number) => (v > 0.005 ? '+' : '') + Math.round(v * 100);
    const e = this.editor;
    e.replaceChildren();
    switch (this.tab) {
      case 'body': {
        const build = section(e, 'Build');
        const sex = chips(build, ['Woman', 'Man'], a.gender > 0.5 ? 'Man' : 'Woman', (v) => {
          const man = v === 'Man';
          if ((this.look.gender > 0.5) === man) return;
          this.look.gender = man ? 0.92 : 0.06;
          if (!man) this.look.beardStyle = 'none';
          gender.set(this.look.gender);
          this.edited();
        });
        const gender = rangeRow(build, 'Feminine to masculine', a.gender, 0, 1, pct, (v) => { this.set('gender', v); sex.pick(v > 0.5 ? 'Man' : 'Woman'); });
        rangeRow(build, 'Age', clamp(a.age, 0.42, 0.95), 0.42, 0.95, (v) => `${ageYears(v)} years`, (v) => this.set('age', v));
        rangeRow(build, 'Height', a.height, 0, 1, (v) => `${heightCm({ ...this.look, height: v })} cm`, (v) => this.set('height', v));
        rangeRow(build, 'Weight', a.weight, 0, 1, pct, (v) => this.set('weight', v));
        rangeRow(build, 'Muscle', a.muscle, 0, 1, pct, (v) => this.set('muscle', v));
        rangeRow(build, 'Proportions', a.proportions, 0, 1, pct, (v) => this.set('proportions', v));
        const shape = section(e, 'Shape');
        for (const [k, text] of BODY) rangeRow(shape, text, a.body[k], -1, 1, signed, (v) => { this.look.body[k] = v; this.edited(); });
        this.ancestry(section(e, 'Ancestry'));
        child(e, 'p', 'note', 'Double-click a slider to put it back in the middle.');
        break;
      }
      case 'face': {
        const s = section(e, 'Features');
        for (const [k, text] of FACE) rangeRow(s, text, a.face[k] ?? 0, -1, 1, signed, (v) => { this.look.face[k] = v; this.edited(); });
        rangeRow(s, 'Little differences', a.faceDetail ?? 1, 0, 1, pct, (v) => this.set('faceDetail', v));
        break;
      }
      case 'hair': {
        const s = section(e, 'Hair');
        chips(field(s, 'Style'), withCurrent(HAIR, a.hairStyle), a.hairStyle, (v) => this.set('hairStyle', v));
        swatches(field(s, 'Colour'), HAIR_COL, a.hairColor, (c) => this.set('hairColor', c));
        const f = section(e, 'Face');
        chips(field(f, 'Beard'), withCurrent(BEARD_STYLES, a.beardStyle), a.beardStyle, (v) => this.set('beardStyle', v));
        chips(field(f, 'Eyebrows'), withCurrent(BROW, a.browStyle), a.browStyle, (v) => this.set('browStyle', v));
        break;
      }
      case 'skin': {
        const s = section(e, 'Skin');
        swatches(field(s, 'Tone'), SKIN, a.skinTone, (c) => {
          this.look.skinTone = c;
          this.look.skinAccent = [c[0] * 0.55, c[1] * 0.45, c[2] * 0.4];
          this.edited();
        });
        rangeRow(s, 'Freckles', a.skinPattern === 'freckles' ? a.patternStrength : 0, 0, 1, pct, (v) => {
          this.look.skinPattern = v > 0.02 ? 'freckles' : 'none';
          this.look.patternStrength = v;
          this.edited();
        });
        this.marks(field(s, 'Marks'));
        swatches(field(section(e, 'Eyes'), 'Colour'), EYES, a.eyeColor, (c) => this.set('eyeColor', c));
        break;
      }
      case 'clothes': {
        const o = this.outfit, fabric = FABRIC.map(hex);
        const top = section(e, 'Top');
        chips(top, TOPS, o.top, (v) => this.pickGarment('top', v, true));
        swatches(field(top, 'Colour'), fabric, o.topColor, (c) => this.pickGarment('topColor', c));
        chips(field(top, 'Pattern'), PATTERNS, o.topPattern, (v) => this.pickGarment('topPattern', v));
        swatches(field(top, 'Trim and pattern colour'), fabric, o.topColor2, (c) => this.pickGarment('topColor2', c));
        const outer = section(e, 'Over it');
        chips(outer, OUTERS, o.outer, (v) => this.pickGarment('outer', v, true));
        if (o.outer !== 'none') swatches(field(outer, 'Colour'), fabric, o.outerColor, (c) => this.pickGarment('outerColor', c));
        if (o.outer === 'jacket') chips(field(outer, 'Material'), ['Cloth', 'Leather'], o.outerLeather ? 'Leather' : 'Cloth', (v) => this.pickGarment('outerLeather', v === 'Leather'));
        const legs = section(e, 'Legs');
        if (o.top === 'dress') child(legs, 'p', 'note', 'The dress is worn without trousers or a skirt.');
        else {
          chips(legs, BOTTOMS, o.bottom, (v) => this.pickGarment('bottom', v, true));
          swatches(field(legs, 'Colour'), (o.bottom === 'jeans' ? DENIM : FABRIC).map(hex), o.bottomColor, (c) => this.pickGarment('bottomColor', c));
        }
        const feet = section(e, 'Shoes');
        chips(feet, SHOES, o.shoes, (v) => this.pickGarment('shoes', v));
        swatches(field(feet, 'Colour'), SHOE.map(hex), o.shoesColor, (c) => this.pickGarment('shoesColor', c));
        const hat = section(e, 'Hat');
        chips(hat, HATS, o.hat, (v) => this.pickGarment('hat', v, true));
        if (o.hat !== 'none') swatches(field(hat, 'Colour'), fabric, o.hatColor, (c) => this.pickGarment('hatColor', c));
        const cut = section(e, 'Cut');
        button(cut, 'Another cut', () => this.pickGarment('seed', (this.outfit.seed + 1) >>> 0), 'ui-btn small');
        child(cut, 'p', 'note', 'Skirt and dress length, sleeves. A hard hat found below goes on in place of a hat.');
        break;
      }
    }
  }

  /** The three ancestry weights, kept adding up to one (MakeHuman's base shapes). */
  private ancestry(s: HTMLElement): void {
    const keys = [['african', 'African'], ['asian', 'Asian'], ['caucasian', 'European']] as const;
    const els: Slider[] = [];
    for (const [k, text] of keys) {
      els.push(rangeRow(s, text, this.look[k], 0, 1, (v) => `${Math.round(v * 100)}%`, (v) => {
        const a = this.look;
        const others = keys.map((x) => x[0]).filter((x) => x !== k);
        const rest = others.reduce((sum, x) => sum + a[x], 0);
        a[k] = v;
        for (const x of others) a[x] = rest > 1e-4 ? (a[x] / rest) * (1 - v) : (1 - v) / 2;
        keys.forEach(([x], i) => { if (x !== k) els[i].set(a[x]); });
        this.edited();
      }));
    }
  }

  private marks(parent: HTMLElement): void {
    const wrap = child(parent, 'div', 'chips');
    for (const [id, text] of MARKS) {
      const b = button(wrap, text, () => {
        const m = this.look.marks, i = m.indexOf(id);
        if (i >= 0) m.splice(i, 1);
        else m.push(id);
        b.classList.toggle('on', i < 0);
        this.edited();
      }, 'ui-btn small');
      b.classList.toggle('on', this.look.marks.includes(id));
    }
  }
}

function section(parent: HTMLElement, title: string): HTMLElement {
  const s = child(parent, 'section');
  child(s, 'div', 'ui-label', title);
  return s;
}

function field(parent: HTMLElement, label: string): HTMLElement {
  const f = child(parent, 'div', 'field');
  child(f, 'div', '', label);
  return f;
}

function rangeRow(parent: HTMLElement, label: string, value: number, min: number, max: number, show: (v: number) => string, input: (v: number) => void): Slider {
  const row = child(parent, 'label', 'slider');
  child(row, 'span', '', label);
  const out = child(row, 'span', 'val');
  const inp = child(row, 'input');
  inp.type = 'range';
  inp.min = String(min);
  inp.max = String(max);
  inp.step = String((max - min) / 400);
  inp.value = String(value);
  const showValue = () => { out.textContent = show(Number(inp.value)); };
  showValue();
  inp.addEventListener('input', () => { showValue(); input(Number(inp.value)); });
  const middle = min < 0 ? 0 : (min + max) / 2;
  inp.addEventListener('dblclick', () => { inp.value = String(middle); showValue(); input(middle); });
  return { el: row, set(v) { inp.value = String(v); showValue(); } };
}

function chips<T extends string>(parent: HTMLElement, options: readonly T[], value: T, pick: (v: T) => void): { pick(v: T): void } {
  const wrap = child(parent, 'div', 'chips');
  const mark = (v: T) => { for (const b of wrap.children) b.classList.toggle('on', (b as HTMLElement).dataset.v === v); };
  for (const o of options) button(wrap, named(o), () => { mark(o); pick(o); }, 'ui-btn small').dataset.v = o;
  mark(value);
  return { pick: mark };
}

function swatches(parent: HTMLElement, list: readonly string[], value: readonly number[], pick: (c: Rgb) => void): void {
  const wrap = child(parent, 'div', 'swatches');
  const now = hex(value);
  for (const c of list) {
    const b = button(wrap, '', () => {
      for (const x of wrap.children) x.classList.toggle('on', x === b);
      pick(rgb(c));
    }, 'swatch');
    b.style.background = c;
    b.classList.toggle('on', c === now);
    b.setAttribute('aria-label', c);
  }
}

function withCurrent(list: readonly string[], now: string): string[] {
  return now && !list.includes(now) ? [now, ...list] : [...list];
}
