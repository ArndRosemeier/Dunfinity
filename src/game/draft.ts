/**
 * The draft: the way down breathes. Near a shaft the player feels cold air coming from its
 * direction, said relative to where the camera looks (pure, so tests run it).
 */

/** A draft is felt this close to a shaft, metres. */
export const DRAFT_RANGE = 600;

const FROM = ['ahead', 'ahead-right', 'the right', 'behind-right', 'behind', 'behind-left', 'the left', 'ahead-left'];

/**
 * Where the air comes from, for a viewer at (x, z) looking along `yaw` (forward is (-sin yaw,
 * -cos yaw)) and a shaft at (sx, sz): a line for the HUD, or null when the shaft is out of range.
 */
export function draftLine(x: number, z: number, yaw: number, sx: number, sz: number): string | null {
  const dx = sx - x, dz = sz - z, d = Math.hypot(dx, dz);
  if (d > DRAFT_RANGE) return null;
  if (d < 12) return 'Cold air rises from the shaft.';
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const a = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz); // 0 ahead, +π/2 right
  return `${d < 150 ? 'A cold draft' : 'A faint draft'} from ${FROM[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]}.`;
}
