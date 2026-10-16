/**
 * The game's DOM panels (the tin, the map, What's new): their stylesheet into the page once, and
 * their element by id into the host. Every panel gets the theme (src/app/theme.ts): its colours,
 * fonts and the shared `ui-*` classes.
 */
import { growOn, type Growth } from './growth';
import { useTheme } from './theme';

/** `t` made safe to put into innerHTML. */
export function esc(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

/** Add a stylesheet to the page. */
export function addStyle(css: string): void {
  useTheme();
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

/** A `tag` element with id `id`, styled by `css`, appended to `host`. */
export function panel<K extends keyof HTMLElementTagNameMap>(host: HTMLElement, tag: K, id: string, css: string): HTMLElementTagNameMap[K] {
  addStyle(css);
  const el = document.createElement(tag);
  el.id = id;
  host.appendChild(el);
  return el;
}

/** A `tag` element of class `cls` (and text `text`) appended to `parent`. */
export function child<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text) el.textContent = text;
  parent.appendChild(el);
  return el;
}

/** A button of class `cls` saying `text` in `parent`: a click does `click` (and goes no further, and leaves no focus behind). */
export function button(parent: HTMLElement, text: string, click: () => void, cls = ''): HTMLButtonElement {
  const b = child(parent, 'button', cls, text);
  b.addEventListener('click', (e) => { e.stopPropagation(); click(); b.blur(); });
  return b;
}

/** `key` as a keycap (the theme's `ui-key`), for innerHTML. */
export function keycap(key: string): string {
  return `<span class="ui-key">${esc(key)}</span>`;
}

/**
 * A panel in the middle of the screen (the theme's `ui-modal`) on paper or the dark, grown over
 * with salt as it opens (src/app/growth.ts): shown with its html, hidden again. Grandma's tin,
 * her diary and an inscription read are one each. Its html goes into `el`, which scrolls (style
 * its padding as `#id > .ui-scroll`); the frame round it holds the growth.
 */
export class Modal {
  private readonly frame: HTMLDivElement;
  private readonly growth: Growth;
  protected readonly el: HTMLDivElement;

  /** `toggled(open)`: it opened or closed. */
  constructor(host: HTMLElement, id: string, css: string, surface: 'paper' | 'dark' = 'paper', private readonly toggled?: (open: boolean) => void) {
    this.frame = panel(host, 'div', id, css);
    this.frame.className = `${surface === 'paper' ? 'ui-paper' : 'ui-panel'} ui-modal`;
    this.el = child(this.frame, 'div', 'ui-scroll');
    this.growth = growOn(this.frame, id);
  }

  get open(): boolean {
    return this.frame.classList.contains('open');
  }

  /** Show it with `html` in it. */
  protected showHtml(html: string): void {
    this.el.innerHTML = html;
    if (this.open) { this.frame.classList.add('open'); return; }
    this.growth.fit();
    this.frame.classList.add('open');
    this.toggled?.(true);
  }

  hide(): void {
    if (!this.open) return;
    this.frame.classList.remove('open');
    this.toggled?.(false);
  }
}
