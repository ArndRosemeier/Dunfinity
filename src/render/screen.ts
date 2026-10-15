/**
 * Where on screen a world point is (docs/ARCHITECTURE.md): the one way from the world to CSS pixels,
 * for anything drawn over the 3D view (the Tab target's mark).
 */
import { Vector3, type Camera } from 'three';

const p = new Vector3();

/** Where `camera` sees (x, y, z), CSS pixels from the top left of the window; null if behind it or off screen (by more than `margin`, a share of the view). */
export function toScreen(camera: Camera, x: number, y: number, z: number, margin = 0.1): { x: number; y: number } | null {
  p.set(x, y, z).project(camera);
  if (p.z > 1 || Math.abs(p.x) > 1 + margin || Math.abs(p.y) > 1 + margin) return null;
  return { x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight };
}
