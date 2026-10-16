/**
 * The bone hollows style (catalog §3.4): caverns inside the ribcages of something enormous and
 * long dead. Carcasses a hundred metres and more long lie along the level's grain, one after another
 * down each of a few parallel lines, a low passage joining each to the next. A carcass is a long
 * arched chamber: a tapering tail, then the ribcage, its walls and roof a row of great curved ribs
 * every seven metres standing out from the dark rock between, a spine of vertebrae down the roof;
 * then the neck narrows, and the head is a domed skull chamber with two eye-holes going on ahead.
 * Ivory bone on dark rock: mid headroom, the strongest grain, a periodic roof.
 *
 * In section a chamber is an arch: straight walls up to where a half circle springs. Along the
 * ribcage the rock between the ribs lies further out, and each rib is a round bar carved back out
 * of it; a vertebra is a ball of rock in the roof; the skull a sphere cut by the floor. Lines along
 * u (src/gen/grainLines.ts), a column keeping every line near enough to reach it. Envelope (E1):
 * each line's floor weighted by how near it is, a roof over all of them.
 *
 * Pure, like every style.
 */
import { Noise, deriveSeed, hash2i, hashToFloat, smoothstep } from '@futuremagic/core';
import { dryAbove, type Band } from './bands';
import { Envelope } from './envelope';
import { GrainLines, grainOf } from './grainLines';
import { propModel } from './models';
import { unworked, type Column, type Working } from './quarry';
import { rockMix } from './rockTypes';
import type { Style, StyleId } from './style';
import { scatter, type Dress } from './styleProps';

export const BONES = {
  /** The lines lie this far apart, metres, each strayed by up to `jitter`, meandering by up to `meander[0]` over `meander[1]` metres. */
  spacing: 70,
  jitter: 5,
  meander: [8, 220] as const,
  /** One carcass to a stretch of line this long, metres; it starts up to `start` in, and is this long (min, extra). */
  cell: 200,
  start: 25,
  length: [110, 50] as const,
  /** A chamber's half width at its widest (min, extra), where its arch springs over the floor; the passage between carcasses, the same. */
  half: [8, 4] as const,
  spring: 3,
  passage: { half: 2.8, spring: 1.5 },
  /** Along a carcass from its tail: where the ribcage starts and ends, where the neck is narrowest, as parts of its length. */
  cage: [0.25, 0.75] as const,
  neck: 0.88,
  /** The ribs: this far apart, this thick (radius), standing out this far from the rock between them, metres. */
  rib: { pitch: 7, radius: 0.75, out: 1.8 },
  /** The vertebrae down the roof: this far apart, this big, sunk this far into the roof, metres. */
  vertebra: { pitch: 2.4, radius: 1.1, sunk: 0.45 },
  /** The skull: its radius as a part of the widest half width; the eye-holes' radius and how far they run on, metres. */
  skull: 1.05,
  eye: { radius: 1.8, run: 9 },
  /** The floor: rolling by this much over this distance along a line, up from clear of the water. */
  roll: [2.5, 260] as const,
  /** Bones and skulls on the floor: the chance of each per 3 m. */
  things: { bones: 0.05, skull: 0.04 },
  /** Pale lichen glowing on a rib's foot, either side: the chance at each, and the chance a patch is bright enough to light the bones round it. */
  lichen: 0.35,
  bright: 0.4,
} as const;

/** The lichen's glow: pale blue-green. */
const LICHEN = [0.45, 0.95, 0.8] as const;

/** Rock further than this from a chamber counts as this far, metres. */
const FAR = 10;

/** What a bone hollow column is to the code that asks about workings: natural, no pillar grid. */
const HOLLOW: Working = { id: 0x626f6e65, angle: 0, spacing: 1e9, pillar: 0, floor: 0, height: 14, collapse: 0, cavern: true, cx: 0, cz: 0 };

/** A carcass on a line: where its tail is (u), how long, which way its head lies (+1: up u), its widest half width. */
interface Carcass {
  u: number;
  len: number;
  head: number;
  half: number;
}

/** One line near a column: across it (v from its middle), its floor, the chamber's half width here and how far out the rock between the ribs lies, how near the nearest rib and vertebra are (along it), the skull's and the eyes' plan distances (Infinity: none). */
interface NearLine {
  across: number;
  floor: number;
  r: number;
  recess: number;
  rib: number;
  vertebra: number;
  /** The skull: plan distance from its middle, its radius, how high its middle stands. */
  skull: number;
  skullR: number;
  skullY: number;
  /** The eye-holes: plan distance from the nearer one's middle line. */
  eye: number;
}

export class Bones implements Style {
  readonly id: StyleId = 'bones';
  /** The rock the carcasses lie in (src/gen/rockTypes.ts). */
  readonly rocks = rockMix({ shale: 0.4, slate: 0.3, limestone: 0.3 });
  /** Ivory on the map (M). */
  readonly mapFloor = [0.66, 0.62, 0.52] as const;
  private readonly noise: Noise;
  private readonly cells: number;
  private readonly lines: GrainLines;
  private readonly own = new WeakMap<Column, NearLine[]>();

  constructor(readonly seed: number, readonly band: Band) {
    this.noise = new Noise(deriveSeed(seed, 'bones', 'shape'));
    this.cells = deriveSeed(seed, 'bones', 'cells');
    this.lines = new GrainLines(this.noise, this.cells, grainOf(seed, 'bones'), BONES.spacing, BONES.jitter, BONES.meander);
  }

  /** The carcass in stretch c of line k. */
  private carcass(k: number, c: number): Carcass {
    const B = BONES, h = hash2i(this.cells ^ 0xb0e5, k, c), f = (m: number) => hashToFloat(hash2i(h, m, 7));
    return { u: c * B.cell + B.start * f(0), len: B.length[0] + B.length[1] * f(1), head: f(2) < 0.5 ? 1 : -1, half: B.half[0] + B.half[1] * f(3) };
  }

  /** Line k's floor at u. */
  private floor(k: number, u: number): number {
    const R = BONES.roll;
    return dryAbove(this.band) + 1 + (1 + this.noise.n2(u / R[1], k * 4.3 + 0.7)) * R[0];
  }

  column(x: number, z: number, col: Column): Column {
    const B = BONES, u = this.lines.u(x, z), v = this.lines.v(x, z);
    let near = this.own.get(col);
    if (!near) { near = []; this.own.set(col, near); }
    near.length = 0;
    const env = new Envelope(FAR);
    const k0 = Math.round(v / B.spacing);
    for (let k = k0 - 1; k <= k0 + 1; k++) {
      const across = v - this.lines.line(k, u), floor = this.floor(k, u);
      const n: NearLine = { across, floor, r: B.passage.half, recess: 0, rib: Infinity, vertebra: Infinity, skull: Infinity, skullR: 0, skullY: 0, eye: Infinity };
      // The carcasses that may reach here: one to a stretch, its body running on into the next and its eye-holes into the one before.
      const ci = Math.floor(u / B.cell);
      for (let c = ci - 1; c <= ci + 1; c++) {
        const a = this.carcass(k, c), at = u - a.u, s = a.head > 0 ? at : a.len - at;
        // Along the body from its tail: the half width tapering up the tail, full through the ribcage, narrowing to the neck, widening a little to the head.
        const L = a.len, P = B.passage.half, c0 = B.cage[0] * L, c1 = B.cage[1] * L, nk = B.neck * L;
        let r: number = P;
        if (s > 0 && s < L) {
          if (s < c0) r = P + (a.half - P) * (s / c0);
          else if (s < c1) r = a.half;
          else if (s < nk) r = a.half + (P + 1.2 - a.half) * ((s - c1) / (nk - c1));
          else r = P + 1.2;
        }
        if (r > n.r) n.r = r;
        // The ribcage: the rock between the ribs lies out, ramping in over 6 m at its ends; the nearest rib along it.
        if (s > c0 - 6 && s < c1 + 6) {
          n.recess = Math.max(n.recess, B.rib.out * Math.min(1, (s - c0 + 6) / 6, (c1 + 6 - s) / 6));
          const i = Math.max(1, Math.min(Math.floor((c1 - c0) / B.rib.pitch), Math.round((s - c0) / B.rib.pitch)));
          n.rib = Math.min(n.rib, Math.abs(s - c0 - i * B.rib.pitch));
        }
        // The vertebrae from the tail to the neck.
        if (s > -2 && s < nk + 2) {
          const i = Math.max(1, Math.min(Math.floor(nk / B.vertebra.pitch), Math.round(s / B.vertebra.pitch)));
          n.vertebra = Math.min(n.vertebra, Math.abs(s - i * B.vertebra.pitch));
        }
        // The skull at the head end, and the eye-holes going on ahead from it, either side and high.
        const R = B.skull * a.half, sk = L - 0.15 * R, ds = s - sk;
        const sd = Math.hypot(ds, across);
        if (sd >= n.skull) continue;
        n.skull = sd; n.skullR = R; n.skullY = R * 0.42;
        n.eye = Math.hypot(Math.max(0, -ds, ds - R - B.eye.run), Math.abs(across) - 0.38 * R);
      }
      const top = floor + Math.max(B.spring + n.r + n.recess, n.skull < n.skullR + FAR ? n.skullY + n.skullR : 0);
      const inside = Math.max(n.r + n.recess - Math.abs(across), n.skullR - n.skull);
      if (inside > -FAR) {
        near.push(n);
        env.add(inside, floor, top);
      }
    }
    col.floor = env.floor();
    col.ceiling = env.ceiling();
    let wall = -FAR;
    for (const n of near) wall = Math.max(wall, n.r - Math.abs(n.across), n.skullR * 0.9 - n.skull);
    col.wall = wall;
    unworked(col, HOLLOW, 1000, 1);
    return col;
  }

  at(col: Column, _x: number, y: number, _z: number): number {
    const B = BONES, near = this.own.get(col)!;
    let d = -FAR;
    for (const n of near) {
      const h = y - n.floor, up = Math.max(0, h - B.spring), q = Math.hypot(n.across, up);
      // The arch with the rock between the ribs lying out, less the ribs (round bars against it).
      const out = n.r + n.recess - q, I = B.rib, rr = I.radius * Math.min(1, n.recess / I.out);
      let air = n.recess > 0 ? Math.min(out, Math.hypot(n.rib, out - rr) - rr) : out;
      air = Math.max(air, n.r - q);
      // The vertebrae: balls sunk into the roof down the middle.
      const V = B.vertebra, top = B.spring + n.r + n.recess;
      air = Math.min(air, Math.hypot(n.vertebra, n.across, h - top + V.sunk) - V.radius);
      // The skull, and the eye-holes high in it going on ahead.
      if (n.skullR > 0) {
        air = Math.max(air, n.skullR - Math.hypot(n.skull, h - n.skullY));
        air = Math.max(air, B.eye.radius - Math.hypot(n.eye, h - n.skullY - 0.35 * n.skullR));
      }
      d = Math.max(d, Math.min(air, h));
    }
    return Math.max(d, -FAR);
  }

  color(col: Column, x: number, y: number, z: number, out: Float32Array, o: number): void {
    const B = BONES, rk = this.band.rock, n = this.noise, near = this.own.get(col);
    let bone = 0, h = y - col.floor;
    if (near && near.length) {
      // The line this point is on: the nearest across.
      let l = near[0];
      for (const m of near) if (Math.abs(m.across) < Math.abs(l.across)) l = m;
      h = y - l.floor;
      const up = Math.max(0, h - B.spring), q = Math.hypot(l.across, up);
      // On a rib (near it along the line, inside the recess), on a vertebra, or on the skull's wall.
      if (l.recess > 0) bone = Math.max(bone, (1 - smoothstep(B.rib.radius, B.rib.radius + 0.5, l.rib)) * smoothstep(l.r + l.recess + 0.3, l.r + l.recess - 0.2, q));
      bone = Math.max(bone, (1 - smoothstep(B.vertebra.radius * 0.6, B.vertebra.radius + 0.6, l.vertebra)) * smoothstep(B.spring + l.r + l.recess - 2.5, B.spring + l.r + l.recess - 1, h));
      if (l.skullR > 0) bone = Math.max(bone, 1 - smoothstep(0.8, 2, Math.abs(Math.hypot(l.skull, h - l.skullY) - l.skullR)));
    }
    const floor = 1 - smoothstep(0.05, 0.3, h);
    bone *= 1 - floor;
    // Old ivory, cracked and stained; dark rock between; a floor of dust and bone grit.
    const grain = 0.9 + 0.1 * n.n2(x / 1.7 + y * 0.4, z / 1.7 - y * 0.4);
    const stain = smoothstep(0.2, 0.7, n.n2(x / 6 + 30, z / 6 - y / 4)) * 0.25;
    const IVORY = [0.94, 0.88, 0.72], ROCK = [0.16, 0.15, 0.15], DUST = [0.36, 0.33, 0.28];
    for (let c = 0; c < 3; c++) {
      const wall = (ROCK[c] + rk[c] * 0.06) * (1 - bone) + IVORY[c] * (1 - stain) * bone;
      out[o + c] = (wall * (1 - floor) + DUST[c] * floor) * grain;
    }
  }

  /** A passage from another style ends on the middle line of the nearest line (E3). */
  portal(x: number, z: number): [number, number] {
    return this.lines.nearest(x, z);
  }

  climbable(): boolean {
    return true;
  }

  /** Bones and skulls fallen on the floor; pale lichen glowing on the feet of the ribs. */
  props(d: Dress): void {
    const B = BONES, T = B.things, bones = propModel('prop_bone_pile'), skull = propModel('prop_skull');
    // The lines and stretches whose carcasses may reach into the tile: those of its corners and one beyond.
    const us: number[] = [], vs: number[] = [];
    for (const [x, z] of [[d.x0, d.z0], [d.x0 + d.size, d.z0], [d.x0, d.z0 + d.size], [d.x0 + d.size, d.z0 + d.size]]) { us.push(this.lines.u(x, z)); vs.push(this.lines.v(x, z)); }
    for (let k = Math.round(Math.min(...vs) / B.spacing) - 1; k <= Math.round(Math.max(...vs) / B.spacing) + 1; k++) {
      for (let c = Math.floor(Math.min(...us) / B.cell) - 1; c <= Math.floor(Math.max(...us) / B.cell); c++) {
        const a = this.carcass(k, c), c0 = B.cage[0] * a.len, n = Math.floor((B.cage[1] - B.cage[0]) * a.len / B.rib.pitch);
        for (let i = 1; i <= n; i++) for (const side of [-1, 1]) {
          const h = hash2i(this.cells ^ 0x11c4, k * 4096 + c, i * 2 + (side > 0 ? 1 : 0)), f = (m: number) => hashToFloat(hash2i(h, m, 5));
          if (f(0) >= B.lichen) continue;
          const s = c0 + i * B.rib.pitch, u = a.head > 0 ? a.u + s : a.u + a.len - s, line = this.lines.line(k, u);
          // At the rib's foot, just in from the wall: a patch of glowing tufts climbing it, now and then bright enough to light the ribs round it.
          let lit = f(30) < B.bright;
          for (let t = 0; t < 6; t++) {
            const [x, z] = this.lines.xz(u + (f(t + 1) - 0.5) * 1.2, line + side * (a.half - 0.1 - 0.3 * f(t + 5)));
            if (!d.mine(x, z)) continue;
            const g = this.floor(k, u), y = g + 0.15 + 1.6 * f(t + 9) * f(t + 13);
            d.glow.ellipsoid(x, y, z, 0.3 + 0.25 * f(t + 17), 0.16, 0.3 + 0.25 * f(t + 21), LICHEN, 6);
            if (lit) { d.light(x, y + 0.8, z); lit = false; }
            d.placed();
          }
        }
      }
    }
    scatter(d, 3, 0xb0e, 1.5, (x, z, g, r) => {
      const roll = r(3), yaw = r(4) * Math.PI * 2;
      if (roll < T.bones) d.solid.stamp(bones, x, g, z, yaw, { scale: 0.8 + 0.6 * r(5) });
      else if (roll < T.bones + T.skull) d.solid.stamp(skull, x, g, z, yaw, { scale: 1 + r(5) });
      else return;
      d.placed();
    });
  }
}
