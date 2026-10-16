/**
 * What stands in the town at night (src/gen/town.ts): every building's walls and roof crisp over
 * the field's rounded ones, the church's tower and spire, the street lamps, the houses' windows (a
 * few still lit), their front doors, the shops' fronts, Frau Weber's open door, grandma's own lit
 * window and doorstep. Pure data like the other props: it places only what lies in the tile it is
 * asked for.
 */
import { hash3f, v3cross, v3madd, v3norm, v3scale, type Vec3 } from '@futuremagic/core';
import { HOUSES, TOWN, VILLAGE, houseColors, townGround, type House } from './town';
import { ridgeHeight } from './village';
import { alongPolyline, polylineLength } from './polyline';
import { local, type PropBuilder, type Rgb } from './propMesh';
import type { Furnish } from './cellarProps';

const IRON: Rgb = [0.08, 0.08, 0.09], DOOR: Rgb = [0.18, 0.11, 0.07], FRAME: Rgb = [0.3, 0.26, 0.2], STONE: Rgb = [0.36, 0.34, 0.31];
const LIT: Rgb = [0.95, 0.68, 0.36], DARK_PANE: Rgb = [0.04, 0.05, 0.09], LANTERN: Rgb = [1, 0.85, 0.55], CHURCH_PANE: Rgb = [0.06, 0.08, 0.14];

/** How far the buildings' walls and roofs stand out of the field's (rounder) surface, metres: they hide it. */
const SHELL = 0.15;

/** The town's own seed for its props: which windows are lit. */
const TOWN_PROPS = 1932;

/** The street lamps: how far apart along a street (closer on grandma's), how high. */
const LAMP = { every: 24, herStreet: 13, height: 3.8 } as const;

/** Where the street lamps stand: along the streets of the village, at the edge of the road, sides taking turns. */
const LAMPS: readonly (readonly [number, number])[] = (() => {
  const out: [number, number][] = [], S = VILLAGE.spec;
  for (const R of VILLAGE.roads) {
    if (R.kind === 'track') continue;
    const L = polylineLength(R.pts), every = R.given ? LAMP.herStreet : LAMP.every;
    for (let s = R.given ? 4 : 10, k = 0; s < L - 4; s += every, k++) {
      const [px, pz, tx, tz] = alongPolyline(R.pts, s), side = R.given ? 1 : k % 2 ? 1 : -1;
      const x = px - tz * side * (R.hw - 0.7), z = pz + tx * side * (R.hw - 0.7);
      if (!R.given && Math.hypot(x - S.x, z - S.z) > S.r) break;
      if (VILLAGE.nearestBuilding(x, TOWN.ground + 1, z).d < 0.4 || VILLAGE.squareEdge(x, z) < 1) continue;
      if (out.some(([ox, oz]) => Math.hypot(ox - x, oz - z) < 8)) continue;
      out.push([x, z]);
    }
  }
  // Round the square.
  const q = VILLAGE.square;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4, x = q.x + Math.cos(a) * (q.r - 0.6), z = q.z + Math.sin(a) * (q.r - 0.6);
    if (VILLAGE.roadEdge(x, z) > 0.5 && !out.some(([ox, oz]) => Math.hypot(ox - x, oz - z) < 6)) out.push([x, z]);
  }
  return out;
})();

export function furnishTown(f: Furnish): void {
  const s = f.solid;
  for (const [x, z] of LAMPS) {
    if (!f.inTile(x, z)) continue;
    const G = townGround(x, z).y;
    s.cylinder(x, G + 0.15, z, 0.12, 0.15, IRON, 8);
    s.cylinder(x, G + LAMP.height / 2, z, 0.05, LAMP.height / 2, IRON, 8);
    s.upright(x, G + LAMP.height + 0.3, z, 0, 0.16, 0.03, 0.16, IRON);
    f.glow.upright(x, G + LAMP.height + 0.12, z, 0, 0.11, 0.15, 0.11, LANTERN);
    f.light(x, G + LAMP.height - 0.1, z);
    f.block(x, z, 0, 0.13, 0.13, G, G + LAMP.height);
  }

  HOUSES.forEach((H, i) => {
    if (!f.inTile(H.cx, H.cz)) return;
    shell(f, H, i === 0);
    if (i > 0) fronts(f, H, i);
  });

  // Grandma's own front: the doorstep, and her living-room window lit (her standard lamp).
  const g = TOWN.grandma, D = TOWN.door, G = TOWN.ground;
  if (f.inTile(HOUSES[0].cx, HOUSES[0].cz)) {
    const fx = g.x[0] - SHELL;
    s.upright(fx - 0.35, G + 0.06, 0, Math.PI / 2, 0.75, 0.06, 0.35, STONE);
    f.glow.upright(fx - 0.02, G + 1.5, -2.8, Math.PI / 2, 0.5, 0.6, 0.01, LIT);
    s.upright(fx - 0.03, G + 1.5, -2.8, Math.PI / 2, 0.03, 0.6, 0.02, FRAME);
    s.upright(fx - 0.03, G + 2.13, -2.8, Math.PI / 2, 0.58, 0.04, 0.05, FRAME);
    s.upright(fx - 0.02, G + D.top + 0.06, 0, Math.PI / 2, 0.6, 0.06, 0.04, FRAME); // the lintel
  }
}

/** A box in a building's frame: centred `side` across and `fwd` ahead of its middle, at height y, half sizes along its side, up and forward. */
function inFrame(b: PropBuilder, H: House, side: number, fwd: number, y: number, hs: number, hy: number, hf: number, c: Rgb): void {
  const [x, z] = local(H.cx, H.cz, H.yaw)(side, fwd);
  b.upright(x, y, z, H.yaw, hs, hy, hf, c);
}

/** The world point `side` across, `fwd` ahead in a building's frame, at height y. */
function framePoint(H: House, side: number, fwd: number, y: number): [number, number, number] {
  const [x, z] = local(H.cx, H.cz, H.yaw)(side, fwd);
  return [x, y, z];
}

/** The windows, door and step of a building's front (and its back), a few windows lit; a shop's front, the neighbour's open door; the church's tall windows and the tower's door and belfry; a barn's big doors. */
function fronts(f: Furnish, H: House, i: number): void {
  const s = f.solid, G = H.base, out = H.hv + SHELL + 0.02;
  const pane = (side: number, fwd: number, y: number, k: number, back: boolean) => {
    const lit = (H.role === 'weber' && !back && y < G + 3) || hash3f(TOWN_PROPS, i, k, 1) < (back ? 0.15 : 0.3); // (Frau Weber is up: her downstairs is lit)
    const dir = Math.sign(fwd);
    (lit ? f.glow : s).upright(...framePoint(H, side, fwd, y), H.yaw, 0.42, 0.55, 0.01, lit ? LIT : DARK_PANE);
    inFrame(s, H, side, fwd + dir * 0.01, y, 0.03, 0.55, 0.02, FRAME);
    inFrame(s, H, side, fwd + dir * 0.03, y - 0.6, 0.5, 0.04, 0.06, STONE); // the sill
  };
  if (H.kind === 'church' || H.kind === 'tower') { churchFront(f, H); return; }
  if (H.kind === 'barn') {
    // Big double doors of boards, shut.
    const w = Math.min(H.hu - 0.6, 2.2), h = Math.min(2.6, H.eaves - G - 0.6);
    inFrame(s, H, 0, out, G + h / 2, w, h / 2, 0.04, DOOR);
    inFrame(s, H, 0, out + 0.03, G + h / 2, 0.04, h / 2, 0.02, IRON);
    return;
  }
  if (H.role === 'pawn' || H.role === 'hardware') shopFront(f, H, out);
  if (H.role === 'weber') {
    // Frau Weber's door stands open on her lit hall, the leaf folded back against the front.
    inFrame(f.glow, H, H.door, out - 0.02, G + 1.05, 0.5, 1.05, 0.01, LIT);
    inFrame(s, H, H.door - 0.53, out + 0.5, G + 1.05, 0.03, 1.05, 0.5, DOOR);
  } else inFrame(s, H, H.door, out, G + 1.05, 0.5, 1.05, 0.03, DOOR);
  inFrame(s, H, H.door, out + 0.23, G + 0.08, 0.7, 0.08, 0.25, STONE); // the step
  const [bx, bz] = local(H.cx, H.cz, H.yaw)(H.door, out + 0.23);
  f.block(bx, bz, H.yaw, 0.7, 0.26, G, G + 0.16);
  let k = 0;
  const upstairs = H.eaves > G + 5;
  for (let u = -H.hu + 1.2; u < H.hu - 1; u += 2.1) {
    if (Math.abs(u - H.door) > (H.role === 'pawn' || H.role === 'hardware' ? 2.4 : 1)) pane(u, out, G + 1.6, k++, false);
    if (upstairs) pane(u, out, G + 4.3, k++, false);
    // The back: fewer windows, mostly dark (not where it stands in the hill).
    if ((k & 1) === 0 && townGround(...back(H, u)).y < G + 1) pane(u, -out, G + 1.6, k++, true);
  }
}

/** The ground point just behind a building's back wall at `side`. */
function back(H: House, side: number): [number, number] {
  return local(H.cx, H.cz, H.yaw)(side, -H.hv - 1);
}

/** The church: tall dark windows down the nave's sides; the tower's door, its belfry's openings. */
function churchFront(f: Furnish, H: House): void {
  const s = f.solid, G = H.base;
  if (H.kind === 'church') {
    for (const side of [-1, 1]) for (let v = -H.hv + 3; v < H.hv - 2; v += 4) {
      const x = side * (H.hu + SHELL + 0.02);
      const [px, , pz] = framePoint(H, x, v, 0);
      s.upright(px, G + 4.2, pz, H.yaw, 0.01, 2.0, 0.55, CHURCH_PANE);
      inFrame(s, H, x + side * 0.03, v, G + 2.1, 0.06, 0.04, 0.65, STONE);
    }
    return;
  }
  const out = H.hv + SHELL + 0.02;
  inFrame(s, H, 0, out, G + 1.6, 0.8, 1.6, 0.04, DOOR);
  inFrame(s, H, 0, out + 0.04, G + 3.3, 1.0, 0.12, 0.06, STONE);
  const top = H.eaves - 2.2;
  for (const [side, fwd] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
    const at = framePoint(H, side * (H.hu + SHELL + 0.02), fwd * (H.hv + SHELL + 0.02), top);
    s.upright(at[0], at[1], at[2], H.yaw, side ? 0.01 : 0.6, 1.0, side ? 0.6 : 0.01, DARK_PANE);
  }
  // The clock over the door, its face pale.
  inFrame(f.glow, H, 0, out + 0.01, top - 3.2, 0.7, 0.7, 0.01, [0.5, 0.48, 0.4]);
}

/** a + b·k; a at length k. */
const plus = (a: Vec3, b: Vec3, k = 1): Vec3 => v3madd(a, b, k);
const unit = (a: Vec3, k = 1): Vec3 => v3scale(v3norm(a), k);

/**
 * A building's walls and roof as flat slabs standing SHELL out of the field's surface (which rounds
 * its corners at the mesh's metre cells), the gables filled, a stone plinth round its foot. Grandma's
 * keeps her front door open.
 */
function shell(f: Furnish, H: House, hers: boolean): void {
  const s = f.house, G = H.base, { wall, roof } = houseColors(H); // (plaster and tiles: src/render/materials.ts `HOUSE`)
  const y0 = G - 0.4;
  // The walls: front and back (along its side axis), its two ends.
  const groundUnder = (side: number, fwd: number) => Math.min(...[-1, 0, 1].map((t) => townGround(...(fwd ? local(H.cx, H.cz, H.yaw)(t * H.hu, fwd) : local(H.cx, H.cz, H.yaw)(side, t * H.hv))).y));
  for (const fwd of [-H.hv, H.hv]) {
    const yb = Math.max(y0, groundUnder(0, fwd) - 0.4), cy = (yb + H.eaves) / 2, hy = (H.eaves - yb) / 2;
    if (hers && fwd > 0) {
      // Her front door cut out (TOWN.door: across z, which is her side axis).
      const D = TOWN.door, top = G + D.top, a = D.z[0], b = D.z[1];
      inFrame(s, H, (-H.hu - SHELL + a) / 2, fwd, cy, (a + H.hu + SHELL) / 2, hy, SHELL, wall);
      inFrame(s, H, (H.hu + SHELL + b) / 2, fwd, cy, (H.hu + SHELL - b) / 2, hy, SHELL, wall);
      inFrame(s, H, (a + b) / 2, fwd, (top + H.eaves) / 2, (b - a) / 2, (H.eaves - top) / 2, SHELL, wall);
    } else inFrame(s, H, 0, fwd, cy, H.hu + SHELL, hy, SHELL, wall);
  }
  for (const side of [-H.hu, H.hu]) {
    const yb = Math.max(y0, groundUnder(side, 0) - 0.4);
    inFrame(s, H, side, 0, (yb + H.eaves) / 2, SHELL, (H.eaves - yb) / 2, H.hv + SHELL, wall);
  }
  // A stone plinth round the foot, over the field's fillet where its ground meets its walls (not where a hill buries it).
  const P = { out: SHELL + 0.4, top: G + 0.55 }, py = (y0 + P.top) / 2, ph = (P.top - y0) / 2;
  const plinth = (side: number, fwd: number, hs: number, hf: number) => {
    const at = framePoint(H, side, fwd, py);
    f.solid.upright(at[0], py, at[2], H.yaw, hs, ph, hf, STONE);
    f.block(at[0], at[2], H.yaw, hs, hf, G, P.top);
  };
  const outside = (side: number, fwd: number) => townGround(...local(H.cx, H.cz, H.yaw)(side, fwd)).y < P.top;
  for (const fwd of [-H.hv, H.hv]) {
    if (!outside(0, fwd + Math.sign(fwd))) continue;
    if (hers && fwd > 0) {
      const D = TOWN.door;
      plinth((-H.hu - P.out + D.z[0]) / 2, fwd, (D.z[0] + H.hu + P.out) / 2, P.out);
      plinth((H.hu + P.out + D.z[1]) / 2, fwd, (H.hu + P.out - D.z[1]) / 2, P.out);
    } else plinth(0, fwd, H.hu + P.out, P.out);
  }
  for (const side of [-H.hu, H.hu]) if (outside(side + Math.sign(side), 0)) plinth(side, 0, P.out, H.hv + P.out);

  const es: Vec3 = [Math.cos(H.yaw), 0, -Math.sin(H.yaw)], ef: Vec3 = [Math.sin(H.yaw), 0, Math.cos(H.yaw)], up: Vec3 = [0, 1, 0];
  const c: Vec3 = [H.cx, 0, H.cz], over = 0.35;
  if (H.ridge === 'spire') {
    // Four faces from the eaves (out over the walls) to the point.
    const apex = plus([H.cx, ridgeHeight(H), H.cz], up, 0.02), ey = H.eaves - over * 0.5;
    const corner = (a: number, b: number) => plus(plus(plus(c, es, a * (H.hu + over)), ef, b * (H.hv + over)), up, ey);
    for (const [a1, b1, a2, b2] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) {
      const p = corner(a1, b1), q = corner(a2, b2), n = unit(v3cross([q[0] - p[0], q[1] - p[1], q[2] - p[2]], [apex[0] - p[0], apex[1] - p[1], apex[2] - p[2]]));
      const m = n[1] < 0 ? unit(n, -1) : n;
      s.ribbon([p, apex], [q, apex], [m, m], [roof, roof]);
      s.ribbon([q, apex], [p, apex], [m, m], [roof, roof]);
    }
    return;
  }
  // Ridge along `r` (half length A), the roof falling across `b` (half width B).
  const across = H.ridge === 'across', r = across ? ef : es, b = across ? es : ef, A = across ? H.hv : H.hu, B = across ? H.hu : H.hv;
  const ridge = H.eaves + B * H.pitch;
  // The gables: a triangle of wall over each end, both ways round.
  for (const e of [-1, 1]) {
    const o = plus(c, r, e * (A + SHELL)), n = unit(r, e);
    const p: Vec3 = plus(plus(o, b, -(B + SHELL)), up, H.eaves), q: Vec3 = plus(plus(o, b, B + SHELL), up, H.eaves), t: Vec3 = plus(o, up, ridge);
    s.ribbon([p, t], [q, t], [n, n], [wall, wall]);
    s.ribbon([q, t], [p, t], [n, n], [wall, wall]);
  }
  // The roof: a slab down each side from the ridge, out over the walls.
  const lift = SHELL + 0.06;
  for (const side of [-1, 1]) {
    const ey = H.eaves - over * H.pitch, eb = side * (B + over);
    const half: Vec3 = plus(unit(b, eb / 2), up, (ey - ridge) / 2);
    let u: Vec3 = unit(r, A + over), n = unit(v3cross(u, half));
    if (n[1] < 0) { u = unit(r, -(A + over)); n = unit(v3cross(u, half)); }
    const mid = plus(plus(plus(c, b, eb / 2), up, (ridge + ey) / 2), n, lift);
    s.box(mid[0], mid[1], mid[2], u, half, unit(n, 0.06), roof);
  }
}

const SIGN: Rgb = [0.12, 0.09, 0.06], BRASS: Rgb = [0.6, 0.47, 0.2], PAINT: Rgb = [0.18, 0.3, 0.22];
const CRATE: Rgb = [0.38, 0.27, 0.15], ROPE: Rgb = [0.55, 0.47, 0.3], WOOD_HANDLE: Rgb = [0.3, 0.2, 0.1];

/**
 * A shop's front: a wide lit window either side of the door, the sign board over it, a lantern by
 * the door; and its sign: Ilse's three brass balls, or Kemal's crates and coil of rope out front.
 */
function shopFront(f: Furnish, H: House, out: number): void {
  const s = f.solid, G = H.base;
  for (const side of [-1, 1]) {
    const u = H.door + side * 1.6;
    inFrame(f.glow, H, u, out, G + 1.45, 0.85, 0.7, 0.01, [0.9, 0.62, 0.3]);
    inFrame(s, H, u, out + 0.01, G + 1.45, 0.04, 0.7, 0.02, FRAME);
    inFrame(s, H, u, out + 0.06, G + 0.72, 0.92, 0.04, 0.1, STONE);
  }
  inFrame(s, H, H.door, out + 0.1, G + 2.75, 1.1, 0.28, 0.04, SIGN);
  inFrame(s, H, H.door, out + 0.12, G + 2.75, 1.0, 0.2, 0.02, H.role === 'pawn' ? BRASS : PAINT);
  if (H.role === 'pawn') {
    // The three brass balls, hung from an iron arm.
    inFrame(s, H, H.door, out + 0.55, G + 3.25, 0.02, 0.02, 0.5, IRON);
    for (const [du, dy] of [[-0.12, 0], [0.12, 0], [0, -0.2]]) {
      const p = framePoint(H, H.door + du, out + 0.95, G + 3.0 + dy);
      s.ellipsoid(p[0], p[1], p[2], 0.09, 0.09, 0.09, BRASS, 10);
    }
  } else {
    // Kemal's goods out on the pavement: crates, a coil of rope, a shovel leant on the wall.
    const cu = H.door - 2.4, pf = out + 0.75;
    const [cx, cz] = local(H.cx, H.cz, H.yaw)(cu, pf);
    s.upright(cx, G + 0.25, cz, H.yaw + 0.15, 0.3, 0.25, 0.3, CRATE);
    s.upright(cx, G + 0.66, cz, H.yaw - 0.1, 0.24, 0.16, 0.24, CRATE);
    f.block(cx, cz, H.yaw + 0.15, 0.34, 0.34, G, G + 0.82);
    const rp = framePoint(H, H.door + 2.4, pf, G + 0.09);
    s.cylinder(rp[0], rp[1], rp[2], 0.3, 0.09, ROPE, 14);
    s.cylinder(rp[0], rp[1], rp[2], 0.12, 0.1, SIGN, 10);
    const a = framePoint(H, H.door + 1.0, out + 0.3, G + 0.05), b = framePoint(H, H.door + 1.0, out + 0.08, G + 1.3);
    s.beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.03, 0.02, WOOD_HANDLE);
    inFrame(s, H, H.door + 1.0, out + 0.31, G + 0.15, 0.11, 0.14, 0.015, IRON);
  }
  // The lantern by the door, lit.
  const lu = H.door + 0.85;
  inFrame(s, H, lu, out + 0.15, G + 2.25, 0.06, 0.02, 0.12, IRON);
  inFrame(f.glow, H, lu, out + 0.2, G + 2.1, 0.07, 0.11, 0.07, LANTERN);
  const l = framePoint(H, lu, out + 0.3, G + 2.0);
  f.light(l[0], l[1], l[2]);
}
