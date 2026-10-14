import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { SHAFT, ladderTop } from '../src/gen/descents';

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
