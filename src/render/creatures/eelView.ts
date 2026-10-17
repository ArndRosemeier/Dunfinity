/**
 * The brine eels on screen (src/creatures/eels.ts): three metres of pale, slimy eel modelled, rigged
 * and animated in Blender (AssetGenerator spec `creature_brine_eel`, see src/render/creatures/rigged.ts),
 * with a blunt head, an underslung jaw of needle teeth, milky eyes that catch the light, and a fin
 * down its back into the tail. Its body is laid along the chain the sim keeps (each bone turned to
 * its link) with a swimming wave running down it; its head plays clips: weaving and breathing as it
 * swims, rearing up with the jaw dropping wide (the tell), the strike, a jerk when stabbed, the jaw
 * falling slack when dead, and it rolls belly up.
 *
 * A fixed pool, built once and added with the Stage before play.
 */
import { Matrix4, Quaternion, Vector3, type Object3D } from 'three/webgpu';
import { FigurePool } from './figures';
import { EEL_COAT } from '../materials';
import { EEL, type Eel } from '../../creatures/eels';
import { Rigged, RiggedFigure, type ClipUse } from './rigged';

/** How many can be drawn at once. */
const POOL = 12;

/** The head's clips (AssetGenerator's quadruped eel_clips.py); the body is laid along the chain here. */
const CLIPS: Record<string, ClipUse> = {
  Swim: { loop: true },
  Graze: { loop: true },
  Rest: { loop: true },
  Rise: { loop: false },
  Strike: { loop: false },
  Die: { loop: false },
};

const _m = new Matrix4(), _inv = new Matrix4(), _q = new Quaternion(), _qy = new Quaternion(), _qx = new Quaternion(), _qz = new Quaternion();
const _p = new Vector3(), _one = new Vector3(1, 1, 1), _Y = new Vector3(0, 1, 0), _X = new Vector3(1, 0, 0), _Z = new Vector3(0, 0, 1);

/** One drawn eel: the model at the world's origin, its `root` bone on the chain's first point, `body1`.. along the links. */
class EelFigure extends RiggedFigure<Eel> {
  /** The bones the chain drives (root first, then body1..), and each one's rest turn (model space). */
  private readonly bones: Object3D[] = [];
  private readonly rest: Quaternion[] = [];
  /** Where each bone sits on the chain, swum sideways: x, y, z per point. */
  private readonly at = new Float32Array(EEL.segments * 3);

  constructor(rig: Rigged) {
    super(rig, CLIPS);
    this.root.updateMatrixWorld(true);
    for (const name of ['root', ...Array.from({ length: EEL.segments - 1 }, (_, k) => `body${k + 1}`)]) {
      const b = this.root.getObjectByName(name);
      if (!b) throw new Error(`brine eel: no bone "${name}"`);
      this.bones.push(b);
      this.rest.push(b.getWorldQuaternion(new Quaternion()));
    }
  }

  /** The figure stays at the origin: its bones are put on the chain, in the world (`posed`). */
  protected place(): void {
    this.root.visible = true;
  }

  protected clipFor(e: Eel): string {
    if (e.mode === 'cruise' && e.pose) return e.pose === 'feed' ? 'Graze' : 'Rest'; // nosing along the bottom, or still (src/creatures/life.ts)
    return e.mode === 'dead' ? 'Die' : e.mode === 'rise' ? 'Rise' : e.mode === 'strike' ? 'Strike' : 'Swim';
  }

  protected travelled(): number {
    return 0;
  }

  protected posed(e: Eel, time: number): void {
    // The swimming wave runs down the body, faster when it hurries; a thrash when stabbed.
    const c = e.chain, n = EEL.segments, dead = e.mode === 'dead', a = this.at;
    const hit = Math.max(0, 1 - e.hurtT / 0.4);
    const wave = (dead ? 0.02 : 0.08 + 0.05 * Math.min(1, e.speed / 2)) + hit * 0.15;
    const roll = dead ? Math.PI * Math.min(1, e.deadT / 0.6) : 0;
    for (let k = 0; k < n; k++) {
      const i = k * 3, j = Math.max(0, k - 1) * 3;
      let fx = c[j] - c[i], fz = c[j + 2] - c[i + 2];
      if (k === 0) { fx = -Math.sin(e.yaw); fz = -Math.cos(e.yaw); }
      const h = Math.hypot(fx, fz) || 1;
      const side = Math.sin(time * (dead ? 1 : 6 + e.speed * 2) - k * 0.7 + e.id) * wave * (k / n + 0.2);
      a[i] = c[i] - (fz / h) * side; a[i + 1] = c[i + 1]; a[i + 2] = c[i + 2] + (fx / h) * side;
    }
    // Each bone from its point, turned along its link (the root along the heading), rolled when dead.
    _qz.setFromAxisAngle(_Z, roll);
    for (let k = 0; k < n; k++) {
      const b = this.bones[k], i = Math.max(0, k - 1) * 3, j = k * 3;
      let yaw = e.yaw, pitch = 0;
      if (k > 0) {
        const dx = a[j] - a[i], dy = a[j + 1] - a[i + 1], dz = a[j + 2] - a[i + 2];
        yaw = Math.atan2(dx, dz);
        pitch = -Math.atan2(dy, Math.hypot(dx, dz));
      }
      _qy.setFromAxisAngle(_Y, yaw);
      _qx.setFromAxisAngle(_X, pitch);
      _q.copy(_qy).multiply(_qx).multiply(_qz).multiply(this.rest[k]);
      _p.set(a[i], a[i + 1], a[i + 2]);
      _m.compose(_p, _q, _one);
      b.parent!.updateWorldMatrix(true, false);
      _inv.copy(b.parent!.matrixWorld).invert();
      _m.premultiply(_inv).decompose(b.position, b.quaternion, b.scale);
      b.updateMatrixWorld(true);
    }
  }
}

export class EelView extends FigurePool<Eel> {
  private constructor(rig: Rigged) {
    super('eels', POOL, () => new EelFigure(rig));
  }

  /** Load the model (before the warm-up, so its skin's maps are there when the shaders build). */
  static async create(): Promise<EelView> {
    return new EelView(await Rigged.fetch('brine_eel.glb', EEL_COAT));
  }
}
