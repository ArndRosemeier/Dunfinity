/**
 * The touch pad's buttons (src/app/touchPad.ts): the action (its own key) each presses and what it is
 * called, which prompts name instead of a key when the game is played by touch. Pure data.
 */
/** A button on the pad: the action it presses (its own key), its label, held on until tapped again (`hold`), on the top row (`top`). */
export interface PadButton {
  readonly action: string;
  readonly label: string;
  readonly hold?: boolean;
  readonly top?: boolean;
  /** Shown only by the fire. */
  readonly fire?: boolean;
  readonly cls?: string;
}

export const TOUCH_BUTTONS: readonly PadButton[] = [
  { action: 'Mouse0', label: 'Stab', cls: 'stab' },
  { action: 'Space', label: 'Jump', cls: 'jump' },
  { action: 'KeyE', label: 'Use', cls: 'use' },
  { action: 'Tab', label: 'Target', cls: 'target' },
  { action: 'KeyZ', label: 'Sneak', hold: true, cls: 'sneak' },
  { action: 'KeyT', label: 'Tin', fire: true, cls: 'tin' },
  { action: 'KeyM', label: 'Map', top: true },
  { action: 'KeyI', label: 'Pack', top: true },
  { action: 'KeyJ', label: 'Diary', top: true },
  { action: 'KeyF', label: 'Lamp', top: true },
  { action: 'KeyC', label: 'Fire', top: true },
];

/** What an action's touch button is called ('Use' for KeyE), or null if it has none: what prompts name instead of a key. */
export function touchLabel(action: string): string | null {
  return TOUCH_BUTTONS.find((b) => b.action === action)?.label ?? null;
}
