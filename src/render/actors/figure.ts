/**
 * A drawn person or humanoid of Actors: its Character (body, skin, hair, clothes, face) and the
 * game's animator, placed where the game says each frame. Faces like the old humans did: the
 * figure's front turned by `yaw` about +Y from −Z. After the clips, its rig (src/render/actors/rig.ts)
 * lays a scene's pose over them (`override`), puts hands and feet where a scene wants (`limbs`) and
 * closes the fists round what they carry (`carry`).
 */
import { Group, type Material, type Mesh, type Object3D } from 'three/webgpu';
import { uniform } from 'three/tsl';
import { nodeMaterials } from '@actors/three/webgpu';
import type { CharacterPatch } from '@actors/generator';
import { Character, HUMAN_PACK, packFetch } from './pack';
import { FigureAnimator, type AnimState } from './animator';
import { OWN_SHADOWS, PLAIN_SHADOW } from '../stage';
import { FigureRig, type LimbGoals, type Pose, type SocketName } from './rig';

export type { AnimState, ActionAnim, Mood, MoveState } from './animator';

/** One frame of a figure: feet position, world velocity (m/s), facing, what it does. */
export interface FigureFrame {
  pos: readonly [number, number, number];
  vel: readonly [number, number, number];
  yaw: number;
  anim: AnimState;
  combat?: boolean;
}

/** The floor under a foot at (x, y, z), or null (the old humans' foot IK; not used yet). */
export type GroundFn = (x: number, y: number, z: number) => number | null;

/** Parts too small to cast a shadow anyone sees. */
const NO_SHADOW = /^(teeth|tongue|eyes|eyebrow|brows|lashes|eyelashes)/;
/** Parts whose shadow needs their cut-outs (hair cards); every other solid part casts a plain shadow. */
const CUT_SHADOW = /^hair/;
/** How far a fist closes round a handle, radians a finger joint. */
const GRIP_CURL = 1.15;

export class Figure {
  /** The scene object: at the feet, turned to face where the game says. */
  readonly object = new Group();
  readonly animator: FigureAnimator;
  /** Sockets, the pose layer and reaching. */
  readonly rig: FigureRig;
  /** A pose laid over the clips (a scene's, like the ladder climb) and how much of it (0..1). */
  override: { pose: (p: Pose) => void; w: number } | null = null;
  /** Hands and feet put where a scene wants them (after `override`). */
  limbs: LimbGoals | null = null;
  /** What each socket carries. */
  private readonly carried = new Map<SocketName, Object3D>();

  private constructor(readonly character: Character) {
    this.object.name = 'actors-figure';
    // Its skinning nodes are its own, so are its shadow shaders: each warmed (src/render/stage.ts).
    this.object.userData[OWN_SHADOWS] = true;
    this.object.add(character.object);
    this.animator = new FigureAnimator(character);
    this.rig = new FigureRig(this.object, character.actor.bones);
    this.rig.fit(character.height);
    // A new body shape is bound in the bind pose: measure it again there.
    character.onShape((h) => this.rig.fit(h));
  }

  /** Builds a figure with a look (missing fields: Actors' defaults) and loads its clips. */
  static async load(look: CharacterPatch): Promise<Figure> {
    const character = await Character.load({
      pack: HUMAN_PACK,
      renderer: null,
      materials: nodeMaterials,
      clipLibraries: false,
      fetcher: packFetch,
      config: { anatomy: false, ...look, animation: null },
    });
    const figure = new Figure(character);
    figure.shadows();
    await figure.animator.load();
    return figure;
  }

  /**
   * Set how its parts cast shadows; again after its look changes (new parts). The mouth and eyes cast
   * none worth its shader (each figure's are its own); solid parts a plain one, shared by every
   * figure (src/render/stage.ts `PLAIN_SHADOW`); hair keeps its cut-outs.
   */
  shadows(): void {
    this.character.object.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      if (NO_SHADOW.test(m.name)) m.castShadow = false;
      const mat = m.material as Material;
      if (m.castShadow && !mat.transparent && !CUT_SHADOW.test(m.name)) mat.userData[PLAIN_SHADOW] = true;
    });
  }

  /** Standing height, metres. */
  get height(): number {
    return this.character.height;
  }

  /** A ghost's fade (0 gone .. 1 there; src/render/actors/ghost.ts reads it); the living ignore it. */
  readonly fadeNode = uniform(1);

  get fade(): number {
    return this.fadeNode.value;
  }

  set fade(v: number) {
    this.fadeNode.value = v;
  }

  /** The hips' height over the feet standing, metres. */
  get hipHeight(): number {
    return this.rig.hipHeight;
  }

  /**
   * Carry `thing` on socket `name` (built in that socket's space; null: nothing). Returns what was
   * there before, taken off, for the caller to dispose. A fist with something in it closes round it.
   */
  carry(name: SocketName, thing: Object3D | null): Object3D | null {
    const old = this.carried.get(name) ?? null;
    if (old === thing) return null;
    old?.removeFromParent();
    if (thing) {
      this.rig.socket(name).add(thing);
      this.carried.set(name, thing);
    } else this.carried.delete(name);
    return old;
  }

  /** Pose for this frame. */
  update(f: FigureFrame, dt: number, time: number, _ground: GroundFn | null = null): void {
    this.object.position.set(f.pos[0], f.pos[1], f.pos[2]);
    // Actors' bodies face +Z; the game's figures face −Z turned by yaw.
    this.object.rotation.y = f.yaw + Math.PI;
    this.rig.relax();
    this.animator.update({ anim: f.anim, speed: Math.hypot(f.vel[0], f.vel[2]), time, combat: f.combat }, dt);
    this.character.update(dt);
    this.afterClips();
  }

  /** The rig's turn: a scene's pose, its hands and feet, fists round what they hold. */
  private afterClips(): void {
    if (this.override) this.rig.pose(this.override.pose, this.override.w);
    const limbs = this.limbs;
    if (limbs) this.rig.reachFor(limbs);
    for (const side of ['L', 'R'] as const) {
      if (!this.carried.has(side === 'R' ? 'grip.R' : 'grip.L')) continue;
      const curled = limbs && (limbs.curlW ?? 0) > 0 && limbs.curl?.[side] !== undefined;
      if (!curled) this.rig.curl(side, GRIP_CURL);
    }
  }

  dispose(): void {
    this.animator.stop();
    this.character.dispose();
    this.object.removeFromParent();
  }
}
