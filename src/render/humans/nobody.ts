/**
 * The nobody: the grandchild as an Actors figure (src/render/actors/figure.ts) in today's clothes,
 * posed from the body's movement by the figure's animator, with the kit they carry on its sockets:
 * a tool in the fist when fighting (at the hip otherwise), the flashlight or umbrella in the off
 * hand, grandma's pot lid on the forearm, Kemal's hard hat on the head.
 */
import { Group, type Mesh, type Object3D } from 'three/webgpu';
import type { CharacterConfig, CharacterPatch } from '@actors/generator';
import { deriveSeed } from '@futuremagic/core';
import type { Body } from '../../world/traverse/body';
import type { Level } from '../../gen/level';
import type { Item } from '../../loot/items';
import { Figure, type ActionAnim, type MoveState } from '../actors/figure';
import { personOfToday } from '../actors/looks';
import { buildHeld, hardHat, heldTool } from './wardrobe';
import { moveOf, SWIM, swimLift } from './move';

/** The nobody's look by the seed: a young adult of today (grandma's family, so always human). */
export function nobodyLook(seed: number): Promise<CharacterPatch> {
  const s = deriveSeed(seed, 'nobody');
  return personOfToday(s, { age: 0.05, female: (s & 1) === 1 });
}

/** Where a human's feet find the floor (its foot IK): the rock's surface under them, if near, on the level `level()` gives. */
export function floorUnder(level: () => Level | null): (x: number, y: number, z: number) => number | null {
  return (x, y, z) => {
    const l = level();
    if (!l) return null;
    const g = l.groundAt(x, z);
    return Math.abs(g - y) < 0.8 ? g : null;
  };
}

/** Marks (in `userData`) hair hidden under the hard hat. */
const TUCKED = 'tucked';

/** How the stowed tool hangs at the hip (socket `hip.R`): hilt up and forward. */
const STOWED = { tilt: 0.35, roll: Math.PI + 0.25 } as const;

export class Nobody {
  /** Put this into the scene (the figure in it moves with the body; a new look swaps the figure inside it). */
  readonly root = new Group();
  /** At eye height, turning with the body: things like the headlamp hang here. */
  readonly head = new Group();
  private readonly ground: (x: number, y: number, z: number) => number | null;
  /** The level the feet stand on (changes on the way down; none: the Lab). */
  level: Level | null;
  /** The figure drawn now, and the one a new look is built in (kept loaded: the creator swaps between them). */
  private figure_: Figure;
  private spare: Figure | null = null;

  /** `look`: the one made in the creator (src/game/creator.ts), else the seed's. */
  static async create(seed: number, level: Level | null, look?: CharacterConfig): Promise<Nobody> {
    return new Nobody(await Figure.load(look ?? await nobodyLook(seed), { hairShadow: true }), level);
  }

  private constructor(figure: Figure, level: Level | null) {
    this.level = level;
    this.figure_ = figure;
    this.root.add(figure.object);
    this.hangOn(figure);
    this.ground = floorUnder(() => this.level);
  }

  /** The figure drawn now (a new look swaps it). */
  get figure(): Figure { return this.figure_; }
  /** The look it was built from. */
  get look(): CharacterConfig { return structuredClone(this.figure_.character.config); }

  /**
   * Show a new look (the creator): set on the spare figure (built the first time), compiled by
   * `prepare` (src/render/stage.ts) and only then swapped in, with the kit and the head moved over.
   */
  async restyle(look: CharacterConfig, prepare: (o: Object3D) => Promise<void>): Promise<void> {
    let next = this.spare;
    this.spare = null;
    if (next) {
      await next.character.set(look);
      next.shadows(); // new parts
    } else next = await Figure.load(look, { hairShadow: true });
    await prepare(next.object);
    const old = this.figure_;
    next.object.position.copy(old.object.position);
    next.object.rotation.copy(old.object.rotation);
    for (const s of ['grip.R', 'grip.L', 'hip.R', 'forearm.L', 'head'] as const) {
      const thing = old.carry(s, null);
      if (thing) next.carry(s, thing);
    }
    this.root.add(next.object);
    old.object.removeFromParent();
    old.animator.stop();
    this.figure_ = next;
    this.spare = old;
    next.character.object.visible = this.shown_;
    this.hangOn(next);
  }

  /** Hang the head group on `f` and hide the hair under a hard hat. */
  private hangOn(f: Figure): void {
    f.object.add(this.head);
    this.head.position.y = f.height - 0.1;
    this.hideHair(f);
  }

  /** The spare figure goes (the creator is done). */
  dropSpare(): void {
    this.spare?.dispose();
    this.spare = null;
  }

  /** Dress in grandma's pot lid on the arm (the Pot Lid card) or not, and what of the kit is on (src/loot/items.ts). Changes only what changed. */
  wear(lid: boolean, items: readonly Item[]): void {
    const key = `${lid}|${items.map((i) => `${i.kind}:${i.quality}`).join(',')}`;
    if (key === this.worn) return;
    this.worn = key;
    const f = this.figure_;
    const off = lid ? 'potlid' : items.some((it) => it.kind === 'flashlight') ? 'flashlight' : items.some((it) => it.kind === 'umbrella') ? 'umbrella' : null;
    this.put('forearm.L', off === 'potlid' ? 'potlid' : null);
    this.put('grip.L', off && off !== 'potlid' ? off : null);
    this.tool = heldTool(items);
    this.drawn = null; // placed on the next pose
    this.put('head', items.some((it) => it.kind === 'miners-helmet') ? 'hardhat' : null);
    this.hideHair(f);
  }

  /** What each socket carries, by item id (to rebuild only on a change). */
  private readonly onSocket = new Map<string, string>();
  private worn = 'false|';
  /** The tool in the kit (hatchet, pick, crowbar), and whether it is in the fist now (null: not placed yet). */
  private tool: string | null = null;
  private drawn: boolean | null = null;

  /** Carry item `id` (null: nothing) on socket `s`, built for this figure. */
  private put(s: 'grip.R' | 'grip.L' | 'hip.R' | 'forearm.L' | 'head', id: string | null): void {
    if ((this.onSocket.get(s) ?? null) === id) return;
    const f = this.figure_;
    let thing: Object3D | null = null;
    if (id === 'hardhat') thing = hardHat(f.rig.headRadius);
    else if (id) {
      thing = buildHeld(id);
      if (s === 'forearm.L') thing.rotation.z = Math.PI; // the lid's top towards the elbow
      if (s === 'hip.R') thing.rotation.set(STOWED.tilt, 0, STOWED.roll);
    }
    const old = f.carry(s, thing);
    old?.traverse((m) => (m as Mesh).geometry?.dispose());
    if (id) this.onSocket.set(s, id);
    else this.onSocket.delete(s);
  }

  /** The tool in the fist when fighting, at the hip otherwise. */
  private holdTool(combat: boolean): void {
    if (this.drawn === combat) return;
    this.drawn = combat;
    this.put(combat ? 'hip.R' : 'grip.R', null);
    this.put(combat ? 'grip.R' : 'hip.R', this.tool);
  }

  /** Under the hard hat the hair is tucked away (the hair it wears: Actors keeps the others hidden). */
  private hideHair(f: Figure): void {
    const hat = this.onSocket.has('head');
    for (const o of f.meshes()) {
      if (!o.name.startsWith('hair')) continue;
      if (hat && o.visible) { o.visible = false; o.userData[TUCKED] = true; }
      else if (!hat && o.userData[TUCKED]) { o.visible = true; delete o.userData[TUCKED]; }
    }
  }

  /**
   * Show or hide the figure (hidden in first person). The root stays visible: a light hanging on
   * it must stay in the scene, or the light count, and every shader, would change.
   */
  set shown(v: boolean) {
    if (v === this.shown_) return;
    this.shown_ = v;
    this.figure_.character.object.visible = v;
  }

  private shown_ = true;

  /** Pose as a puppet (a scripted scene such as a ladder climb): feet at pos, facing yaw; `action` and `combat` as in `pose`. */
  puppet(pos: [number, number, number], vel: [number, number, number], yaw: number, move: MoveState, dt: number, time: number, action?: ActionAnim, combat = false): void {
    this.holdTool(combat);
    this.figure_.update({ pos, vel, yaw, anim: { move, action }, combat }, dt, time, null);
  }

  /**
   * Follow the body: place, turn and pose. `action`: a one-shot (a stab) playing over the movement;
   * `combat`: the tool drawn and held ready (else at the hip); `move`: what the body does, if not what its state says (crouched by a fire).
   */
  pose(b: Body, dt: number, time: number, action?: ActionAnim, combat = false, move: MoveState = moveOf(b)): void {
    const yaw = b.mode === 'climb' ? Math.atan2(b.wall[0], b.wall[2]) : b.facing;
    this.holdTool(combat);
    this.figure_.update({ pos: [b.x, b.y + this.lifted(b, dt), b.z], vel: [b.vx, b.vy, b.vz], yaw, anim: { move, action }, combat }, dt, time, this.ground);
  }

  /** How far the figure is drawn over the body's feet now (`swimLift` while swimming, else 0, eased). */
  lift = 0;

  /** Ease `lift` towards the swim pose's water line while swimming, else to the feet; its new value. */
  private lifted(b: Body, dt: number): number {
    const to = b.mode === 'swim' ? swimLift(this.figure_.height) : 0;
    return (this.lift += Math.max(-SWIM.rate * dt, Math.min(SWIM.rate * dt, to - this.lift)));
  }

  /** A blow landed on the nobody from direction (dx, dz) (towards them), strength 0..1: they flinch. */
  hit(dx: number, dz: number, strength: number): void {
    this.figure_.animator.onHit(dx, dz, strength);
  }

  /** The gait's phase for footsteps (none yet: footsteps follow the distance walked). */
  get gaitPhase(): number | null { return null; }
}
