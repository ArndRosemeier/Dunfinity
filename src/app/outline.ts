/**
 * Outlines on screen, pure geometry (no DOM): the convex hull of a body's corners, that hull grown
 * out with rounded corners, and an outline resampled evenly with each point's outward normal.
 * Grandma's Salt Sight draws its auras along them (src/app/saltSight.ts).
 */

/** The convex hull of `pts` (Andrew's monotone chain), anticlockwise on screen. */
export function hull(pts: readonly (readonly [number, number])[]): [number, number][] {
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (s.length < 3) return s.map((q) => [q[0], q[1]]);
  const cross = (o: readonly number[], a: readonly number[], b: readonly number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [], upper: [number, number][] = [];
  for (const q of s) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push([q[0], q[1]]); }
  for (let i = s.length - 1; i >= 0; i--) { const q = s[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push([q[0], q[1]]); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** A convex outline (`hull`) grown out by `pad`: each edge pushed out, each corner an arc. */
export function rounded(shape: readonly (readonly [number, number])[], pad: number): [number, number][] {
  const n = shape.length, out: [number, number][] = [];
  let cx = 0, cy = 0;
  for (const [x, y] of shape) { cx += x / n; cy += y / n; }
  // Each edge's outward normal, as an angle (the side away from the middle).
  const outward = (i: number) => {
    const [ax, ay] = shape[i], [bx, by] = shape[(i + 1) % n];
    let a = Math.atan2(bx - ax, -(by - ay));
    if (Math.cos(a) * ((ax + bx) / 2 - cx) + Math.sin(a) * ((ay + by) / 2 - cy) < 0) a += Math.PI;
    return a;
  };
  for (let i = 0; i < n; i++) {
    const a0 = outward((i + n - 1) % n), a1 = outward(i), turn = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0));
    const steps = Math.max(1, Math.ceil(Math.abs(turn) / 0.3));
    for (let k = 0; k <= steps; k++) {
      const a = a0 + (turn * k) / steps;
      out.push([shape[i][0] + Math.cos(a) * pad, shape[i][1] + Math.sin(a) * pad]);
    }
  }
  return out;
}

/** A point of an outline: where it is, its outward normal, and how far round the outline it is (0..1). */
export interface Edge { x: number; y: number; nx: number; ny: number; u: number }

/** A closed outline resampled every `step` px, each point with its outward normal (anticlockwise or not). */
export function along(shape: readonly (readonly [number, number])[], step: number): Edge[] {
  const n = shape.length, len: number[] = [0];
  for (let i = 0; i < n; i++) { const [ax, ay] = shape[i], [bx, by] = shape[(i + 1) % n]; len.push(len[i] + Math.hypot(bx - ax, by - ay)); }
  const total = len[n], m = Math.max(24, Math.round(total / step)), pts: [number, number][] = [];
  if (!(total > 0)) return [];
  for (let k = 0, i = 0; k < m; k++) {
    const d = (k / m) * total;
    while (len[i + 1] < d) i++;
    const [ax, ay] = shape[i], [bx, by] = shape[(i + 1) % n], f = (d - len[i]) / (len[i + 1] - len[i] || 1);
    pts.push([ax + (bx - ax) * f, ay + (by - ay) * f]);
  }
  let area = 0;
  for (let i = 0; i < m; i++) { const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % m]; area += ax * by - bx * ay; }
  const turn = area > 0 ? 1 : -1;
  return pts.map(([x, y], i) => {
    const [px, py] = pts[(i + m - 1) % m], [qx, qy] = pts[(i + 1) % m], tx = qx - px, ty = qy - py, l = Math.hypot(tx, ty) || 1;
    return { x, y, nx: (turn * ty) / l, ny: (-turn * tx) / l, u: i / m };
  });
}
