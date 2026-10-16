/**
 * Playing by touch (a tablet): over the game, a thumb stick where the left thumb lands (pushed to its
 * rim it runs), the rest of the screen to look round by dragging (two fingers pinch the camera nearer
 * or farther), and buttons for what keys do: stab, jump, use, target, sneak and, by the fire, the tin
 * on the right; map, pack, diary, headlamp and fire along the top. While a panel is open only a Close
 * button is left, which is Escape.
 *
 * Everything goes into `Controls` (src/input/controls.ts) as the keys and mouse would: presses and
 * latches of the actions' own keys, look in mouse pixels, wheel steps, the stick. The main bar
 * (src/app/abilityBar.ts) is tapped as it is clicked. Shown only while `Controls.byTouch`.
 */
import type { Controls } from '../input/controls';
import { TOUCH_BUTTONS as BUTTONS, type PadButton } from '../input/touchButtons';
import { button, child, panel } from './panel';

/** The stick: its radius, CSS pixels; the dead middle and the rim (running) as fractions of it. */
const STICK = { radius: 64, dead: 0.12, run: 0.92 };
/** Look: mouse pixels per finger pixel; a pinch: how much nearer or farther the fingers move for one wheel step. */
const LOOK = { gain: 1.5, pinch: 1.18 };
/** The stick's half of the screen: a thumb landing left of this fraction of the width (and below the top row) takes the stick. */
const LEFT = 0.4;

const STYLE = `
  #touch { position: fixed; inset: 0; z-index: 4; pointer-events: none; display: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
  #touch.on { display: block; }
  #touch .pad { position: absolute; inset: 0; pointer-events: auto; touch-action: none; }
  #touch.panel .pad, #touch.panel .act, #touch.panel .top .b { display: none; }
  #touch .ring { position: absolute; width: ${2 * STICK.radius}px; height: ${2 * STICK.radius}px; margin: -${STICK.radius}px 0 0 -${STICK.radius}px; border-radius: 50%; display: none;
    border: 1px solid var(--ui-line-bright); background: radial-gradient(circle, #0b090740 40%, #0b090799); box-shadow: inset 0 0 18px #0008; }
  #touch .ring.on { display: block; }
  #touch .ring.run { border-color: var(--ui-vein); box-shadow: inset 0 0 18px #0008, 0 0 14px var(--ui-vein-glow); }
  #touch .knob { position: absolute; left: 50%; top: 50%; width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%;
    background: radial-gradient(circle at 40% 35%, var(--ui-dark-raised), var(--ui-dark-solid)); border: 1px solid var(--ui-accent); box-shadow: var(--ui-glow); }
  #touch .act { position: absolute; right: max(18px, env(safe-area-inset-right)); bottom: max(52px, env(safe-area-inset-bottom)); width: 236px; height: 236px; pointer-events: none; }
  #touch .b { position: absolute; pointer-events: auto; touch-action: none; display: flex; align-items: center; justify-content: center; box-sizing: border-box;
    border-radius: 50%; font: 500 14px/1 var(--ui-font); letter-spacing: .04em; color: var(--ui-ink); text-shadow: var(--ui-text-shadow);
    background: radial-gradient(circle at 50% 35%, #2c251ce0, #16120dd0); border: 1px solid var(--ui-line-bright); box-shadow: 0 4px 14px #0009, inset 0 1px 0 #ffffff14; }
  #touch .b.down { border-color: var(--ui-accent); color: #fff3d6; box-shadow: var(--ui-glow), inset 0 0 14px #e9b85c44; transform: scale(.96); }
  #touch .b.on { border-color: var(--ui-vein); box-shadow: 0 0 12px var(--ui-vein-glow), inset 0 0 12px #9fdcff33; }
  #touch .b.gone { display: none; }
  #touch .stab { right: 0; bottom: 0; width: 96px; height: 96px; font-size: 17px; border-color: var(--ui-accent); }
  #touch .jump { right: 108px; bottom: 0; width: 72px; height: 72px; }
  #touch .use { right: 6px; bottom: 112px; width: 72px; height: 72px; }
  #touch .target { right: 96px; bottom: 90px; width: 58px; height: 58px; font-size: 12px; }
  #touch .sneak { right: 172px; bottom: 82px; width: 52px; height: 52px; font-size: 12px; }
  #touch .tin { right: 86px; bottom: 166px; width: 64px; height: 64px; border-color: var(--ui-salt); color: var(--ui-salt); }
  #touch .top { position: absolute; right: max(12px, env(safe-area-inset-right)); top: 96px; display: flex; gap: 8px; pointer-events: none; }
  #touch .top .b, #touch .top .ui-btn { position: static; width: 54px; height: 44px; border-radius: var(--ui-radius); font-size: 13px; }
  #touch .top .close { display: none; pointer-events: auto; width: auto; height: 44px; padding: 0 18px; font-size: 15px; }
  #touch.panel .top .close { display: block; }`;

export class TouchPad {
  private readonly el: HTMLDivElement;
  private readonly ring: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private readonly buttons = new Map<string, HTMLDivElement>();
  /** The finger on the stick and where it landed; the fingers looking round and where each was last. */
  private stickId: number | null = null;
  private readonly from = [0, 0];
  private readonly looking = new Map<number, [number, number]>();
  /** The two looking fingers' distance when a pinch last stepped. */
  private spread = 0;

  constructor(host: HTMLElement, private readonly controls: Controls) {
    this.el = panel(host, 'div', 'touch', STYLE);
    const pad = child(this.el, 'div', 'pad');
    this.ring = child(pad, 'div', 'ring');
    this.knob = child(this.ring, 'div', 'knob');
    const act = child(this.el, 'div', 'act'), top = child(this.el, 'div', 'top');
    for (const b of BUTTONS) this.buttons.set(b.action, this.padButton(b.top ? top : act, b));
    // Close is Escape, as from the keyboard: the game's panels and the settings each listen for it.
    button(top, 'Close', () => { for (const type of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(type, { code: 'Escape', key: 'Escape' })); }, 'ui-btn close');
    pad.addEventListener('pointerdown', (e) => this.down(e));
    pad.addEventListener('pointermove', (e) => this.move(e));
    for (const ev of ['pointerup', 'pointercancel'] as const) pad.addEventListener(ev, (e) => this.up(e));
    pad.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /**
   * Each frame: shown while the game is played by touch (`on`); with a panel open (`panel`) only Close;
   * the tin's button by the fire (`resting`).
   */
  reflect(on: boolean, panel: boolean, resting: boolean): void {
    this.el.classList.toggle('on', on);
    this.el.classList.toggle('panel', panel);
    for (const b of BUTTONS) {
      const el = this.buttons.get(b.action)!;
      if (b.fire) el.classList.toggle('gone', !resting);
      if (b.hold) el.classList.toggle('on', this.controls.isLatched(b.action));
    }
    if (!on || panel) this.release();
  }

  private padButton(parent: HTMLElement, b: PadButton): HTMLDivElement {
    const el = child(parent, 'div', `b ${b.cls ?? ''}`.trim(), b.label);
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.add('down');
      if (b.hold) this.controls.latch(b.action, !this.controls.isLatched(b.action));
      else this.controls.press(b.action);
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) el.addEventListener(ev, () => el.classList.remove('down'));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    return el;
  }

  private down(e: PointerEvent): void {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    if (this.stickId === null && e.clientX < innerWidth * LEFT && e.clientY > innerHeight * 0.25) {
      this.stickId = e.pointerId;
      this.from[0] = e.clientX; this.from[1] = e.clientY;
      this.ring.style.left = `${e.clientX}px`;
      this.ring.style.top = `${e.clientY}px`;
      this.ring.classList.add('on');
      this.knob.style.transform = '';
      return;
    }
    this.looking.set(e.pointerId, [e.clientX, e.clientY]);
    this.spread = this.pinchSpread();
  }

  private move(e: PointerEvent): void {
    if (e.pointerId === this.stickId) {
      let dx = (e.clientX - this.from[0]) / STICK.radius, dy = (e.clientY - this.from[1]) / STICK.radius;
      const m = Math.hypot(dx, dy);
      if (m > 1) { dx /= m; dy /= m; }
      this.knob.style.transform = `translate(${dx * STICK.radius}px, ${dy * STICK.radius}px)`;
      const live = m > STICK.dead;
      this.controls.stick.right = live ? dx : 0;
      this.controls.stick.forward = live ? -dy : 0;
      this.ring.classList.toggle('run', m >= STICK.run);
      return;
    }
    const at = this.looking.get(e.pointerId);
    if (!at) return;
    const dx = e.clientX - at[0], dy = e.clientY - at[1];
    at[0] = e.clientX; at[1] = e.clientY;
    if (this.looking.size === 1) { this.controls.turn(dx * LOOK.gain, dy * LOOK.gain); return; }
    // Two fingers: a pinch (apart: nearer, as the wheel away from the user).
    const s = this.pinchSpread();
    if (this.spread > 0 && s > 0) {
      const r = s / this.spread;
      if (r > LOOK.pinch) { this.controls.zoom(-1); this.spread = s; }
      else if (r < 1 / LOOK.pinch) { this.controls.zoom(1); this.spread = s; }
    }
  }

  private up(e: PointerEvent): void {
    if (e.pointerId === this.stickId) this.stopStick();
    this.looking.delete(e.pointerId);
    this.spread = this.pinchSpread();
  }

  /** The distance between the first two looking fingers (0 with fewer). */
  private pinchSpread(): number {
    const [a, b] = [...this.looking.values()];
    return a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : 0;
  }

  private stopStick(): void {
    this.stickId = null;
    this.controls.stick.forward = this.controls.stick.right = 0;
    this.ring.classList.remove('on', 'run');
  }

  /** Let go of everything (hidden, or a panel opened). */
  private release(): void {
    if (this.stickId !== null) this.stopStick();
    this.looking.clear();
    this.spread = 0;
  }

  /** Whether the stick is pushed to its rim (running). */
  get running(): boolean {
    return this.stickId !== null && Math.hypot(this.controls.stick.forward, this.controls.stick.right) >= STICK.run;
  }
}
