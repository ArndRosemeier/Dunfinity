/**
 * Free-fly camera for the Level Lab: click to capture the mouse, WASD to move, Space / C up and down,
 * Shift for speed, the wheel scales speed (caverns are hundreds of metres wide).
 */
import { PerspectiveCamera, Vector3 } from 'three/webgpu';
import type { Controls } from '../input/controls';

export class FlyCamera {
  yaw = 0;
  pitch = 0;
  speed = 20;
  private readonly fwd = new Vector3();
  private readonly right = new Vector3();

  constructor(readonly camera: PerspectiveCamera, private readonly controls: Controls) {}

  update(dt: number): void {
    const c = this.controls;
    const [mx, my] = c.takeLook();
    this.yaw -= mx * 0.0022;
    this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - my * 0.0022));
    const w = c.takeWheel();
    if (w) this.speed = Math.max(1, Math.min(400, this.speed * 1.15 ** -w));
    const v = this.speed * (c.held('ShiftLeft') || c.held('ShiftRight') ? 4 : 1) * dt;
    this.fwd.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const p = this.camera.position;
    if (c.held('KeyW')) p.addScaledVector(this.fwd, v);
    if (c.held('KeyS')) p.addScaledVector(this.fwd, -v);
    if (c.held('KeyD')) p.addScaledVector(this.right, v);
    if (c.held('KeyA')) p.addScaledVector(this.right, -v);
    if (c.held('Space')) p.y += v;
    if (c.held('KeyC') || c.held('ControlLeft')) p.y -= v;
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
