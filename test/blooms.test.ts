import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { BLOOM, BLOOM_CYCLE, bloomLook, crackles, type BloomSite } from '../src/gen/blooms';

function bloomsOf(seed: number, depth: number): BloomSite[] {
  const l = new Level(seed, depth), [x, , z] = l.arrival;
  return l.blooms.near(x, z, 150);
}

test('salt blooms below the cellar, many where the rock is salt, the same for a seed', () => {
  const salt = bloomsOf(1, 3);
  assert.ok(salt.length >= 6, `the Salt Works: ${salt.length}`);
  assert.deepEqual(salt, bloomsOf(1, 3));
  assert.equal(new Level(1, 0).blooms.near(0, 0, 200).length, 0, 'none in grandma\'s cellar or the town');
});

test('a bloom lies on flat dry floor with room over it', () => {
  const l = new Level(1, 3);
  for (const b of l.blooms.near(l.arrival[0], l.arrival[2], 150)) {
    assert.ok(l.dry(b.x, b.z, 0.05), 'out of the water');
    for (let a = 0; a < 8; a++) assert.ok(Math.abs(l.groundAt(b.x + Math.cos(a) * b.r, b.z + Math.sin(a) * b.r) - b.y) < 0.15, 'flat under it');
    assert.ok(l.sdf(b.x, b.y + 0.8, b.z) > 0.6, 'room over it');
  }
});

test('the cycle: it spreads, stands, crumbles to nothing, rests, and blooms again', () => {
  const s = bloomsOf(1, 3)[0], at = (t: number) => ({ ...bloomLook(s, t - s.offset) });
  assert.equal(at(0).grown, 0);
  assert.ok(Math.abs(at(BLOOM.grow).grown - 1) < 1e-9 && at(BLOOM.grow).crumbled === 0);
  assert.ok(at(BLOOM.grow + BLOOM.stand + BLOOM.crumble / 2).crumbled > 0.2);
  assert.equal(at(BLOOM.grow + BLOOM.stand + BLOOM.crumble + 1).grown, 0, 'gone while it rests');
  let last = at(0);
  for (let t = 0.1; t < BLOOM.grow; t += 0.1) { const now = at(t); assert.ok(now.grown >= last.grown && now.grown - last.grown < 0.02, `smooth at ${t.toFixed(1)}`); last = now; }
});

test('it crackles while it spreads and once, lower, as it crumbles', () => {
  const s = bloomsOf(1, 3)[0];
  let crack = 0, crumble = 0;
  for (let t = 0; t < BLOOM_CYCLE; t += 1 / 30) {
    const n = crackles(s, t - s.offset, t + 1 / 30 - s.offset);
    if (n < 0) crumble++; else crack += n;
  }
  assert.equal(crumble, 1);
  assert.ok(Math.abs(crack - BLOOM.grow / BLOOM.crackle) <= 2, `${crack} crackles`);
});
