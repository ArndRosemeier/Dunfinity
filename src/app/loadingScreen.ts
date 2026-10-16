/**
 * The loading screen: black with the game's name, what is being done and a bar, from the first paint
 * (index.html draws it before any script runs) until the first picture is ready; and the plain
 * message for a browser that cannot draw the game, or a start that failed.
 *
 * It only shows progress: the shader warm-up keeps its own pacing (docs/SHADERS.md).
 */
import { addStyle, esc } from './panel';

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
    addStyle(`
      #loading .msg { max-width: 34em; margin-top: 18px; line-height: 1.55; color: #cfd6dc; text-align: left; }
      #loading .msg h2 { font-size: 16px; color: #e8d9b8; margin: 0 0 8px; letter-spacing: 0.04em; }
      #loading .msg p { margin: 6px 0; }
      #loading .msg code { font-size: 12px; color: #a9c3d6; word-break: break-word; }
      #loading.failed .bar, #loading.failed .step { display: none; }`);
    let root = document.getElementById('loading');
    if (!root) {
      root = document.createElement('div');
      root.id = 'loading';
      root.innerHTML = '<div class="name">Dunfinity</div><div class="bar"><i></i></div><div class="step"></div>';
      host.appendChild(root);
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
    this.label.textContent = text;
    this.shown = Math.max(this.shown, Math.min(1, done));
    this.bar.style.width = `${(this.shown * 100).toFixed(1)}%`;
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
    msg.className = 'msg';
    msg.innerHTML = `<h2>${esc(title)}</h2>${paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}${detail ? `<p><code>${esc(detail)}</code></p>` : ''}`;
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
