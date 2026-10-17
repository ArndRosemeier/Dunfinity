/**
 * Draw Way Home's window (src/world/wayHome.ts): one quad of the `WAY` kind, added once with the
 * Stage, placed, turned and sized to it; how open it is, the hall's colours and the picture seen
 * through it go to the shader (`WAY_STATE`). Grandma's room is an image shipped with the game; the
 * place one left is copied from the screen (`LevelView.capture` into `WAY_PICTURES.back`).
 */
import { ImageLoader } from 'three/webgpu';
import { tintHall, windowQuad } from './thinView';
import { WAY as WAY_KIND, WAY_PICTURES, WAY_STATE } from './materials';
import { WAY, wayOpen, type WayDoor } from '../world/wayHome';

/** Rim colours: the veins' green leading up (home), their blue leading down (the hall between worlds' too). */
export const RIM: Record<'home' | 'down', [number, number, number]> = { home: [0.35, 0.9, 0.55], down: [0.3, 0.6, 1.0] };

/** Where the picture is looked at from (m before the window) and laid (m behind it). */
const PICTURE = { eye: 1.6, behind: 0.6 } as const;

export class WayView {
  readonly mesh = windowQuad(WAY_KIND, 'way home');

  constructor() {
    new ImageLoader().load(`${import.meta.env.BASE_URL}portal/home.jpg`, (img) => {
      WAY_PICTURES.home.image = img;
      WAY_PICTURES.home.needsUpdate = true;
    });
  }

  /** Once a frame: show door `w` (null: none). */
  draw(w: WayDoor | null): void {
    this.mesh.visible = !!w;
    if (!w) return;
    const g = w.glimpse, s = w.shot, up = w.picture === 'home';
    this.mesh.position.set(w.x, w.y, w.z);
    this.mesh.rotation.set(0, w.yaw, 0);
    this.mesh.scale.set(WAY.half[0], WAY.half[1], 1);
    WAY_STATE.open.value.set(wayOpen(w.age), w.age, g.bay, Math.min(g.height, 3.2));
    WAY_STATE.floor.value = -WAY.over;
    tintHall(WAY_STATE, g);
    WAY_STATE.rim.value.set(...(up ? RIM.home : RIM.down));
    // The picture: laid just behind the window and seen from close before it, so its whole height
    // shows (the middle of its width) and it shifts only a little as one moves.
    WAY_STATE.pic.value.set(w.picture ? 1 : 0, w.picture === 'back' ? 1 : 0, s.tan, s.aspect);
    WAY_STATE.eye.value.set(0, PICTURE.eye, 0, PICTURE.behind);
  }
}
