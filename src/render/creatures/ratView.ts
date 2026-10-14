/**
 * The rats on screen (src/creatures/rats.ts): a fat-bodied quarry rat of smooth parts in the solid
 * kind, with eyes in the glow kind that catch the light in the dark. Legs and tail are their own
 * meshes on pivots, posed per frame: a trot, a sniff, the wind-up and snap of a bite, the jerk of a
 * blow, and rolled onto its back when dead.
 *
 * A fixed pool of rats, built once and added with the Stage before play (the kinds are compiled in
 * the warm-up), so nothing is compiled or added to the scene later.
 */
import { Group, type Object3D } from 'three/webgpu';
import type { Rgb } from '../../gen/propMesh';
import { meshOf as mesh } from '../meshes';
import { GLOW, VERTEX_COLOR_SOLID } from '../materials';
import { RAT, type Rat } from '../../creatures/rats';

/** How many rats can be drawn at once. */
const POOL = 36;

const FUR: Rgb = [0.1, 0.078, 0.06], BELLY: Rgb = [0.2, 0.165, 0.13], PINK: Rgb = [0.42, 0.2, 0.18], TOOTH: Rgb = [0.55, 0.45, 0.2];
const EYE: Rgb = [1.0, 0.28, 0.1];

/** Hips of the legs (x, y, z): front left, front right, back left, back right; and their trot phase. */
const HIPS: [number, number, number, number][] = [[-0.06, 0.12, -0.11, 0], [0.06, 0.12, -0.11, Math.PI], [-0.075, 0.12, 0.13, Math.PI], [0.075, 0.12, 0.13, 0]];
const TAIL = { base: [0, 0.13, 0.22] as const, segments: 4, length: 0.1 };

/** The parts one rat is made of, built once and shared (geometry and material) by every rat. */
function parts() {
  const body = mesh((b) => {
    b.ellipsoid(0, 0.15, 0.04, 0.1, 0.095, 0.17, FUR, 12);
    b.ellipsoid(0, 0.15, 0.13, 0.115, 0.1, 0.11, FUR, 12);
    b.ellipsoid(0, 0.14, -0.1, 0.085, 0.085, 0.1, FUR, 10);
    b.ellipsoid(0, 0.105, 0.03, 0.08, 0.055, 0.15, BELLY, 10);
    b.ellipsoid(0, 0.15, -0.21, 0.062, 0.06, 0.088, FUR, 10, 0.25);
    b.ellipsoid(0, 0.13, -0.29, 0.033, 0.035, 0.06, FUR, 8, 0.3);
    b.ellipsoid(0, 0.122, -0.345, 0.013, 0.012, 0.012, PINK, 6);
    b.upright(0, 0.1, -0.328, 0, 0.008, 0.012, 0.004, TOOTH);
    for (const s of [-1, 1]) b.ellipsoid(s * 0.045, 0.215, -0.19, 0.03, 0.033, 0.009, PINK, 8);
  }, VERTEX_COLOR_SOLID);
  const eyes = mesh((b) => { for (const s of [-1, 1]) b.ellipsoid(s * 0.04, 0.172, -0.255, 0.012, 0.012, 0.012, EYE, 6); }, GLOW);
  const front = mesh((b) => {
    b.ellipsoid(0, -0.045, 0, 0.026, 0.055, 0.032, FUR, 8);
    b.ellipsoid(0, -0.108, -0.016, 0.02, 0.011, 0.03, PINK, 6);
  }, VERTEX_COLOR_SOLID);
  const back = mesh((b) => {
    b.ellipsoid(0, -0.035, 0.01, 0.036, 0.06, 0.05, FUR, 8);
    b.ellipsoid(0, -0.108, -0.02, 0.022, 0.011, 0.04, PINK, 6);
  }, VERTEX_COLOR_SOLID);
  const tail = Array.from({ length: TAIL.segments }, (_, k) => {
    const r = 0.016 * (1 - k / (TAIL.segments + 0.5));
    return mesh((b) => b.ellipsoid(0, 0, TAIL.length / 2, r, r, TAIL.length / 2 + r * 0.5, PINK, 6), VERTEX_COLOR_SOLID);
  });
  return { body, eyes, front, back, tail };
}

/** One drawn rat: a root at its feet (turned by yaw), a body that bobs and lunges, legs, a tail. */
class RatFigure {
  readonly root = new Group();
  readonly body = new Group();
  readonly legs: Object3D[] = [];
  readonly tail: Object3D[] = [];

  constructor(p: ReturnType<typeof parts>) {
    this.root.add(this.body);
    this.body.add(p.body.clone(), p.eyes.clone());
    HIPS.forEach(([x, y, z], i) => {
      const leg = (i < 2 ? p.front : p.back).clone();
      leg.position.set(x, y, z);
      this.body.add(leg);
      this.legs.push(leg);
    });
    let parent: Object3D = this.body;
    p.tail.forEach((seg, k) => {
      const s = seg.clone();
      if (k === 0) s.position.set(TAIL.base[0], TAIL.base[1], TAIL.base[2]);
      else s.position.set(0, 0, TAIL.length);
      parent.add(s);
      this.tail.push(s);
      parent = s;
    });
  }

  pose(r: Rat, time: number): void {
    const R = this.root, B = this.body;
    R.visible = true;
    R.position.set(r.x, r.y, r.z);
    R.rotation.y = r.yaw;
    R.scale.setScalar(r.size);
    const speed = Math.hypot(r.vx, r.vz);
    const moving = Math.min(1, speed / 1.5);
    const g = r.gait;
    B.position.set(0, Math.abs(Math.sin(g)) * 0.012 * moving, 0);
    B.rotation.set(0, 0, 0);
    if (r.mode === 'dead') {
      // Rolled onto its back, legs curled up.
      const k = Math.min(1, r.deadT / 0.35);
      B.rotation.z = Math.PI * k * k;
      B.position.y = 0.24 * k;
      for (const leg of this.legs) leg.rotation.x = -1.1 * k;
      this.tail.forEach((s, i) => { s.rotation.set(0.15, 0.2 * (i % 2 ? 1 : -1), 0); });
      return;
    }
    // Trot: diagonal pairs together.
    this.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(g + HIPS[i][3]) * 0.75 * moving; });
    // Sniffing: the nose works, the body sways; a bite winds up (nose up, back) then snaps forward.
    let pitch = 0, lunge = 0;
    if (r.mode === 'sniff') pitch = Math.sin(time * 9 + r.id) * 0.04 + 0.05;
    if (r.mode === 'bite') {
      const t = r.biteT;
      pitch = t < RAT.windup ? -0.35 * (t / RAT.windup) : 0.25 * Math.max(0, 1 - (t - RAT.windup) / 0.3);
      lunge = t < RAT.windup ? 0.05 * (t / RAT.windup) : -0.1 * Math.max(0, 1 - (t - RAT.windup) / 0.3);
    }
    // Hit: a jerk up and back.
    const hit = Math.max(0, 1 - r.hurtT / 0.25);
    B.rotation.x = pitch + hit * -0.4;
    B.position.z = lunge + hit * 0.06;
    B.position.y += hit * 0.05;
    this.tail.forEach((s, i) => {
      s.rotation.y = Math.sin(time * (3 + moving * 6) + r.id - i * 0.8) * (0.18 + 0.12 * moving);
      s.rotation.x = i === 0 ? 0.25 - moving * 0.15 : 0.08;
    });
  }
}

export class RatView {
  /** Put into the scene once (Stage.add), after the warm-up. */
  readonly root = new Group();
  private readonly figures: RatFigure[] = [];

  constructor() {
    this.root.name = 'rats';
    const p = parts();
    for (let k = 0; k < POOL; k++) {
      const f = new RatFigure(p);
      this.figures.push(f);
      this.root.add(f.root);
    }
  }

  /** Pose the pool after the rats; the rest is hidden. */
  draw(rats: readonly Rat[], time: number): void {
    let k = 0;
    for (const r of rats) if (k < POOL) this.figures[k++].pose(r, time);
    for (; k < POOL; k++) this.figures[k].root.visible = false;
  }
}
