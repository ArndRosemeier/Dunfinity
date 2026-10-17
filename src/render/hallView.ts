/**
 * Draw the hall between worlds (src/world/hall.ts) while one walks it: one quad over the whole
 * screen of the `HALL` kind, added once with the Stage, drawn after everything else; where one
 * stands in it, its world's colours and how bright its doorway is go to the shader (`HALL_STATE`).
 */
import { HALL as HALL_KIND, HALL_STATE } from './materials';
import { tintHall, windowQuad } from './thinView';
import { RIM } from './wayView';
import { HALL, type Crossing } from '../world/hall';

export class HallView {
  readonly mesh = windowQuad(HALL_KIND, 'hall between worlds');

  constructor() {
    this.mesh.renderOrder = 1e6;
  }

  /** Once a frame: show crossing `c` (null: none). */
  draw(c: Crossing | null): void {
    this.mesh.visible = !!c && c.shown > 0;
    if (!c) return;
    const g = c.look;
    HALL_STATE.eye.value.set(c.x, HALL.eye, c.z, c.yaw);
    // The doorway: dim and far while that world is not ready, then bright.
    HALL_STATE.look.value.set(g.bay, Math.min(g.height, 4.5), c.length, c.open ? 1.4 + 0.3 * Math.sin(c.age * 3) : 0.35);
    tintHall(HALL_STATE, g);
    HALL_STATE.rim.value.set(...RIM[c.up ? 'home' : 'down']);
    HALL_STATE.shown.value = c.shown;
  }
}
