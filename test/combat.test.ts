import { test } from 'node:test';
import assert from 'node:assert/strict';
import { damage, nearestReached, reach, type Blow, type Fighter } from '../src/combat/combat';

function dummy(x: number, z: number, y = 0): Fighter & { health: number; causes: string[] } {
  return {
    x, y, z, vx: 0, vz: 0, radius: 0.2, height: 0.3, health: 10, causes: [],
    get dead() { return this.health <= 0; },
    hurt(a: number, c: string) { this.health -= a; this.causes.push(c); },
  };
}

// Facing -z (yaw 0).
const blow: Blow = { x: 0, y: 0, z: 0, yaw: 0, range: 1, arc: 0.8, low: -0.3, high: 1.3 };

test('a blow reaches what is in front, in range and at a height it covers', () => {
  assert.ok(reach(blow, dummy(0, -1)));
  assert.ok(!reach(blow, dummy(0, -1.4)), 'out of range');
  assert.ok(!reach(blow, dummy(0, 1)), 'behind');
  assert.ok(!reach(blow, dummy(0, -1, 2)), 'too high');
  assert.ok(reach(blow, dummy(0.1, 0.05)), 'touching counts from any side');
});

test('the nearest reached target is the one hit; the dead are not', () => {
  const near = dummy(0.1, -0.6), far = dummy(-0.1, -1);
  assert.equal(nearestReached(blow, [far, near]), near);
  near.health = 0;
  assert.equal(nearestReached(blow, [far, near]), far);
});

test('damage takes health, names the cause and knocks the target away', () => {
  const t = dummy(0, -1);
  damage(t, 4, 0, 0, 3, 'knife');
  assert.equal(t.health, 6);
  assert.deepEqual(t.causes, ['knife']);
  assert.ok(t.vz < -2.9 && Math.abs(t.vx) < 1e-9);
  damage(t, 0, 0, 0, 3, 'knife');
  assert.equal(t.causes.length, 1, 'no damage, no hurt');
});
