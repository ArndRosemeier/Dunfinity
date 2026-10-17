/**
 * The one way into the browser's localStorage (guarded: only src/persist/ touches it): a value kept
 * as JSON under `dunfinity:<name>`. Reading never throws: a missing, blocked or broken entry is null;
 * writing to a full or blocked storage keeps nothing (the game goes on, unsaved).
 */
const PREFIX = 'dunfinity:';

export function recall<T>(name: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + name);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Keep `value` under `name` (null: forget it). */
export function remember(name: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(PREFIX + name);
    else localStorage.setItem(PREFIX + name, JSON.stringify(value));
  } catch {
    // (storage full or blocked)
  }
}

/** Every name kept (without the prefix). */
export function names(): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) out.push(k.slice(PREFIX.length));
    }
  } catch {
    // (no storage: nothing kept)
  }
  return out;
}
