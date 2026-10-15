import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseViewParams } from '../src/app/params';

test('Lab params: numeric and text seeds, depth floor, position', () => {
  assert.equal(parseViewParams('?seed=42').seed, 42);
  assert.equal(parseViewParams('?seed=grandma').seed, parseViewParams('?seed=grandma').seed);
  assert.notEqual(parseViewParams('?seed=grandma').seed, parseViewParams('?seed=grandpa').seed);
  assert.equal(parseViewParams('?depth=-3').depth, 0);
  assert.equal(parseViewParams('').depth, 0); // grandma's cellar
  assert.deepEqual(parseViewParams('?pos=1,2,3').pos, [1, 2, 3]);
  assert.equal(parseViewParams('?pos=1,2').pos, null);
  assert.equal(parseViewParams('?gl').forceWebGL, true);
  assert.equal(parseViewParams('?style=karst').style, 'karst');
  assert.equal(parseViewParams('?style=nonsense').style, undefined);
  assert.equal(parseViewParams('').style, undefined);
});

test('Lab params: look direction and colour mode', () => {
  assert.deepEqual(parseViewParams('?look=90,-20').look, [90, -20]);
  assert.equal(parseViewParams('?look=90').look, null);
  assert.equal(parseViewParams('?color=working').color, 'working');
  assert.equal(parseViewParams('?color=nonsense').color, 'rock');
});

test('dark starts in headlamp darkness', () => {
  assert.equal(parseViewParams('?seed=1').dark, false);
  assert.equal(parseViewParams('?seed=1&dark').dark, true);
});
