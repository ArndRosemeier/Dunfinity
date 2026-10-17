import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidates, clicked, keeps, nextTarget, TARGET, yawTo } from '../src/game/target';
import type { Fighter } from '../src/combat/combat';

const foe = (x: number, z: number, dead = false): Fighter => ({ x, y: 0, z, vx: 0, vz: 0, radius: 0.3, height: 0.5, dead, hurt() {} });

test('Tab picks the foe near where the camera looks first, then goes round them', () => {
  // Looking along -z (yaw 0): one ahead at 8 m, one behind at 3 m, one ahead-left at 5 m, one dead, one too far.
  const ahead = foe(0, -8), behind = foe(0, 3), left = foe(-2, -5), dead = foe(0, -2, true), far = foe(0, -(TARGET.pick + 5));
  const all = [behind, ahead, left, dead, far], tried = new Set<Fighter>();
  const list = candidates(all, 0, 0, 0, 0);
  const first = nextTarget(list, null, tried);
  assert.equal(first, left);
  const second = nextTarget(list, first, tried);
  assert.equal(second, ahead);
  assert.equal(nextTarget(list, second, tried), behind);
  assert.equal(nextTarget(list, behind, tried), left, 'round again');
  assert.equal(nextTarget(candidates([dead, far], 0, 0, 0, 0), null, new Set()), null);
});

test('Tab only goes through the foes you can see', () => {
  // A rat right ahead, and two nearer ones behind the rock (not seen): Tab picks the rat, and stays on it.
  const rat = foe(0, -6), hid1 = foe(1, -1), hid2 = foe(-1, 1), tried = new Set<Fighter>();
  const seen = (f: Fighter) => f === rat;
  const list = candidates([hid1, hid2, rat], 0, 0, 0, 0, seen);
  assert.deepEqual(list, [rat]);
  let t: Fighter | null = null;
  for (let i = 0; i < 10; i++) { t = nextTarget(list, t, tried); assert.equal(t, rat); }
});

test('Tab goes round every foe seen even when they shuffle between presses', () => {
  // Four foes whose order changes at each press (they move): each gets its turn before any twice.
  const fs = [foe(0, -3), foe(1, -4), foe(-1, -5), foe(0, -6)], tried = new Set<Fighter>(), got = new Set<Fighter>();
  let t: Fighter | null = null;
  for (let i = 0; i < 4; i++) {
    const list = i % 2 ? [...fs].reverse() : fs;
    t = nextTarget(list, t, tried);
    assert.ok(t && !got.has(t), `press ${i + 1} picks one not had yet`);
    got.add(t);
  }
});

test('a click picks the foe drawn nearest it on screen, if near enough', () => {
  const a = foe(0, -3), b = foe(0, -6), at = (f: Fighter) => (f === a ? { x: 100, y: 100 } : { x: 300, y: 100 });
  assert.equal(clicked([a, b], at, 290, 110), b);
  assert.equal(clicked([a, b], at, 200, 400), null);
});

test('a target is let go once it dies or gets far; knives turn to it', () => {
  assert.ok(keeps(foe(0, -10), 0, 0));
  assert.ok(!keeps(foe(0, -(TARGET.keep + 1)), 0, 0));
  assert.ok(!keeps(foe(0, -2, true), 0, 0));
  assert.ok(Math.abs(yawTo(foe(0, -5), 0, 0)) < 1e-9, 'straight ahead is yaw 0');
  assert.ok(Math.abs(yawTo(foe(-5, 0), 0, 0) - Math.PI / 2) < 1e-9, 'to the left is +π/2');
});
