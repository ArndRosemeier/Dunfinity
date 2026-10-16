/**
 * Polylines and boxes in plan (x, z), as flat number arrays `[x0, z0, x1, z1, ...]`: smoothing,
 * resampling, length, the closest point, and whether two turned boxes overlap. From Scale's
 * `core/geom2` (the village generator's roads and plots, src/gen/village.ts). Pure.
 */

/** Smooth a polyline by cutting its corners (Chaikin), `iterations` times; the ends stay. */
export function chaikin(pts: readonly number[], iterations: number): number[] {
  let cur = pts.slice();
  for (let it = 0; it < iterations; it++) {
    const out: number[] = [cur[0], cur[1]];
    const n = cur.length >> 1;
    for (let i = 0; i < n - 1; i++) {
      const ax = cur[i * 2], az = cur[i * 2 + 1], bx = cur[i * 2 + 2], bz = cur[i * 2 + 3];
      out.push(0.75 * ax + 0.25 * bx, 0.75 * az + 0.25 * bz, 0.25 * ax + 0.75 * bx, 0.25 * az + 0.75 * bz);
    }
    out.push(cur[cur.length - 2], cur[cur.length - 1]);
    cur = out;
  }
  return cur;
}

/** The length of an open polyline, metres. */
export function polylineLength(pts: readonly number[]): number {
  let s = 0;
  for (let i = 2; i < pts.length; i += 2) s += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
  return s;
}

/** The polyline again with its points about `spacing` metres apart (its ends kept). */
export function resample(pts: readonly number[], spacing: number): number[] {
  const L = polylineLength(pts), count = Math.max(1, Math.round(L / spacing)), out: number[] = [];
  let seg = 0, segStart = 0, segLen = Math.hypot(pts[2] - pts[0], pts[3] - pts[1]);
  for (let k = 0; k <= count; k++) {
    const d = (k / count) * L;
    while (seg < (pts.length >> 1) - 2 && segStart + segLen < d) {
      segStart += segLen;
      seg++;
      segLen = Math.hypot(pts[seg * 2 + 2] - pts[seg * 2], pts[seg * 2 + 3] - pts[seg * 2 + 1]);
    }
    const t = segLen > 0 ? Math.min(1, (d - segStart) / segLen) : 0;
    out.push(pts[seg * 2] + (pts[seg * 2 + 2] - pts[seg * 2]) * t, pts[seg * 2 + 1] + (pts[seg * 2 + 3] - pts[seg * 2 + 1]) * t);
  }
  return out;
}

/** The same polyline the other way round. */
export function reversed(pts: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = pts.length - 2; i >= 0; i -= 2) out.push(pts[i], pts[i + 1]);
  return out;
}

/** The point of the polyline closest to (x, z): its distance, how far along the line it is (`s`, metres), and where. */
export function closestOnPolyline(pts: readonly number[], x: number, z: number): { d: number; s: number; px: number; pz: number } {
  let best = Infinity, bs = 0, bpx = pts[0], bpz = pts[1], acc = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const ax = pts[i], az = pts[i + 1], dx = pts[i + 2] - ax, dz = pts[i + 3] - az, l2 = dx * dx + dz * dz, L = Math.sqrt(l2);
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
    const px = ax + dx * t, pz = az + dz * t, d = (px - x) ** 2 + (pz - z) ** 2;
    if (d < best) { best = d; bs = acc + L * t; bpx = px; bpz = pz; }
    acc += L;
  }
  return { d: Math.sqrt(best), s: bs, px: bpx, pz: bpz };
}

/** A point `s` metres along the polyline (clamped to its ends), and the unit direction there. */
export function alongPolyline(pts: readonly number[], s: number): [x: number, z: number, dx: number, dz: number] {
  let i = 0, acc = 0;
  const n = pts.length >> 1;
  for (; i < n - 2; i++) {
    const l = Math.hypot(pts[i * 2 + 2] - pts[i * 2], pts[i * 2 + 3] - pts[i * 2 + 1]);
    if (acc + l >= s) break;
    acc += l;
  }
  const dx = pts[i * 2 + 2] - pts[i * 2], dz = pts[i * 2 + 3] - pts[i * 2 + 1], l = Math.hypot(dx, dz) || 1;
  const t = Math.max(0, Math.min(1, (s - acc) / l));
  return [pts[i * 2] + dx * t, pts[i * 2 + 1] + dz * t, dx / l, dz / l];
}

/**
 * Do two boxes in plan overlap (separating axes)? Each is its centre, its unit axis u (its other
 * axis is u turned a right angle) and its half sizes along u and the other axis.
 */
export function boxesOverlap(ax: number, az: number, aux: number, auz: number, ahu: number, ahv: number, bx: number, bz: number, bux: number, buz: number, bhu: number, bhv: number): boolean {
  const dx = bx - ax, dz = bz - az;
  for (const [x, z] of [[aux, auz], [-auz, aux], [bux, buz], [-buz, bux]]) {
    const ra = ahu * Math.abs(aux * x + auz * z) + ahv * Math.abs(-auz * x + aux * z);
    const rb = bhu * Math.abs(bux * x + buz * z) + bhv * Math.abs(-buz * x + bux * z);
    if (Math.abs(dx * x + dz * z) > ra + rb) return false;
  }
  return true;
}
