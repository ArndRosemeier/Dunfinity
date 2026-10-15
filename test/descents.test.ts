import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { SHAFT, ladderOf, ladderTop } from '../src/gen/descents';

const level = new Level(1, 1);
const [ax, , az] = level.arrival;

test('no shaft near the arrival, and one within reach further out', () => {
  assert.equal(level.descents.nearest(ax, az, SHAFT.quiet - SHAFT.cell / 2), null);
  const s = level.descents.nearest(ax, az, 1200);
  assert.ok(s, 'a shaft within 1.2 km');
});

test('shafts are the same for the same seed and differ per depth', () => {
  const s1 = new Level(1, 1).descents.nearest(ax, az, 1200)!;
  const s2 = level.descents.nearest(ax, az, 1200)!;
  assert.deepEqual([s1.x, s1.z], [s2.x, s2.z]);
  const other = new Level(1, 2).descents.nearest(ax, az, 1200);
  assert.ok(!other || other.x !== s1.x || other.z !== s1.z);
});

test('a shaft is a hole in the floor: air down the middle, rock beside it, the ladder top on the floor', () => {
  const s = level.descents.nearest(ax, az, 1200)!;
  assert.ok(level.sdf(s.x, s.top - 20, s.z) > 1, 'air in the shaft');
  assert.ok(level.sdf(s.x + s.r + 1.5, s.top - 20, s.z) < 0, 'rock beside it');
  assert.ok(level.sdf(s.x, s.bottom - 1, s.z) < 0, 'a bottom');
  const [lx, lz] = ladderTop(s);
  assert.ok(Math.abs(level.groundAt(lx, lz) - s.top) < 0.8, 'the ladder starts on the floor');
});

test('below the cellar one arrives at the foot of a way up: a ladder up a pillar into the ceiling', () => {
  assert.equal(new Level(1, 0).ascent, null);
  for (const seed of [1, 2, 3, 4, 5]) for (const depth of [1, 2]) {
    const l = new Level(seed, depth), a = l.ascent;
    assert.ok(a && a.up, `seed ${seed}: no way up`);
    const L = ladderOf(a);
    const [x, y, z] = l.arrival;
    assert.ok(Math.hypot(x - L.x, z - L.z) < 1.5 && Math.abs(y - L.floor) < 0.01);
    // Room to climb in front of the rungs, rock right behind them, and the shaft open above the ceiling.
    for (let h = L.floor + 1; h < L.hi; h += 2) assert.ok(l.sdf(L.x - L.nx * 0.4, h, L.z - L.nz * 0.4) > 0.25, `seed ${seed}: blocked at ${h}`);
    assert.ok(l.sdf(L.x + L.nx * 0.7, L.floor + 3, L.z + L.nz * 0.7) < 0.1);
    assert.ok(L.hi > a.bottom + 10);
    // The draft never points up.
    assert.notEqual(l.descents.nearest(x, z, 1500), a);
  }
});
