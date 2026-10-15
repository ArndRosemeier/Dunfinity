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
