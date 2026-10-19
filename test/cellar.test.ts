import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { CELLAR, CELLAR_SHAFT, stairWell } from '../src/gen/cellar';
import { quarryProps, PROP_TILE } from '../src/gen/quarryProps';
import { heirName, notaryLetter, notaryList } from '../src/gen/notary';
import { Campfire, type Rester } from '../src/world/fire';
import { Blockers } from '../src/world/blockers';
import { Body } from '../src/world/traverse/body';

const level = new Level(1, 0);
const F = CELLAR.house.floor;

/** Everything in the way on the cellar's tiles (the cellar's own, the room's, the passage's and the chamber's). */
function world(): Blockers {
  const blockers = new Blockers();
  for (let tz = -1; tz <= 0; tz++) for (let tx = -1; tx <= 1; tx++) blockers.set(`${tx},${tz}`, quarryProps(level, tx, tz).blockers);
  return blockers;
}

/** Walk a body (no doors) along a way, and where it got to. */
function walk(start: readonly [number, number, number], path: readonly (readonly [number, number])[], seconds = 20): Body {
  const b = new Body(start[0], start[1], start[2]), dt = 1 / 120, blockers = world();
  for (const [tx, tz] of path) {
    for (let t = 0; t < seconds && Math.hypot(tx - b.x, tz - b.z) > 0.2; t += dt) {
      b.step(level, { forward: 1, right: 0, yaw: Math.atan2(-(tx - b.x), -(tz - b.z)), sprint: false, jump: false }, dt, blockers);
    }
  }
  return b;
}

/**
 * Up the turned stair into the hall, from the cellar floor: where it went (a point every 0.25 m),
 * which way it faced as it set off on each leg, and where it arrived.
 */
function climb(): { body: Body; path: [number, number, number][]; headings: number[] } {
  const blockers = world(), b = new Body(-10.2, 0, 0.25), dt = 1 / 120;
  const legs = [[-9.4, 0.25], [-7.9, 0.25], [-7.9, -0.65], [-8.4, -0.65], [-10.5, -0.65], [-11.2, -0.65]] as const;
  const path: [number, number, number][] = [[b.x, b.y, b.z]], headings: number[] = [];
  for (const [tx, tz] of legs) {
    headings.push(Math.atan2(-(tx - b.x), -(tz - b.z)));
    for (let t = 0; t < 20 && Math.hypot(tx - b.x, tz - b.z) > 0.2; t += dt) {
      b.step(level, { forward: 1, right: 0, yaw: Math.atan2(-(tx - b.x), -(tz - b.z)), sprint: false, jump: false }, dt, blockers);
      const [lx, , lz] = path[path.length - 1];
      if (Math.hypot(b.x - lx, b.z - lz) >= 0.25) path.push([b.x, b.y, b.z]);
    }
  }
  return { body: b, path, headings };
}

test("depth 0 is grandma's cellar, the same for every seed", () => {
  assert.equal(level.band.id, 'cellar');
  const other = new Level(77, 0);
  for (const [x, y, z] of [[-11, 1, 0], [-2.9, 1, 0], [2, 1, 0.3], [5.5, 1, 0]]) assert.equal(level.sdf(x, y, z), other.sdf(x, y, z));
});

test('the cellar lies under the house', () => {
  const H = CELLAR.house;
  for (let x = -14.85; x <= -7.55; x += 0.35) for (let z = -2.45; z <= 2.45; z += 0.35) {
    // (the stairwell, and the half metre of its wall, is the one place the two airs join)
    if (stairWell(x, z) > -0.5) continue;
    assert.ok(x >= H.x[0] && x <= H.x[1] && z >= H.z[0] && z <= H.z[1], `under the house at ${x.toFixed(1)}, ${z.toFixed(1)}`);
    // Up the column: the cellar's air, then rock, then the house's air. The band between them is 0.5 m
    // (a thinner one would not mesh, and the hall would open into the cellar).
    let below = -Infinity, above = Infinity;
    for (let y = 0.5; y < 5; y += 0.05) {
      if (level.sdf(x, y, z) <= 0) continue;
      if (y < H.floor - 0.3) below = y;
      else if (above === Infinity) above = y;
    }
    assert.ok(below > 0, `the cellar's air at ${x.toFixed(1)}, ${z.toFixed(1)}`);
    assert.ok(above - below >= 0.5, `rock band ${(above - below).toFixed(2)} m at ${x.toFixed(1)}, ${z.toFixed(1)}`);
  }
});

test('one walks from the armchair through the low doorway and the broken arch to the old shaft', () => {
  const [sx, sy, sz] = level.arrival;
  assert.deepEqual([sx, sy, sz], [CELLAR.start.x, 0, CELLAR.start.z]);
  // From the armchair west through the low doorway into the cellar; and east through the arch, the
  // passage and into the chamber round the shaft (stopping short of its rim guard).
  const west = walk([sx, 0, sz], [[-4.6, 1.3], [-3.9, 1.65], [-8.2, 1.65]]);
  assert.ok(west.x < -7.6, `through the low doorway: stopped at x ${west.x.toFixed(2)}`);
  assert.ok(Math.abs(west.y) < 0.2, `on the cellar's floor: y ${west.y.toFixed(2)}`);
  const east = walk([sx, 0, sz], [[sx, 1.2], [-2.2, 1.2], [-2.2, 0], [1.5, 0], [3.4, 0]]);
  assert.ok(east.x > 3.1, `through the arch and the passage into the chamber: stopped at x ${east.x.toFixed(2)}`);
  // Head-high air and the floor at 0 all along the room, the arch and the passage.
  for (let x = -2.5; x <= 3.4; x += 0.25) {
    assert.ok(level.sdf(x, 1.2, 0) > 0.1, `air at x ${x}`);
    assert.ok(Math.abs(level.groundAt(x, 0)) < 0.3, `floor at x ${x}: ${level.groundAt(x, 0).toFixed(2)}`);
  }
  // Rock beyond the walls, and none of the Quarry's halls round about.
  for (const [x, z] of [[-11, 3.5], [5.5, 3.8], [2, 2.5], [-15.8, 0], [10, 0], [0, 30]]) assert.ok(level.sdf(x, 1.2, z) < 0, `rock at ${x}, ${z}`);
  // The stairs rise into the house.
  assert.ok(level.groundAt(-10.0, -0.65) > 2.2 && Math.abs(level.groundAt(-10.6, -0.65) - F) < 0.05, 'up the stairs is her ground floor');
});

test('the stairs turn', () => {
  const { body, headings } = climb();
  assert.ok(Math.abs(body.y - F) < 0.15 && body.x < -10.4, `arrived at the hall floor: ${body.x.toFixed(2)}, ${body.y.toFixed(2)}, ${body.z.toFixed(2)}`);
  // The heading on the bottom flight (east, up from the cellar) and on the top flight (west, into the hall).
  const turn = Math.abs(Math.atan2(Math.sin(headings[4] - headings[0]), Math.cos(headings[4] - headings[0])));
  assert.ok(turn > Math.PI / 2, `the stair turns ${((turn * 180) / Math.PI).toFixed(0)}°`);
  assert.ok(headings.length >= 5, 'the walk recorded its heading');
});

test('the stairs have headroom', () => {
  const { path } = climb();
  assert.ok(path.length > 20, `a walked path of ${path.length} points`);
  for (const [x, y, z] of path) assert.ok(level.sdf(x, y + 2, z) > 0, `air 2 m over the stair at ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}`);
});

test('nothing drawn stands in the way up the stairs that one would walk through', () => {
  // Segments along the walked path at knee and head height, against every solid prop triangle near them.
  const { path } = climb();
  const meshes = [-1, 0].flatMap((tx) => [-1, 0].map((tz) => quarryProps(level, tx, tz).solid)).filter((m) => m !== null);
  const hits: string[] = [];
  for (let i = 1; i < path.length; i++) {
    const [ax, ay, az] = path[i - 1], [bx, by, bz] = path[i];
    for (const up of [0.6, 1.5]) for (const m of meshes) for (let k = 0; k < m.indices.length; k += 3) {
      const v = [0, 1, 2].map((j) => [0, 1, 2].map((c) => m.positions[m.indices[k + j] * 3 + c]));
      if (crosses([ax, ay + up, az], [bx, by + up, bz], v[0], v[1], v[2])) hits.push(`at ${ax.toFixed(1)}, ${az.toFixed(1)} +${up}: a triangle at ${v[0].map((c) => c.toFixed(2)).join(',')}`);
    }
  }
  assert.deepEqual(hits.slice(0, 4), []);
});

/** Whether segment a–b crosses triangle p q r (Möller–Trumbore). */
function crosses(a: number[], b: number[], p: number[], q: number[], r: number[]): boolean {
  const sub = (u: number[], v: number[]) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
  const cross = (u: number[], v: number[]) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const dot = (u: number[], v: number[]) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const d = sub(b, a), e1 = sub(q, p), e2 = sub(r, p), h = cross(d, e2), det = dot(e1, h);
  if (Math.abs(det) < 1e-12) return false;
  const s = sub(a, p), u = dot(s, h) / det;
  if (u < 0 || u > 1) return false;
  const qv = cross(s, e1), v = dot(d, qv) / det;
  if (v < 0 || u + v > 1) return false;
  const t = dot(e2, qv) / det;
  return t >= 0 && t <= 1;
}

test("up the stairs is her ground floor: a body walks into the hall, the kitchen, her bedroom and the living room", () => {
  for (const [x, z] of [[-9.9, 3], [-13, 3.5], [-11, -3]]) {
    assert.ok(level.sdf(x, F + 1.2, z) > 0.3, `air at ${x}, ${z}`);
    assert.ok(Math.abs(level.groundAt(x, z) - F) < 0.1, `floor at ${x}, ${z}: ${level.groundAt(x, z).toFixed(2)}`);
  }
  assert.ok(level.sdf(-12, F + 2.9, 0) < 0, 'a ceiling');
  assert.ok(level.sdf(-12, 1.2, 0) > 0.3, 'and the cellar air under the hall');
  // From the foot of the stairs up into the hall, then through each doorway.
  const go = (path: readonly (readonly [number, number])[]): Body => walk([-10.2, 0, 0.25], [[-9.4, 0.25], [-7.9, 0.25], [-7.9, -0.65], [-8.4, -0.65], [-10.5, -0.65], ...path]);
  const near = (b: Body, x: number, z: number) => Math.hypot(b.x - x, b.z - z) < 0.4 && Math.abs(b.y - F) < 0.2;
  const kitchen = go([[-10.3, -0.4], [-9.9, 0.9], [-9.9, 1.8], [-10.6, 3.4]]);
  assert.ok(near(kitchen, -10.6, 3.4), `kitchen: ${kitchen.x.toFixed(2)}, ${kitchen.y.toFixed(2)}, ${kitchen.z.toFixed(2)}`);
  const bedroom = go([[-10.9, -0.3], [-11.0, 0.9], [-13.1, 0.9], [-13.1, 2.0]]);
  assert.ok(near(bedroom, -13.1, 2.0), `bedroom: ${bedroom.x.toFixed(2)}, ${bedroom.z.toFixed(2)}`);
  const living = go([[-11.5, -0.3], [-11.7, -0.9], [-11.7, -2.6]]);
  assert.ok(near(living, -11.7, -2.6), `living room: ${living.x.toFixed(2)}, ${living.z.toFixed(2)}`);
  // The thin walls hold: straight from the hall at the kitchen's wall does not get through it.
  const walled = walk([-10.8, F, 0.5], [[-10.8, 3]]);
  assert.ok(walled.z < 1.1, `through the wall: ${walled.z.toFixed(2)}`);
});

test("a body fits through every way out of grandma's room: the low doorway, the arch, on to the shaft and up the stairs", () => {
  // West through the low doorway into the cellar.
  const west = walk([CELLAR.start.x, 0, CELLAR.start.z], [[-4.6, 1.3], [-3.9, 1.65], [-8.2, 1.65]]);
  assert.ok(west.x < -7.6, `through the low doorway: stopped at x ${west.x.toFixed(2)}`);
  // East through the arch and into the chamber, short of the shaft's rim guard.
  const east = walk([CELLAR.start.x, 0, CELLAR.start.z], [[-4.7, 1.2], [-2.2, 1.2], [-2.2, 0], [1.5, 0], [7.5, 0]]);
  assert.ok(east.x > 3.1, `through the arch: stopped at x ${east.x.toFixed(2)}`);
  // And up the turned stair.
  const up = climb().body;
  assert.ok(up.x < -10.4 && Math.abs(up.y - F) < 0.15, `up the stairs: ${up.x.toFixed(2)}, ${up.y.toFixed(2)}, ${up.z.toFixed(2)}`);
});

test("making straight for a way out from anywhere in her room gets one through: her walls slide one along, they are not climbed", () => {
  const go = (sx: number, sz: number, tx: number, tz: number): Body => walk([sx, 0, sz], [[tx, tz]]);
  // From round the wall of the room, at a slant to the low doorway (west); not from behind her chair or table.
  for (const [sx, sz] of [[-4.6, 0.0], [-4.6, -0.8], [-4.0, 1.2], [-3.0, 1.5], [-2.2, 0.8], [-2.2, -0.8]]) {
    const w = go(sx, sz, -9.1, 1.8);
    assert.ok(w.x < -7.4 && w.mode === 'walk', `to the low doorway from (${sx}, ${sz}): stopped at (${w.x.toFixed(2)}, ${w.z.toFixed(2)}), ${w.mode}`);
  }
  // At a slant to the arch (east).
  for (const [sx, sz] of [[-3.0, 1.5], [-3.0, -1.5], [-1.8, 1.8], [-1.8, -1.8], [-1.0, 1.4], [-1.0, -1.4]]) {
    const e = go(sx, sz, 2.0, 0);
    assert.ok(e.x > 1.6 && e.mode === 'walk', `to the arch from (${sx}, ${sz}): stopped at (${e.x.toFixed(2)}, ${e.z.toFixed(2)}), ${e.mode}`);
  }
  assert.ok(!level.climbable(-11, 1, 1.5) && !level.climbable(-10.6, 3.5, 4.1) && level.climbable(2, 1, 0.9), 'bricks and plaster no, the mine yes');
});

test('its one way down is the old shaft, and level 1 has its way up', () => {
  assert.equal(level.descents.nearest(0, 0, 5000), CELLAR_SHAFT);
  assert.equal(level.descents.nearest(500, 500, 300), null);
  assert.ok(level.sdf(CELLAR_SHAFT.x, -20, CELLAR_SHAFT.z) > 0, 'the shaft is open below');
  assert.ok(new Level(1, 1).ascent?.up);
});

test('the cellar is furnished, lit, and its things are in the air', () => {
  let lit = 0, shafts = 0, solid = 0;
  for (let tz = -1; tz <= 0; tz++) for (let tx = -1; tx <= 1; tx++) {
    const t = quarryProps(level, tx, tz);
    lit += t.counts.lit; shafts += t.counts.shafts; solid += t.solid?.positions.length ?? 0;
    for (let i = 0; i < t.lamps.length; i += 3) assert.ok(level.sdf(t.lamps[i], t.lamps[i + 1], t.lamps[i + 2]) > 0.2, 'a light in the air');
    assert.equal(t.counts.sleepers, 0);
  }
  assert.ok(PROP_TILE >= 16);
  assert.ok(lit >= 3, `lights ${lit}`);
  assert.equal(shafts, 1);
  assert.ok(solid > 1000);
});

test("grandma's salt circle is a fire that never goes out: rest in it, nothing needed", () => {
  const c = new Campfire(level, 100, 12), ci = CELLAR.circle;
  const r: Rester = { x: ci.x + 0.6, y: 0, z: ci.z, vx: 0, vz: 0, health: 30, stamina: 1 };
  for (let t = 0; t < 5; t += 0.1) c.step(r, false, t, 0.1);
  assert.ok(c.resting && r.health > 50, `${r.health}`);
  assert.notEqual(c.whyNot(r, 0, false, 0), '', 'no fire lit in it');
  const out: Rester = { ...r, x: ci.x - ci.r - 0.5, health: 30 };
  c.step(out, false, 6, 0.1);
  assert.ok(!c.resting && out.health === 30);
});

test("the notary's letter lies on her table, and he grows wearier with every heir", () => {
  const w = level.writing!;
  assert.equal(w.kind, 'letter');
  assert.ok(level.sdf(w.at[0], w.at[1] + 0.05, w.at[2]) > 0.3);
  const first = notaryLetter(1, 1), later = notaryLetter(4, 1), last = notaryLetter(12, 1);
  assert.match(first, /inherited her house/);
  assert.match(later, /3 of your cousins/);
  assert.ok(last.length < first.length);
  assert.equal(notaryLetter(3, 9), notaryLetter(3, 9));
  assert.equal(new Level(1, 4).writing, null); // (level 1 has a page of her diary)
});

test("the notary's list: the fallen crossed out with where it happened, then the next heir", () => {
  const list = notaryList([{ heir: 1, depth: 3, what: 'a rat' }, { heir: 2, depth: 7, what: 'a brine eel' }], 3, 5);
  assert.equal(list.length, 3);
  assert.match(list[0], /̶.*\(level 3, a rat\)$/);
  assert.equal(list[2], heirName(3, 5));
  assert.match(notaryLetter(2, 5), new RegExp(heirName(1, 5).replace('.', '\\.')));
  const many = notaryList(Array.from({ length: 9 }, (_, k) => ({ heir: k + 1, depth: 1, what: 'a fall' })), 10, 5);
  assert.match(many[0], /3 more/);
});
