/**
 * Which key each action answers to, when the player has moved some. An action is named by the key it
 * answers to by default (a KeyboardEvent.code, or 'Mouse0'…), so the game keeps asking `Controls`
 * for 'KeyW' and gets whatever key walks forward now. Every action has exactly one key and no key
 * does two actions: giving an action a key another action had swaps the two.
 *
 * Pure: plain data in and out (kept by src/persist/settings.ts).
 */
export class Bindings {
  /** action → key, only for the actions moved off their own key. */
  private readonly moved = new Map<string, string>();
  private readonly known: ReadonlySet<string>;

  /** `actions`: every action that can be moved; `fixed`: keys no action may take (Escape, the bar's numbers); `kept`: the moves kept from before. */
  constructor(readonly actions: readonly string[], readonly fixed: readonly string[] = [], kept: Readonly<Record<string, string>> = {}) {
    this.known = new Set(actions);
    for (const [action, key] of Object.entries(kept)) this.rebind(action, key);
  }

  /** The key `action` answers to now. */
  keyOf(action: string): string { return this.moved.get(action) ?? action; }

  /** The action a pressed key stands for: the action moved onto it, else the key itself; null for an action's own key it moved away from. */
  actionOf(key: string): string | null {
    for (const [action, k] of this.moved) if (k === key) return action;
    return this.moved.has(key) ? null : key;
  }

  /** Can `key` be given to an action? */
  canTake(key: string): boolean { return !this.fixed.includes(key); }

  /** Give `action` the key `key`; the action that had it (now given `action`'s old key) or null. Unknown actions and fixed keys change nothing. */
  rebind(action: string, key: string): string | null {
    if (!this.known.has(action) || !this.canTake(key)) return null;
    const old = this.keyOf(action);
    if (old === key) return null;
    const other = this.actions.find((a) => a !== action && this.keyOf(a) === key) ?? null;
    this.set(action, key);
    if (other) this.set(other, old);
    return other;
  }

  /** Every action back on its own key. */
  clear(): void { this.moved.clear(); }

  /** The moves, to keep (only the actions off their own key). */
  get data(): Record<string, string> { return Object.fromEntries(this.moved); }

  private set(action: string, key: string): void {
    if (key === action) this.moved.delete(action);
    else this.moved.set(action, key);
  }
}

const NAMED: Readonly<Record<string, string>> = {
  Mouse0: 'LMB', Mouse1: 'MMB', Mouse2: 'RMB', Mouse3: 'Mouse 4', Mouse4: 'Mouse 5',
  ShiftLeft: 'Shift', ShiftRight: 'Right Shift', ControlLeft: 'Ctrl', ControlRight: 'Right Ctrl',
  AltLeft: 'Alt', AltRight: 'Alt Gr', MetaLeft: 'Meta', MetaRight: 'Right Meta',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', IntlBackslash: '<',
  Escape: 'Esc', Backspace: 'Backspace', CapsLock: 'Caps Lock',
};

/** How a key (a KeyboardEvent.code, or 'Mouse0'…) is shown to the player: 'KeyW' → 'W', 'Mouse2' → 'RMB'. */
export function keyLabel(code: string): string {
  return NAMED[code] ?? code.replace(/^Key|^Digit/, '').replace(/^Numpad/, 'Num ');
}
