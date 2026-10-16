/**
 * The loading screen: black with the game's name, what is being done and a bar, from the first paint
 * (index.html draws it before any script runs) until the first picture is ready; and the plain
 * message for a browser that cannot draw the game, or a start that failed.
 *
 * It only shows progress: the shader warm-up keeps its own pacing (docs/SHADERS.md).
 */
import { addStyle, esc, panel } from './panel';
import { useTheme } from './theme';

/** Seconds the screen takes to fade away. */
const FADE = 0.6;

export class LoadingScreen {
  private readonly root: HTMLElement;
  private readonly label: HTMLElement;
  private readonly bar: HTMLElement;
  private shown = 0;
  private hidden = false;
  private gone_ = false;
  private removing = 0;

  /** Takes over index.html's `#loading` (made here when a page has none). */
  constructor(host: HTMLElement) {
    useTheme();
    addStyle(`
      #loading .name { font-family: var(--ui-font-display); color: var(--ui-ink); }
      #loading .bar i { background: var(--ui-accent); }
      #loading .step { font-family: var(--ui-font); color: var(--ui-ink-faint); }
      #loading .msg { max-width: 34em; margin-top: 22px; padding: 16px 20px; text-align: left; }
      #loading .msg p { margin: 6px 0; }
      #loading .msg code { font-size: 12px; color: var(--ui-salt); word-break: break-word; }
      #loading.failed .bar, #loading.failed .step { display: none; }`);
    let root = document.getElementById('loading');
    if (!root) {
      root = panel(host, 'div', 'loading', '');
      root.innerHTML = '<div class="name">Dunfinity</div><div class="bar"><i></i></div><div class="step"></div>';
    }
    this.root = root;
    this.label = root.querySelector('.step') as HTMLElement;
    this.bar = root.querySelector('.bar i') as HTMLElement;
  }

  /** Is it still in front of the game? */
  get open(): boolean { return !this.hidden; }

  /** Faded away and removed: nothing of it is on screen (what a screenshot waits for). */
  get gone(): boolean { return this.gone_; }

  /** Say what is being done now, and how far the whole start has come (0–1; the bar never goes back). */
  step(text: string, done: number): void {
    if (this.hidden) return;
    // Touch the page only when something shows a change: called every frame, a restyle each time
    // costs real frame time (and the bar's eased width would never rest).
    const shown = Math.max(this.shown, Math.round(Math.min(1, done) * 100) / 100);
    if (text !== this.label.textContent) this.label.textContent = text;
    if (shown === this.shown) return;
    this.shown = shown;
    this.bar.style.width = `${shown * 100}%`;
  }

  /** Fade it away and remove it. */
  hide(): void {
    if (this.hidden) return;
    this.step('', 1);
    this.hidden = true;
    this.root.style.transition = `opacity ${FADE}s`;
    this.root.style.opacity = '0';
    this.root.style.pointerEvents = 'none';
    this.removing = window.setTimeout(() => { this.root.remove(); this.gone_ = true; }, FADE * 1000);
  }

  /** The game cannot start: say why, in words a player can act on, instead of a black screen. */
  fail(title: string, paragraphs: readonly string[], detail = ''): void {
    clearTimeout(this.removing);
    if (!this.root.isConnected) document.body.appendChild(this.root);
    this.root.classList.add('failed');
    this.root.style.transition = '';
    this.root.style.opacity = '1';
    this.root.style.pointerEvents = 'auto';
    const msg = document.createElement('div');
    msg.className = 'msg ui-panel';
    msg.innerHTML = `<h2 class="ui-title">${esc(title)}</h2><hr class="ui-rule">${paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}${detail ? `<p><code>${esc(detail)}</code></p>` : ''}`;
    this.root.querySelector('.msg')?.remove();
    this.root.appendChild(msg);
  }
}

/** The message for a browser with neither WebGPU nor WebGL 2 (`GraphicsUnavailable`). */
export const NO_GRAPHICS = {
  title: 'This browser cannot draw Dunfinity',
  lines: [
    'The game needs 3D graphics in the browser: WebGPU, or WebGL 2 where WebGPU is missing. This browser offers neither, or its graphics would not start.',
    'Try a current Chrome, Edge, Firefox or Safari. If you already use one, check that hardware acceleration is on in its settings, and update your graphics drivers.',
  ],
} as const;

/** The message for any other failed start. */
export const START_FAILED = {
  title: 'Dunfinity could not start',
  lines: ['Something went wrong while loading. Reloading the page often helps; if it keeps happening, the line below says what broke.'],
} as const;
