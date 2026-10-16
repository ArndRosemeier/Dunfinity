import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TITLE_DEPTHS, shotAt } from '../src/game/titleShots';

test('the title goes down: each shot deeper than the last, from the street at the top', () => {
  assert.equal(TITLE_DEPTHS[0], 0);
  for (let i = 1; i < TITLE_DEPTHS.length; i++) assert.ok(TITLE_DEPTHS[i] > TITLE_DEPTHS[i - 1]);
  const top = shotAt(1, 0);
  assert.match(top.at.name, /street/);
});

test('a title shot stands the nobody by something alive, the same for the same seed', () => {
  const a = shotAt(1, 5), b = shotAt(1, 5);
  assert.deepEqual(a.at, b.at);
  assert.match(a.at.name, /Foreman/); // level 5 has the Foreman's hall
  assert.equal(a.caption, 'Level 5 · The Salt Works');
  const c = shotAt(1, 1);
  assert.match(c.at.name, / \(\d+ m\)$/); // a den
  assert.ok(Math.abs(c.level.groundAt(c.at.x, c.at.z) - c.at.y) < 0.5, 'stands on the floor');
});
