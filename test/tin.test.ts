import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SALT, Tin, pinches } from '../src/loot/tin';

test('salt rewards firsts: the first of a kind most, a few pinches later, then nothing', () => {
  assert.equal(pinches(1, 4), 4);
  assert.equal(pinches(2, 4), 2);
  assert.equal(pinches(3, 4), 2);
  assert.equal(pinches(4, 4), 0);
  assert.equal(pinches(5, 4), 1);
  assert.equal(pinches(50, 4), 0);
  const tin = new Tin();
  assert.equal(tin.salt, SALT.start);
  let total = 0;
  for (let k = 0; k < 60; k++) total += tin.killed('touched')?.amount ?? 0;
  assert.equal(total, 4 + 2 + 2 + 3);
  assert.equal(tin.salt, SALT.start + total);
  assert.match(new Tin().killed('rats')!.why, /first rat/);
});

test('a new depth and a camp of grandma\'s give salt once', () => {
  const tin = new Tin();
  assert.ok(tin.reached(3)!.amount > 0);
  assert.equal(tin.reached(3), null);
  assert.ok(tin.camp(9)!.amount > 0);
  assert.equal(tin.camp(9), null);
});
