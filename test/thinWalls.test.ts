import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { Body, type BodyInput } from '../src/world/traverse/body';

// Arnd's reports (v0.190): level 4 of seed 1, walking at a wall between workings that the opening
// noise had worn to a sliver full of holes. The 1 m mesh drew bigger holes than the rock had, and
// the nobody stood at an invisible wall from either side.
const level = new Level(1, 4);
const REPORTS = [
  { from: [-238.627, -1.236, 124.668], yaw: 92.1, past: (b: Body) => b.x < -241.8 },
  { from: [-242.193, -2.263, 124.966], yaw: -92.7, past: (b: Body) => b.x > -240.6 },
] as const;

test('the walls between workings are never a sliver: both reported invisible walls can be walked through', () => {
  for (const r of REPORTS) for (const dz of [-0.4, 0, 0.4]) for (const turn of [-10, 0, 10]) {
    const [x, , z] = r.from;
    const b = new Body(x, level.groundAt(x, z + dz) + 0.2, z + dz);
    const inp: BodyInput = { forward: 1, right: 0, yaw: ((r.yaw + turn) * Math.PI) / 180, sprint: false, jump: false };
    let t = 0;
    for (; t < 6 * 120 && !r.past(b); t++) {
      b.step(level, { ...inp }, 1 / 120);
      if (b.ledge) b.overLedge(); // the game plays the pull-up, then this
    }
    assert.ok(r.past(b), `from ${x}, ${(z + dz).toFixed(1)} at ${r.yaw + turn}°: stuck at ${b.x.toFixed(2)}, ${b.y.toFixed(2)}, ${b.z.toFixed(2)} (${b.mode})`);
  }
});
