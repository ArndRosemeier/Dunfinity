/**
 * What is in grandma's cellar (src/gen/cellar.ts): shelves of jars and a crate or two, a bare bulb
 * under the vault, the stairs' wooden treads up into the house; in the strange room her armchair
 * with the tin on it, the side table with her lamp and the knife block, the circle of infused salt
 * glowing on the floor; the bricks of the broken arch lying where they fell; a lamp by the old shaft.
 * Upstairs, her ground floor as she left it (`furnishHouse`): its thin walls, the front door open,
 * night at the windows, the kitchen, her bedroom, the living room and its photographs.
 *
 * Pure data like the rest of the props: it places only what lies in the tile it is asked for.
 */
import { hash3f } from '@futuremagic/core';
import { CELLAR } from './cellar';
import { local, type PropBuilder, type Rgb } from './propMesh';
import { furnishTown } from './townProps';

/** What the tile builder lends the cellar to furnish with. */
export interface Furnish {
  readonly solid: PropBuilder;
  readonly glow: PropBuilder;
  /** Drawn as rock: shapes `dressed` with a surface record (the town's plastered walls and tiled roofs). */
  readonly rock: PropBuilder;
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
    hangBulb(f, -0.5, C.cellar.crown, 0);
  }

  if (at(-6, 0)) {
    // Over the cellar door (src/gen/doorways.ts), at the foot of the stairs: a lintel up to the vault.
    s.upright(C.cellar.x[0] + 0.05, 2.4, 0, 0, 0.1, 0.25, C.stairs.z[1] + 0.15, DARK);
    // Wooden treads up the stairs into the house.
    const S = C.stairs, n = 14, run = (S.x[1] - S.x[0]) / n;
    for (let i = 0; i < n; i++) {
      const x = S.x[1] - (i + 0.5) * run, top = ((i + 1) / n) * S.top;
      s.upright(x, top - 0.06, 0, 0, run / 2, 0.06, S.z[1] - 0.03, WOOD);
    }
  }

  furnishHouse(f);
  furnishTown(f);

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
    s.upright(C.letter.x, C.letter.y, C.letter.z, 0.5, 0.08, 0.003, 0.11, [0.85, 0.83, 0.76]); // the notary's letter
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

const PAPER: Rgb = [0.42, 0.39, 0.28], CLOTH: Rgb = [0.35, 0.12, 0.1], LINEN: Rgb = [0.7, 0.68, 0.6], ENAMEL: Rgb = [0.72, 0.72, 0.66];
const NIGHT: Rgb = [0.05, 0.07, 0.13];
const PHOTOS: readonly Rgb[] = [[0.42, 0.38, 0.3], [0.3, 0.28, 0.25], [0.5, 0.44, 0.34], [0.36, 0.33, 0.3]];

/**
 * Grandma's ground floor (CELLAR.house): the hall the stairs come up into, the front door at its
 * west end (open onto the street, src/gen/town.ts), the kitchen and her bedroom to the north, the living room
 * to the south. Its inner walls are thin boards of wallpaper (furniture, so they show), with doorways.
 */
function furnishHouse(f: Furnish): void {
  const H = CELLAR.house, F = H.floor, s = f.solid, top = F + H.height;
  const at = (x: number, z: number) => f.inTile(x, z);
  const h = (a: number, b: number, k: number) => hash3f(1967, a, b, k);
  /** A wall along x at `z` from x0 to x1, a doorway in each gap [a, b]; or along z (`alongZ`). */
  const wall = (along: 'x' | 'z', at0: number, from: number, to: number, gaps: readonly (readonly [number, number])[]) => {
    const cuts = [from, ...[...gaps].sort((a, b) => a[0] - b[0]).flat(), to];
    const piece = (a: number, b: number, y0: number, y1: number) => {
      const m = (a + b) / 2, hl = (b - a) / 2, hy = (y1 - y0) / 2, cy = (y0 + y1) / 2;
      const [x, z] = along === 'x' ? [m, at0] : [at0, m];
      if (!at(x, z)) return;
      const yaw = along === 'x' ? 0 : Math.PI / 2;
      s.upright(x, cy, z, yaw, hl, hy, 0.06, PAPER);
      f.block(x, z, yaw, hl, 0.08, y0, y1);
    };
    for (let i = 0; i < cuts.length; i += 2) piece(cuts[i], cuts[i + 1], F, top);
    for (const [a, b] of gaps) piece(a, b, F + 2.05, top); // over the doorway
  };
  // The hall runs the middle (z in [-1.1, 1.1]); the kitchen (east) and her bedroom (west) north of it, the living room south.
  wall('x', 1.1, H.x[0], H.x[1], [[-10.4, -9.4], [-13.6, -12.6]]);
  wall('x', -1.1, H.x[0], H.x[1], [[-12.2, -11.2]]);
  wall('z', -11.6, 1.1, H.z[1], []);

  // A rail round the stairwell, where the stairs come up through the floor.
  const S = CELLAR.stairs;
  if (at(-7.8, 0)) for (const z of [S.z[0] - 0.08, S.z[1] + 0.08]) {
    s.upright((S.x[0] + H.x[1]) / 2, F + 0.9, z, 0, (H.x[1] - S.x[0]) / 2, 0.03, 0.03, WOOD);
    s.upright(S.x[0] + 0.03, F + 0.45, z, 0, 0.03, 0.45, 0.03, WOOD);
    f.block((S.x[0] + H.x[1]) / 2, z, 0, (H.x[1] - S.x[0]) / 2, 0.06, F, F + 1);
  }

  // Night at the windows: dark panes with their crosses, one or two to a room.
  const window = (x: number, z: number, yaw: number) => {
    if (!at(x, z)) return;
    f.glow.upright(x, F + 1.5, z, yaw, 0.5, 0.6, 0.01, NIGHT);
    s.upright(x, F + 1.5, z, yaw, 0.03, 0.6, 0.025, WOOD);
    s.upright(x, F + 1.5, z, yaw, 0.5, 0.03, 0.025, WOOD);
    s.upright(x, F + 0.88, z, yaw, 0.58, 0.03, 0.06, WOOD); // the sill
  };
  window(-9.7, H.z[1] - 0.02, 0);
  window(-13.3, H.z[1] - 0.02, 0);
  window(-10.3, H.z[0] + 0.02, 0);
  window(-13.7, H.z[0] + 0.02, 0);
  window(H.x[0] + 0.02, -2.8, Math.PI / 2);

  // The hall: the front door at its west end (src/gen/doorways.ts), a coat stand, a bulb.
  if (at(H.x[0], 0)) {
    s.upright(H.x[0] + 0.5, F + 0.006, 0, 0, 0.3, 0.006, 0.45, CLOTH); // the mat
    s.upright(H.x[0] + 0.6, F + 0.9, 0.85, 0, 0.025, 0.9, 0.025, WOOD); // the coat stand
    s.ellipsoid(H.x[0] + 0.6, F + 1.45, 0.82, 0.16, 0.3, 0.12, [0.22, 0.2, 0.18], 8); // her coat
    f.block(H.x[0] + 0.6, 0.85, 0, 0.2, 0.2, F, F + 1.8);
    hangBulb(f, -12.5, top, 0);
  }

  // The kitchen: the stove, the sink under the window, the table set for one.
  if (at(-9.5, 3)) {
    s.upright(-8.0, F + 0.45, 3.6, 0, 0.32, 0.45, 0.32, ENAMEL); // the stove
    s.upright(-8.0, F + 0.91, 3.6, 0, 0.3, 0.01, 0.3, DARK);
    f.block(-8.0, 3.6, 0, 0.34, 0.34, F, F + 0.95);
    s.upright(-9.7, F + 0.45, 4.05, 0, 0.8, 0.45, 0.3, WOOD); // the sink cupboard
    s.upright(-9.7, F + 0.92, 4.05, 0, 0.3, 0.02, 0.22, ENAMEL);
    f.block(-9.7, 4.05, 0, 0.82, 0.32, F, F + 0.95);
    s.upright(-9.6, F + 0.74, 2.4, 0, 0.55, 0.03, 0.4, WOOD); // the table
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) s.upright(-9.6 + dx * 0.5, F + 0.36, 2.4 + dz * 0.35, 0, 0.03, 0.36, 0.03, WOOD);
    s.cylinder(-9.4, F + 0.78, 2.3, 0.11, 0.01, ENAMEL, 12); // one plate
    s.upright(-8.7, F + 0.23, 2.4, 0, 0.2, 0.02, 0.2, WOOD); // a chair
    s.upright(-8.52, F + 0.6, 2.4, 0, 0.02, 0.35, 0.2, WOOD);
    f.block(-9.6, 2.4, 0, 0.6, 0.45, F, F + 0.8);
    f.block(-8.65, 2.4, 0, 0.25, 0.25, F, F + 0.95);
    // Jars and a clock on the shelf over the table.
    s.upright(-10.6, F + 1.6, 1.28, 0, 0.6, 0.015, 0.1, WOOD);
    for (let k = 0; k < 4; k++) s.cylinder(-11.0 + k * 0.25, F + 1.685, 1.3, 0.05, 0.07, JARS[k], 8);
    hangBulb(f, -9.5, top, 2.8);
  }

  // Her bedroom: the bed made, the wardrobe, a chair with her cardigan.
  if (at(-13.3, 3)) {
    s.upright(-13.6, F + 0.25, 3.3, 0, 0.75, 0.25, 1.0, WOOD); // the bed
    s.upright(-13.6, F + 0.53, 3.35, 0, 0.72, 0.05, 0.95, LINEN);
    s.upright(-13.6, F + 0.6, 4.1, 0, 0.35, 0.06, 0.15, LINEN); // the pillow
    s.upright(-13.6, F + 0.7, 4.32, 0, 0.75, 0.45, 0.04, WOOD); // the headboard
    f.block(-13.6, 3.3, 0, 0.78, 1.05, F, F + 0.7);
    s.upright(-14.6, F + 1.0, 1.75, Math.PI / 2, 0.55, 1.0, 0.3, DARK); // the wardrobe
    f.block(-14.6, 1.75, Math.PI / 2, 0.57, 0.32, F, F + 2);
    s.upright(-12.2, F + 0.23, 3.9, 0, 0.2, 0.02, 0.2, WOOD);
    s.upright(-12.2, F + 0.33, 3.9, 0, 0.18, 0.12, 0.17, [0.3, 0.32, 0.45]); // her cardigan
  }

  // The living room: the sofa, her other armchair, the sideboard and its photographs, a standard lamp.
  if (at(-11, -3)) {
    s.upright(-11.2, F + 0.003, -2.8, 0, 1.4, 0.003, 1.0, CLOTH); // the rug
    s.upright(-11.2, F + 0.22, -4.0, 0, 1.0, 0.22, 0.38, PLUSH); // the sofa
    s.upright(-11.2, F + 0.62, -4.3, 0, 1.0, 0.25, 0.1, PLUSH);
    for (const sd of [-1, 1]) s.upright(-11.2 + sd * 0.95, F + 0.4, -4.0, 0, 0.08, 0.15, 0.38, PLUSH);
    f.block(-11.2, -4.0, 0, 1.05, 0.42, F, F + 0.9);
    s.upright(-13.4, F + 0.25, -2.6, Math.PI / 2, 0.38, 0.25, 0.38, PLUSH); // the armchair
    s.upright(-13.75, F + 0.7, -2.6, Math.PI / 2, 0.38, 0.4, 0.08, PLUSH);
    f.block(-13.4, -2.6, 0, 0.42, 0.42, F, F + 1.1);
    s.upright(-8.0, F + 0.45, -2.8, Math.PI / 2, 0.9, 0.45, 0.25, WOOD); // the sideboard
    f.block(-8.0, -2.8, Math.PI / 2, 0.92, 0.27, F, F + 0.95);
    // Her photographs, on the sideboard and on the wall over it: the family, the mine, the old house.
    for (let k = 0; k < 7; k++) {
      const z = -3.5 + k * 0.24, onWall = k % 2 === 1, w = 0.07 + h(k, 3, 0) * 0.05, ht = w * (1.1 + h(k, 4, 0) * 0.3);
      const x = onWall ? H.x[1] - 0.03 : -7.95 - h(k, 2, 0) * 0.08, y = onWall ? F + 1.55 + h(k, 1, 0) * 0.3 : F + 0.915 + ht;
      s.upright(x, y, z, Math.PI / 2, w + 0.015, ht + 0.015, 0.012, onWall ? DARK : GOLD);
      s.upright(x - 0.013, y, z, Math.PI / 2, w, ht, 0.004, PHOTOS[k % PHOTOS.length]);
    }
    // The standard lamp in the corner, lit.
    s.cylinder(-14.5, F + 0.02, -4.0, 0.16, 0.02, DARK, 10);
    s.upright(-14.5, F + 0.75, -4.0, 0, 0.012, 0.75, 0.012, DARK);
    s.cylinder(-14.5, F + 1.55, -4.0, 0.2, 0.13, SHADE, 12, 0, -0.25);
    f.glow.ellipsoid(-14.5, F + 1.47, -4.0, 0.045, 0.055, 0.045, BULB, 8);
    f.light(-14.5, F + 1.45, -4.0);
  }
}

/** A bare bulb on its cord from the ceiling at `top`, lit. */
function hangBulb(f: Furnish, x: number, top: number, z: number): void {
  f.solid.upright(x, top - 0.12, z, 0, 0.006, 0.12, 0.006, DARK);
  f.glow.ellipsoid(x, top - 0.28, z, 0.05, 0.065, 0.05, BULB, 8);
  f.light(x, top - 0.42, z);
}
