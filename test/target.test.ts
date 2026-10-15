import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keeps, nextTarget, TARGET, yawTo } from '../src/game/target';
import type { Fighter } from '../src/combat/combat';

const foe = (x: number, z: number, dead = false): Fighter => ({ x, y: 0, z, vx: 0, vz: 0, radius: 0.3, height: 0.5, dead, hurt() {} });

test('Tab picks the foe near where the camera looks first, then goes round them', () => {
  // Looking along -z (yaw 0): one ahead at 8 m, one behind at 3 m, one ahead-left at 5 m, one dead, one too far.
  const ahead = foe(0, -8), behind = foe(0, 3), left = foe(-2, -5), dead = foe(0, -2, true), far = foe(0, -(TARGET.pick + 5));
  const all = [behind, ahead, left, dead, far];
  const first = nextTarget(all, null, 0, 0, 0, 0);
  assert.equal(first, left);
  const second = nextTarget(all, first, 0, 0, 0, 0);
  assert.equal(second, ahead);
  assert.equal(nextTarget(all, second, 0, 0, 0, 0), behind);
  assert.equal(nextTarget(all, behind, 0, 0, 0, 0), left, 'round again');
  assert.equal(nextTarget([dead, far], null, 0, 0, 0, 0), null);
});

test('a target is let go once it dies or gets far; knives turn to it', () => {
  assert.ok(keeps(foe(0, -10), 0, 0));
  assert.ok(!keeps(foe(0, -(TARGET.keep + 1)), 0, 0));
  assert.ok(!keeps(foe(0, -2, true), 0, 0));
  assert.ok(Math.abs(yawTo(foe(0, -5), 0, 0)) < 1e-9, 'straight ahead is yaw 0');
  assert.ok(Math.abs(yawTo(foe(-5, 0), 0, 0) - Math.PI / 2) < 1e-9, 'to the left is +π/2');
});
