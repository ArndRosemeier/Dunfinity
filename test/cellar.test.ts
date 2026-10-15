import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { CELLAR, CELLAR_SHAFT } from '../src/gen/cellar';
import { quarryProps, PROP_TILE } from '../src/gen/quarryProps';

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
