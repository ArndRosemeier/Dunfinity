/**
 * The draft: the way down breathes. Near a shaft the player feels cold air coming from its
 * direction, said relative to where the camera looks (pure, so tests run it). Out in the village
 * there is no draft to feel; there the line says which way grandma's house is.
 */

/** A draft is felt this close to a shaft, metres. */
export const DRAFT_RANGE = 600;

const FROM = ['ahead', 'ahead-right', 'the right', 'behind-right', 'behind', 'behind-left', 'the left', 'ahead-left'];
const TO = ['ahead', 'ahead to the right', 'to the right', 'behind you to the right', 'behind you', 'behind you to the left', 'to the left', 'ahead to the left'];

/**
 * Which of eight ways (0 ahead, 2 right, 4 behind, 6 left) the point (tx, tz) lies, for a viewer at
 * (x, z) looking along `yaw` (forward is (-sin yaw, -cos yaw)).
 */
function octant(x: number, z: number, yaw: number, tx: number, tz: number): number {
  const dx = tx - x, dz = tz - z;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const a = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz); // 0 ahead, +π/2 right
  return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
}

/**
 * Where the air comes from, for a viewer at (x, z) looking along `yaw` and a shaft at (sx, sz): a
 * line for the HUD, or null when the shaft is out of range.
 */
export function draftLine(x: number, z: number, yaw: number, sx: number, sz: number): string | null {
  const d = Math.hypot(sx - x, sz - z);
  if (d > DRAFT_RANGE) return null;
  if (d < 12) return 'Cold air rises from the shaft.';
  return `${d < 150 ? 'A cold draft' : 'A faint draft'} from ${FROM[octant(x, z, yaw, sx, sz)]}.`;
}

/** Closer than this (m) to her door one sees it; no line. */
const HOME_NEAR = 6;

/**
 * Which way grandma's house is, out in the village, for a viewer at (x, z) looking along `yaw`
 * and her front door at (hx, hz): a line for the HUD, or null at her door.
 */
export function homeLine(x: number, z: number, yaw: number, hx: number, hz: number): string | null {
  const d = Math.hypot(hx - x, hz - z);
  if (d < HOME_NEAR) return null;
  return `Grandma's house is ${TO[octant(x, z, yaw, hx, hz)]}${d > 120 ? ', a long way off' : ''}.`;
}
