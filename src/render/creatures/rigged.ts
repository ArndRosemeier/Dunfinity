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
import { AnimationMixer, AnimationUtils, AdditiveAnimationBlendMode, LoopOnce, LoopRepeat, Mesh, type AnimationAction, type AnimationClip, type Object3D, type Texture } from 'three/webgpu';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { GLOW, VERTEX_COLOR_SOLID, type CoatKind, type MaterialKind } from '../materials';
import { wear } from '../meshes';

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
