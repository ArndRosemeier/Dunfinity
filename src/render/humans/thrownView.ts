/**
 * Things thrown, on screen (src/combat/thrown.ts): grandma's kitchen knife turning end over end in
 * flight, then lying still where it landed until it is gone; a Sunday candle tumbling, then standing
 * where it came down, its flame flickering; a seed of grandma's Snapdragons tumbling, glinting green.
 *
 * Fixed pools, built once and added with the Stage before play.
 */
import { Group, type Object3D } from 'three/webgpu';
import { kitchenKnife } from './wardrobe';
import { meshOf } from '../meshes';
import { GLOW, VERTEX_COLOR_SOLID } from '../materials';
import type { Missile } from '../../combat/thrown';

/** Knives, candles and seeds drawn at once; turns per second in flight; knives drawn this much larger than life, to be seen in flight. */
const KNIVES = 6;
const CANDLES = 4;
const SEEDS = 3;
const SPIN = 3;
const SCALE = 1.5;

/** A candle standing at the origin: white wax, a black wick and its flame (the flame a child, to flicker). */
function candle(): { root: Group; flame: Object3D } {
  const root = new Group();
  root.add(meshOf((b) => {
    b.cylinder(0, 0.09, 0, 0.03, 0.09, [0.78, 0.75, 0.66], 10);
    b.upright(0, 0.19, 0, 0, 0.003, 0.012, 0.003, [0.05, 0.04, 0.03]);
  }, VERTEX_COLOR_SOLID));
  const flame = meshOf((b) => {
    b.ellipsoid(0, 0.03, 0, 0.018, 0.035, 0.018, [1, 0.62, 0.22], 8);
    b.ellipsoid(0, 0.022, 0, 0.009, 0.018, 0.009, [1, 0.9, 0.6], 6);
  }, GLOW);
  flame.position.y = 0.19;
  root.add(flame);
  return { root, flame };
}

/** A seed, drawn large enough to be seen in flight: a dark husk with a green glint of the salt in it. */
function seed(): Group {
  const root = new Group();
  root.add(meshOf((b) => { b.ellipsoid(0, 0, 0, 0.035, 0.025, 0.05, [0.22, 0.14, 0.07], 8); }, VERTEX_COLOR_SOLID));
  root.add(meshOf((b) => { b.ellipsoid(0, 0.012, -0.012, 0.016, 0.016, 0.022, [0.4, 1.5, 0.5], 6); }, GLOW));
  return root;
}

export class ThrownView {
  readonly root = new Group();
  private readonly knives: Group[] = [];
  private readonly candles: { root: Group; flame: Object3D }[] = [];
  private readonly seeds: Group[] = [];

  constructor() {
    for (let k = 0; k < KNIVES; k++) {
      const pivot = new Group(), knife = kitchenKnife();
      knife.position.y = -0.11; // turn about the middle of the knife, not the fist
      pivot.add(knife);
      pivot.scale.setScalar(SCALE);
      pivot.visible = false;
      this.knives.push(pivot);
      this.root.add(pivot);
    }
    for (let k = 0; k < CANDLES; k++) {
      const c = candle();
      c.root.visible = false;
      this.candles.push(c);
      this.root.add(c.root);
    }
    for (let k = 0; k < SEEDS; k++) {
      const s = seed();
      s.visible = false;
      this.seeds.push(s);
      this.root.add(s);
    }
  }

  /** Place what is thrown (the newest first, as many as the pools hold) at `time`. */
  arrange(missiles: readonly Missile[], time: number): void {
    const knives = missiles.filter((m) => m.kind === 'knife'), candles = missiles.filter((m) => m.kind === 'candle'), seeds = missiles.filter((m) => m.kind === 'seed');
    this.seeds.forEach((p, k) => {
      const n = seeds[seeds.length - 1 - k];
      p.visible = !!n;
      if (n) this.pose(p, n);
    });
    this.knives.forEach((p, k) => {
      const n = knives[knives.length - 1 - k];
      p.visible = !!n;
      if (n) this.pose(p, n);
    });
    this.candles.forEach((c, k) => {
      const n = candles[candles.length - 1 - k];
      c.root.visible = !!n;
      if (!n) return;
      this.pose(c.root, n);
      if (n.landed >= 0) c.root.rotation.set(0, 0, 0);
      c.flame.scale.set(1 + 0.15 * Math.sin(time * 13 + k), 1 + 0.3 * Math.sin(time * 9.3 + k * 2), 1 + 0.15 * Math.cos(time * 11 + k));
    });
  }

  /** Where it is, turning end over end while it flies (as it was when it landed, after). */
  private pose(p: Object3D, n: Missile): void {
    p.position.set(n.x, n.y, n.z);
    if (n.landed < 0) p.rotation.set(n.t * SPIN * Math.PI * 2, Math.atan2(n.vx, n.vz), 0, 'YXZ');
  }
}
