/**
 * Distances to simple shapes, for the styles' fields. Pure.
 */

/** Distance to a box's surface from a point whose per-axis offsets beyond the half-sizes are (qx, qz) (|p - centre| - half): negative inside. */
export function boxDist2(qx: number, qz: number): number {
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
}

/** The same in three dimensions. */
export function boxDist3(qx: number, qy: number, qz: number): number {
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0);
}
