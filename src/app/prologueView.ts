/**
 * The prologue on screen (src/game/prologue.ts): black bars top and bottom sliding in, the caption
 * over the bottom one, the fades to and from black, and a quiet line on how to hurry or skip it.
 * Everything else on the page hides while it plays (the `cinematic` class on the body). A click on
 * it hurries the caption on (`onNext`).
 */
import { esc, panel } from './panel';

const STYLE = `
  body.cinematic > :not(canvas):not(#prologue) { visibility: hidden !important; }
  #prologue { position: fixed; inset: 0; z-index: 30; display: none; cursor: pointer; user-select: none; }
  #prologue.open { display: block; }
  #prologue .bar { position: absolute; left: 0; right: 0; height: 13vh; background: #000; transition: transform 1.2s ease; }
  #prologue .bar.top { top: 0; transform: translateY(-100%); }
  #prologue .bar.bottom { bottom: 0; transform: translateY(100%); }
  #prologue.shown .bar { transform: none; }
  #prologue .black { position: absolute; inset: 0; background: #000; opacity: 1; pointer-events: none; }
  #prologue .caption { position: absolute; left: 50%; bottom: calc(13vh + 18px); transform: translateX(-50%); width: min(820px, calc(100vw - 48px));
    text-align: center; color: #efe6cf; font: italic 22px/1.45 Georgia, 'Times New Roman', serif; text-shadow: 0 2px 6px #000, 0 0 18px #000c; opacity: 0; }
  @media (max-width: 720px) { #prologue .caption { font-size: 17px; } }
  #prologue .keys { position: absolute; right: 18px; bottom: calc(6.5vh - 8px); color: #8d8574; font: 12px system-ui, sans-serif; letter-spacing: 0.04em; opacity: 0.8; }
  #prologue .keys b { color: #c9bfa6; font-weight: 600; }`;

export class PrologueView {
  private readonly el: HTMLDivElement;
  private readonly caption: HTMLDivElement;
  private readonly black: HTMLDivElement;
  private shownText = '';

  constructor(host: HTMLElement, onNext: () => void) {
    this.el = panel(host, 'div', 'prologue', STYLE);
    this.el.innerHTML = '<div class="bar top"></div><div class="bar bottom"></div><div class="caption"></div><div class="black"></div>'
      + '<div class="keys"><b>click</b> next &nbsp;·&nbsp; <b>Esc</b> skip</div>';
    this.caption = this.el.querySelector('.caption')!;
    this.black = this.el.querySelector('.black')!;
    this.el.addEventListener('click', onNext);
  }

  show(): void {
    document.body.classList.add('cinematic');
    this.el.classList.add('open');
    requestAnimationFrame(() => requestAnimationFrame(() => this.el.classList.add('shown')));
  }

  /** This frame: the caption (and how opaque it is), and the black over everything. */
  showFrame(text: string, caption: number, black: number): void {
    if (text !== this.shownText) { this.caption.innerHTML = esc(text); this.shownText = text; }
    this.caption.style.opacity = caption.toFixed(3);
    this.black.style.opacity = black.toFixed(3);
  }

  /** The bars slide away and the page comes back. */
  hide(): void {
    this.el.classList.remove('shown');
    this.black.style.opacity = '0';
    this.caption.style.opacity = '0';
    document.body.classList.remove('cinematic');
    this.el.style.pointerEvents = 'none';
    setTimeout(() => { this.el.classList.remove('open'); this.el.style.pointerEvents = ''; }, 1300);
  }
}
