/**
 * Draw the wisps (src/creatures/wisps.ts): a halo of the `WISP` kind each (a fixed pool, added once
 * with the Stage), and their light, borrowed from the lamp pool (`LampLights.glows`): no new light,
 * no new shader.
 */
import { Group, type Mesh } from 'three/webgpu';
import { WISP as WISP_KIND, WISP_TINT } from '../materials';
import { meshFromData } from '../meshes';
import type { Glow, LampLights } from '../props/lamps';
import { WISP, shine, type Wisps } from '../../creatures/wisps';

export class WispView {
  readonly root = new Group();
  private readonly halos: Mesh[] = [];
  private readonly glows: Glow[] = [];
  private readonly lit: Glow[] = [];

  constructor(private readonly lamps: LampLights) {
    const proto = meshFromData({
      positions: new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
      colors: new Float32Array(12).fill(1),
      indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    }, WISP_KIND);
    proto.name = 'wisp';
    proto.matrixAutoUpdate = true; // moved every frame (meshFromData makes static meshes)
    for (let i = 0; i < WISP.most; i++) {
      const m = proto.clone();
      m.visible = false;
      this.root.add(m);
      this.halos.push(m);
      this.glows.push({ x: 0, y: 0, z: 0, intensity: 0, reach: 0, color: [1, 1, 1] });
    }
  }

  /** Place the halos and lend the wisps their lights (once a frame, before the view's frame). */
  draw(wisps: Wisps): void {
    WISP_TINT.value.set(...wisps.color);
    this.lit.length = 0;
    for (let i = 0; i < this.halos.length; i++) {
      const m = this.halos[i], w = wisps.list[i];
      const s = w ? shine(w) : null;
      m.visible = !!s && s.size > 0;
      if (!w || !s || !m.visible) continue;
      m.position.set(w.x, w.y, w.z);
      m.scale.set(s.size, Math.max(1e-3, s.bright), 1);
      const g = this.glows[i];
      g.x = w.x; g.y = w.y; g.z = w.z; g.intensity = s.light; g.reach = s.reach; g.color = wisps.color;
      this.lit.push(g);
    }
    this.lamps.glows = this.lit;
  }
}
