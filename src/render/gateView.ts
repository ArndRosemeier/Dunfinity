/**
 * Draw the gates near the viewer (src/gen/gates.ts, carried by the prop tiles): a fixed pool of
 * `GATE_SLOTS` quads of the `GATE` kind, added once with the Stage; the nearest gates take them,
 * each turned flat to its wall, the world it leads to seen through it (as a thin place shows one,
 * `homeGlimpse`), its rim blue for a way down and green for a way up. Nothing is rebuilt or
 * compiled as they come and go.
 */
import { GATE as GATE_KIND, GATE_SLOTS, GATE_STATE } from './materials';
import { SlotPool } from './props/slotPool';
import { GATE, type Gate } from '../gen/gates';
import { homeGlimpse, type Glimpse } from '../world/thinPlaces';
import type { Level } from '../gen/level';

/** Gates are drawn this near (m). */
const SEEN = 70;
const DOWN = [0.25, 0.6, 1.0] as const, UP = [0.3, 1.0, 0.55] as const;

export class GateView {
  private readonly pool = new SlotPool<Gate>(GATE_SLOTS, 'gate', GATE_KIND, pane);
  readonly root = this.pool.root;
  private readonly looks = new Map<string, Glimpse>();

  /** Once a frame: the nearest of `gates` (on `level`) round (x, z), at `time` (s). */
  draw(gates: readonly Gate[], level: Level, x: number, z: number, time: number): void {
    const field = { near: (_x: number, _z: number, r: number, out: Gate[]) => { out.length = 0; for (const g of gates) if (Math.hypot(g.x - x, g.z - z) < r) out.push(g); return out; } };
    const shown = this.pool.fill(field, x, z, SEEN);
    const state = GATE_STATE.array as { set(x: number, y: number, z: number, w: number): unknown }[];
    for (let k = 0; k < GATE_SLOTS; k++) {
      const m = this.pool.slots[k], g = shown[k];
      m.visible = !!g;
      if (!g) continue;
      m.position.set(g.x, g.y, g.z);
      m.rotation.set(0, g.yaw, 0);
      m.scale.set(GATE.half[0], GATE.half[1], 1);
      const look = this.lookOf(level.seed, g.to), rim = g.to > level.depth ? DOWN : UP;
      // Held open, breathing a little.
      state[k * 5].set(0.94 + 0.06 * Math.sin(time * 0.8 + k), time, look.bay, look.height);
      state[k * 5 + 1].set(...look.stone, -GATE.over);
      state[k * 5 + 2].set(...look.light, 0);
      state[k * 5 + 3].set(...look.haze, 0);
      state[k * 5 + 4].set(rim[0], rim[1], rim[2], 0);
    }
  }

  private lookOf(seed: number, depth: number): Glimpse {
    const key = `${seed}:${depth}`;
    let l = this.looks.get(key);
    if (!l) { l = homeGlimpse(seed, depth); this.looks.set(key, l); }
    return l;
  }
}

/** Slot `slot`'s pane: a quad, x, y in -1..1, facing +z. */
function pane(slot: number) {
  return {
    positions: new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    colors: new Float32Array([0, 0, slot, 0, 0, slot, 0, 0, slot, 0, 0, slot]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  };
}
