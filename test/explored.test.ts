import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { EXPLORE, Explored } from '../src/world/explored';

test('the floor round the nobody is marked seen, not the rock, and comes back from the save', () => {
  const level = new Level(1, 0), e = new Explored();
  e.see(level, 0, 0, 0);
  const c = EXPLORE.cell;
  assert.ok(e.has(0, 0, 0) && e.has(0, Math.floor(-3 / c), 0), 'the cellar floor');
  assert.ok(!e.has(0, 0, Math.floor(6 / c)), 'not the rock beyond the wall');
  assert.ok(!e.has(1, 0, 0), 'not another level');
  const n = e.cells(0);
  assert.ok(n > 5);
  assert.equal(Explored.from(JSON.parse(JSON.stringify(e.data))).cells(0), n);
});
