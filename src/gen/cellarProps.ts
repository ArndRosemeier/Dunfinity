/**
 * What is in grandma's cellar (src/gen/cellar.ts): shelves of jars and a crate or two, a bare bulb
 * under the vault, the stairs' wooden treads up into the house; in the strange room her armchair
 * with the tin on it, the side table with her lamp and the knife block (her salt circle is
 * `HavenView`'s); the bricks of the broken arch lying where they fell; a lamp by the old shaft.
 * Upstairs, her ground floor as she left it (`furnishHouse`): its thin walls, the front door open,
 * night at the windows, the kitchen, her bedroom, the living room and its photographs.
 *
 * Pure data like the rest of the props: it places only what lies in the tile it is asked for.
 */
import { hash3f } from '@futuremagic/core';
import { CELLAR } from './cellar';
import { local, type PropBuilder, type Rgb } from './propMesh';
import { furnishTown } from './townProps';
import { propModel } from './models';

/** What the tile builder lends the cellar to furnish with. */
export interface Furnish {
  readonly solid: PropBuilder;
  readonly glow: PropBuilder;
  /** Drawn as a house (src/render/materials.ts `HOUSE`): the town's plastered walls and tiled roofs. */
  readonly house: PropBuilder;
  /** Whether (x, z) is in the tile being built. */
  inTile(x: number, z: number): boolean;
  /** A burning lamp's light at (x, y, z). */
  light(x: number, y: number, z: number): void;
  /** Something in the way: an upright box (as `TileBuilder.block`). */
  block(x: number, z: number, yaw: number, hx: number, hz: number, y0: number, y1: number): void;
}

/** A flight of the cellar's stair (src/gen/cellar.ts): its plan, the floor at its first x edge (`from`) and second (`to`). */
type Flight = { readonly x: readonly [number, number]; readonly z: readonly [number, number]; readonly from: number; readonly to: number };

const WOOD: Rgb = [0.2, 0.13, 0.075], DARK: Rgb = [0.12, 0.08, 0.05], BRICK: Rgb = [0.4, 0.2, 0.14];
const TIN: Rgb = [0.16, 0.24, 0.38], GOLD: Rgb = [0.55, 0.42, 0.18];
const SHADE: Rgb = [0.75, 0.62, 0.4], BULB: Rgb = [1, 0.86, 0.6], STEEL: Rgb = [0.55, 0.56, 0.58];
const JARS: readonly Rgb[] = [[0.45, 0.28, 0.08], [0.2, 0.3, 0.12], [0.5, 0.12, 0.1], [0.55, 0.45, 0.2]];

export function furnishCellar(f: Furnish): void {
  const C = CELLAR, s = f.solid;
  const at = (x: number, z: number) => f.inTile(x, z);
  const h = (a: number, b: number, k: number) => hash3f(1966, a, b, k);

  if (at(-12, 2)) {
    // Shelves along the north wall, jars of things she put up, the jars catching the bulb.
    for (const x0 of [C.cellar.x[0] + 0.6, C.cellar.x[0] + 2.4]) {
      s.stamp(propModel('furn_cellar_shelf'), x0 + 0.75, 0, 2.2, Math.PI);
      for (const y of [0.35, 0.95, 1.55]) {
        for (let k = 0; k < 6; k++) {
          if (h(x0, y, k) < 0.25) continue;
          const jx = x0 + 0.12 + k * 0.25, r = 0.045 + 0.02 * h(x0, y, k + 9);
          s.cylinder(jx, y + 0.015 + r * 1.5, 2.18, r, r * 1.5, JARS[Math.floor(h(x0, y, k + 20) * JARS.length)], 8);
        }
      }
      f.block(x0 + 0.75, 2.2, 0, 0.8, 0.22, 0, 1.85);
    }
    // Crates and a barrel by the south wall.
    s.upright(C.cellar.x[0] + 1.3, 0.25, -2.1, 0.2, 0.32, 0.25, 0.3, WOOD);
    s.upright(C.cellar.x[0] + 1.4, 0.68, -2.15, -0.1, 0.25, 0.18, 0.22, DARK);
    s.cylinder(C.cellar.x[0] + 2.6, 0.42, -2.1, 0.3, 0.42, DARK, 12, 0.12);
    f.block(C.cellar.x[0] + 1.3, -2.1, 0.2, 0.35, 0.32, 0, 0.9);
    f.block(C.cellar.x[0] + 2.6, -2.1, 0, 0.36, 0.36, 0, 0.84);
    // The bulb under the vault, on its cord.
    hangBulb(f, C.cellar.x[0] + 3.0, C.cellar.crown, 0);
  }

  if (at(C.stairs.foot.x, (C.stairs.foot.z + C.stairs.lower.z[0]) / 2)) {
    // The cellar door's frame (src/gen/doorways.ts hangs the door) at the foot of the stairs, under
    // the vault, and the wooden treads up the two flights and the half-landing.
    const F = C.stairs.foot;
    for (const z of [F.z, F.z - F.width]) s.upright(F.x, F.height / 2, z, 0, 0.08, F.height / 2, 0.05, DARK);
    s.upright(F.x, F.height + 0.04, F.z - F.width / 2, 0, 0.1, 0.05, F.width / 2 + 0.06, DARK);
    const treads = (fl: Flight, n: number) => {
      // From the flight's low end up to its high one, a tread at every riser.
      const low = fl.from < fl.to ? [fl.x[0], fl.from] : [fl.x[1], fl.to], high = fl.from < fl.to ? [fl.x[1], fl.to] : [fl.x[0], fl.from];
      const step = (high[0] - low[0]) / n, zc = (fl.z[0] + fl.z[1]) / 2, hz = (fl.z[1] - fl.z[0]) / 2 - 0.03;
      for (let i = 0; i < n; i++) {
        const x = low[0] + (i + 0.5) * step, top = low[1] + ((i + 1) / n) * (high[1] - low[1]);
        s.upright(x, top - 0.06, zc, 0, Math.abs(step) / 2, 0.06, hz, WOOD);
      }
    };
    treads(C.stairs.upper, 8);
    treads(C.stairs.lower, 4);
    const L = C.stairs.landing;
    s.upright((L.x[0] + L.x[1]) / 2, L.y - 0.06, (L.z[0] + L.z[1]) / 2, 0, (L.x[1] - L.x[0]) / 2, 0.06, (L.z[1] - L.z[0]) / 2, WOOD);
  }

  furnishHouse(f);
  furnishTown(f);

  if (at(C.door.x[0], C.door.z[0])) {
    // The low doorway into her room, in the cellar's east wall: posts and a lintel.
    const D = C.door, x = C.cellar.x[1] + 0.1;
    for (const z of [D.z[0] + 0.06, D.z[1] - 0.06]) s.upright(x, D.top / 2, z, 0, 0.08, D.top / 2, 0.06, DARK);
    s.upright(x, D.top - 0.07, (D.z[0] + D.z[1]) / 2, 0, 0.1, 0.07, (D.z[1] - D.z[0]) / 2, DARK);
  }

  if (at(C.room.x, C.room.z)) {
    // The circle of infused salt and the ward round it are drawn turning slowly by `HavenView` (src/render/props/havenView.ts).
    // Her armchair, the tin on its seat.
    const ch = C.chair, p = local(ch.x, ch.z, ch.yaw);
    s.stamp(propModel('furn_armchair'), ch.x, 0, ch.z, ch.yaw);
    const [tx, tz] = p(0.05, 0.08);
    s.cylinder(tx, 0.52, tz, 0.11, 0.06, TIN, 14);
    s.cylinder(tx, 0.585, tz, 0.115, 0.008, TIN, 14);
    f.block(ch.x, ch.z, ch.yaw, 0.45, 0.45, 0, 1.1);
    // The side table: her lamp, the knife block.
    const [bx, bz] = p(0.85, 0.05);
    s.stamp(propModel('furn_side_table'), bx, 0, bz, ch.yaw);
    s.cylinder(bx - 0.08, 0.66, bz + 0.05, 0.06, 0.04, DARK, 10);
    s.upright(bx - 0.08, 0.86, bz + 0.05, 0, 0.012, 0.18, 0.012, DARK);
    s.cylinder(bx - 0.08, 1.1, bz + 0.05, 0.17, 0.11, SHADE, 12, 0, -0.25);
    f.glow.ellipsoid(bx - 0.08, 1.02, bz + 0.05, 0.04, 0.05, 0.04, BULB, 8);
    f.light(bx - 0.08, 1.0, bz + 0.05);
    s.upright(bx + 0.1, 0.72, bz - 0.06, 0.3, 0.06, 0.1, 0.05, WOOD); // the knife block
    for (let k = 0; k < 4; k++) s.upright(bx + 0.07 + k * 0.02, 0.86, bz - 0.07 + k * 0.006, 0.3, 0.008, 0.045, 0.012, DARK);
    s.upright(C.letter.x, C.letter.y, C.letter.z, 0.5, 0.08, 0.003, 0.11, [0.85, 0.83, 0.76]); // the notary's letter
    f.block(bx, bz, 0, 0.26, 0.26, 0, 1.2);
  }

  // The bricks of the arch, broken out and lying where they fell (the arch straddles the prop tiles).
  for (let k = 0; k < 26; k++) {
    const x = C.arch.x[0] + 0.4 + h(k, 1, 0) * 1.6, z = -0.9 + h(k, 2, 0) * 1.8;
    if (!at(x, z)) continue;
    const y = 0.035 + (h(k, 3, 0) < 0.3 ? 0.07 : 0);
    s.upright(x, y, z, h(k, 4, 0) * Math.PI, 0.11, 0.035, 0.055, BRICK);
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

const PAPER: Rgb = [0.42, 0.39, 0.28], CLOTH: Rgb = [0.35, 0.12, 0.1], ENAMEL: Rgb = [0.72, 0.72, 0.66];
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

  // Rails round the stairwell at the hall's floor: north of the upper flight's west part, down the
  // well's west edge above the foot, and north of the lower flight and the landing.
  const S = CELLAR.stairs;
  if (at((S.upper.x[0] + S.landing.x[1]) / 2, S.lower.z[1])) {
    const railX = (x0: number, x1: number, z: number) => {
      s.upright((x0 + x1) / 2, F + 0.9, z, 0, (x1 - x0) / 2, 0.03, 0.03, WOOD);
      s.upright(x0 + 0.03, F + 0.45, z, 0, 0.03, 0.45, 0.03, WOOD);
      f.block((x0 + x1) / 2, z, 0, (x1 - x0) / 2, 0.06, F, F + 1);
    };
    railX(S.upper.x[0], S.lower.x[0], S.upper.z[1] + 0.04);
    railX(S.lower.x[0], S.landing.x[1], S.lower.z[1] + 0.04);
    s.upright(S.lower.x[0] - 0.04, F + 0.9, (S.lower.z[0] + S.lower.z[1]) / 2, 0, 0.03, 0.03, (S.lower.z[1] - S.lower.z[0]) / 2, WOOD);
    s.upright(S.lower.x[0] - 0.04, F + 0.45, S.lower.z[0] + 0.03, 0, 0.03, 0.45, 0.03, WOOD);
    f.block(S.lower.x[0] - 0.04, (S.lower.z[0] + S.lower.z[1]) / 2, 0, 0.06, (S.lower.z[1] - S.lower.z[0]) / 2, F, F + 1);
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
    s.stamp(propModel('furn_coat_stand'), H.x[0] + 0.6, F, 0.85, 0.4); // the coat stand
    s.ellipsoid(H.x[0] + 0.6, F + 1.45, 0.82, 0.16, 0.3, 0.12, [0.22, 0.2, 0.18], 8); // her coat
    f.block(H.x[0] + 0.6, 0.85, 0, 0.2, 0.2, F, F + 1.8);
    hangBulb(f, -12.5, top, 0);
  }

  // The kitchen: the stove, the sink under the window, the table set for one.
  if (at(-9.5, 3)) {
    s.stamp(propModel('furn_stove'), -8.0, F, 3.6, Math.PI); // the stove
    f.block(-8.0, 3.6, 0, 0.34, 0.34, F, F + 0.95);
    s.stamp(propModel('furn_sink_cupboard'), -9.7, F, 4.05, Math.PI); // the sink cupboard
    s.upright(-9.7, F + 0.92, 4.05, 0, 0.3, 0.02, 0.22, ENAMEL);
    f.block(-9.7, 4.05, 0, 0.82, 0.32, F, F + 0.95);
    s.stamp(propModel('furn_kitchen_table'), -9.6, F, 2.4, 0); // the table
    s.cylinder(-9.4, F + 0.78, 2.3, 0.11, 0.01, ENAMEL, 12); // one plate
    s.stamp(propModel('furn_chair'), -8.65, F, 2.4, -Math.PI / 2); // a chair, pulled up to it
    f.block(-9.6, 2.4, 0, 0.6, 0.45, F, F + 0.8);
    f.block(-8.65, 2.4, 0, 0.25, 0.25, F, F + 0.95);
    // Jars and a clock on the shelf over the table.
    s.upright(-10.6, F + 1.6, 1.28, 0, 0.6, 0.015, 0.1, WOOD);
    for (let k = 0; k < 4; k++) s.cylinder(-11.0 + k * 0.25, F + 1.685, 1.3, 0.05, 0.07, JARS[k], 8);
    hangBulb(f, -9.5, top, 2.8);
  }

  // Her bedroom: the bed made, the wardrobe, a chair with her cardigan.
  if (at(-13.3, 3)) {
    s.stamp(propModel('furn_bed'), -13.6, F, 3.3, 0); // the bed, its head to the wall
    f.block(-13.6, 3.3, 0, 0.78, 1.05, F, F + 0.7);
    s.stamp(propModel('furn_wardrobe'), -14.6, F, 1.75, Math.PI / 2); // the wardrobe
    f.block(-14.6, 1.75, Math.PI / 2, 0.57, 0.32, F, F + 2);
    s.stamp(propModel('furn_chair'), -12.2, F, 3.9, Math.PI);
    s.upright(-12.2, F + 0.5, 3.88, 0, 0.18, 0.05, 0.17, [0.3, 0.32, 0.45]); // her cardigan, over the seat
    s.upright(-12.2, F + 0.78, 4.12, -0.1, 0.19, 0.12, 0.03, [0.3, 0.32, 0.45]); // and over the back
  }

  // The living room: the sofa, her other armchair, the sideboard and its photographs, a standard lamp.
  if (at(-11, -3)) {
    s.upright(-11.2, F + 0.003, -2.8, 0, 1.4, 0.003, 1.0, CLOTH); // the rug
    s.stamp(propModel('furn_sofa'), -11.2, F, -4.0, 0); // the sofa
    f.block(-11.2, -4.0, 0, 1.05, 0.42, F, F + 0.9);
    s.stamp(propModel('furn_armchair'), -13.4, F, -2.6, Math.PI / 2); // the armchair
    f.block(-13.4, -2.6, 0, 0.42, 0.42, F, F + 1.1);
    s.stamp(propModel('furn_sideboard'), -8.0, F, -2.8, -Math.PI / 2); // the sideboard
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
