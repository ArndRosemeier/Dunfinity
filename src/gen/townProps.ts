/**
 * What stands in grandma's street at night (src/gen/town.ts): the street lamps, the houses' windows
 * (a few still lit), their front doors, her own lit window and doorstep. Pure data like the other
 * props: it places only what lies in the tile it is asked for.
 */
import { hash3f } from '@futuremagic/core';
import { HOUSES, TOWN, houseColors, townGround, type House } from './town';
import type { Furnish } from './cellarProps';
import type { PropBuilder, Rgb } from './propMesh';
import { SURFACE_STRIDE } from './style';

const IRON: Rgb = [0.08, 0.08, 0.09], DOOR: Rgb = [0.18, 0.11, 0.07], FRAME: Rgb = [0.3, 0.26, 0.2], STONE: Rgb = [0.36, 0.34, 0.31];
const LIT: Rgb = [0.95, 0.68, 0.36], DARK_PANE: Rgb = [0.04, 0.05, 0.09], LANTERN: Rgb = [1, 0.85, 0.55];

/** The rock shader's surface records (src/gen/style.ts) of a plastered wall (smooth render), a tiled roof, a plinth of dressed stone in courses. */
const PLASTERED = surfaceRecord([0, 0, 0.4, 0], [0, 0, 1, 0]), TILED = surfaceRecord([0, 0, 0, 0], [0, 0, 0, 1]), DRESSED = surfaceRecord([0, 1, 0, 0.3], [0, 0, 0, 0]);

/** A surface record: `surface`, no rock types, `cover`. */
function surfaceRecord(surface: readonly number[], cover: readonly number[]): number[] {
  const r = new Array<number>(SURFACE_STRIDE).fill(0);
  r.splice(0, 4, ...surface);
  r.splice(SURFACE_STRIDE - 4, 4, ...cover);
  return r;
}

/** How far the houses' walls and roofs stand out of the field's (rounder) surface, metres: they hide it. */
const SHELL = 0.15;

/** The street's own seed, for which windows are lit and where the doors are. */
const TOWN_PROPS = 1932;

/** The street lamps: down the far side of the street, this far apart. */
const LAMPS = { x: TOWN.street.x[0] + 0.6, every: 13, height: 3.8 } as const;

export function furnishTown(f: Furnish): void {
  const s = f.solid, G = TOWN.ground;

  for (let z = -52; z <= 52; z += LAMPS.every) {
    if (!f.inTile(LAMPS.x, z)) continue;
    s.cylinder(LAMPS.x, G + 0.15, z, 0.12, 0.15, IRON, 8);
    s.cylinder(LAMPS.x, G + LAMPS.height / 2, z, 0.05, LAMPS.height / 2, IRON, 8);
    s.upright(LAMPS.x, G + LAMPS.height + 0.3, z, 0, 0.16, 0.03, 0.16, IRON);
    f.glow.upright(LAMPS.x, G + LAMPS.height + 0.12, z, 0, 0.11, 0.15, 0.11, LANTERN);
    f.light(LAMPS.x, G + LAMPS.height - 0.1, z);
    f.block(LAMPS.x, z, 0, 0.13, 0.13, G, G + LAMPS.height);
  }

  // Every house's walls and roof, crisp over the field's rounded ones.
  for (const H of HOUSES) if (f.inTile((H.x0 + H.x1) / 2, (H.z0 + H.z1) / 2)) shell(f, H, H === HOUSES[0]);

  // The houses' fronts: a door, and windows up both floors, a few of them still lit.
  for (let i = 1; i < HOUSES.length; i++) {
    const H = HOUSES[i], fx = H.faces > 0 ? H.x1 + SHELL + 0.02 : H.x0 - SHELL - 0.02, mid = (H.z0 + H.z1) / 2;
    if (!f.inTile(fx, mid)) continue;
    const pane = (z: number, y: number, k: number) => {
      const lit = (H.home && y < G + 3) || hash3f(TOWN_PROPS, i, k, 1) < 0.3; // (Frau Weber is up: her downstairs is lit)
      (lit ? f.glow : s).upright(fx, y, z, Math.PI / 2, 0.42, 0.55, 0.01, lit ? LIT : DARK_PANE);
      s.upright(fx + H.faces * 0.01, y, z, Math.PI / 2, 0.03, 0.55, 0.02, FRAME);
      s.upright(fx + H.faces * 0.03, y - 0.6, z, Math.PI / 2, 0.5, 0.04, 0.06, STONE); // the sill
    };
    const doorZ = H.door;
    if (H.shop) shopFront(f, H, fx);
    if (H.home) {
      // Frau Weber's door stands open on her lit hall, the leaf folded back against the front.
      f.glow.upright(fx - H.faces * 0.02, G + 1.05, doorZ, Math.PI / 2, 0.5, 1.05, 0.01, LIT);
      s.upright(fx + H.faces * 0.5, G + 1.05, doorZ - 0.53, 0, 0.5, 1.05, 0.03, DOOR);
    } else s.upright(fx, G + 1.05, doorZ, Math.PI / 2, 0.5, 1.05, 0.03, DOOR);
    s.upright(fx + H.faces * 0.25, G + 0.08, doorZ, Math.PI / 2, 0.7, 0.08, 0.25, STONE); // the step
    f.block(fx + H.faces * 0.25, doorZ, Math.PI / 2, 0.7, 0.26, G, G + 0.16);
    let k = 0;
    for (let z = H.z0 + 1.2; z < H.z1 - 1; z += 2.1) {
      if (Math.abs(z - doorZ) > (H.shop ? 2.4 : 1)) pane(z, G + 1.6, k++);
      if (H.eaves > G + 5) pane(z, G + 4.3, k++);
    }
  }

  // Grandma's own front: the doorstep, and her living-room window lit (her standard lamp).
  const g = TOWN.grandma, D = TOWN.door;
  if (f.inTile(g.x[0], 0)) {
    const fx = g.x[0] - SHELL;
    s.upright(fx - 0.35, G + 0.06, 0, Math.PI / 2, 0.75, 0.06, 0.35, STONE);
    f.glow.upright(fx - 0.02, G + 1.5, -2.8, Math.PI / 2, 0.5, 0.6, 0.01, LIT);
    s.upright(fx - 0.03, G + 1.5, -2.8, Math.PI / 2, 0.03, 0.6, 0.02, FRAME);
    s.upright(fx - 0.03, G + 2.13, -2.8, Math.PI / 2, 0.58, 0.04, 0.05, FRAME);
    s.upright(fx - 0.02, G + D.top + 0.06, 0, Math.PI / 2, 0.6, 0.06, 0.04, FRAME); // the lintel
  }
}

/**
 * A house's walls and roof as flat slabs standing SHELL out of the field's surface (which rounds
 * its corners at the mesh's metre cells), the gables filled. Grandma's keeps her front door open.
 */
function shell(f: Furnish, H: House, door: boolean): void {
  f.rock.dressed(PLASTERED, () => walls(f, H, door));
  f.rock.dressed(TILED, () => roofOf(f.rock, H));
}

/** The walls, plinth and gables of `shell`. */
function walls(f: Furnish, H: House, door: boolean): void {
  const s = f.rock, G = TOWN.ground, { wall } = houseColors(H);
  const cz = (H.z0 + H.z1) / 2, half = (H.z1 - H.z0) / 2, hx = (H.x1 - H.x0) / 2, cx = (H.x0 + H.x1) / 2;
  const y0 = G - 0.4, cy = (y0 + H.eaves) / 2, hy = (H.eaves - y0) / 2;
  // The long walls (along x) and the ends (along z), the end to the street with her doorway cut out.
  for (const z of [H.z0, H.z1]) s.upright(cx, cy, z, 0, hx + SHELL, hy, SHELL, wall);
  for (const x of [H.x0, H.x1]) {
    if (door && x === H.x0) {
      const D = TOWN.door, top = G + D.top;
      s.upright(x, cy, (H.z0 - SHELL + D.z[0]) / 2, 0, SHELL, hy, (D.z[0] - H.z0 + SHELL) / 2, wall);
      s.upright(x, cy, (H.z1 + SHELL + D.z[1]) / 2, 0, SHELL, hy, (H.z1 + SHELL - D.z[1]) / 2, wall);
      s.upright(x, (top + H.eaves) / 2, cz, 0, SHELL, (H.eaves - top) / 2, (D.z[1] - D.z[0]) / 2, wall);
    } else {
      // From where the ground meets it (her back wall stands in the hill; under the hill there is no wall to show, and the cellar stairs pass there).
      const yb = Math.max(y0, townGround(x, cz).y - 0.4);
      s.upright(x, (yb + H.eaves) / 2, cz, 0, SHELL, (H.eaves - yb) / 2, half + SHELL, wall);
    }
  }
  // A stone plinth round the foot, over the field's fillet where its ground meets its walls.
  const P = { out: SHELL + 0.4, top: G + 0.55 }, py = (y0 + P.top) / 2, ph = (P.top - y0) / 2;
  const plinth = (x: number, z: number, hx: number, hz: number) => {
    f.rock.dressed(DRESSED, () => f.rock.upright(x, py, z, 0, hx, ph, hz, STONE));
    f.block(x, z, 0, hx, hz, G, P.top);
  };
  for (const z of [H.z0, H.z1]) plinth(cx, z, hx + P.out, P.out);
  for (const x of [H.x0, H.x1]) {
    if (door && x === H.x0) {
      const D = TOWN.door;
      plinth(x, (H.z0 - P.out + D.z[0]) / 2, P.out, (D.z[0] - H.z0 + P.out) / 2);
      plinth(x, (H.z1 + P.out + D.z[1]) / 2, P.out, (H.z1 + P.out - D.z[1]) / 2);
    } else if (townGround(x + (x === H.x0 ? -1 : 1), cz).y < P.top) plinth(x, cz, P.out, half + P.out); // (not where the hill buries it)
  }
  // The gables: a triangle of wall over each end, both ways round.
  const ridge = H.eaves + half * H.pitch;
  for (const x of [H.x0, H.x1]) {
    const xo = x + (x === H.x0 ? -SHELL : SHELL), a: [number, number, number][] = [[xo, H.eaves, H.z0 - SHELL], [xo, ridge, cz]], b: [number, number, number][] = [[xo, H.eaves, H.z1 + SHELL], [xo, ridge, cz]];
    const n: [number, number, number] = [x === H.x0 ? -1 : 1, 0, 0];
    s.ribbon(a, b, [n, n], [wall, wall]);
    s.ribbon(b, a, [n, n], [wall, wall]);
  }
}

/** The roof of `shell`: a slab down each side from the ridge, out over the walls. */
function roofOf(s: PropBuilder, H: House): void {
  const { roof } = houseColors(H), cz = (H.z0 + H.z1) / 2, half = (H.z1 - H.z0) / 2, hx = (H.x1 - H.x0) / 2, cx = (H.x0 + H.x1) / 2;
  const ridge = H.eaves + half * H.pitch, over = 0.35, lift = SHELL + 0.06;
  for (const side of [-1, 1]) {
    const ez = cz + side * (half + over), ey = H.eaves - over * H.pitch;
    const half_v: [number, number, number] = side < 0 ? [0, (ey - ridge) / 2, (ez - cz) / 2] : [0, (ridge - ey) / 2, (cz - ez) / 2];
    const a = hx + over, nl = Math.hypot(half_v[1], half_v[2]), nn: [number, number, number] = [0, (-a * half_v[2]) / (a * nl), (a * half_v[1]) / (a * nl)];
    const mx = cx, my = (ridge + ey) / 2 + nn[1] * lift, mz = (cz + ez) / 2 + nn[2] * lift;
    s.box(mx, my, mz, [a, 0, 0], half_v, [nn[0] * 0.06, nn[1] * 0.06, nn[2] * 0.06], roof);
  }
}

const SIGN: Rgb = [0.12, 0.09, 0.06], BRASS: Rgb = [0.6, 0.47, 0.2], PAINT: Rgb = [0.18, 0.3, 0.22];
const CRATE: Rgb = [0.38, 0.27, 0.15], ROPE: Rgb = [0.55, 0.47, 0.3], WOOD_HANDLE: Rgb = [0.3, 0.2, 0.1];

/**
 * A shop's front: a wide lit window either side of the door, the sign board over it, a lantern by
 * the door; and its sign: Ilse's three brass balls, or Kemal's crates and coil of rope out front.
 */
function shopFront(f: Furnish, H: House, fx: number): void {
  const s = f.solid, G = TOWN.ground, out = H.faces;
  for (const side of [-1, 1]) {
    const z = H.door + side * 1.6;
    f.glow.upright(fx, G + 1.45, z, Math.PI / 2, 0.85, 0.7, 0.01, [0.9, 0.62, 0.3]);
    s.upright(fx + out * 0.01, G + 1.45, z, Math.PI / 2, 0.04, 0.7, 0.02, FRAME);
    s.upright(fx + out * 0.06, G + 0.72, z, Math.PI / 2, 0.92, 0.04, 0.1, STONE);
  }
  s.upright(fx + out * 0.1, G + 2.75, H.door, Math.PI / 2, 1.1, 0.28, 0.04, SIGN);
  s.upright(fx + out * 0.12, G + 2.75, H.door, Math.PI / 2, 1.0, 0.2, 0.02, H.shop === 'pawn' ? BRASS : PAINT);
  if (H.shop === 'pawn') {
    // The three brass balls, hung from an iron arm.
    s.upright(fx + out * 0.55, G + 3.25, H.door, 0, 0.5, 0.02, 0.02, IRON);
    for (const [dz, dy] of [[-0.12, 0], [0.12, 0], [0, -0.2]]) s.ellipsoid(fx + out * 0.95, G + 3.0 + dy, H.door + dz, 0.09, 0.09, 0.09, BRASS, 10);
  } else {
    // Kemal's goods out on the pavement: crates, a coil of rope, a shovel leant on the wall.
    const cz = H.door - 2.4, px = fx + out * 0.75;
    s.upright(px, G + 0.25, cz, 0.15, 0.3, 0.25, 0.3, CRATE);
    s.upright(px, G + 0.66, cz + 0.05, -0.1, 0.24, 0.16, 0.24, CRATE);
    f.block(px, cz, 0.15, 0.34, 0.34, G, G + 0.82);
    s.cylinder(px, G + 0.09, H.door + 2.4, 0.3, 0.09, ROPE, 14);
    s.cylinder(px, G + 0.09, H.door + 2.4, 0.12, 0.1, SIGN, 10);
    s.beam(fx + out * 0.3, G + 0.05, H.door + 1.0, fx + out * 0.08, G + 1.3, H.door + 1.0, 0.03, 0.02, WOOD_HANDLE);
    s.upright(fx + out * 0.31, G + 0.15, H.door + 1.0, Math.PI / 2, 0.11, 0.14, 0.015, IRON);
  }
  // The lantern by the door, lit.
  const lz = H.door + 0.85;
  s.upright(fx + out * 0.15, G + 2.25, lz, 0, 0.12, 0.02, 0.06, IRON);
  f.glow.upright(fx + out * 0.2, G + 2.1, lz, 0, 0.07, 0.11, 0.07, LANTERN);
  f.light(fx + out * 0.3, G + 2.0, lz);
}
