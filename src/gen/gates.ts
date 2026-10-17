/**
 * Gates (Arnd 2026-10-17): thin places that hold still, set flat in a rock wall, each a way to the
 * level above or below. Walk into one and you come out of its twin on that level, somewhere else
 * (a few hundred metres off), with the twin's face behind you: every gate has a way back.
 *
 * A pair belongs to the boundary between two levels (b and b + 1, b ≥ 1: none into the cellar). It
 * is rolled per cell of that boundary: its upper end lies in that cell on level b, its lower end in a
 * cell up to `GATE.off` cells away on level b + 1. Each end is set on an upright wall near its cell's
 * middle with open floor before it. A pair exists only if both ends found such a wall.
 *
 * Pure (the levels' fields only), and slow to work out (a wall sought on two levels), so the prop
 * tiles carry them (`PropTile.gates`, built off the main thread); src/render/gateView.ts draws them,
 * the game walks you through.
 */
import { Rng, deriveSeed } from '@futuremagic/core';
import { CellMemo } from './cellMemo';
import { Level } from './level';
import { PROP_TILE } from './propGrid';

export const GATE = {
  /** A boundary's cells (m); the share of cells with a pair. */
  cell: 160,
  chance: 0.6,
  /** The lower end lies this many cells off the upper one at most (each way). */
  off: 2,
  /** An end is sought within this of its cell's middle (m), with this many tries. */
  spread: 50,
  tries: 24,
  /** The wall is looked for this far from the floor point (m); one stands this far out from it. */
  reach: 8,
  stand: 1.6,
  /** Half its width and height (m), its middle this high over the floor before it. */
  half: [1.3, 1.7] as const,
  over: 1.9,
  /** Walking within this of its face (m), inside its frame, goes through. */
  through: 0.75,
  /** The nearest gate within this (m) has its other end prepared (src/render/prepared.ts). */
  prepare: 90,
} as const;

/** Where an end hangs: its middle (on the wall), the way its face looks (+z along (sin yaw, cos yaw)), and where one stands before it. */
export interface Place {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly stand: readonly [number, number, number];
}

/** One end of a pair on a level: where it hangs, the level it leads to, and its twin there (where one comes out). */
export interface Gate extends Place {
  /** The pair's id (the same on both ends). */
  readonly id: string;
  readonly to: number;
  readonly twin: Place;
}

/** A pair rolled for boundary cell (i, j): the cell its lower end lies in, and its own rng seed. */
interface Roll {
  readonly p: number;
  readonly q: number;
  readonly seed: number;
}

/**
 * The gates of one level. `above` and `below` are the levels next to it (null where there is none,
 * or none with gates): a pair counts only where its other end has a wall too.
 */
export class Gates {
  private readonly downs: CellMemo<Gate | null>;
  private readonly ups: CellMemo<Gate[]>;

  constructor(readonly level: Level, above: Level | null, below: Level | null) {
    const d = level.depth;
    // Ends leading down: boundary d, the upper ends in cell (i, j).
    this.downs = new CellMemo((i, j) => {
      if (!below || d < 1) return null;
      const r = rollOf(level.seed, d, i, j);
      if (!r) return null;
      const here = placeOn(level, i, j, r.seed, 'upper'), there = here && placeOn(below, r.p, r.q, r.seed, 'lower');
      return here && there ? { ...here, id: `${d}:${i}:${j}`, to: d + 1, twin: there } : null;
    });
    // Ends leading up: boundary d - 1, the lower ends landing in cell (p, q), from any cell within `off`.
    this.ups = new CellMemo((p, q) => {
      const b = d - 1, out: Gate[] = [];
      if (!above || b < 1) return out;
      for (let j = q - GATE.off; j <= q + GATE.off; j++) for (let i = p - GATE.off; i <= p + GATE.off; i++) {
        const r = rollOf(level.seed, b, i, j);
        if (!r || r.p !== p || r.q !== q) continue;
        const here = placeOn(level, p, q, r.seed, 'lower'), there = here && placeOn(above, i, j, r.seed, 'upper');
        if (here && there) out.push({ ...here, id: `${b}:${i}:${j}`, to: b, twin: there });
      }
      return out;
    });
  }

  /** The gates within `r` m of (x, z). */
  near(x: number, z: number, r: number, out: Gate[] = []): Gate[] {
    out.length = 0;
    const c = GATE.cell;
    for (let j = Math.floor((z - r - GATE.spread) / c); j <= Math.floor((z + r + GATE.spread) / c); j++) {
      for (let i = Math.floor((x - r - GATE.spread) / c); i <= Math.floor((x + r + GATE.spread) / c); i++) {
        const g = this.downs.at(i, j);
        if (g && Math.hypot(g.x - x, g.z - z) < r) out.push(g);
        for (const u of this.ups.at(i, j)) if (Math.hypot(u.x - x, u.z - z) < r) out.push(u);
      }
    }
    return out;
  }

  /** The gates whose middle lies in prop tile (tx, tz). */
  inTile(tx: number, tz: number): Gate[] {
    const c = PROP_TILE, out = this.near((tx + 0.5) * c, (tz + 0.5) * c, c * 0.75);
    return out.filter((g) => Math.floor(g.x / c) === tx && Math.floor(g.z / c) === tz);
  }
}

/** The gates of `level` (its neighbours made for it), kept for the last few levels asked. */
export function gatesOf(level: Level): Gates {
  const key = `${level.seed}:${level.depth}:${level.style ?? ''}`;
  let g = kept.get(key);
  if (!g || g.level !== level) {
    const near = (d: number) => (d >= 1 ? new Level(level.seed, d, level.style) : null);
    g = new Gates(level, near(level.depth - 1), near(level.depth + 1));
    kept.set(key, g);
    if (kept.size > 4) kept.delete(kept.keys().next().value!);
  }
  return g;
}
const kept = new Map<string, Gates>();

/** Whether feet at (x, y, z) walk into gate `g`: against its face, inside its frame. */
export function walksInto(g: Gate, x: number, y: number, z: number): boolean {
  return inFrame(g, x, y, z, GATE.half[0], GATE.over, -0.2, GATE.through);
}

/**
 * Whether feet at (x, y, z) are in the frame of a window hanging at `p` (a gate, a thin place: its
 * face looking along (sin yaw, cos yaw), its middle `over` m above the floor, `half` m its half
 * width): between `behind` and `before` m off its face, inside its width, not above it.
 */
export function inFrame(p: { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number }, x: number, y: number, z: number, half: number, over: number, behind: number, before: number): boolean {
  const dx = x - p.x, dz = z - p.z, s = Math.sin(p.yaw), c = Math.cos(p.yaw);
  const across = dx * c - dz * s, off = dx * s + dz * c, up = y - p.y;
  return off > behind && off < before && Math.abs(across) < half * 0.85 && up > -over - 0.6 && up < 0;
}

/** The pair rolled for cell (i, j) of boundary b, or null. */
function rollOf(seed: number, b: number, i: number, j: number): Roll | null {
  const rng = new Rng(deriveSeed(seed, 'gate', b, i, j));
  if (!rng.chance(GATE.chance)) return null;
  let p = i, q = j;
  while (p === i && q === j) { p = i + rng.int(-GATE.off, GATE.off); q = j + rng.int(-GATE.off, GATE.off); }
  return { p, q, seed: deriveSeed(seed, 'gate place', b, i, j) };
}

/** An end on level l near the middle of cell (i, j): an upright wall with open floor before it, or null. */
function placeOn(l: Level, i: number, j: number, seed: number, end: 'upper' | 'lower'): Place | null {
  const rng = new Rng(deriveSeed(seed, end));
  const n: [number, number, number] = [0, 0, 0];
  for (let k = 0; k < GATE.tries; k++) {
    const a = rng.range(0, Math.PI * 2), r = rng.range(0, GATE.spread);
    const px = (i + 0.5) * GATE.cell + Math.cos(a) * r, pz = (j + 0.5) * GATE.cell + Math.sin(a) * r, g = l.groundAt(px, pz);
    if (Math.abs(g - l.floorAt(px, pz)) > 0.5 || !l.dry(px, pz, 0.3) || l.sdf(px, g + 1.6, pz) < 0.6) continue;
    // Out to the nearest wall round it, then onto its face.
    const y = g + GATE.over, turn = rng.range(0, Math.PI / 4);
    let hit: number = GATE.reach, dx = 0, dz = 0;
    for (let a = 0; a < 8; a++) {
      const t = turn + (a * Math.PI) / 4, ex = Math.cos(t), ez = Math.sin(t), h = l.trace(px, y, pz, ex, 0, ez, GATE.reach);
      if (h < hit) { hit = h; dx = ex; dz = ez; }
    }
    if (hit >= GATE.reach) continue;
    const face = l.ontoRock(px + dx * hit, y, pz + dz * hit, n);
    if (!face) continue;
    // One stands out before it, on floor level with the floor under it, with room.
    const sx = face[0] + n[0] * GATE.stand, sz = face[2] + n[2] * GATE.stand, sg = l.groundAt(sx, sz);
    if (Math.abs(sg - g) > 0.8 || Math.abs(sg - l.floorAt(sx, sz)) > 0.5 || l.sdf(sx, sg + 1.6, sz) < 0.6) continue;
    // On the wall at its own middle's height; nothing of the wall stands out in front of it at its corners (a recess behind is fine).
    const at = l.ontoRock(face[0], sg + GATE.over, face[2], n, true);
    if (!at || !clear(l, at, n, sg)) continue;
    const off = 0.06;
    return { x: at[0] + n[0] * off, y: at[1], z: at[2] + n[2] * off, yaw: Math.atan2(n[0], n[2]), stand: [sx, sg + 0.05, sz] };
  }
  return null;
}

/** Whether no rock stands out more than a little in front of the wall at `face` (looking out along n) at the gate's corners. */
function clear(l: Level, face: readonly [number, number, number], n: readonly [number, number, number], floor: number): boolean {
  const tx = -n[2], tz = n[0];
  for (const u of [-1, 1]) for (const h of [0.5, GATE.over * 2 - 0.5]) {
    const x = face[0] + tx * u * GATE.half[0], z = face[2] + tz * u * GATE.half[0], y = floor + h;
    // Along -n from a little out: rock met well before the plane stands in front of it.
    if (l.trace(x + n[0] * 0.6, y, z + n[2] * 0.6, -n[0], 0, -n[2], 1.4) < 0.35) return false;
  }
  return true;
}
