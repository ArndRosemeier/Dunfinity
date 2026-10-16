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

/** Distance in plan from (x, z) to the segment from (ax, az) to (bx, bz). */
export function segDist(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2)) : 0;
  return Math.hypot(x - ax - ex * t, z - az - ez * t);
}

/**
 * A roof over a round tunnel or chamber of radius r whose middle stands `mid` over the floor, `a`
 * metres across from its middle in plan: over the round roof everywhere (an envelope bound, E1),
 * falling away beyond it no steeper than 0.75.
 */
export function roundRoof(mid: number, r: number, a: number): number {
  const t = Math.min(a, r);
  return mid + r - (0.375 * t * t) / r - 0.75 * Math.max(0, a - r);
}
