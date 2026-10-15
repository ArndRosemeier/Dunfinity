/**
 * Creatures modelled in Blender (AssetGenerator's creature generators, e.g. the spec
 * `creature_feral_dog`): one skinned glb with its clips, served from `public/creatures/`.
 *
 * `Rigged.fetch` loads it once and puts every part on a material kind (docs/SHADERS.md): the coat on
 * its `CoatKind` (the glb's two maps go into the kind's textures), the eyes on `GLOW` (they throw the
 * headlamp back), the teeth on `VERTEX_COLOR_SOLID`. `rig.figure()` clones it with its own skeleton,
 * and `Animator` plays its clips: one clip at a time, faded into the next, so nothing ever pops; gaits
 * by distance travelled (`stride`), so the paws stay planted at any speed; a flinch layered on top.
 */
import { AnimationMixer, AnimationUtils, AdditiveAnimationBlendMode, Group, LoopOnce, LoopRepeat, Mesh, type AnimationAction, type AnimationClip, type Object3D, type Texture } from 'three/webgpu';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { GLOW, VERTEX_COLOR_SOLID, type CoatKind, type MaterialKind } from '../materials';
import { wear } from '../meshes';
import { placeFigure, type Figure } from './figures';
import { groundSpeed, type Creature } from '../../creatures/creature';

export class Rigged {
  private constructor(private readonly template: Object3D, readonly clips: ReadonlyMap<string, AnimationClip>) {}

  /** Load `public/creatures/<file>`; the glb's coat maps go into `coat`'s textures. */
  static async fetch(file: string, coat: CoatKind): Promise<Rigged> {
    const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}creatures/${file}`);
    const kinds: Record<string, MaterialKind> = { coat, eye: GLOW, teeth: VERTEX_COLOR_SOLID };
    gltf.scene.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const loaded = o.material as { name: string; map?: Texture | null; normalMap?: Texture | null; dispose(): void };
      const kind = kinds[loaded.name];
      if (!kind) throw new Error(`creature ${file}: no kind for material "${loaded.name}"`);
      if (kind === coat) {
        fill(coat.maps.colour, loaded.map);
        fill(coat.maps.normal, loaded.normalMap);
      }
      loaded.dispose();
      wear(o, kind);
      // Its bounds are the rest pose's: a dog rolled over on its side would be culled while in view.
      o.frustumCulled = false;
    });
    const clips = new Map<string, AnimationClip>();
    for (const c of gltf.animations) clips.set(c.name, c);
    return new Rigged(gltf.scene, clips);
  }

  /** A copy with its own skeleton (geometry and materials shared). */
  figure(): Object3D {
    return clone(this.template);
  }
}

function fill(into: Texture, from: Texture | null | undefined): void {
  if (!from) throw new Error('creature coat: a map is missing from the glb');
  into.image = from.image;
  into.needsUpdate = true;
}

/** How a clip is played: looped (by time, or by distance with `stride` metres per cycle at size 1), or once and held. */
export interface ClipUse {
  readonly loop: boolean;
  readonly stride?: number;
}

/** Plays one figure's clips. */
export class Animator {
  private readonly mixer: AnimationMixer;
  private readonly actions = new Map<string, AnimationAction>();
  private readonly flinch: AnimationAction | null;
  private current = '';
  /** Seconds a change of clip takes to fade over. */
  fade = 0.22;

  constructor(root: Object3D, rig: Rigged, uses: Readonly<Record<string, ClipUse>>, flinch?: string) {
    this.mixer = new AnimationMixer(root);
    for (const [name, use] of Object.entries(uses)) {
      const clip = rig.clips.get(name);
      if (!clip) throw new Error(`creature clip "${name}" is missing`);
      const a = this.mixer.clipAction(clip);
      a.setLoop(use.loop ? LoopRepeat : LoopOnce, Infinity);
      a.clampWhenFinished = !use.loop;
      if (use.stride !== undefined) a.timeScale = 0; // its time is set from the distance travelled
      this.actions.set(name, a);
    }
    if (flinch) {
      const clip = rig.clips.get(flinch);
      if (!clip) throw new Error(`creature clip "${flinch}" is missing`);
      const add = AnimationUtils.makeClipAdditive(clip.clone());
      this.flinch = this.mixer.clipAction(add);
      this.flinch.blendMode = AdditiveAnimationBlendMode;
      this.flinch.setLoop(LoopOnce, 1);
      this.flinch.clampWhenFinished = false;
    } else this.flinch = null;
  }

  /** Play `name` (fading from what played before; a clip played once starts over when it is played again after another). */
  play(name: string): void {
    if (name === this.current) return;
    const next = this.actions.get(name);
    if (!next) throw new Error(`creature clip "${name}" is not in use`);
    const prev = this.actions.get(this.current);
    next.reset();
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.play();
    if (prev) prev.crossFadeTo(next, this.fade, false);
    else next.fadeIn(0);
    this.current = name;
  }

  /** Set a stride clip's phase from `distance` travelled (metres, at size 1). */
  pace(name: string, distance: number, stride: number): void {
    const a = this.actions.get(name);
    if (!a) return;
    const d = a.getClip().duration;
    a.time = (((distance / stride) % 1) + 1) % 1 * d;
  }

  /** Flinch (a hit), on top of whatever is playing. */
  hurt(): void {
    if (!this.flinch) return;
    this.flinch.reset();
    this.flinch.play();
  }

  get playing(): string { return this.current; }

  update(dt: number): void {
    this.mixer.update(dt);
  }
}

/**
 * A drawn creature played from its clips: placed at the creature, the clip its state calls for
 * (`clipFor`, which can ask `faster` for gaits that change with speed), paced by distance on stride
 * clips, and the flinch when its health drops. A figure taken over by another creature starts that
 * one's clip without fading.
 */
export abstract class RiggedFigure<T extends Creature<string> & { readonly size: number }> implements Figure<T> {
  readonly root = new Group();
  private readonly anim: Animator;
  private readonly over = new Map<string, boolean>();
  private who: T | null = null;
  private last = 0;
  private hurtT = 9;
  /** Ground speed this frame, metres per second at size 1. */
  protected speed = 0;

  constructor(rig: Rigged, private readonly uses: Readonly<Record<string, ClipUse>>, flinch = 'Hurt') {
    const model = rig.figure();
    this.root.add(model);
    this.anim = new Animator(model, rig, uses, flinch);
  }

  /** The clip for the creature's state now. */
  protected abstract clipFor(c: T): string;
  /** How far it has walked (metres, at size 1): the phase of its stride clips. */
  protected abstract travelled(c: T): number;

  /** Is it going faster than `band` (up past the first speed, back below the second, so it never flickers between two)? */
  protected faster(name: string, band: readonly [number, number]): boolean {
    const was = this.over.get(name) ?? false;
    const now = this.speed > band[was ? 1 : 0];
    this.over.set(name, now);
    return now;
  }

  pose(c: T, time: number): void {
    placeFigure(this.root, c);
    const dt = Math.min(0.1, Math.max(0, time - this.last));
    this.last = time;
    const fresh = c !== this.who;
    if (fresh) { this.who = c; this.hurtT = c.hurtT; this.over.clear(); }
    this.speed = groundSpeed(c) / c.size;
    const clip = this.clipFor(c);
    if (fresh) this.anim.fade = 0;
    this.anim.play(clip);
    this.anim.fade = 0.22;
    const stride = this.uses[clip].stride;
    if (stride) this.anim.pace(clip, this.travelled(c), stride);
    // Hit: the flinch, on top.
    if (c.hurtT < this.hurtT && !fresh && !c.dead) this.anim.hurt();
    this.hurtT = c.hurtT;
    this.anim.update(fresh ? 0 : dt);
  }
}
