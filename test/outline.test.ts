import { test } from 'node:test';
import assert from 'node:assert/strict';
import { along, hull, rounded } from '../src/app/outline';

test("Salt Sight's aura outline: evenly spaced round the body, each point's normal pointing away from it", () => {
  const box = hull([[100, 100], [220, 100], [220, 160], [100, 160], [160, 130]]);
  for (const shape of [rounded(box, 12), [...rounded(box, 12)].reverse()]) {
    const pts = along(shape, 9);
    assert.ok(pts.length >= 24, `${pts.length} points`);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      assert.ok(Math.abs(p.u - i / pts.length) < 1e-9, 'its share of the way round');
      assert.ok(Math.abs(Math.hypot(p.nx, p.ny) - 1) < 1e-9, 'a unit normal');
      assert.ok((p.x - 160) * p.nx + (p.y - 130) * p.ny > 0, `outwards at ${p.x.toFixed(0)}, ${p.y.toFixed(0)}`);
      assert.ok(Math.hypot(q.x - p.x, q.y - p.y) < 12, 'no gap along it');
    }
  }
  assert.deepEqual(along([[0, 0], [0, 0], [0, 0]], 9), [], 'nothing for a body of no size');
});
