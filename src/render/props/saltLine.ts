/**
 * Grandma's Salt Line on the floor (src/world/saltLine.ts): a crust of white salt and pale crystals
 * glowing faintly blue, like her circles round the Tall One's lair. The ring shows as it is poured,
 * the nobody going round, and its crystals go dull one by one as it wears off.
 *
 * One ring per radius the card has, built once (segments in order round the ring, so a draw range
 * is a share of it poured) and added with the Stage; poured, its vertices are moved onto the floor.
 */
import { Group, type Mesh } from 'three/webgpu';
import type { Rgb } from '../../gen/propMesh';
import { meshOf as mesh } from '../meshes';
import { GLOW, VERTEX_COLOR_SOLID } from '../materials';
import type { SaltLine } from '../../world/saltLine';
import type { Level } from '../../gen/level';

const CRUST: Rgb = [0.62, 0.64, 0.66], CRYSTAL: Rgb = [0.45, 0.7, 1.0];
/** Segments round a ring. */
const SEGMENTS = 64;

interface Ring {
  readonly r: number;
  readonly root: Group;
  readonly crust: Mesh;
  readonly glow: Mesh;
  /** The heights of each mesh's vertices as built (on a flat floor). */
  readonly flat: readonly Float32Array[];
}

function ring(r: number): Ring {
  const at = (k: number) => [Math.cos((k / SEGMENTS) * Math.PI * 2) * r, Math.sin((k / SEGMENTS) * Math.PI * 2) * r] as const;
  const crust = mesh((b) => {
    for (let k = 0; k < SEGMENTS; k++) { const [x, z] = at(k); b.upright(x, 0.015, z, -(k / SEGMENTS) * Math.PI * 2, 0.09, 0.03, (Math.PI * r) / SEGMENTS + 0.03, CRUST); }
  }, VERTEX_COLOR_SOLID);
  const glow = mesh((b) => {
    for (let k = 0; k < SEGMENTS; k++) { const [x, z] = at(k), h = (k * 0.618) % 1; b.upright(x, 0.05 + h * 0.05, z, k * 1.7, 0.025 + h * 0.02, 0.05 + h * 0.07, 0.025, CRYSTAL); }
  }, GLOW);
  const root = new Group();
  root.add(crust, glow);
  root.visible = false;
  return { r, root, crust, glow, flat: [crust, glow].map((m) => Float32Array.from(m.geometry.attributes.position.array as Float32Array)) };
}

export class SaltLineView {
  readonly root = new Group();
  private readonly rings: Ring[];
  /** The circle the rings were last laid on the floor for. */
  private laid: object | null = null;

  /** `radii`: the circle's radius at each rank of the card. */
  constructor(radii: readonly number[]) {
    this.rings = radii.map(ring);
    for (const r of this.rings) this.root.add(r.root);
  }

  /** Show the line as it is at `now`. */
  draw(line: SaltLine, level: Level, now: number): void {
    const c = line.circle, s = line.shown(now);
    for (const r of this.rings) {
      r.root.visible = !!c && Math.abs(c.r - r.r) < 1e-3;
      if (!r.root.visible || !c) continue;
      r.root.position.set(c.x, c.y, c.z);
      if (this.laid !== c) { this.laid = c; lay(r, level, c.x, c.y, c.z); }
      show(r.crust, s.poured);
      show(r.glow, Math.min(s.poured, s.bright));
    }
  }
}

/** Lay ring `r` (centred at x, y, z) on the floor of `level`: each vertex up or down to the floor under it. */
function lay(r: Ring, level: Level, x: number, y: number, z: number): void {
  [r.crust, r.glow].forEach((m, k) => {
    const pos = m.geometry.attributes.position, flat = r.flat[k], a = pos.array as Float32Array;
    for (let i = 0; i < a.length; i += 3) {
      const dy = level.groundAt(x + flat[i], z + flat[i + 2]) - y;
      a[i + 1] = flat[i + 1] + (Math.abs(dy) < 1.2 ? dy : 0); // (against the rock it runs on into it)
    }
    pos.needsUpdate = true;
  });
}

/** Draw the first `share` of a ring's segments. */
function show(m: Mesh, share: number): void {
  const per = (m.geometry.index?.count ?? 0) / SEGMENTS;
  m.geometry.setDrawRange(0, Math.round(share * SEGMENTS) * per);
}
