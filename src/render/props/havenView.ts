/**
 * Grandma's salt circle in the round room (CELLAR.circle, the level's `haven`) and the ward she
 * traced round it (src/gen/inscriptions.ts): infused salt glowing faintly on the flagstones, a soft
 * halo spilling round the ring, the whole of it turning very slowly, breathing and shimmering (the
 * `SALT_GLOW` kind). Built once round the circle's middle and added with the Stage; shown on the
 * cellar's level only.
 */
import { Group } from 'three/webgpu';
import { hash3f } from '@futuremagic/core';
import type { Rgb } from '../../gen/propMesh';
import { CELLAR } from '../../gen/cellar';
import { inscribeLettering, inscriptionsAt, letteringOf } from '../../gen/inscriptions';
import type { Level } from '../../gen/level';
import { meshOf as mesh } from '../meshes';
import { SALT_GLOW } from '../materials';

export const HAVEN_LOOK = {
  /** The ring's glow at rest, the halo round it, the ward's (linear rgb, light added: kept low, Arnd wants it subtle). */
  salt: [0.09, 0.17, 0.26] as Rgb,
  halo: [0.02, 0.04, 0.065] as Rgb,
  ward: [0.06, 0.12, 0.19] as Rgb,
  /** How fast it turns, radians a second (once round in about five minutes). */
  turn: 0.02,
  /** Segments round the ring. */
  segments: 64,
} as const;

export class HavenView {
  readonly root = new Group();

  constructor() {
    const L = HAVEN_LOOK, c = CELLAR.circle, n = L.segments, seg = (Math.PI * c.r) / n + 0.01;
    const ring = mesh((b) => {
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2, x = Math.cos(a) * c.r, z = Math.sin(a) * c.r;
        // Uneven, as poured salt is: so its turning shows.
        const v = 0.55 + 0.45 * hash3f(1966, k, 0, 0), tone: Rgb = [L.salt[0] * v, L.salt[1] * v, L.salt[2] * v];
        b.upright(x, 0.006, z, -a, 0.022, 0.004, seg, tone);
        b.upright(x, 0.003, z, -a, 0.1, 0.002, seg, L.halo);
      }
    }, SALT_GLOW);
    const ward = mesh((b) => {
      for (const ins of inscriptionsAt(0)) inscribeLettering(b, { ...ins.place, x: 0, z: 0 } as typeof ins.place, letteringOf(ins), 0.022, 0.008, L.ward);
    }, SALT_GLOW);
    this.root.add(ring, ward);
    this.root.position.set(c.x, 0, c.z);
  }

  /** Show it (on the cellar's level), turned as it is at `now`. */
  draw(level: Level, now: number): void {
    this.root.visible = level.depth === 0;
    this.root.rotation.y = now * HAVEN_LOOK.turn;
  }
}
