/**
 * Grandma's Snapdragons on screen (src/combat/snapdragon.ts): a rosette of leaves unfurling where the
 * seed went in, a stalk shooting up with a bounce, and a head like the garden flower's, crimson
 * jaws with a yellow lip, teeth, and the salt glowing in its throat. It sways while it waits, turns
 * to whom it bites, coils back with its jaws wide, lunges, snaps them shut, and at the end droops
 * and sinks back into the floor. Every pose follows the plant's clocks smoothly (no jitter).
 *
 * A fixed pool of plants, built once and added with the Stage before play.
 */
import { Group, type Mesh } from 'three/webgpu';
import { FigurePool, placeFigure, type Figure } from './creatures/figures';
import { clamp, lerp, smoothstep } from '@futuremagic/core';
import type { Rgb, V3 } from '../gen/propMesh';
import type { PropBuilder } from '../gen/propMesh';
import { meshOf } from './meshes';
import { GLOW, VERTEX_COLOR_SOLID } from './materials';
import { SNAP, type Plant } from '../combat/snapdragon';

/** Plants drawn at once; the stalk's joints and each one's length, metres; its radius at the foot and the head. */
const PLANTS = 3;
const JOINTS = 6;
const LENGTH = 0.24;
const RADIUS = [0.045, 0.022] as const;
const LEAF: Rgb = [0.12, 0.3, 0.08], LEAF_DARK: Rgb = [0.07, 0.18, 0.05], STALK: Rgb = [0.18, 0.36, 0.1];
const PETAL: Rgb = [0.62, 0.05, 0.12], LIP: Rgb = [0.85, 0.62, 0.08], TOOTH: Rgb = [0.86, 0.84, 0.74], THROAT: Rgb = [0.35, 1.5, 1.1];
/** The lunge: how far each joint leans back while it coils and forward when it strikes, radians, and how far the head reaches forward then (for stretching to the target), metres. */
const COIL = 0.14, LUNGE = 0.3;
const LUNGE_REACH = (() => {
  let a = 0, f = 0;
  for (let k = 0; k < JOINTS; k++) { a += LUNGE; f += LENGTH * Math.sin(a); }
  return f;
})();

/** A leaf from the origin out along `yaw` (forward is (-sin, -cos)), `len` long, rising by `lift` then drooping: both faces. */
function leafOut(b: PropBuilder, x: number, y: number, z: number, yaw: number, len: number, width: number, lift: number): void {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), sx = Math.cos(yaw), sz = -Math.sin(yaw);
  const a: V3[] = [], c: V3[] = [], up: V3[] = [], down: V3[] = [], col: Rgb[] = [];
  const N = 6;
  for (let k = 0; k <= N; k++) {
    const t = k / N, w = Math.sin(Math.PI * Math.min(1, t * 1.1)) * width * (1 - t * 0.35) + 0.002;
    const mx = x + fx * len * t, my = y + lift * Math.sin(Math.PI * t * 0.8) - lift * 0.4 * t * t, mz = z + fz * len * t;
    // The leaf cups up a little at its edges.
    a.push([mx + sx * w, my + w * 0.35, mz + sz * w]);
    c.push([mx - sx * w, my + w * 0.35, mz - sz * w]);
    up.push([fx * -0.3, 1, fz * -0.3]);
    down.push([fx * 0.3, -1, fz * 0.3]);
    col.push(t < 0.5 ? LEAF_DARK : LEAF);
  }
  b.ribbon(a, c, up, col);
  b.ribbon(c, a, down, col);
}

interface Parts {
  readonly root: Group;
  readonly leaves: Mesh;
  /** The stalk's joints, each a child of the one below, and the piece of stalk on each (stretched, not the joint). */
  readonly joints: Group[];
  readonly stalks: Mesh[];
  readonly head: Group;
  readonly upper: Group;
  readonly lower: Group;
  readonly phase: number;
}

function parts(k: number): Parts {
  const root = new Group();
  const leaves = meshOf((b) => {
    for (let i = 0; i < 7; i++) leafOut(b, 0, 0.02, 0, i * 0.9 + 0.3, 0.32 + (i % 3) * 0.05, 0.07, 0.1);
  }, VERTEX_COLOR_SOLID);
  root.add(leaves);
  const joints: Group[] = [], stalks: Mesh[] = [];
  let parent: Group = root;
  for (let j = 0; j < JOINTS; j++) {
    const g = new Group(), r0 = lerp(RADIUS[0], RADIUS[1], j / JOINTS), r1 = lerp(RADIUS[0], RADIUS[1], (j + 1) / JOINTS);
    const stalk = meshOf((b) => {
      b.tube(0, 0, 0, 0, LENGTH, 0, (r0 + r1) / 2, STALK, 8);
      b.ellipsoid(0, 0, 0, r0 * 1.15, r0 * 1.15, r0 * 1.15, STALK, 8);
      // A pair of small leaves off the stalk partway up.
      if (j === 1 || j === 3) { leafOut(b, 0, LENGTH * 0.6, 0, j * 1.3, 0.16, 0.04, 0.05); leafOut(b, 0, LENGTH * 0.6, 0, j * 1.3 + Math.PI, 0.14, 0.035, 0.05); }
    }, VERTEX_COLOR_SOLID);
    g.add(stalk);
    if (j > 0) g.position.y = LENGTH;
    parent.add(g);
    joints.push(g);
    stalks.push(stalk);
    parent = g;
  }
  const head = new Group();
  head.position.y = LENGTH;
  parent.add(head);
  head.add(meshOf((b) => {
    // The calyx and a ruff of petals behind the jaws.
    b.ellipsoid(0, 0, 0.02, 0.07, 0.07, 0.06, STALK, 8);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      b.ellipsoid(Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0.03, 0.06, 0.06, 0.025, PETAL, 8);
    }
  }, VERTEX_COLOR_SOLID));
  head.add(meshOf((b) => { b.ellipsoid(0, 0, -0.07, 0.06, 0.05, 0.07, THROAT, 8); }, GLOW));
  // The jaws hinge at the back of the head: the upper opens up, the lower down.
  const jaw = (sign: 1 | -1): Group => {
    const g = new Group();
    g.add(meshOf((b) => {
      b.ellipsoid(0, sign * 0.03, -0.13, 0.11, 0.055, 0.15, sign > 0 ? PETAL : LIP, 10);
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (0.15 + 0.7 * (i / 6)), tx = Math.cos(a) * 0.085, tz = -0.13 - Math.sin(a) * 0.12;
        b.box(tx, -sign * 0.012, tz, [0.008, 0, 0], [0, -sign * 0.02, 0], [0, 0, 0.008], TOOTH);
      }
    }, VERTEX_COLOR_SOLID));
    head.add(g);
    return g;
  };
  const upper = jaw(1), lower = jaw(-1);
  root.visible = false;
  return { root, leaves, joints, stalks, head, upper, lower, phase: k * 2.1 };
}

/** 0 → 1 with a little overshoot past 1 (the stalk shooting up with a bounce). */
function springUp(t: number): number {
  const s = 1.7;
  const u = clamp(t, 0, 1) - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
}

/** The plants, a `FigurePool` (added once with the Stage; `draw(plants, time)`). */
export class SnapdragonView extends FigurePool<Plant> {
  constructor() {
    let k = 0;
    super('snapdragons', PLANTS, (): Figure<Plant> => {
      const f = parts(k++);
      return { root: f.root, pose: (p, time) => posePlant(f, p, time) };
    });
  }
}

/** Pose a plant's parts after its clocks at `time`. */
function posePlant(f: Parts, p: Plant, time: number): void {
  const t = p.t, wilt = clamp((t - p.sowing.lasts) / SNAP.wilt, 0, 1);
  placeFigure(f.root, p);
  f.root.position.y -= 0.3 * wilt * wilt;
  f.leaves.scale.setScalar(Math.max(0.01, smoothstep(0, 0.6, t) * (1 - 0.4 * wilt)));
  const up = Math.max(0.01, springUp((t - 0.25) / (SNAP.grow - 0.25)) * (1 - 0.6 * wilt));
  // The bite's clocks: coiling back with the jaws opening, the lunge to the jaws snapping shut, the way back.
  const { hit, dur } = SNAP.bite, b = p.biting;
  let lean = 0, jaw = 0.12 + 0.08 * Math.sin(time * 2.3 + f.phase);
  if (b >= 0) {
    const coil = hit * 0.7;
    lean = b < coil ? COIL * smoothstep(0, 1, b / coil) : b < hit ? lerp(COIL, -LUNGE, smoothstep(0, 1, (b - coil) / (hit - coil))) : lerp(-LUNGE, 0, smoothstep(0, 1, (b - hit) / (dur - hit)));
    jaw = b < hit * 0.8 ? lerp(jaw, 0.95, smoothstep(0, 1, b / (hit * 0.8))) : b < hit ? lerp(0.95, 0, (b - hit * 0.8) / (hit * 0.2)) : lerp(0, 0.12, smoothstep(0, 1, (b - hit) / (dur - hit)));
  } else if (p.target) lean = COIL * 0.35;
  // It yawns once as it comes up; shuts as it wilts.
  if (t < SNAP.grow + 0.5) jaw = Math.max(jaw, 0.7 * Math.sin(Math.PI * clamp((t - SNAP.grow + 0.5) / 1, 0, 1)));
  jaw *= 1 - wilt;
  // Stretched to the one it bites at, while it lunges.
  const lunging = Math.max(0, -lean) / LUNGE, tg = p.target;
  const want = tg ? clamp((Math.hypot(tg.x - p.x, tg.z - p.z) - tg.radius * 0.5) / LUNGE_REACH, 0.7, 2.6) : 1;
  const stretch = 1 + (want - 1) * lunging;
  let bent = 0;
  f.joints.forEach((g, j) => {
    const sway = 0.05 * Math.sin(time * 1.7 + f.phase + j * 0.6) * (1 - lunging);
    const x = lean + sway + 0.22 * wilt;
    g.rotation.set(x, 0, 0.04 * Math.sin(time * 1.1 + f.phase + j * 0.8) + 0.12 * wilt * (j % 2 ? 1 : 0.6));
    f.stalks[j].scale.y = stretch;
    if (j > 0) g.position.y = LENGTH * stretch;
    bent += x;
  });
  f.joints[0].scale.setScalar(up);
  f.head.position.y = LENGTH * stretch;
  // The head looks forward whatever the stalk does (a little down at the end of a lunge).
  f.head.rotation.x = -bent * 0.85;
  f.upper.rotation.x = jaw * 0.75;
  f.lower.rotation.x = -jaw * 0.45;
}
