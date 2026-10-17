/**
 * Draw the suns (src/creatures/suns.ts): a boiling ball of the `SUN` kind each, a wide warm halo of
 * the `WISP` kind round it, its prominences (small `SUN` blobs swelling on it) and the burning drops
 * that break off (warm `WISP` halos, flashing as they splash). Fixed pools, added once with the
 * Stage; their light is borrowed from the lamp pool (`LampLights.lend`): no new light, no new shader.
 */
import { Group, type Mesh } from 'three/webgpu';
import { smoothstep } from '@futuremagic/core';
import { SUN as SUN_KIND } from '../materials';
import { meshOf } from '../meshes';
import type { Glow, LampLights } from '../props/lamps';
import { SUN, flareAt, lightOf, sizeOf, type Suns } from '../../creatures/suns';
import { haloOf } from './wispView';

/** The halo's and the drops' warm light (linear rgb), and the sun's light. */
const HALO: readonly [number, number, number] = [1.0, 0.55, 0.2];
const DROP: readonly [number, number, number] = [1.0, 0.62, 0.28];
const LIGHT: readonly [number, number, number] = [1.0, 0.75, 0.45];
/** Prominences (swelling or falling) drawn per sun at most. */
const FLARES = 6;

interface Pool { body: Mesh; halo: Mesh; blobs: Mesh[]; drops: Mesh[]; glow: Glow }

export class SunView {
  readonly root = new Group();
  private readonly pools: Pool[] = [];
  private readonly lit: Glow[] = [];

  constructor(private readonly lamps: LampLights) {
    const ball = meshOf((b) => b.ellipsoid(0, 0, 0, 1, 1, 1, [1, 1, 1], 24), SUN_KIND);
    const blob = meshOf((b) => b.ellipsoid(0, 0, 0, 1, 1, 1, [1, 0.9, 0.8], 10), SUN_KIND);
    const halo = haloOf(HALO), drop = haloOf(DROP);
    const hide = <T extends Mesh>(m: T): T => { m.visible = false; this.root.add(m); return m; };
    for (let i = 0; i < SUN.most; i++) {
      this.pools.push({
        body: hide(ball.clone()), halo: hide(halo.clone()),
        blobs: Array.from({ length: FLARES }, () => hide(blob.clone())),
        drops: Array.from({ length: FLARES }, () => hide(drop.clone())),
        glow: { x: 0, y: 0, z: 0, intensity: 0, reach: 0, color: LIGHT },
      });
    }
  }

  /** Place the suns and lend them their lights (once a frame, before the view's frame); the eye at (ex, ey, ez). */
  draw(suns: Suns, ex: number, ey: number, ez: number): void {
    this.lit.length = 0;
    for (let i = 0; i < this.pools.length; i++) {
      const p = this.pools[i], s = suns.list[i];
      const r = s && s.age < s.life ? sizeOf(s) : 0;
      p.body.visible = p.halo.visible = r > 0.01;
      if (s && r > 0.01) {
        p.body.position.set(s.x, s.y, s.z);
        p.body.scale.setScalar(r);
        // A slow turn, so its boiling face rolls (smooth: never a flicker).
        p.body.rotation.set(0.3 * Math.sin(s.phase * 6.283), s.age * 0.06 + s.phase * 6.283, 0);
        p.halo.position.set(s.x, s.y, s.z);
        // Its glare dims close up (hanging from it, the eye is inside its halo).
        const near = smoothstep(4, 22, Math.hypot(s.x - ex, s.y - ey, s.z - ez));
        p.halo.scale.set(r * 4.5, (1.8 + 0.2 * Math.sin(s.age * 0.9 + s.phase * 9)) * (0.06 + 0.94 * near * near), 1);
        const l = lightOf(s), g = p.glow;
        g.x = s.x; g.y = s.y; g.z = s.z; g.intensity = l.intensity; g.reach = l.reach;
        this.lit.push(g);
      }
      for (let k = 0; k < FLARES; k++) {
        const f = s?.flares[k], blob = p.blobs[k], drop = p.drops[k];
        blob.visible = drop.visible = false;
        if (!s || !f) continue;
        if (f.age < SUN.swell) {
          const at = flareAt(s, f);
          if (at.r < 0.01) continue;
          blob.visible = true;
          blob.position.set(at.x, at.y, at.z);
          blob.scale.setScalar(at.r);
          blob.rotation.set(0, f.age, 0);
        } else {
          // Falling: a burning drop; splashing: a short flash on the floor, gone at once.
          const fr = f.size * s.r;
          const k2 = f.splashed < 0 ? 1 : 1 - f.splashed / SUN.splash;
          const size = f.splashed < 0 ? fr * 1.6 : fr * (2 + 3 * (1 - k2));
          drop.visible = k2 > 0;
          drop.position.set(f.x, f.y, f.z);
          drop.scale.set(size, Math.max(1e-3, (f.splashed < 0 ? 1.4 : 3) * k2 * k2), 1);
        }
      }
    }
    this.lamps.lend('suns', this.lit);
  }
}
