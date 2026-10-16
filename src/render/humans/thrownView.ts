/**
 * Things thrown, on screen (src/combat/thrown.ts): grandma's kitchen knife turning end over end in
 * flight, then lying still where it landed until it is gone; a Sunday candle tumbling, then standing
 * where it came down, its flame flickering; a seed of grandma's Snapdragons tumbling, glinting green;
 * a paper bag of her flour tumbling; one of her long matches, lit, turning end over end.
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
const BAGS = 3;
const MATCHES = 3;
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

/** A paper bag of flour, tied at the top. */
function bag(): Group {
  const root = new Group();
  root.add(meshOf((b) => {
    b.upright(0, 0, 0, 0, 0.07, 0.09, 0.05, [0.72, 0.62, 0.45]);
    b.ellipsoid(0, 0.1, 0, 0.035, 0.03, 0.025, [0.68, 0.58, 0.42], 6);
    b.upright(0, 0.035, 0.051, 0, 0.05, 0.03, 0.002, [0.35, 0.3, 0.55]);
  }, VERTEX_COLOR_SOLID));
  return root;
}

/** One of her long matches for the oven, lit: a pale stick with its burning head. */
function match(): Group {
  const root = new Group();
  root.add(meshOf((b) => { b.upright(0, 0, 0, 0, 0.004, 0.004, 0.09, [0.8, 0.68, 0.45]); }, VERTEX_COLOR_SOLID));
  root.add(meshOf((b) => {
    b.ellipsoid(0, 0, -0.094, 0.009, 0.009, 0.012, [0.9, 0.25, 0.1], 6);
    b.ellipsoid(0, 0.01, -0.1, 0.016, 0.024, 0.016, [2.2, 1.2, 0.35], 6);
  }, GLOW));
  return root;
}

export class ThrownView {
  readonly root = new Group();
  private readonly knives: Group[] = [];
  private readonly candles: { root: Group; flame: Object3D }[] = [];
  private readonly seeds: Group[] = [];
  private readonly bags: Group[] = [];
  private readonly matches: Group[] = [];

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
    this.pool(this.seeds, SEEDS, seed, 1);
    this.pool(this.bags, BAGS, bag, SCALE);
    this.pool(this.matches, MATCHES, match, SCALE);
  }

  private pool(list: Group[], n: number, make: () => Group, scale: number): void {
    for (let k = 0; k < n; k++) {
      const g = make();
      g.scale.setScalar(scale);
      g.visible = false;
      list.push(g);
      this.root.add(g);
    }
  }

  /** Pose the newest of `kind` on `list`'s figures (the rest hidden). */
  private show(list: readonly Group[], missiles: readonly Missile[], kind: Missile['kind']): void {
    const of = missiles.filter((m) => m.kind === kind);
    list.forEach((p, k) => {
      const n = of[of.length - 1 - k];
      p.visible = !!n;
      if (n) this.pose(p, n);
    });
  }

  /** Place what is thrown (the newest first, as many as the pools hold) at `time`. */
  arrange(missiles: readonly Missile[], time: number): void {
    const candles = missiles.filter((m) => m.kind === 'candle');
    this.show(this.seeds, missiles, 'seed');
    this.show(this.knives, missiles, 'knife');
    this.show(this.bags, missiles, 'flour');
    this.show(this.matches, missiles, 'match');
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
