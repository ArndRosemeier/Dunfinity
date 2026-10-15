/**
 * A built style's envelope (E1) from the features near a column (halls, naves, passages): the floor
 * is their floors weighted by how near each one is, all but its own inside it and nothing at `far`
 * (with a little weight on the level's own floor, so a feature coming into reach changes nothing);
 * the ceiling is a roof over all of them that falls away outside each one so steeply that a
 * feature leaving the list, `far` out, is under every other's. Pure.
 */
export class Envelope {
  private wsum = 0.002;
  private fsum = 0;
  private roof: number;

  /** `far`: features further out than this are not added; `fall`: how steeply the roof falls away outside one. */
  constructor(private readonly far: number, private readonly fall = 3) {
    this.roof = -far;
  }

  /** A feature `inside` metres in from its walls (negative outside), its floor and its roof here. */
  add(inside: number, floor: number, top: number): void {
    const out = Math.max(0, -inside), w = Math.max(0, 1 / (out * out + 0.01) - 1 / (this.far * this.far));
    this.wsum += w;
    this.fsum += w * floor;
    this.roof = Math.max(this.roof, top + this.fall * Math.min(0, inside));
  }

  /** The envelope's floor. */
  floor(): number {
    return this.fsum / this.wsum;
  }

  /** The envelope's ceiling: the roof, but never under `headroom` over the floor. */
  ceiling(headroom = 3): number {
    return Math.max(this.roof, this.floor() + headroom) + 0.5;
  }
}
