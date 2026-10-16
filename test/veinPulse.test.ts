import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { PULSE, pulseAt, pulseFrom, pulseRing } from '../src/gen/veinPulse';

test('one pulse in each window, the same for a seed, running its whole life', () => {
  let starts = 0, last: number | null = null;
  for (let t = 0; t < PULSE.window * 6; t += 0.25) {
    const s = pulseAt(1, 4, t);
    assert.equal(s, pulseAt(1, 4, t));
    if (s !== null) {
      assert.ok(t >= s && t < s + PULSE.life);
      if (s !== last) starts++;
    }
    last = s;
  }
  assert.equal(starts, 6);
});

test('it starts behind the viewer, on the far side from the nearest way down', () => {
  const l = new Level(1, 3), [x, , z] = l.arrival, down = l.descents.nearest(x, z, PULSE.seen);
  const [ox, oz] = pulseFrom(l, x, z, 1, 0);
  assert.ok(Math.abs(Math.hypot(ox - x, oz - z) - PULSE.behind) < 1e-6);
  if (down && !down.up) assert.ok(Math.hypot(down.x - ox, down.z - oz) > Math.hypot(down.x - x, down.z - z), 'the viewer lies between it and the way down');
});

test('its ring spreads, rises gently and fades out before it ends', () => {
  assert.deepEqual(pulseRing(0), [0, 0]);
  assert.ok(pulseRing(3)[1] === 1 && pulseRing(3)[0] > pulseRing(2)[0]);
  assert.ok(pulseRing(PULSE.life)[1] < 1e-9);
});
