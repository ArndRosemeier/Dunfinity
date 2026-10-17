import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { GATE, gatesOf, walksInto } from '../src/gen/gates';

test('gates lead one level up or down, and their twin there leads back to them', () => {
  const level = new Level(1, 3), [x, , z] = level.arrival;
  const here = gatesOf(level).near(x, z, 500);
  assert.ok(here.length >= 2, `${here.length} gates within 500 m`);
  for (const g of here) {
    assert.ok(g.to === 2 || g.to === 4, `to ${g.to}`);
    assert.ok(Math.hypot(g.twin.x - g.x, g.twin.z - g.z) > GATE.cell * 0.4, 'its twin lies somewhere else');
    const there = gatesOf(new Level(1, g.to)).near(g.twin.x, g.twin.z, 1).find((t) => t.id === g.id);
    assert.ok(there, `its twin on ${g.to} is there`);
    assert.equal(there.to, 3, 'and leads back');
    assert.deepEqual([there.x, there.y, there.z], [g.twin.x, g.twin.y, g.twin.z]);
    assert.deepEqual([there.twin.x, there.twin.z], [g.x, g.z], 'to this one');
    // On a wall: rock just behind its face, open floor where one stands.
    const s = Math.sin(g.yaw), c = Math.cos(g.yaw);
    assert.ok(level.sdf(g.x - s * 0.4, g.y, g.z - c * 0.4) < 0.3, 'rock behind it');
    assert.ok(level.sdf(g.stand[0], g.stand[1] + 1.5, g.stand[2]) > 0.5, 'room before it');
    assert.ok(walksInto(g, g.x + s * 0.4, g.y - GATE.over, g.z + c * 0.4), 'walking against it goes through');
    assert.ok(!walksInto(g, ...g.stand), 'standing before it does not');
  }
});

test('no gate leads into the cellar or out of it', () => {
  const one = new Level(1, 1), [x, , z] = one.arrival;
  assert.ok(gatesOf(one).near(x, z, 500).every((g) => g.to === 2));
  assert.equal(gatesOf(new Level(1, 0)).near(0, 0, 500).length, 0);
});
