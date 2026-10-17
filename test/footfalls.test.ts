import { test } from 'node:test';
import assert from 'node:assert/strict';
import { footfalls } from '../src/audio/gameSounds';

test('a footstep sounds on each heel strike the gait phase passes, and only then', () => {
  assert.equal(footfalls(0.2, 0.3), 1, 'left heel');
  assert.equal(footfalls(0.7, 0.8), 1, 'right heel');
  assert.equal(footfalls(0.3, 0.7), 0, 'mid-swing');
  assert.equal(footfalls(0.9, 0.1), 0, 'round the end of the cycle, no heel');
  assert.equal(footfalls(0.2, 0.25), 1, 'landing on the strike counts');
  assert.equal(footfalls(0.25, 0.3), 0, 'and is not counted twice');
  assert.equal(footfalls(0.4, 0.4), 0, 'standing still');
  assert.equal(footfalls(0.3, 0.2), 1, 'backpedalling crosses it backwards');
  assert.equal(footfalls(0.8, 0.7), 1);
});

test('a walk of many small frames sounds two steps a cycle', () => {
  let n = 0, p = 0.1;
  for (let i = 0; i < 300; i++) { const q = (p + 0.01) % 1; n += footfalls(p, q); p = q; }
  assert.equal(n, 6, 'three cycles, six heel strikes');
});
