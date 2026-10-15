/**
 * The brine eels on screen (src/creatures/eels.ts): a long, pale, slimy body of tapering segments
 * laid along the chain the sim keeps, swimming in a wave that runs down it, and a blunt head with
 * a jaw and milky eyes that catch the light. It rears its head out of the water (the tell), gapes
 * and strikes, thrashes when stabbed, and floats belly up when dead.
 *
 * A fixed pool, built once and added with the Stage before play.
 */
import { FigurePool, type Figure } from './figures';
import { Group, type Object3D } from 'three/webgpu';
import type { Rgb } from '../../gen/propMesh';
import { meshOf as mesh } from '../meshes';
import { GLOW, VERTEX_COLOR_SOLID } from '../materials';
import { EEL, type Eel } from '../../creatures/eels';

/** How many can be drawn at once. */
const POOL = 12;

const SKIN: Rgb = [0.36, 0.38, 0.32], BACK: Rgb = [0.2, 0.22, 0.18], BELLY: Rgb = [0.55, 0.55, 0.47], MOUTH: Rgb = [0.3, 0.1, 0.1], EYE: Rgb = [0.75, 0.8, 0.7];

/** Radius of segment k (the head end is 0). */
const thick = (k: number) => 0.13 * (1 - (k / EEL.segments) * 0.75);

function parts() {
  const half = EEL.link * 0.62;
  const segs = Array.from({ length: EEL.segments }, (_, k) => mesh((b) => {
    const r = thick(k);
    b.ellipsoid(0, 0, 0, r, r * 0.9, half, SKIN, 10);
    b.ellipsoid(0, r * 0.35, 0, r * 0.7, r * 0.6, half * 0.95, BACK, 8);
    b.ellipsoid(0, -r * 0.4, 0, r * 0.75, r * 0.5, half * 0.9, BELLY, 8);
    if (k === EEL.segments - 1) b.ellipsoid(0, 0.02, half, 0.01, r * 1.4, half * 1.2, BACK, 6); // the tail fin
  }, VERTEX_COLOR_SOLID));
  const head = mesh((b) => {
    b.ellipsoid(0, 0.01, -0.06, 0.1, 0.085, 0.14, SKIN, 10);
    b.ellipsoid(0, 0.05, -0.05, 0.07, 0.05, 0.12, BACK, 8);
    b.ellipsoid(0, -0.025, -0.13, 0.06, 0.03, 0.08, MOUTH, 8);
  }, VERTEX_COLOR_SOLID);
  const jaw = mesh((b) => b.ellipsoid(0, -0.02, -0.08, 0.07, 0.025, 0.11, BELLY, 8), VERTEX_COLOR_SOLID);
  const eyes = mesh((b) => { for (const s of [-1, 1]) b.ellipsoid(s * 0.065, 0.04, -0.11, 0.018, 0.018, 0.018, EYE, 6); }, GLOW);
  return { segs, head, jaw, eyes };
}

class EelFigure implements Figure<Eel> {
  readonly root = new Group();
  private readonly segs: Object3D[] = [];
  private readonly head = new Group();
  private readonly jaw: Object3D;

  constructor(p: ReturnType<typeof parts>) {
    for (const s of p.segs) { const o = s.clone(); this.root.add(o); this.segs.push(o); }
    this.head.add(p.head.clone(), p.eyes.clone());
    this.jaw = p.jaw.clone();
    this.jaw.position.set(0, -0.03, -0.02);
    this.head.add(this.jaw);
    this.head.scale.setScalar(1.3);
    this.root.add(this.head);
  }

  pose(e: Eel, time: number): void {
    this.root.visible = true;
    const c = e.chain, n = EEL.segments, dead = e.mode === 'dead';
    // The swimming wave runs down the body, faster when it hurries; a thrash when stabbed.
    const hit = Math.max(0, 1 - e.hurtT / 0.4);
    const wave = (dead ? 0.02 : 0.08 + 0.05 * Math.min(1, e.speed / 2)) + hit * 0.15;
    const roll = dead ? Math.PI * Math.min(1, e.deadT / 0.6) : 0;
    for (let k = 0; k < n; k++) {
      const i = k * 3, j = Math.max(0, k - 1) * 3;
      // Facing along the body towards the head (the head faces along the eel's heading).
      let fx = c[j] - c[i], fy = c[j + 1] - c[i + 1], fz = c[j + 2] - c[i + 2];
      if (k === 0) { fx = -Math.sin(e.yaw); fy = 0; fz = -Math.cos(e.yaw); }
      const h = Math.hypot(fx, fz) || 1, yaw = Math.atan2(-fx, -fz), pitch = Math.atan2(fy, h);
      const side = Math.sin(time * (dead ? 1 : 6 + e.speed * 2) - k * 0.7 + e.id) * wave * (k / n + 0.2);
      const o = this.segs[k];
      o.position.set(c[i] + Math.cos(yaw) * side, c[i + 1], c[i + 2] - Math.sin(yaw) * side);
      o.rotation.set(pitch, yaw, roll, 'YXZ');
    }
    // The head on the front of segment 0, lifted when it rears.
    const H = this.head, s0 = this.segs[0];
    H.position.set(s0.position.x - Math.sin(e.yaw) * EEL.link * 0.5, s0.position.y, s0.position.z - Math.cos(e.yaw) * EEL.link * 0.5);
    const rear = e.mode === 'rise' || e.mode === 'strike';
    H.rotation.set(rear ? 0.35 + Math.sin(time * 9) * 0.06 : 0, e.yaw, roll, 'YXZ');
    this.jaw.rotation.x = dead ? 0.4 : e.mode === 'rise' ? 0.25 + 0.2 * Math.min(1, e.t / EEL.rise) : e.mode === 'strike' ? 0.75 - 0.75 * Math.min(1, e.t / EEL.strike) : 0.05;
  }
}

export class EelView extends FigurePool<Eel> {
  constructor() {
    const p = parts();
    super('eels', POOL, () => new EelFigure(p));
  }
}
