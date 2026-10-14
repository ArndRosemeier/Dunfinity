/**
 * The nobody, for now: a stand-in figure of boxes (Scale's human comes later, decision D1), posed
 * from the body's movement: walking legs and arms, arms up on a wall, low in the water.
 */
import { Group, type Mesh } from 'three/webgpu';
import { PropBuilder, type Rgb } from '../gen/propMesh';
import type { Body } from '../world/traverse/body';
import { VERTEX_COLOR_SOLID } from './materials';
import { meshFromData } from './meshes';

const COAT: Rgb = [0.09, 0.11, 0.14];
const TROUSERS: Rgb = [0.06, 0.055, 0.05];
const SKIN: Rgb = [0.55, 0.38, 0.29];
const HAIR: Rgb = [0.05, 0.035, 0.025];

/** A box mesh hanging from a pivot: the box spans y from `top` down `len` metres below the pivot. */
function limb(hx: number, len: number, hz: number, color: Rgb): Mesh {
  const b = new PropBuilder();
  b.box(0, -len / 2, 0, [hx, 0, 0], [0, len / 2, 0], [0, 0, hz], color);
  const m = meshFromData(b.build()!, VERTEX_COLOR_SOLID);
  m.matrixAutoUpdate = true;
  return m;
}

export class Figure {
  readonly root = new Group();
  /** Where the eyes are (things like the headlamp hang here). */
  readonly head = new Group();
  private readonly legs: Group[] = [];
  private readonly arms: Group[] = [];
  private phase = 0;

  constructor() {
    const torso = new Group();
    torso.position.y = 0.92;
    this.root.add(torso);
    const body = limb(0.2, 0.62, 0.12, COAT);
    body.position.y = 0.62;
    torso.add(body);
    this.head.position.y = 0.72;
    torso.add(this.head);
    const face = limb(0.1, 0.24, 0.11, SKIN);
    face.position.y = 0.2;
    const hair = limb(0.105, 0.08, 0.115, HAIR);
    hair.position.y = 0.22;
    this.head.add(face, hair);
    for (const side of [-1, 1]) {
      const leg = new Group();
      leg.position.set(side * 0.1, 0.92, 0);
      leg.add(limb(0.075, 0.9, 0.08, TROUSERS));
      this.root.add(leg);
      this.legs.push(leg);
      const arm = new Group();
      arm.position.set(side * 0.27, 0.6, 0);
      arm.add(limb(0.055, 0.62, 0.06, COAT));
      torso.add(arm);
      this.arms.push(arm);
    }
  }

  /**
   * Show or hide the figure's meshes (hidden in first person). The root stays visible: a light
   * hanging on the figure must stay in the scene, or the light count, and every shader, would change.
   */
  set shown(v: boolean) {
    this.root.traverse((o) => { if ((o as Mesh).isMesh) o.visible = v; });
  }

  /** Follow the body: place, turn and pose. */
  pose(b: Body, dt: number): void {
    this.root.position.set(b.x, b.y, b.z);
    const facing = b.mode === 'climb' ? Math.atan2(b.wall[0], b.wall[2]) : b.facing;
    this.root.rotation.y = facing;
    const speed = Math.hypot(b.vx, b.vz, b.mode === 'climb' ? b.vy : 0);
    this.phase += dt * speed * 2.4;
    const swing = Math.sin(this.phase) * Math.min(0.7, speed * 0.15);
    const [l, r] = this.legs, [la, ra] = this.arms;
    if (b.mode === 'climb') {
      la.rotation.x = Math.PI * 0.85 + swing * 0.5; ra.rotation.x = Math.PI * 0.85 - swing * 0.5;
      l.rotation.x = -0.3 - swing * 0.4; r.rotation.x = -0.3 + swing * 0.4;
    } else if (b.mode === 'swim') {
      la.rotation.x = 1.4 + swing; ra.rotation.x = 1.4 - swing;
      l.rotation.x = swing * 0.6; r.rotation.x = -swing * 0.6;
    } else {
      l.rotation.x = swing; r.rotation.x = -swing;
      la.rotation.x = -swing * 0.8; ra.rotation.x = swing * 0.8;
      if (!b.grounded && b.vy < -3) { la.rotation.x = ra.rotation.x = 2.2; } // falling: arms up
    }
  }
}
