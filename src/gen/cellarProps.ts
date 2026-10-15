/**
 * What is in grandma's cellar (src/gen/cellar.ts): shelves of jars and a crate or two, a bare bulb
 * under the vault, the stairs' wooden treads up to the house door; in the strange room her armchair
 * with the tin on it, the side table with her lamp and the knife block, the circle of infused salt
 * glowing on the floor; the bricks of the broken arch lying where they fell; a lamp by the old shaft.
 *
 * Pure data like the rest of the props: it places only what lies in the tile it is asked for.
 */
import { hash3f } from '@futuremagic/core';
import { CELLAR } from './cellar';
import { local, type PropBuilder, type Rgb } from './propMesh';

/** What the tile builder lends the cellar to furnish with. */
export interface Furnish {
  readonly solid: PropBuilder;
  readonly glow: PropBuilder;
  /** Whether (x, z) is in the tile being built. */
  inTile(x: number, z: number): boolean;
  /** A burning lamp's light at (x, y, z). */
  light(x: number, y: number, z: number): void;
  /** Something in the way: an upright box (as `TileBuilder.block`). */
  block(x: number, z: number, yaw: number, hx: number, hz: number, y0: number, y1: number): void;
}

const WOOD: Rgb = [0.2, 0.13, 0.075], DARK: Rgb = [0.12, 0.08, 0.05], BRICK: Rgb = [0.4, 0.2, 0.14];
const PLUSH: Rgb = [0.17, 0.21, 0.12], TIN: Rgb = [0.16, 0.24, 0.38], GOLD: Rgb = [0.55, 0.42, 0.18];
const SHADE: Rgb = [0.75, 0.62, 0.4], BULB: Rgb = [1, 0.86, 0.6], SALT: Rgb = [0.45, 0.8, 1.1], STEEL: Rgb = [0.55, 0.56, 0.58];
const JARS: readonly Rgb[] = [[0.45, 0.28, 0.08], [0.2, 0.3, 0.12], [0.5, 0.12, 0.1], [0.55, 0.45, 0.2]];

export function furnishCellar(f: Furnish): void {
  const C = CELLAR, s = f.solid;
  const at = (x: number, z: number) => f.inTile(x, z);
  const h = (a: number, b: number, k: number) => hash3f(1966, a, b, k);

  if (at(-2, 2)) {
    // Shelves along the north wall, jars of things she put up, the jars catching the bulb.
    for (const x0 of [-3.9, -2.1]) {
      for (const dx of [0, 1.5]) s.upright(x0 + dx, 0.95, 2.35, 0, 0.03, 0.95, 0.2, WOOD);
      for (const y of [0.35, 0.95, 1.55]) {
        s.upright(x0 + 0.75, y, 2.35, 0, 0.78, 0.015, 0.21, WOOD);
        for (let k = 0; k < 6; k++) {
          if (h(x0, y, k) < 0.25) continue;
          const jx = x0 + 0.12 + k * 0.25, r = 0.045 + 0.02 * h(x0, y, k + 9);
          s.cylinder(jx, y + 0.015 + r * 1.5, 2.33, r, r * 1.5, JARS[Math.floor(h(x0, y, k + 20) * JARS.length)], 8);
        }
      }
      f.block(x0 + 0.75, 2.35, 0, 0.8, 0.22, 0, 1.9);
    }
    // Crates and a barrel by the south wall.
    s.upright(-3.2, 0.25, -2.1, 0.2, 0.32, 0.25, 0.3, WOOD);
    s.upright(-3.1, 0.68, -2.15, -0.1, 0.25, 0.18, 0.22, DARK);
    s.cylinder(-1.9, 0.42, -2.1, 0.3, 0.42, DARK, 12, 0.12);
    f.block(-3.2, -2.1, 0.2, 0.35, 0.32, 0, 0.9);
    f.block(-1.9, -2.1, 0, 0.36, 0.36, 0, 0.84);
    // The bulb under the vault, on its cord.
    s.upright(-0.5, 2.5, 0, 0, 0.006, 0.1, 0.006, DARK);
    f.glow.ellipsoid(-0.5, 2.35, 0, 0.05, 0.065, 0.05, BULB, 8);
    f.light(-0.5, 2.2, 0);
  }

  if (at(-6, 0)) {
    // Wooden treads up the stairs, and the house door at the top, shut.
    const S = C.stairs, n = 14, run = (S.x[1] - S.x[0]) / n;
    for (let i = 0; i < n; i++) {
      const x = S.x[1] - (i + 0.5) * run, top = ((i + 1) / n) * S.top;
      s.upright(x, top - 0.06, 0, 0, run / 2, 0.06, S.z[1] - 0.03, WOOD);
    }
    s.upright(S.x[0] + 0.05, S.top + 1.0, 0, Math.PI / 2, 0.45, 1.0, 0.04, DARK);
    s.upright(S.x[0] + 0.1, S.top + 0.95, -0.32, 0, 0.02, 0.02, 0.03, GOLD); // the handle
  }

  if (at(4, 0)) {
    // The doorway into her room: posts and a lintel.
    const D = C.door;
    for (const z of [D.z[0] + 0.06, D.z[1] - 0.06]) s.upright(3.5, D.top / 2, z, 0, 0.08, D.top / 2, 0.06, DARK);
    s.upright(3.5, D.top - 0.07, 0, 0, 0.1, 0.07, D.z[1], DARK);
  }

  if (at(C.room.x, C.room.z)) {
    // The circle of infused salt: a thin glowing ring on the flagstones.
    const ci = C.circle, n = 40;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, x = ci.x + Math.cos(a) * ci.r, z = ci.z + Math.sin(a) * ci.r;
      f.glow.upright(x, 0.006, z, -a, 0.035, 0.006, (Math.PI * ci.r) / n + 0.01, SALT);
    }
    // Her armchair, the tin on its seat.
    const ch = C.chair, p = local(ch.x, ch.z, ch.yaw);
    const box = (side: number, fwd: number, y: number, hx: number, hy: number, hz: number, c: Rgb) => {
      const [x, z] = p(side, fwd);
      s.upright(x, y, z, ch.yaw, hx, hy, hz, c);
    };
    box(0, 0, 0.22, 0.42, 0.22, 0.42, PLUSH);
    box(0, -0.36, 0.7, 0.42, 0.42, 0.08, PLUSH);
    for (const sd of [-1, 1]) box(sd * 0.38, 0.02, 0.55, 0.07, 0.12, 0.42, PLUSH);
    for (const [sd, fw] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(sd * 0.36, fw * 0.36, 0.03, 0.03, 0.03, 0.03, DARK);
    const [tx, tz] = p(0.05, 0.08);
    s.cylinder(tx, 0.52, tz, 0.11, 0.06, TIN, 14);
    s.cylinder(tx, 0.585, tz, 0.115, 0.008, TIN, 14);
    f.block(ch.x, ch.z, ch.yaw, 0.45, 0.45, 0, 1.1);
    // The side table: her lamp, the knife block.
    const [bx, bz] = p(0.85, 0.05);
    s.cylinder(bx, 0.6, bz, 0.25, 0.02, WOOD, 14);
    s.upright(bx, 0.3, bz, 0, 0.03, 0.3, 0.03, WOOD);
    s.cylinder(bx, 0.02, bz, 0.16, 0.02, WOOD, 10);
    s.cylinder(bx - 0.08, 0.66, bz + 0.05, 0.06, 0.04, DARK, 10);
    s.upright(bx - 0.08, 0.86, bz + 0.05, 0, 0.012, 0.18, 0.012, DARK);
    s.cylinder(bx - 0.08, 1.1, bz + 0.05, 0.17, 0.11, SHADE, 12, 0, -0.25);
    f.glow.ellipsoid(bx - 0.08, 1.02, bz + 0.05, 0.04, 0.05, 0.04, BULB, 8);
    f.light(bx - 0.08, 1.0, bz + 0.05);
    s.upright(bx + 0.1, 0.72, bz - 0.06, 0.3, 0.06, 0.1, 0.05, WOOD); // the knife block
    for (let k = 0; k < 4; k++) s.upright(bx + 0.07 + k * 0.02, 0.86, bz - 0.07 + k * 0.006, 0.3, 0.008, 0.045, 0.012, DARK);
    s.upright(bx + 0.04, 0.85, bz + 0.1, 0.5, 0.06, 0.002, 0.08, [0.85, 0.83, 0.76]); // the notary's letter
    f.block(bx, bz, 0, 0.26, 0.26, 0, 1.2);
    // The bricks of the arch, broken out and lying where they fell.
    for (let k = 0; k < 26; k++) {
      const x = 8.4 + h(k, 1, 0) * 1.6, z = -0.9 + h(k, 2, 0) * 1.8, y = 0.035 + (h(k, 3, 0) < 0.3 ? 0.07 : 0);
      s.upright(x, y, z, h(k, 4, 0) * Math.PI, 0.11, 0.035, 0.055, BRICK);
    }
  }

  if (at(C.chamber.x, C.chamber.z)) {
    // A miner's lamp hung on a chain from the rock over the old shaft's rim.
    const ch = C.chamber, lx = ch.x - 1.6, lz = ch.z + 1.3;
    s.upright(lx, 2.45, lz, 0, 0.01, 0.4, 0.01, STEEL);
    s.upright(lx, 1.98, lz, 0, 0.08, 0.05, 0.08, DARK);
    f.glow.upright(lx, 1.86, lz, 0, 0.05, 0.06, 0.05, BULB);
    f.light(lx, 1.6, lz);
  }
}
