/**
 * The feral dogs on screen (src/creatures/dogs.ts): a gaunt, rough-coated dog of smooth parts in the
 * solid kind, eyes in the glow kind that throw the headlamp back. Legs, head, jaw and tail are on
 * their own pivots, posed per frame: lying up at the den, a trot, a gallop round you, head low as it
 * circles, down on its haunches before a lunge (the tell), stretched out in the lunge with the jaw
 * open, the snap, the spring back, a jerk when stabbed, and on its side when dead.
 *
 * A fixed pool, built once and added with the Stage before play.
 */
import { FigurePool, placeFigure, type Figure } from './figures';
import { Group, type Object3D } from 'three/webgpu';
import type { Rgb } from '../../gen/propMesh';
import { meshOf as mesh } from '../meshes';
import { GLOW, VERTEX_COLOR_SOLID } from '../materials';
import type { Dog } from '../../creatures/dogs';
import { groundSpeed } from '../../creatures/creature';

/** How many can be drawn at once. */
const POOL = 16;

const COAT: Rgb = [0.2, 0.17, 0.13], DARK: Rgb = [0.09, 0.075, 0.06], PALE: Rgb = [0.3, 0.26, 0.2], NOSE: Rgb = [0.03, 0.025, 0.02], EYE: Rgb = [0.9, 0.75, 0.3];

/** Hips and shoulders (x, y, z), and their phase in the gallop. */
const HIPS: [number, number, number, number][] = [[-0.08, 0.52, -0.3, 0], [0.08, 0.52, -0.3, 0.35], [-0.08, 0.52, 0.25, Math.PI], [0.08, 0.52, 0.25, Math.PI + 0.35]];
const NECK = [0, 0.64, -0.42] as const;

function parts() {
  const body = mesh((b) => {
    b.ellipsoid(0, 0.56, -0.18, 0.14, 0.17, 0.26, COAT, 12); // chest
    b.ellipsoid(0, 0.57, 0.14, 0.12, 0.13, 0.24, COAT, 12); // the tucked-up loin
    b.ellipsoid(0, 0.47, -0.12, 0.09, 0.07, 0.22, PALE, 10); // underside
    b.ellipsoid(0, 0.68, -0.25, 0.09, 0.06, 0.2, DARK, 10); // the darker back, hackles
    b.ellipsoid(0, 0.62, -0.38, 0.08, 0.11, 0.12, COAT, 10, -0.7); // neck
  }, VERTEX_COLOR_SOLID);
  const head = mesh((b) => {
    b.ellipsoid(0, 0, 0, 0.085, 0.085, 0.1, COAT, 10);
    b.ellipsoid(0, -0.015, -0.12, 0.045, 0.045, 0.09, COAT, 10); // muzzle
    b.ellipsoid(0, 0, -0.205, 0.022, 0.018, 0.016, NOSE, 6);
    for (const s of [-1, 1]) b.ellipsoid(s * 0.05, 0.09, 0.02, 0.022, 0.06, 0.012, DARK, 6, -0.2); // ears, pricked
  }, VERTEX_COLOR_SOLID);
  const jaw = mesh((b) => b.ellipsoid(0, -0.015, -0.07, 0.035, 0.016, 0.075, DARK, 8), VERTEX_COLOR_SOLID);
  const eyes = mesh((b) => { for (const s of [-1, 1]) b.ellipsoid(s * 0.042, 0.022, -0.075, 0.012, 0.011, 0.01, EYE, 6); }, GLOW);
  const leg = mesh((b) => {
    b.ellipsoid(0, -0.12, 0, 0.045, 0.13, 0.055, COAT, 8);
    b.ellipsoid(0, -0.35, 0.015, 0.024, 0.13, 0.028, DARK, 6);
    b.ellipsoid(0, -0.49, -0.02, 0.033, 0.02, 0.05, DARK, 6);
  }, VERTEX_COLOR_SOLID);
  const tail = mesh((b) => b.ellipsoid(0, 0, 0.16, 0.03, 0.03, 0.17, COAT, 8), VERTEX_COLOR_SOLID);
  return { body, head, jaw, eyes, leg, tail };
}

/** One drawn dog: a root at its feet (turned by yaw), a body, four legs, a head with a jaw, a tail. */
class DogFigure implements Figure<Dog> {
  readonly root = new Group();
  private readonly body = new Group();
  private readonly head = new Group();
  private readonly jaw: Object3D;
  private readonly tail: Object3D;
  private readonly legs: Object3D[] = [];
  /** How far lying down (0..1), eased. */
  private lie = 0;
  private last = 0;

  constructor(p: ReturnType<typeof parts>) {
    this.root.add(this.body);
    this.body.add(p.body.clone(), this.head);
    this.head.position.set(NECK[0], NECK[1] + 0.08, NECK[2] - 0.1);
    this.head.add(p.head.clone(), p.eyes.clone());
    this.jaw = p.jaw.clone();
    this.jaw.position.set(0, -0.035, -0.04);
    this.head.add(this.jaw);
    for (const [x, y, z] of HIPS) {
      const l = p.leg.clone();
      l.position.set(x, y, z);
      this.body.add(l);
      this.legs.push(l);
    }
    this.tail = p.tail.clone();
    this.tail.position.set(0, 0.62, 0.36);
    this.body.add(this.tail);
  }

  pose(g: Dog, time: number): void {
    const R = this.root, B = this.body, H = this.head;
    placeFigure(R, g);
    B.position.set(0, 0, 0);
    B.rotation.set(0, 0, 0);
    H.rotation.set(0, 0, 0);
    this.jaw.rotation.x = 0;
    const dt = Math.min(0.1, Math.max(0, time - this.last));
    this.last = time;
    if (g.mode === 'dead') {
      // On its side, legs out stiff.
      const k = Math.min(1, g.deadT / 0.4);
      B.rotation.z = (Math.PI / 2) * k;
      B.position.set(-0.45 * k, 0.16 * k, 0);
      this.legs.forEach((l, i) => { l.rotation.set(i < 2 ? -0.3 * k : 0.3 * k, 0, 0); });
      this.tail.rotation.set(0, 0, 0);
      this.jaw.rotation.x = 0.3 * k;
      return;
    }
    const speed = groundSpeed(g), moving = Math.min(1, speed / 2), gallop = Math.min(1, Math.max(0, (speed - 2.5) / 2.5));
    this.lie += ((g.mode === 'rest' && speed < 0.2 ? 1 : 0) - this.lie) * Math.min(1, dt * 3);
    // Trot (diagonal pairs) blending into a gallop (front pair, then hind pair).
    this.legs.forEach((l, i) => {
      const trot = i === 0 || i === 3 ? 0 : Math.PI;
      const ph = trot + (HIPS[i][3] - trot) * gallop;
      l.rotation.set(Math.sin(g.gait + ph) * (0.5 + 0.4 * gallop) * moving, 0, 0);
    });
    B.position.y = Math.abs(Math.sin(g.gait)) * 0.03 * moving;
    B.rotation.x = Math.sin(g.gait) * 0.06 * gallop;
    // Lying up: down on its belly, legs folded under, head on its paws.
    if (this.lie > 0.01) {
      const k = this.lie;
      B.position.y -= 0.36 * k;
      this.legs.forEach((l, i) => { l.rotation.x = l.rotation.x * (1 - k) + (i < 2 ? -1.45 : 1.35) * k; });
      H.rotation.x = -0.35 * k;
    }
    // Head: low as it circles, snarling; it sweeps when it rests.
    let tail = 0.3;
    if (g.mode === 'circle' || g.mode === 'back') { H.rotation.x = -0.35; this.jaw.rotation.x = 0.12 + 0.05 * Math.sin(time * 30 + g.id); tail = -0.2; }
    if (g.mode === 'rest' || g.mode === 'trot') H.rotation.y = Math.sin(time * 0.7 + g.id) * 0.3;
    if (g.mode === 'crouch') {
      // Down on its haunches, head low and level, hind legs loaded: the tell.
      const k = Math.min(1, g.t / 0.15);
      B.position.y -= 0.14 * k;
      B.rotation.x = -0.12 * k;
      this.legs.forEach((l, i) => { l.rotation.x = i < 2 ? -0.35 * k : 0.55 * k; });
      H.rotation.x = -0.15;
      this.jaw.rotation.x = 0.2;
      tail = -0.35;
    }
    if (g.mode === 'lunge') {
      // Stretched out, front legs reaching, jaw wide.
      B.rotation.x = 0.12;
      this.legs.forEach((l, i) => { l.rotation.x = i < 2 ? -1.0 : 0.95; });
      H.rotation.x = 0.1;
      this.jaw.rotation.x = 0.6;
      tail = 0.1;
    }
    if (g.mode === 'back') this.jaw.rotation.x = Math.max(0, 0.6 - g.t * 6); // the snap shut
    // Stabbed: a jerk away.
    const hit = Math.max(0, 1 - g.hurtT / 0.25);
    B.rotation.z += hit * 0.3 * Math.sin(g.id);
    B.position.y += hit * 0.05;
    this.tail.rotation.set(tail, Math.sin(time * (2 + moving * 5) + g.id) * 0.3, 0);
  }
}

export class DogView extends FigurePool<Dog> {
  constructor() {
    const p = parts();
    super('dogs', POOL, () => new DogFigure(p));
  }
}
