/**
 * Grandma's Horseradish on screen (src/combat/horseradish.ts): while it tunnels only its ruff of big
 * leaves shows, cutting along the floor like a fin over a hump of earth; it shoots up out of the
 * floor, a thick pale knobbly root whose top splits into a pair of fibrous jaws with the salt glowing
 * between, sways while it waits, leans back with its jaws wide, lunges and snaps them shut; it drops
 * back under to go after one that got away, and at the end keels over, withers and sinks. Every pose
 * follows the root's clocks smoothly (no jitter).
 *
 * A fixed pool of roots, built once and added with the Stage before play.
 */
import { Group, type Mesh } from 'three/webgpu';
import { FigurePool, placeFigure, type Figure } from './creatures/figures';
import { clamp, lerp, smoothstep } from '@futuremagic/core';
import type { Rgb } from '../gen/propMesh';
import { meshOf } from './meshes';
import { GLOW, VERTEX_COLOR_SOLID } from './materials';
import { leafOut, springUp } from './snapdragons';
import { RADISH, type Root } from '../combat/horseradish';

/** Roots drawn at once; how tall the root stands, metres, and how deep it rides while it tunnels. */
const ROOTS = 4;
const TALL = 0.85;
const UNDER = -0.78;
const SKIN: Rgb = [0.78, 0.7, 0.52], RING: Rgb = [0.5, 0.4, 0.27], FLESH: Rgb = [0.93, 0.9, 0.78], FIBRE: Rgb = [0.84, 0.78, 0.6];
const EARTH: Rgb = [0.2, 0.14, 0.09], SALT: Rgb = [0.6, 1.3, 1.7];
/** The bite: how far it leans back coiling and forward lunging, radians. */
const COIL = 0.3, LUNGE = 0.75;

interface Parts {
  readonly root: Group;
  /** The hump of earth over it while it tunnels. */
  readonly mound: Mesh;
  /** Everything that comes up: the root itself, pivoting at the floor. */
  readonly stem: Group;
  readonly fore: Group;
  readonly aft: Group;
  readonly phase: number;
}

function rootParts(k: number): Parts {
  const root = new Group();
  const mound = meshOf((b) => {
    b.ellipsoid(0, 0, 0, 0.32, 0.12, 0.42, EARTH, 8);
    b.ellipsoid(0.12, 0.02, 0.25, 0.12, 0.08, 0.14, EARTH, 6);
    b.ellipsoid(-0.1, 0.03, 0.32, 0.1, 0.06, 0.1, EARTH, 6);
  }, VERTEX_COLOR_SOLID);
  root.add(mound);
  const stem = new Group();
  root.add(stem);
  stem.add(meshOf((b) => {
    // The root: thick and knobbly, ringed, narrowing up to the jaws; hair roots off its foot.
    const segs = 5;
    for (let s = 0; s < segs; s++) {
      const y0 = (s / segs) * TALL * 0.8, y1 = ((s + 1) / segs) * TALL * 0.8, r = lerp(0.11, 0.07, s / segs);
      b.tube(Math.sin(s * 1.9) * 0.012, y0, Math.cos(s * 2.3) * 0.012, Math.sin(s * 1.9 + 1.9) * 0.012, y1, Math.cos(s * 2.3 + 2.3) * 0.012, r, SKIN, 9);
      b.ellipsoid(0, y1, 0, r * 1.06, 0.018, r * 1.06, RING, 9);
      b.ellipsoid(Math.cos(s * 2.4) * r * 0.9, (y0 + y1) / 2, Math.sin(s * 2.4) * r * 0.9, 0.03, 0.026, 0.03, SKIN, 6);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + k;
      b.tube(Math.cos(a) * 0.08, 0.02, Math.sin(a) * 0.08, Math.cos(a) * 0.2, -0.08, Math.sin(a) * 0.2, 0.008, RING, 4);
    }
    // A ruff of big leaves under the jaws, standing up: all that shows while it tunnels.
    for (let i = 0; i < 6; i++) leafOut(b, 0, TALL * 0.62, 0, i * 1.05 + 0.4, 0.42 + (i % 2) * 0.08, 0.09, 0.32);
  }, VERTEX_COLOR_SOLID));
  stem.add(meshOf((b) => { b.ellipsoid(0, TALL * 0.82, 0, 0.045, 0.05, 0.045, SALT, 8); }, GLOW));
  // The jaws: the root's top split in two, hinged across at the split, opening forward and back.
  const half = (sign: 1 | -1): Group => {
    const g = new Group();
    g.position.y = TALL * 0.8;
    g.add(meshOf((b) => {
      b.ellipsoid(0, 0.09, sign * 0.035, 0.07, 0.11, 0.035, SKIN, 9);
      b.ellipsoid(0, 0.08, sign * 0.012, 0.06, 0.09, 0.012, FLESH, 8);
      for (let i = 0; i < 6; i++) {
        const x = lerp(-0.05, 0.05, i / 5), y = 0.04 + 0.11 * Math.sin(Math.PI * (0.2 + 0.6 * (i / 5)));
        b.tube(x, y, sign * 0.012, x * 1.1, y + 0.01, -sign * 0.03, 0.006, FIBRE, 4);
      }
    }, VERTEX_COLOR_SOLID));
    stem.add(g);
    return g;
  };
  const fore = half(-1), aft = half(1);
  root.visible = false;
  return { root, mound, stem, fore, aft, phase: k * 1.7 };
}

/** The roots, a `FigurePool` (added once with the Stage; `draw(roots, time)`). */
export class HorseradishView extends FigurePool<Root> {
  constructor() {
    let k = 0;
    super('horseradish', ROOTS, (): Figure<Root> => {
      const f = rootParts(k++);
      return { root: f.root, pose: (r, time) => poseRoot(f, r, time) };
    });
  }
}

/** Pose a root's parts after its clocks at `time`. */
function poseRoot(f: Parts, r: Root, time: number): void {
  placeFigure(f.root, r);
  const sway = Math.sin(time * 1.6 + f.phase);
  let depth = 0, lean = 0, roll = 0.04 * sway, jaw = 0.08 + 0.05 * Math.sin(time * 2.1 + f.phase), mound = 0, shrink = 1;
  switch (r.phase) {
    case 'dig':
      depth = UNDER + 0.03 * Math.sin(time * 14 + f.phase);
      roll = 0.12 * Math.sin(time * 9 + f.phase);
      mound = 1;
      jaw = 0;
      break;
    case 'rise': {
      const u = r.t / RADISH.rise;
      depth = UNDER * (1 - springUp(u));
      mound = 1 - smoothstep(0, 0.6, u);
      jaw = 0.5 * Math.sin(Math.PI * clamp(u * 1.2 - 0.2, 0, 1));
      break;
    }
    case 'dive': {
      const u = smoothstep(0, 1, r.t / RADISH.dive);
      depth = UNDER * u * u;
      mound = u;
      jaw = 0;
      break;
    }
    case 'up':
      if (r.biting >= 0) {
        const { hit, dur } = RADISH.bite, b = r.biting, coil = hit * 0.65;
        lean = b < coil ? COIL * smoothstep(0, 1, b / coil) : b < hit ? lerp(COIL, -LUNGE, smoothstep(0, 1, (b - coil) / (hit - coil))) : lerp(-LUNGE, 0, smoothstep(0, 1, (b - hit) / (dur - hit)));
        jaw = b < hit * 0.85 ? lerp(jaw, 1, smoothstep(0, 1, b / (hit * 0.85))) : b < hit ? lerp(1, 0, (b - hit * 0.85) / (hit * 0.15)) : lerp(0, 0.08, smoothstep(0, 1, (b - hit) / (dur - hit)));
      } else lean = 0.05 * sway;
      break;
    case 'shrivel': {
      const u = clamp(r.t / RADISH.shrivel, 0, 1);
      roll = 1.1 * smoothstep(0, 0.6, u);
      depth = -0.25 * u * u;
      shrink = 1 - 0.55 * smoothstep(0.2, 1, u);
      jaw *= 1 - u;
      break;
    }
  }
  f.mound.visible = mound > 0.01;
  f.mound.scale.set(1, Math.max(0.01, mound) * (1 + 0.15 * Math.sin(time * 18 + f.phase)), 1);
  f.stem.position.y = depth;
  f.stem.rotation.set(lean, 0, roll);
  f.stem.scale.set(lerp(0.6, 1, shrink), shrink, lerp(0.6, 1, shrink));
  f.fore.rotation.x = -jaw * 0.8;
  f.aft.rotation.x = jaw * 0.5;
}
