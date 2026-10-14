import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLabParams } from '../src/lab/params';

test('Lab params: numeric and text seeds, depth floor, position', () => {
  assert.equal(parseLabParams('?seed=42').seed, 42);
  assert.equal(parseLabParams('?seed=grandma').seed, parseLabParams('?seed=grandma').seed);
  assert.notEqual(parseLabParams('?seed=grandma').seed, parseLabParams('?seed=grandpa').seed);
  assert.equal(parseLabParams('?depth=0').depth, 1);
  assert.deepEqual(parseLabParams('?pos=1,2,3').pos, [1, 2, 3]);
  assert.equal(parseLabParams('?pos=1,2').pos, null);
  assert.equal(parseLabParams('?gl').forceWebGL, true);
});

test('Lab params: look direction and colour mode', () => {
  assert.deepEqual(parseLabParams('?look=90,-20').look, [90, -20]);
  assert.equal(parseLabParams('?look=90').look, null);
  assert.equal(parseLabParams('?color=working').color, 'working');
  assert.equal(parseLabParams('?color=nonsense').color, 'rock');
});

test('dark starts in headlamp darkness', () => {
  assert.equal(parseLabParams('?seed=1').dark, false);
  assert.equal(parseLabParams('?seed=1&dark').dark, true);
});
