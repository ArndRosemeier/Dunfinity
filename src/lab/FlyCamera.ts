/**
 * Free-fly camera for the Level Lab: click to capture the mouse, WASD to move, Space / C up and down,
 * Shift for speed, the wheel scales speed (caverns are hundreds of metres wide).
 */
import { PerspectiveCamera, Vector3 } from 'three/webgpu';

export class FlyCamera {
  yaw = 0;
  pitch = 0;
  speed = 20;
  private keys = new Set<string>();
  private readonly fwd = new Vector3();
  private readonly right = new Vector3();

  constructor(readonly camera: PerspectiveCamera, private readonly el: HTMLElement) {
    el.addEventListener('click', () => el.requestPointerLock?.());
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.el) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - e.movementY * 0.0022));
    });
    el.addEventListener('wheel', (e) => {
      this.speed = Math.max(1, Math.min(400, this.speed * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    }, { passive: true });
  }

  update(dt: number): void {
    const k = this.keys;
    const v = this.speed * (k.has('ShiftLeft') || k.has('ShiftRight') ? 4 : 1) * dt;
    this.fwd.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const p = this.camera.position;
    if (k.has('KeyW')) p.addScaledVector(this.fwd, v);
    if (k.has('KeyS')) p.addScaledVector(this.fwd, -v);
    if (k.has('KeyD')) p.addScaledVector(this.right, v);
    if (k.has('KeyA')) p.addScaledVector(this.right, -v);
    if (k.has('Space')) p.y += v;
    if (k.has('KeyC') || k.has('ControlLeft')) p.y -= v;
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
