import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Practice, SKILLS, TIERS } from '../src/loot/practice';

test('practice goes up a tier at a few low marks, and says so once each', () => {
  const p = new Practice();
  let ups = 0;
  for (let k = 0; k < TIERS[2] + 5; k++) if (p.use('knife')) ups++;
  assert.equal(ups, 3);
  assert.equal(p.tier('knife'), 3);
  assert.equal(p.tier('throwing'), 0);
  assert.ok(Math.abs(p.more('knife') - (1 + 3 * SKILLS.knife.per)) < 1e-9);
  assert.equal(p.less('guard'), 1);
});

test('climbing counts metres, many at a time', () => {
  const p = new Practice();
  assert.equal(p.use('climbing', 12), 1);
  assert.equal(p.use('climbing', 0.5), 0);
  assert.ok(p.less('climbing') < 1);
});
