import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { CELLAR, CELLAR_SHAFT } from '../src/gen/cellar';
import { quarryProps, PROP_TILE } from '../src/gen/quarryProps';
import { heirName, notaryLetter, notaryList } from '../src/gen/notary';
import { Campfire, type Rester } from '../src/world/fire';
import { Blockers } from '../src/world/blockers';
import { Body } from '../src/world/traverse/body';

const level = new Level(1, 0);

test("depth 0 is grandma's cellar, the same for every seed", () => {
  assert.equal(level.band.id, 'cellar');
  const other = new Level(77, 0);
  for (const [x, y, z] of [[0, 1, 0], [6.6, 1, 0], [11, 1, 0.3], [20, 1, 0]]) assert.equal(level.sdf(x, y, z), other.sdf(x, y, z));
});

test('one walks from the armchair through the doorway and the broken arch to the old shaft', () => {
  const [sx, sy, sz] = level.arrival;
  assert.deepEqual([sx, sy, sz], [CELLAR.start.x, 0, CELLAR.start.z]);
  // Head-high air all along the way, the floor at 0.
  for (let x = -4; x <= 13.5; x += 0.25) {
    assert.ok(level.sdf(x, 1.2, 0) > 0.1, `air at x ${x}`);
    assert.ok(Math.abs(level.groundAt(x, 0)) < 0.3, `floor at x ${x}: ${level.groundAt(x, 0).toFixed(2)}`);
  }
  // Rock beyond the walls, and none of the Quarry's halls round about.
  for (const [x, z] of [[0, 4], [6.6, 3.5], [11, 2.5], [-12, 0], [30, 0], [0, 30]]) assert.ok(level.sdf(x, 1.2, z) < 0, `rock at ${x}, ${z}`);
  // The stairs rise into the house.
  assert.ok(level.groundAt(-7.8, 0) > 2.2);
});

test("up the stairs is her ground floor: a body walks into the hall, the kitchen, her bedroom and the living room", () => {
  const F = CELLAR.house.floor;
  for (const [x, z] of [[-12, 0], [-9.9, 3], [-13, 3.5], [-11, -3]]) {
    assert.ok(level.sdf(x, F + 1.2, z) > 0.3, `air at ${x}, ${z}`);
    assert.ok(Math.abs(level.groundAt(x, z) - F) < 0.1, `floor at ${x}, ${z}: ${level.groundAt(x, z).toFixed(2)}`);
  }
  assert.ok(level.sdf(-12, F + 2.9, 0) < 0, 'a ceiling');
  assert.ok(level.sdf(-12, 1.2, 0) < 0, 'rock under the floor');
  const blockers = new Blockers();
  for (let tz = -1; tz <= 0; tz++) for (let tx = -1; tx <= 0; tx++) blockers.set(`${tx},${tz}`, quarryProps(level, tx, tz).blockers);
  // From the cellar up the stairs, along the hall and through each doorway.
  const go = (path: readonly (readonly [number, number])[]): Body => {
    const b = new Body(-3, 0, 0), dt = 1 / 120;
    for (const [tx, tz] of [[-6, 0], [-8.8, 0], ...path]) {
      for (let t = 0; t < 12 && Math.hypot(tx - b.x, tz - b.z) > 0.2; t += dt) {
        b.step(level, { forward: 1, right: 0, yaw: Math.atan2(-(tx - b.x), -(tz - b.z)), sprint: false, jump: false }, dt, blockers);
      }
    }
    return b;
  };
  const near = (b: Body, x: number, z: number) => Math.hypot(b.x - x, b.z - z) < 0.4 && Math.abs(b.y - F) < 0.2;
  const kitchen = go([[-9.9, 0], [-9.9, 1.8], [-10.6, 3.4]]);
  assert.ok(near(kitchen, -10.6, 3.4), `kitchen: ${kitchen.x.toFixed(2)}, ${kitchen.y.toFixed(2)}, ${kitchen.z.toFixed(2)}`);
  const bedroom = go([[-13.1, 0], [-13.1, 2.0]]);
  assert.ok(near(bedroom, -13.1, 2.0), `bedroom: ${bedroom.x.toFixed(2)}, ${bedroom.z.toFixed(2)}`);
  const living = go([[-11.7, 0], [-11.7, -2.6]]);
  assert.ok(near(living, -11.7, -2.6), `living room: ${living.x.toFixed(2)}, ${living.z.toFixed(2)}`);
  // The thin walls hold: straight from the hall at the kitchen's wall does not get through it.
  const walled = go([[-8.8, 0.95], [-8.8, 3]]);
  assert.ok(walled.z < 1.1, `through the wall: ${walled.z.toFixed(2)}`);
});

test("a body fits through every way out of grandma's room: the doorway, the arch, on to the shaft and up the stairs", () => {
  const blockers = new Blockers();
  for (let tz = -1; tz <= 0; tz++) for (let tx = -1; tx <= 1; tx++) blockers.set(`${tx},${tz}`, quarryProps(level, tx, tz).blockers);
  // Walk from the start along z = 0.9 (round her chair and table) to `x`, then along the middle.
  const walk = (x: number): Body => {
    const b = new Body(CELLAR.start.x, 0, CELLAR.start.z);
    const dt = 1 / 120;
    for (const [tx, tz] of [[CELLAR.start.x, 0.9], [x > CELLAR.start.x ? 7.5 : 4.5, x > CELLAR.start.x ? 0.9 : 0], [x, 0]]) {
      for (let t = 0; t < 12 && Math.hypot(tx - b.x, tz - b.z) > 0.2; t += dt) {
        b.step(level, { forward: 1, right: 0, yaw: Math.atan2(-(tx - b.x), -(tz - b.z)), sprint: false, jump: false }, dt, blockers);
      }
    }
    return b;
  };
  assert.ok(walk(13).x > 12.7, `through the arch: stopped at x ${walk(13).x.toFixed(2)}`);
  const west = walk(-6.5);
  assert.ok(west.x < -6.2 && west.y > 0.8, `through the doorway and up the stairs: stopped at x ${west.x.toFixed(2)}, y ${west.y.toFixed(2)}`);
});

test("making straight for a way out from anywhere in her room gets one through: her walls slide one along, they are not climbed", () => {
  const blockers = new Blockers();
  for (let tz = -1; tz <= 0; tz++) for (let tx = -1; tx <= 1; tx++) blockers.set(`${tx},${tz}`, quarryProps(level, tx, tz).blockers);
  const go = (sx: number, sz: number, tx: number): Body => {
    const b = new Body(sx, 0, sz);
    const dt = 1 / 120;
    for (let t = 0; t < 8 && Math.hypot(tx - b.x, b.z) > 0.3; t += dt) {
      b.step(level, { forward: 1, right: 0, yaw: Math.atan2(-(tx - b.x), b.z), sprint: false, jump: false }, dt, blockers);
    }
    return b;
  };
  // From round the wall of the room, at a slant to the doorway (west) and to the arch (east); not from behind her chair or table.
  for (const [sx, sz] of [[4.6, 1.2], [4.6, -1.2], [5.5, 1.6], [5.5, -1.6], [6.6, 1.9], [6.6, -1.9]]) {
    const w = go(sx, sz, 1.5);
    assert.ok(w.x < 2 && w.mode === 'walk', `to the doorway from (${sx}, ${sz}): stopped at (${w.x.toFixed(2)}, ${w.z.toFixed(2)}), ${w.mode}`);
  }
  for (const [sx, sz] of [[5.5, 1.6], [5.5, -1.6], [7.5, 1.4], [7.5, -1.4], [6.6, 1.9], [6.6, -1.9]]) {
    const e = go(sx, sz, 11.5);
    assert.ok(e.x > 11 && e.mode === 'walk', `to the arch from (${sx}, ${sz}): stopped at (${e.x.toFixed(2)}, ${e.z.toFixed(2)}), ${e.mode}`);
  }
  assert.ok(!level.climbable(4.9, 1, 0.75) && !level.climbable(-11, 3.5, 4.1) && level.climbable(12, 1, 0.9), 'bricks and plaster no, the mine yes');
});

test('nothing drawn stands in the way up the stairs that one would walk through', () => {
  // Segments up the middle of the stairs at knee and head height, against every solid prop triangle near them.
  const S = CELLAR.stairs, floor = (x: number) => (x >= S.x[1] ? 0 : x <= S.x[0] ? S.top : ((S.x[1] - x) / (S.x[1] - S.x[0])) * S.top);
  const meshes = [-1, 0].flatMap((tx) => [-1, 0].map((tz) => quarryProps(level, tx, tz).solid)).filter((m) => m !== null);
  const hits: string[] = [];
  for (const up of [0.6, 1.5]) for (let x = -3.2; x > -9; x -= 0.2) {
    const a = [x, floor(x) + up, 0], b = [x - 0.2, floor(x - 0.2) + up, 0];
    for (const m of meshes) for (let i = 0; i < m.indices.length; i += 3) {
      const v = [0, 1, 2].map((k) => [0, 1, 2].map((c) => m.positions[m.indices[i + k] * 3 + c]));
      if (crosses(a, b, v[0], v[1], v[2])) hits.push(`x ${x.toFixed(1)} +${up}: a triangle at ${v[0].map((c) => c.toFixed(2)).join(',')}`);
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
