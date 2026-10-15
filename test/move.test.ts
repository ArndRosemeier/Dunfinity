import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Body, MOVE } from '../src/world/traverse/body';
import { moveOf, SWIM, swimLift } from '../src/render/humans/move';

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

test('a swimmer is drawn with the head at the surface, not under it (the swim pose lies at hip height)', () => {
  // Measured in the game (tools/shot/swim-probe.mjs): the swim pose's head is 0.74 of the human's
  // height over the feet treading water, 0.68 crawling.
  for (const height of [1.45, 1.6, 1.8]) {
    const origin = -MOVE.float + swimLift(height); // the water line at 0
    for (const share of [0.74, 0.68]) {
      const head = origin + share * height;
      assert.ok(head > 0.03 && head < 0.25, `head ${head.toFixed(2)} m over the water at height ${height}`);
    }
    assert.ok(swimLift(height) > 0, 'drawn higher than the floating feet');
  }
  assert.equal(swimLift(1.6), MOVE.float - SWIM.line * 1.6);
});
