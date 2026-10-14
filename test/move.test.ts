import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Body } from '../src/world/traverse/body';
import { moveOf } from '../src/render/humans/move';

const body = (o: Partial<Body>): Body => Object.assign(new Body(0, 0, 0), o);

test('the animator gets the body state: stand, walk, sprint, jump, fall', () => {
  assert.equal(moveOf(body({ grounded: true })), 'idle');
  assert.equal(moveOf(body({ grounded: true, vx: 4.2 })), 'walk');
  assert.equal(moveOf(body({ grounded: true, vz: -7 })), 'sprint');
  assert.equal(moveOf(body({ grounded: false, vy: 6 })), 'jump');
  assert.equal(moveOf(body({ grounded: false, vy: -8 })), 'fall');
});

test('climbing, swimming and death win over the gait', () => {
  assert.equal(moveOf(body({ mode: 'climb', vy: 1.7 })), 'climb');
  assert.equal(moveOf(body({ mode: 'swim', vx: 2 })), 'swim');
  assert.equal(moveOf(body({ health: 0, grounded: true, vx: 4 })), 'dead');
});
