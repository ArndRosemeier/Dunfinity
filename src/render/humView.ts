/**
 * Draw singing crystals ringing (src/world/singing.ts): a fixed pool of `HUM_SLOTS` glowing sheaths
 * of the `HUM` kind, added once with the Stage. A crystal that sings takes the slot that rang
 * longest ago, turned and stretched along it; how long it has rung and its glow go to the shader
 * (`HUM_STATE`). Nothing is rebuilt or compiled as they sing.
 */
import { Quaternion, Vector3 } from 'three/webgpu';
import { HUM, HUM_SLOTS, HUM_STATE } from './materials';
import { SlotPool } from './props/slotPool';
import type { Sung } from '../world/singing';
import type { Sited } from '../gen/cellMemo';

/** Seconds a ring is drawn. */
const RINGS = 4;
/** Around and along the sheath. */
const AROUND = 12, ALONG = 6;

export class HumView {
  private readonly pool = new SlotPool<Sited>(HUM_SLOTS, 'singing crystal', HUM, sheath);
  readonly root = this.pool.root;
  private readonly began = new Array<number>(HUM_SLOTS).fill(-Infinity);
  private readonly up = new Vector3(0, 1, 0);
  private readonly along = new Vector3();
  private readonly turn = new Quaternion();
  /** The time of the last frame drawn (s). */
  private now = 0;
  /** An age (s) to hold every ring at (the Lab and stills). */
  held: number | null = null;

  /** A crystal begins to ring at `time` (s; by default the last frame's). */
  ring(s: Sung, time = this.now): void {
    let k = 0;
    for (let i = 1; i < HUM_SLOTS; i++) if (this.began[i] < this.began[k]) k = i;
    const t = s.crystal, m = this.pool.slots[k];
    this.along.set(t.bx - t.ax, t.by - t.ay, t.bz - t.az);
    const len = this.along.length();
    this.turn.setFromUnitVectors(this.up, this.along.divideScalar(len || 1));
    m.position.set(t.ax, t.ay, t.az);
    m.quaternion.copy(this.turn);
    m.scale.set(1, len, 1);
    this.began[k] = time;
    const state = HUM_STATE.array as Vector4Like[];
    state[k * 2].set(0, t.ra, t.rb, 1);
    state[k * 2 + 1].set(s.hue[0] ** 2.2, s.hue[1] ** 2.2, s.hue[2] ** 2.2, 0);
  }

  /** Once a frame: how long each has rung at `time` (s); those done are hidden. */
  draw(time: number): void {
    this.now = time;
    const state = HUM_STATE.array as Vector4Like[];
    for (let k = 0; k < HUM_SLOTS; k++) {
      const m = this.pool.slots[k], age = Number.isFinite(this.began[k]) && this.held !== null ? this.held : time - this.began[k];
      m.visible = age >= 0 && age < RINGS;
      if (m.visible) state[k * 2].x = age;
    }
  }
}

type Vector4Like = { x: number; set(x: number, y: number, z: number, w: number): unknown };

/** Slot `slot`'s sheath: an open tube round the y axis, radius 1, from y 0 to 1. */
function sheath(slot: number) {
  const pos: number[] = [], nor: number[] = [], col: number[] = [], idx: number[] = [];
  for (let k = 0; k <= ALONG; k++) for (let a = 0; a < AROUND; a++) {
    const ang = (a / AROUND) * Math.PI * 2, c = Math.cos(ang), s = Math.sin(ang);
    pos.push(c, k / ALONG, s); nor.push(c, 0, s); col.push(0, 0, slot);
  }
  for (let k = 0; k < ALONG; k++) for (let a = 0; a < AROUND; a++) {
    const a1 = (a + 1) % AROUND, i0 = k * AROUND + a, i1 = k * AROUND + a1, j0 = i0 + AROUND, j1 = i1 + AROUND;
    idx.push(i0, j0, i1, i1, j0, j1);
  }
  return { positions: new Float32Array(pos), normals: new Float32Array(nor), colors: new Float32Array(col), indices: new Uint32Array(idx) };
}
