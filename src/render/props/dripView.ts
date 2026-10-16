/**
 * Draw the living stalagmites (src/gen/drips.ts): a fixed pool of `DRIP_SLOTS` meshes of the `DRIP`
 * kind, added once with the Stage, each a stalagmite, its stalactite and its drops in unit shapes.
 * Each frame the nearest sites take the slots, and their look goes to the shader (`DRIP_STATE`):
 * nothing is rebuilt as they grow, nothing compiles.
 */
import { Group, type Mesh } from 'three/webgpu';
import { Rng, hash2i } from '@futuremagic/core';
import { meshFromData } from '../meshes';
import { DRIP as DRIP_KIND, DRIP_SLOTS, DRIP_STATE, DRIP_STONE, DRIP_TIMING } from '../materials';
import { DRIP, dripLook, type DripLook, type DripSite } from '../../gen/drips';
import type { Level } from '../../gen/level';

/** Rings up a stalagmite and round it; the stalactite's; the drops' ball. */
const RINGS = 18, AROUND = 16, HANG_RINGS = 6, BALL = [5, 8] as const;

/** Dripstone (linear rgb): calcite, and salt where the rock is salt. */
const CALCITE = [0.5, 0.43, 0.33] as const, SALT = [0.6, 0.6, 0.6] as const;

export class DripView {
  readonly root = new Group();
  private readonly slots: Mesh[] = [];
  private readonly sites: DripSite[] = [];
  private readonly look: DripLook = { height: 0, radius: 0, sunk: 0, drip: 0, wet: 0, t: 0 };
  private level: Level | null = null;
  /** A time to hold every site at instead of the clock (the Lab and stills: to see one moment of the cycle). */
  held: number | null = null;

  constructor() {
    for (let i = 0; i < DRIP_SLOTS; i++) {
      const m = meshFromData(slotShapes(i), DRIP_KIND);
      m.name = 'drip';
      m.frustumCulled = false; // the shader shapes it far beyond its unit geometry
      m.visible = false;
      m.matrixAutoUpdate = true;
      this.root.add(m);
      this.slots.push(m);
    }
    DRIP_TIMING.value.set(DRIP.drops, DRIP.gap, DRIP.swell, DRIP.gravity);
  }

  /** The sites drawn now, nearest first (for their sounds). */
  get shown(): readonly DripSite[] { return this.sites; }

  /** Once a frame: give the slots to the sites nearest (x, z) and set their look at `time` (s). */
  draw(level: Level, x: number, z: number, time: number): void {
    if (level !== this.level) {
      this.level = level;
      const c = (level.band.rocks.salt ?? 0) > 0.3 ? SALT : CALCITE;
      DRIP_STONE.value.set(c[0], c[1], c[2]);
    }
    level.drips.near(x, z, DRIP.seen, this.sites);
    this.sites.sort((a, b) => (a.x - x) ** 2 + (a.z - z) ** 2 - ((b.x - x) ** 2 + (b.z - z) ** 2));
    if (this.sites.length > DRIP_SLOTS) this.sites.length = DRIP_SLOTS;
    const state = DRIP_STATE.array as { set(x: number, y: number, z: number, w: number): unknown }[];
    for (let i = 0; i < DRIP_SLOTS; i++) {
      const m = this.slots[i], s = this.sites[i];
      m.visible = !!s;
      if (!s) continue;
      const l = dripLook(s, this.held ?? time, this.look);
      m.position.set(s.x, s.y, s.z);
      state[i * 3].set(Math.max(l.height, 0.002), Math.max(l.radius, 0.01), l.sunk, s.roof - s.y);
      state[i * 3 + 1].set(l.drip, l.t, l.wet, 0);
      state[i * 3 + 2].set(s.hang, s.hangRadius, 0, 0);
    }
  }
}

/** Slot `slot`'s unit shapes: the stalagmite (lumpy rings, a flared foot, a round tip), the stalactite, the drops. */
function slotShapes(slot: number) {
  const pos: number[] = [], nor: number[] = [], col: number[] = [], idx: number[] = [];
  const rng = new Rng(hash2i(slot, 77, 0));
  // Lumps: a few slow waves round it and up it, so the flowstone bulges smoothly.
  const waves = Array.from({ length: 3 }, (_, i) => ({ n: i + 2, up: rng.range(2, 6), a: rng.range(0, 6.28), b: rng.range(0, 6.28), size: rng.range(0.04, 0.08) }));
  const lump = (ang: number, y: number) => waves.reduce((sum, w) => sum + w.size * Math.sin(w.n * ang + w.a) * Math.sin(w.up * y + w.b), 0);
  // A surface of revolution: rings k = 0..rings at height y(k) with radius r(y); faces out.
  const revolve = (rings: number, ringY: (k: number) => number, r: (y: number) => number, role: number, lumpy: boolean) => {
    const base = pos.length / 3, down = ringY(1) < ringY(0);
    for (let k = 0; k <= rings; k++) {
      const y = ringY(k), e = 0.005;
      const slope = -(r(y + e) - r(y - e)) / (2 * e); // the normal leans up as fast as r falls with y
      const len = Math.hypot(1, slope);
      for (let a = 0; a < AROUND; a++) {
        const ang = (a / AROUND) * Math.PI * 2, c = Math.cos(ang), s = Math.sin(ang);
        const rr = r(y) * (lumpy ? 1 + lump(ang, y) : 1);
        pos.push(c * rr, y, s * rr);
        nor.push(c / len, slope / len, s / len);
        col.push(role, 0, slot);
      }
    }
    for (let k = 0; k < rings; k++) for (let a = 0; a < AROUND; a++) {
      const a1 = (a + 1) % AROUND, i0 = base + k * AROUND + a, i1 = base + k * AROUND + a1, j0 = i0 + AROUND, j1 = i1 + AROUND;
      if (down) idx.push(i0, i1, j0, i1, j1, j0);
      else idx.push(i0, j0, i1, i1, j0, j1);
    }
  };
  // The stalagmite: a foot flaring into the floor, a stout body tapering a little, a domed top (y 0..1).
  // Rings closer together at the foot and the top, where the shape turns.
  const dome = 0.22;
  const stalag = (h: number) => {
    const c = Math.min(1, Math.max(0, h)), body = 0.5 + 0.5 * (1 - c) ** 1.3 + 0.45 * Math.exp(-c * 14);
    return c < 1 - dome ? body : body * Math.sqrt(Math.max(0, 1 - ((c - (1 - dome)) / dome) ** 2));
  };
  revolve(RINGS, (k) => 0.5 - 0.5 * Math.cos((k / RINGS) * Math.PI), stalag, 0, true);
  // The stalactite: from the roof (y 0) down to its point (y -1), a thick root tapering.
  revolve(HANG_RINGS, (k) => -k / HANG_RINGS, (y) => { const h = Math.min(1, Math.max(0, -y)); return (1 - h) ** 1.4 * 1.2 + 0.05 * (1 - h); }, 2, false);
  // The drops: a unit ball each.
  for (let d = 0; d < DRIP.drops; d++) {
    const base = pos.length / 3, [rows, cols] = BALL;
    for (let i = 0; i <= rows; i++) for (let j = 0; j < cols; j++) {
      const th = (i / rows) * Math.PI, ph = (j / cols) * Math.PI * 2;
      const x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph);
      pos.push(x, y, z); nor.push(x, y, z); col.push(1, d, slot);
    }
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const j1 = (j + 1) % cols, a = base + i * cols + j, b = base + i * cols + j1, c = a + cols, e = b + cols;
      idx.push(a, b, c, b, e, c);
    }
  }
  return { positions: new Float32Array(pos), normals: new Float32Array(nor), colors: new Float32Array(col), indices: new Uint32Array(idx) };
}
