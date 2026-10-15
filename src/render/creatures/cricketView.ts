/**
 * The cave crickets on screen (src/creatures/crickets.ts): a pale, humped, dog-sized cricket of
 * smooth parts in the solid kind, with great folded hind legs and feelers longer than its body. On
 * the rock it clings head down, feelers sweeping. Every move shows: it sinks onto its hind legs
 * before a leap (the tell), flies with them stretched out behind, hops on the floor, rears and
 * snaps in a bite, jerks when stabbed, and lies on its back, legs curled, when dead.
 *
 * A fixed pool, built once and added with the Stage before play.
 */
import { FigurePool, placeFigure, type Figure } from './figures';
import { Group, Matrix4, Vector3, type Object3D } from 'three/webgpu';
import type { Rgb } from '../../gen/propMesh';
import { meshOf as mesh } from '../meshes';
import { GLOW, VERTEX_COLOR_SOLID } from '../materials';
import { CRICKET, type Cricket } from '../../creatures/crickets';
import { groundSpeed } from '../../creatures/creature';

/** How many can be drawn at once. */
const POOL = 24;

const SHELL: Rgb = [0.5, 0.44, 0.34], BAND: Rgb = [0.3, 0.25, 0.18], LEG: Rgb = [0.45, 0.39, 0.3], EYE: Rgb = [0.35, 0.12, 0.05];

/** Hips of the four small legs (x, y, z) and their step phase; the hind legs' hips. */
const SMALL: [number, number, number, number][] = [[-0.07, 0.17, -0.12, 0], [0.07, 0.17, -0.12, Math.PI], [-0.08, 0.16, 0.0, Math.PI], [0.08, 0.16, 0.0, 0]];
const HIND: [number, number, number] = [0.09, 0.2, 0.1];

function parts() {
  const body = mesh((b) => {
    b.ellipsoid(0, 0.24, 0.16, 0.13, 0.13, 0.2, SHELL, 12); // the humped abdomen
    for (const z of [0.06, 0.16, 0.26]) b.ellipsoid(0, 0.25 + (z === 0.16 ? 0.02 : 0), z, 0.125, 0.12, 0.018, BAND, 12);
    b.ellipsoid(0, 0.22, -0.04, 0.1, 0.1, 0.1, SHELL, 10); // thorax
    b.ellipsoid(0, 0.2, -0.16, 0.075, 0.085, 0.07, SHELL, 10, 0.4); // head, bent down
    b.ellipsoid(0, 0.13, -0.2, 0.03, 0.03, 0.03, BAND, 6); // mouthparts
    b.upright(0, 0.27, 0.36, 0, 0.012, 0.012, 0.06, BAND); // cerci
  }, VERTEX_COLOR_SOLID);
  const eyes = mesh((b) => { for (const s of [-1, 1]) b.ellipsoid(s * 0.055, 0.23, -0.18, 0.016, 0.02, 0.016, EYE, 6); }, GLOW);
  const feeler = mesh((b) => b.beam(0, 0, 0, 0, 0.25, -0.75, 0.005, 0.005, LEG), VERTEX_COLOR_SOLID);
  const small = [-1, 1].map((s) => mesh((b) => { b.beam(0, 0, 0, s * 0.05, -0.08, 0, 0.012, 0.012, LEG); b.beam(s * 0.05, -0.08, 0, s * 0.07, -0.17, -0.02, 0.009, 0.009, LEG); }, VERTEX_COLOR_SOLID));
  const femur = mesh((b) => b.ellipsoid(0, 0.1, 0.1, 0.035, 0.045, 0.16, LEG, 8, -0.6), VERTEX_COLOR_SOLID);
  const tibia = mesh((b) => b.beam(0, 0, 0, 0, -0.03, 0.34, 0.01, 0.01, LEG), VERTEX_COLOR_SOLID);
  return { body, eyes, feeler, small, femur, tibia };
}

const _m = new Matrix4(), _x = new Vector3(), _y = new Vector3(), _z = new Vector3(), _f = new Vector3();

/** One drawn cricket: a root at its feet (oriented to the surface it is on), a body, six legs, two feelers. */
class CricketFigure implements Figure<Cricket> {
  readonly root = new Group();
  readonly body = new Group();
  readonly small: Object3D[] = [];
  readonly hind: Group[] = [];
  readonly knees: Group[] = [];
  readonly feelers: Object3D[] = [];

  constructor(p: ReturnType<typeof parts>) {
    this.root.add(this.body);
    this.body.add(p.body.clone(), p.eyes.clone());
    for (const [x, y, z] of SMALL) {
      const leg = p.small[x < 0 ? 0 : 1].clone();
      leg.position.set(x, y, z);
      this.body.add(leg);
      this.small.push(leg);
    }
    for (const s of [-1, 1]) {
      const hip = new Group(), knee = new Group();
      hip.position.set(s * HIND[0], HIND[1], HIND[2]);
      hip.add(p.femur.clone(), knee);
      knee.position.set(0, 0.2, 0.24);
      knee.add(p.tibia.clone());
      this.body.add(hip);
      this.hind.push(hip);
      this.knees.push(knee);
      const f = p.feeler.clone();
      f.position.set(s * 0.03, 0.25, -0.2);
      f.rotation.y = s * 0.25;
      this.body.add(f);
      this.feelers.push(f);
    }
  }

  pose(c: Cricket, time: number): void {
    const R = this.root, B = this.body;
    placeFigure(R, c, null);
    // Orientation: up off the surface it is on; forward along its yaw, or head down on a wall.
    _y.set(c.up[0], c.up[1], c.up[2]).normalize();
    if (_y.y > 0.7) _f.set(-Math.sin(c.yaw), 0, -Math.cos(c.yaw));
    else _f.set(0, -1, 0);
    _f.addScaledVector(_y, -_f.dot(_y)).normalize();
    _z.copy(_f).negate();
    _x.crossVectors(_y, _z).normalize();
    R.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
    B.position.set(0, 0, 0);
    B.rotation.set(0, 0, 0);
    const moving = Math.min(1, groundSpeed(c) / 1.5);
    if (c.mode === 'dead') {
      // On its back, legs curled.
      const k = Math.min(1, c.deadT / 0.35);
      B.rotation.z = Math.PI * k * k;
      B.position.y = 0.45 * k;
      for (const l of this.small) l.rotation.x = -1 * k;
      for (const h of this.hind) h.rotation.x = 0.6 * k;
      return;
    }
    // Hind legs: folded (rest), sunk lower (crouch), stretched out behind (leap).
    let fold = 0, sink = 0, stretch = 0;
    if (c.mode === 'crouch') sink = Math.min(1, (CRICKET.crouch - c.t) / 0.15);
    if (c.mode === 'leap') stretch = 1;
    B.position.y = -0.07 * sink + Math.abs(Math.sin(c.gait)) * 0.05 * moving;
    B.rotation.x = 0.15 * sink - 0.2 * stretch;
    fold = 0.35 * sink - 0.9 * stretch;
    this.hind.forEach((h) => { h.rotation.x = fold + Math.sin(c.gait) * 0.3 * moving; });
    this.knees.forEach((k) => { k.rotation.x = -0.5 * sink + 1.3 * stretch; });
    this.small.forEach((l, i) => { l.rotation.x = Math.sin(c.gait * 2 + SMALL[i][3]) * 0.6 * moving - 0.5 * stretch; });
    // A bite: rear back, then snap forward.
    if (c.mode === 'bite') {
      const t = c.biteT, w = Math.min(1, t / CRICKET.windup), s = t < CRICKET.windup ? 0 : Math.max(0, 1 - (t - CRICKET.windup) / 0.3);
      if (t < CRICKET.windup) { B.rotation.x = 0.35 * w; B.position.z = 0.05 * w; } else { B.rotation.x = -0.25 * s; B.position.z = -0.12 * s; }
    }
    // Stabbed: a jerk.
    const hit = Math.max(0, 1 - c.hurtT / 0.25);
    B.rotation.z += hit * 0.4 * Math.sin(c.id);
    B.position.y += hit * 0.06;
    // Feelers sweep, quicker when it is after you.
    const sweep = c.angry ? 7 : 2.5;
    this.feelers.forEach((f, i) => {
      f.rotation.x = Math.sin(time * sweep + c.id + i * 1.7) * 0.25;
      f.rotation.y = (i ? 1 : -1) * (0.25 + 0.15 * Math.sin(time * sweep * 0.7 + c.id * 2 + i));
    });
  }
}

export class CricketView extends FigurePool<Cricket> {
  constructor() {
    const p = parts();
    super('crickets', POOL, () => new CricketFigure(p));
  }
}
