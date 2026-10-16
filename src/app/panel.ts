/**
 * The game's DOM panels (the tin, the map, What's new): their stylesheet into the page once, and
 * their element by id into the host.
 */

/** `t` made safe to put into innerHTML. */
export function esc(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

/** Add a stylesheet to the page. */
export function addStyle(css: string): void {
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
