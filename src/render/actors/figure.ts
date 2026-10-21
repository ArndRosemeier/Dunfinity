/**
 * A drawn person or humanoid of Actors: its Character (body, skin, hair, clothes, face) and the
 * game's animator, placed where the game says each frame. Faces like the old humans did: the
 * figure's front turned by `yaw` about +Y from −Z.
 */
import { Group } from 'three/webgpu';
import { nodeMaterials } from '@actors/three/webgpu';
import type { CharacterPatch } from '@actors/generator';
import { Character, HUMAN_PACK, packFetch } from './pack';
import { FigureAnimator, type AnimState } from './animator';

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

export class Figure {
  /** The scene object: at the feet, turned to face where the game says. */
  readonly object = new Group();
  readonly animator: FigureAnimator;

  private constructor(readonly character: Character) {
    this.object.name = 'actors-figure';
    this.object.add(character.object);
    this.animator = new FigureAnimator(character);
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
    await figure.animator.load();
    return figure;
  }

  /** Standing height, metres. */
  get height(): number {
    return this.character.height;
  }

  /** A ghost's fade (0 gone .. 1 there); the living ignore it. */
  fade = 1;

  /** Pose for this frame. */
  update(f: FigureFrame, dt: number, time: number, _ground: GroundFn | null = null): void {
    this.object.position.set(f.pos[0], f.pos[1], f.pos[2]);
    // Actors' bodies face +Z; the game's figures face −Z turned by yaw.
    this.object.rotation.y = f.yaw + Math.PI;
    this.animator.update({ anim: f.anim, speed: Math.hypot(f.vel[0], f.vel[2]), time, combat: f.combat }, dt);
    this.character.update(dt);
  }

  dispose(): void {
    this.animator.stop();
    this.character.dispose();
    this.object.removeFromParent();
  }
}
