/**
 * Fingers on a touch surface (pointer events): where each is, how far one moved, and two of them
 * pinching (apart: nearer). The touch pad looks round and pinches the camera with it
 * (src/app/touchPad.ts), the map pinches its zoom (src/app/mapView.ts).
 */
/** How much farther apart (or nearer) two fingers move for one pinch step. */
const PINCH = 1.18;

export class Fingers {
  private readonly at = new Map<number, [number, number]>();
  /** The first two fingers' distance when the pinch last stepped. */
  private spread = 0;

  /** Two fingers (or more) down: they pinch rather than drag. */
  get pinching(): boolean { return this.at.size > 1; }

  land(e: PointerEvent): void {
    this.at.set(e.pointerId, [e.clientX, e.clientY]);
    this.spread = this.apart();
  }

  /** A finger moved: how far since it last did (null: not one of these fingers). */
  slide(e: PointerEvent): [number, number] | null {
    const p = this.at.get(e.pointerId);
    if (!p) return null;
    const d: [number, number] = [e.clientX - p[0], e.clientY - p[1]];
    p[0] = e.clientX; p[1] = e.clientY;
    return d;
  }

  /** Pinch steps since the last call: +1 the fingers went apart (nearer), −1 together, 0 neither (or fewer than two). */
  pinch(): number {
    const s = this.apart();
    if (this.spread <= 0 || s <= 0) return 0;
    const r = s / this.spread;
    if (r > PINCH) { this.spread = s; return 1; }
    if (r < 1 / PINCH) { this.spread = s; return -1; }
    return 0;
  }

  lift(e: PointerEvent): void {
    this.at.delete(e.pointerId);
    this.spread = this.apart();
  }

  clear(): void {
    this.at.clear();
    this.spread = 0;
  }

  private apart(): number {
    const [a, b] = [...this.at.values()];
    return a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : 0;
  }
}
