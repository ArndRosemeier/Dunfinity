/**
 * Third-person camera (decision D9): orbits a target with the mouse, the wheel zooms in down to first
 * person. It never goes through rock: it pulls in along its ray to the target (level.trace) at once,
 * and eases back out. A target in the rock (a head under a low vault, climbing) is first moved out of it.
 */
import type { PerspectiveCamera } from 'three/webgpu';
import type { Level } from '../../gen/level';

/** Closer than this the camera is in first person. */
const FIRST_PERSON = 0.6;
const MAX_DISTANCE = 12;
/** The target is kept this far out of the rock, metres. */
const CLEAR = 0.25;

export class OrbitCamera {
  yaw = 0;
  pitch = -0.25;
  /** Wanted distance behind the target, metres (0: first person). */
  distance = 4;
  /** Actual distance this frame (shorter where rock is in the way). */
  private current = 4;

  private readonly n: [number, number, number] = [0, 0, 0];

  /** `level`: the rock that pulls the camera in (changes on the way down). */
  constructor(readonly camera: PerspectiveCamera, public level: Level) {}

  get firstPerson(): boolean { return this.current < FIRST_PERSON; }

  /** Mouse movement in pixels, wheel steps (positive zooms out). */
  look(dx: number, dy: number, wheel: number): void {
    this.yaw -= dx * 0.0022;
    this.pitch = Math.max(-1.45, Math.min(1.3, this.pitch - dy * 0.0022));
    if (wheel) {
      const d = this.distance < FIRST_PERSON ? (wheel > 0 ? 1.5 : 0) : this.distance * 1.2 ** wheel;
      this.distance = d < FIRST_PERSON * 1.2 ? 0 : Math.min(MAX_DISTANCE, d);
    }
  }

  /** Place the camera behind the target (x, y, z): an eye or a head. */
  follow(x: number, y: number, z: number, dt: number): void {
    for (let i = 0; i < 3; i++) {
      const d = this.level.sdf(x, y, z);
      if (d >= CLEAR) break;
      const n = this.level.normal(x, y, z, this.n);
      x += n[0] * (CLEAR - d); y += n[1] * (CLEAR - d); z += n[2] * (CLEAR - d);
    }
    const cp = Math.cos(this.pitch);
    const bx = Math.sin(this.yaw) * cp, by = -Math.sin(this.pitch), bz = Math.cos(this.yaw) * cp; // backwards
    const reach = this.distance > 0 ? this.level.trace(x, y, z, bx, by, bz, this.distance, 0.3) : 0;
    this.current = reach < this.current ? reach : this.current + (reach - this.current) * Math.min(1, dt * 4);
    this.camera.position.set(x + bx * this.current, y + by * this.current, z + bz * this.current);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
