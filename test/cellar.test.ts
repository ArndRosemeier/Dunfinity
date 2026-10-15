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
  // The stairs rise to the house door.
  assert.ok(level.groundAt(-7.8, 0) > 2.2);
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
  assert.equal(new Level(1, 1).writing, null);
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
