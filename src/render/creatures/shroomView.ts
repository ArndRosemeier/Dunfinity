/**
 * The fungal grotto's mushroom monsters on screen (src/creatures/shrooms.ts), modelled, rigged and
 * animated in Blender from the very shells of its mushroom props (AssetGenerator's `creature.mushroom`:
 * specs `creature_toadstool` and `creature_puffcap`, see src/render/creatures/rigged.ts), so they
 * look just like them until they move.
 *
 * The toadstool, a giant fly agaric: still as a prop while it hides; it shivers, pulls six roots out
 * of the ground and stands up on them, tipping its cap back to show two yellow eyes under the gills;
 * scuttles on its roots, rears back and slams its cap down, sinks back into the ground on its spot,
 * and topples over dead. The puffcap, a tall pale cave mushroom with glowing gills: sways, draws its
 * cap in and swells (the tell), flares it and whips forward to throw its spores, and buckles dead.
 * Their spores: a glowing ball on its arc, then a cloud of motes hanging over the floor.
 *
 * Fixed pools, the figures added with the Stage before play, the spores after.
 */
import { Group, type Object3D } from 'three/webgpu';
import { hash3f } from '@futuremagic/core';
import { GLOW } from '../materials';
import { meshOf } from '../meshes';
import type { Rgb } from '../../gen/propMesh';
import type { Puffcap, Toadstool } from '../../creatures/shrooms';
import { SPORES, type Spores } from '../../creatures/spores';
import { FigurePool } from './figures';
import { Rigged, RiggedFigure, type ClipUse } from './rigged';

/** How many of each can be drawn at once. */
const TOADSTOOLS = 10;
const PUFFCAPS = 8;

/** Metres per Walk cycle at size 1 (AssetGenerator's mushroom_creature/toadstool.py STRIDE, for its 0.8 m stalk). */
const STRIDE = 0.2 / 0.55;

const TOADSTOOL_CLIPS: Record<string, ClipUse> = {
  Rest: { loop: true },
  Stand: { loop: true },
  Walk: { loop: true, stride: STRIDE },
  Wake: { loop: false },
  Settle: { loop: false },
  Slam: { loop: false },
  Die: { loop: false },
};

const PUFFCAP_CLIPS: Record<string, ClipUse> = {
  Rest: { loop: true },
  Puff: { loop: false },
  Die: { loop: false },
};

/** Walking: up past the first speed (m/s at size 1), back below the second. */
const WALKS = [0.25, 0.12] as const;

class ToadstoolFigure extends RiggedFigure<Toadstool> {
  protected clipFor(s: Toadstool): string {
    switch (s.mode) {
      case 'dead': return 'Die';
      case 'hide': return 'Rest';
      case 'wake': return 'Wake';
      case 'settle': return 'Settle';
      case 'slam': return 'Slam';
      default: return this.faster('walk', WALKS) ? 'Walk' : 'Stand';
    }
  }

  protected travelled(s: Toadstool): number {
    return s.walked / s.size;
  }
}

class PuffcapFigure extends RiggedFigure<Puffcap> {
  protected clipFor(p: Puffcap): string {
    return p.mode === 'dead' ? 'Die' : p.mode === 'puff' ? 'Puff' : 'Rest';
  }

  protected travelled(): number {
    return 0;
  }
}

/** Spore balls and clouds drawn at once; motes in a cloud. */
const BALLS = 8;
const CLOUDS = 6;
const MOTES = 14;
const GREEN: Rgb = [0.45, 0.95, 0.55], PALE: Rgb = [0.75, 1, 0.7];

/** The spores: balls in flight and the clouds they burst into. */
class SporeView {
  readonly root = new Group();
  private readonly balls: Object3D[] = [];
  private readonly clouds: Object3D[][] = [];

  constructor() {
    for (let k = 0; k < BALLS; k++) {
      const ball = meshOf((b) => {
        b.ellipsoid(0, 0, 0, 0.11, 0.11, 0.11, PALE, 8);
        for (let m = 0; m < 5; m++) {
          const a = m * 2.4, r = 0.13;
          b.ellipsoid(Math.cos(a) * r, (m - 2) * 0.05, Math.sin(a) * r, 0.04, 0.04, 0.04, GREEN, 5);
        }
      }, GLOW);
      ball.visible = false;
      this.balls.push(ball);
      this.root.add(ball);
    }
    for (let k = 0; k < CLOUDS; k++) {
      const motes: Object3D[] = [];
      for (let m = 0; m < MOTES; m++) {
        const mote = meshOf((b) => b.ellipsoid(0, 0, 0, 0.09, 0.09, 0.09, m % 3 ? GREEN : PALE, 6), GLOW);
        mote.visible = false;
        motes.push(mote);
        this.root.add(mote);
      }
      this.clouds.push(motes);
    }
  }

  draw(s: Spores, time: number): void {
    for (let k = 0; k < BALLS; k++) {
      const b = s.balls[s.balls.length - 1 - k], o = this.balls[k];
      o.visible = !!b;
      if (!b) continue;
      o.position.set(b.x, b.y, b.z);
      o.rotation.set(time * 3, time * 5, 0);
    }
    for (let k = 0; k < CLOUDS; k++) {
      const c = s.clouds[s.clouds.length - 1 - k], motes = this.clouds[k];
      for (let m = 0; m < MOTES; m++) {
        const o = motes[m];
        o.visible = !!c;
        if (!c) continue;
        // Each mote drifts out from the burst and up, swirling, and shrinks away at the end.
        const age = c.t / SPORES.hangs, out = SPORES.radius * (0.25 + 0.75 * Math.sqrt(age)) * (0.4 + 0.6 * hash3f(k, m, 1, 7));
        const a = hash3f(k, m, 2, 7) * Math.PI * 2 + c.t * (0.3 + 0.4 * hash3f(k, m, 3, 7));
        o.position.set(c.x + Math.cos(a) * out, c.y + 0.15 + SPORES.high * 0.6 * hash3f(k, m, 4, 7) * Math.sqrt(age), c.z + Math.sin(a) * out);
        o.scale.setScalar(Math.max(0.05, (1 - age) * (0.7 + 0.8 * hash3f(k, m, 5, 7))));
      }
    }
  }
}

export class ShroomView {
  readonly root = new Group();
  readonly spores = new SporeView();

  private constructor(readonly toadstools: FigurePool<Toadstool>, readonly puffcaps: FigurePool<Puffcap>) {
    this.root.add(toadstools.root, puffcaps.root);
  }

  /** Load the models (before the warm-up, so their materials build with the rest). */
  static async create(): Promise<ShroomView> {
    const [toad, puff] = await Promise.all([Rigged.fetch('toadstool.glb'), Rigged.fetch('puffcap.glb')]);
    return new ShroomView(
      new FigurePool<Toadstool>('toadstools', TOADSTOOLS, () => new ToadstoolFigure(toad, TOADSTOOL_CLIPS)),
      new FigurePool<Puffcap>('puffcaps', PUFFCAPS, () => new PuffcapFigure(puff, PUFFCAP_CLIPS)),
    );
  }
}
