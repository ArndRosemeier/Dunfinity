/**
 * Keyboard and mouse for the canvas: held keys, mouse look while the pointer is captured (click to
 * capture), mouse buttons (as 'Mouse0', 'Mouse2' keys) and the wheel. The Lab's fly camera and the game read input through this.
 */
export class Controls {
  private readonly keys = new Set<string>();
  /** Mouse movement since the last `takeLook()`, pixels. */
  private dx = 0;
  private dy = 0;
  /** Wheel steps since the last `takeWheel()` (positive: towards the user). */
  private wheel = 0;
  private readonly pressed = new Set<string>();
  /** Other keys that count as a key (the ability bar's 1–8), and keys held on without a hand on them (a bar slot clicked). */
  private aliases = new Map<string, string[]>();
  private readonly latched = new Set<string>();

  constructor(private readonly el: HTMLElement) {
    el.addEventListener('click', () => el.requestPointerLock?.());
    window.addEventListener('keydown', (e) => { if (e.code === 'Tab') e.preventDefault(); if (!e.repeat) this.pressed.add(e.code); this.keys.add(e.code); });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.latched.clear(); });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.el) return;
      this.dx += e.movementX;
      this.dy += e.movementY;
    });
    // Mouse buttons count as keys 'Mouse0' (left), 'Mouse2' (right) while the pointer is captured.
    el.addEventListener('mousedown', (e) => { if (document.pointerLockElement === this.el) { this.pressed.add(`Mouse${e.button}`); this.keys.add(`Mouse${e.button}`); } });
    window.addEventListener('mouseup', (e) => this.keys.delete(`Mouse${e.button}`));
    el.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
  }

  /** Is the key (a KeyboardEvent.code) held (or one of its aliases, or latched)? */
  held(code: string): boolean { return this.keys.has(code) || this.latched.has(code) || !!this.aliases.get(code)?.some((a) => this.keys.has(a)); }

  /** Was the key (or one of its aliases) pressed this frame (since the last `endFrame`)? */
  tap(code: string): boolean {
    let hit = this.pressed.delete(code);
    for (const a of this.aliases.get(code) ?? []) hit = this.pressed.delete(a) || hit;
    return hit;
  }

  /** Press `code` as if from the keyboard (a click on the ability bar). */
  press(code: string): void { this.pressed.add(code); }

  /** Hold `code` down, or let it go, without a hand on it. */
  latch(code: string, on: boolean): void { if (on) this.latched.add(code); else this.latched.delete(code); }

  isLatched(code: string): boolean { return this.latched.has(code); }

  /** From now, pressing or holding `from` counts as `to` too (pairs [from, to]; replaces the last set). */
  alias(pairs: readonly (readonly [string, string])[]): void {
    this.aliases = new Map();
    for (const [from, to] of pairs) this.aliases.set(to, [...(this.aliases.get(to) ?? []), from]);
  }

  /**
   * End of a frame: presses nobody asked about are dropped, so a key pressed where it meant nothing
   * (E away from a ladder, R while alive) does not fire later when it would.
   */
  endFrame(): void { this.pressed.clear(); }

  /** Mouse movement since the last call, pixels. */
  takeLook(): [number, number] {
    const d: [number, number] = [this.dx, this.dy];
    this.dx = this.dy = 0;
    return d;
  }

  /** Wheel steps since the last call. */
  takeWheel(): number {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }
}
