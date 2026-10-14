import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { quarryProps, PROP_TILE } from '../src/gen/quarryProps';
import { Blockers, BLOCKER_STRIDE } from '../src/world/blockers';
import { Body, type BodyInput } from '../src/world/traverse/body';

const box = (x: number, z: number, yaw: number, hx: number, hz: number, y0 = 0, y1 = 2) => new Float32Array([x, z, hx, hz, Math.cos(yaw), Math.sin(yaw), y0, y1]);

test('a circle is pushed out of a turned box, to the outside, and only where heights overlap', () => {
  const b = new Blockers();
  b.set('t', box(0, 0, 0.6, 1, 0.5));
  const out: [number, number] = [0, 0];
  for (const [x, z] of [[0.3, 0.1], [1.1, 0.2], [-0.2, -0.6], [0, 0]]) {
    if (!b.pushOut(x, z, 0.35, 0.3, 1.7, out)) continue;
    assert.ok(!b.hits(x + out[0], z + out[1], 0.34, 0.3, 1.7), `still inside after the push from ${x}, ${z}`);
  }
  assert.ok(b.hits(0, 0, 0.3, 0, 1));
  assert.ok(!b.hits(0, 0, 0.3, 2.1, 3), 'above the box');
  assert.ok(!b.hits(3, 0, 0.3, 0, 1), 'beside it');
  b.clear('t');
  assert.equal(b.count, 0);
});

test('a body walking at a crate stops at it', () => {
  const level = new Level(1, 1);
  const [sx, , sz] = level.spawn();
  const g = level.groundAt(sx, sz);
  const b = new Blockers();
  // A crate 2 m ahead (walking forward is −z at yaw 0).
  b.set('t', box(sx, sz - 2, 0, 0.4, 0.4, g - 0.3, g + 0.8));
  const body = new Body(sx, g + 0.3, sz);
  const inp: BodyInput = { forward: 1, right: 0, yaw: 0, sprint: false, jump: false };
  for (let i = 0; i < 4 * 120; i++) body.step(level, inp, 1 / 120, b);
  assert.ok(body.z > sz - 2 + 0.4 + 0.3, `walked into the crate: z ${(body.z - sz).toFixed(2)}`);
});

test('the props around the spawn list what is in the way, and the spawn is clear', () => {
  const level = new Level(1, 1);
  const [sx, sy, sz] = level.spawn();
  const b = new Blockers();
  let n = 0;
  for (let tz = -2; tz < 2; tz++) for (let tx = -2; tx < 2; tx++) {
    const t = quarryProps(level, Math.floor(sx / PROP_TILE) + tx, Math.floor(sz / PROP_TILE) + tz);
    assert.equal(t.blockers.length % BLOCKER_STRIDE, 0);
    n += t.blockers.length / BLOCKER_STRIDE;
    b.set(`${tx},${tz}`, t.blockers);
  }
  assert.ok(n > 20, `blockers ${n}`);
  assert.ok(!b.hits(sx, sz, 0.35, sy + 0.3, sy + 1.7), 'the spawn is inside a prop');
});
