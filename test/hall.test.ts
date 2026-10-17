import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crossing, HALL } from '../src/world/hall';
import { glimpseOf } from '../src/world/thinPlaces';

const look = glimpseOf(1, 5, 0);

test('the hall between worlds goes on while that world is not ready, and lets one out once it is', () => {
  const c = new Crossing(0.4, look, false), dt = 1 / 60;
  // Walking straight down it (looking the way it runs) for 20 s while not ready: never out, the doorway always ahead.
  for (let i = 0; i < 20 * 60; i++) assert.equal(c.walk(dt, 1, 0, 0.4, false), false);
  assert.ok(-c.z > HALL.length, `walked ${(-c.z).toFixed(1)} m`);
  assert.ok(c.length - -c.z >= HALL.more - 0.1, 'the doorway keeps ahead');
  assert.ok(Math.abs(c.x) < 1e-6, 'straight down the middle');
  // Ready: the doorway stops, and walking on goes through it within the time to walk what is left.
  const left = c.length + c.z;
  let out = -1;
  for (let i = 0; i < 60 * 10 && out < 0; i++) if (c.walk(dt, 1, 0, 0.4, true)) out = i * dt;
  assert.ok(out >= 0 && out <= left / HALL.speed + 0.2, `out after ${out.toFixed(2)} s`);
  assert.equal(c.shown, 1);
  for (let i = 0; i < 60; i++) c.walk(dt, 0, 0, 0, true);
  assert.ok(c.over, 'faded');
  assert.equal(c.shown, 0);
});

test('in the hall one walks the way one looks, never out through its walls or back through the window', () => {
  const c = new Crossing(0, look, true), dt = 1 / 60;
  for (let i = 0; i < 600; i++) c.walk(dt, 1, 0, Math.PI / 2, false); // looking left: across it
  assert.ok(c.x <= -HALL.side + 1e-6 && Math.abs(c.z) < 1e-6, `at ${c.x.toFixed(2)}, ${c.z.toFixed(2)}`);
  for (let i = 0; i < 600; i++) c.walk(dt, -1, 0, 0, false); // backing up
  assert.ok(c.z <= HALL.behind, 'not back through the window');
  assert.equal(c.out, null);
});
