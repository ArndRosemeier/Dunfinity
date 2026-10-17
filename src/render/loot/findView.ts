/**
 * The finds on screen (src/loot/finds.ts): small things lying on the floor, each kind its own little
 * mesh (metal ones in the metal kind, so they catch the headlamp), with a faint twinkle over it so
 * a find can be spotted in the dark from a few metres. Drawn a bit larger than life, to be seen.
 *
 * A fixed pool per kind, built once and added with the Stage before play: nothing is compiled or
 * added to the scene later.
 */
import { Group, type Object3D } from 'three/webgpu';
import { PropBuilder, type Rgb } from '../../gen/propMesh';
import { meshFromData, meshOf } from '../meshes';
import { GLOW, METAL, VERTEX_COLOR_SOLID } from '../materials';
import { FINDS, type Find, type FindKind } from '../../loot/finds';

/** How many of each kind can be drawn at once. */
const POOL = 10;
/** Drawn this much larger than life. */
const SCALE = 1.6;

const BRASS: Rgb = [0.62, 0.48, 0.22], COPPER: Rgb = [0.55, 0.32, 0.2], SILVER: Rgb = [0.7, 0.7, 0.72], GOLD: Rgb = [0.85, 0.65, 0.25];
const RUST: Rgb = [0.35, 0.2, 0.12], CLAY: Rgb = [0.75, 0.7, 0.62], TIN: Rgb = [0.5, 0.48, 0.42], RED: Rgb = [0.45, 0.12, 0.1];

/** Build a find of `kind` lying on the ground at the origin, in metres: metal parts into `m`, glowing ones into `g`, the rest into `s`. */
function shape(kind: FindKind, m: PropBuilder, s: PropBuilder, g: PropBuilder): void {
  switch (kind) {
    case 'coin':
      m.ellipsoid(0, 0.002, 0, 0.011, 0.0018, 0.011, COPPER, 10);
      break;
    case 'token':
      m.ellipsoid(0, 0.0025, 0, 0.016, 0.0022, 0.016, BRASS, 10);
      m.upright(0, 0.004, 0, 0, 0.003, 0.001, 0.003, [0.2, 0.15, 0.08]); // its punched hole
      break;
    case 'chisel':
      m.beam(-0.09, 0.008, 0, 0.07, 0.008, 0, 0.007, 0.007, RUST);
      m.beam(0.07, 0.008, 0, 0.095, 0.004, 0, 0.009, 0.003, RUST);
      break;
    case 'pipe':
      s.beam(-0.08, 0.005, 0, 0.03, 0.005, 0, 0.004, 0.004, CLAY);
      s.ellipsoid(0.045, 0.014, 0, 0.014, 0.016, 0.014, CLAY, 8);
      s.ellipsoid(0.045, 0.029, 0, 0.01, 0.002, 0.01, [0.12, 0.1, 0.08], 8); // burnt tobacco in the bowl
      break;
    case 'tin':
      m.upright(0, 0.009, 0, 0, 0.04, 0.009, 0.026, TIN);
      m.upright(0, 0.0185, 0, 0, 0.036, 0.0008, 0.022, RED); // the faded label
      break;
    case 'spoon':
      m.beam(-0.08, 0.003, 0, 0.02, 0.003, 0, 0.005, 0.0015, SILVER);
      m.ellipsoid(0.045, 0.005, 0, 0.026, 0.004, 0.017, SILVER, 10);
      break;
    case 'lamp':
      m.upright(0, 0.04, 0, 0, 0.028, 0.04, 0.028, BRASS); // the carbide pot
      m.upright(0, 0.09, 0, 0, 0.022, 0.012, 0.022, BRASS); // the water tank
      m.beam(0, 0.1, 0.02, 0, 0.1, 0.05, 0.004, 0.004, BRASS); // the burner
      m.ellipsoid(0, 0.1, 0.06, 0.03, 0.03, 0.006, SILVER, 10); // the reflector
      break;
    case 'medal':
      m.ellipsoid(0, 0.002, 0.012, 0.016, 0.0018, 0.016, [0.5, 0.45, 0.35], 10);
      m.ellipsoid(0, 0.002, -0.004, 0.004, 0.0015, 0.003, [0.5, 0.45, 0.35], 6); // the loop for the ribbon
      s.upright(0, 0.0015, -0.016, 0, 0.012, 0.0012, 0.016, RED); // its ribbon
      break;
    case 'watch':
      m.ellipsoid(0, 0.006, 0, 0.022, 0.006, 0.022, SILVER, 12);
      m.ellipsoid(0, 0.006, -0.025, 0.005, 0.004, 0.005, SILVER, 6); // the crown
      for (let k = 0; k < 5; k++) m.ellipsoid(0.02 + k * 0.012, 0.002, -0.04 - k * 0.006, 0.006, 0.002, 0.004, SILVER, 6); // the chain
      break;
    case 'ring':
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        m.ellipsoid(Math.cos(a) * 0.009, 0.002, Math.sin(a) * 0.009, 0.0035, 0.0022, 0.0035, GOLD, 6);
      }
      break;
    case 'gear':
      // Something to wear or hold, left rolled up in sacking and tied with string, a buckle showing.
      s.ellipsoid(0, 0.05, 0, 0.14, 0.05, 0.075, [0.42, 0.35, 0.24], 10);
      s.ellipsoid(0.11, 0.05, 0, 0.035, 0.045, 0.07, [0.36, 0.3, 0.2], 8); // its rolled end
      for (const u of [-0.06, 0.05]) s.upright(u, 0.05, 0, 0, 0.006, 0.052, 0.078, [0.62, 0.55, 0.4]); // the string
      m.upright(-0.01, 0.1, 0.02, 0.3, 0.016, 0.004, 0.012, BRASS); // a buckle
      break;
    case 'crystal':
      // A little cluster of the deep world's salt, its points leaning out, glowing the veins' blue.
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + 0.4, lean = k ? 0.012 : 0, h = k ? 0.03 + 0.01 * (k % 2) : 0.05;
        g.ellipsoid(Math.cos(a) * lean, h * 0.5, Math.sin(a) * lean, 0.007, h * 0.5, 0.007, [0.45, 0.75, 1.0], 6);
      }
      break;
  }
}

/** One kind's model: its parts in a group, cloned (geometry and material shared) for the pool. */
function model(kind: FindKind): Object3D {
  const g = new Group(), m = new PropBuilder(), s = new PropBuilder(), gl = new PropBuilder();
  shape(kind, m, s, gl);
  if (!m.empty) g.add(meshFromData(m.build()!, METAL));
  if (!s.empty) g.add(meshFromData(s.build()!, VERTEX_COLOR_SOLID));
  if (!gl.empty) g.add(meshFromData(gl.build()!, GLOW));
  g.scale.setScalar(SCALE);
  return g;
}

export class FindView {
  /** Put into the scene once (Stage.add), after the warm-up. */
  readonly root = new Group();
  private readonly pools = new Map<FindKind, Object3D[]>();
  private readonly glints: Object3D[] = [];

  constructor() {
    this.root.name = 'finds';
    for (const kind of Object.keys(FINDS) as FindKind[]) {
      const m = model(kind), pool: Object3D[] = [];
      for (let k = 0; k < POOL; k++) {
        const o = k ? m.clone() : m;
        this.root.add(o);
        pool.push(o);
      }
      this.pools.set(kind, pool);
    }
    const glint = meshOf((b) => b.ellipsoid(0, 0, 0, 0.012, 0.012, 0.012, [1, 0.85, 0.55], 6), GLOW);
    for (let k = 0; k < POOL * 4; k++) {
      const o = k ? glint.clone() : glint;
      this.root.add(o);
      this.glints.push(o);
    }
  }

  /** Show `finds` (the ones near the nobody), the rest of the pool hidden. `time` makes them twinkle. */
  draw(finds: readonly Find[], time: number): void {
    const used = new Map<FindKind, number>();
    let g = 0;
    for (const f of finds) {
      const k = used.get(f.kind) ?? 0, pool = this.pools.get(f.kind)!;
      if (k >= pool.length) continue;
      used.set(f.kind, k + 1);
      const o = pool[k];
      o.visible = true;
      o.position.set(f.x, f.y, f.z);
      o.rotation.y = f.yaw;
      if (g < this.glints.length) {
        // A twinkle now and then, each find on its own beat.
        const beat = (time * 0.7 + (f.id % 97) * 0.137) % 1, tw = beat < 0.12 ? Math.sin((beat / 0.12) * Math.PI) : 0;
        const s = this.glints[g++];
        s.visible = tw > 0.02;
        s.position.set(f.x, f.y + 0.03, f.z);
        s.scale.setScalar(0.4 + 1.6 * tw);
      }
    }
    for (const [kind, pool] of this.pools) for (let k = used.get(kind) ?? 0; k < pool.length; k++) pool[k].visible = false;
    for (; g < this.glints.length; g++) this.glints[g].visible = false;
  }
}
