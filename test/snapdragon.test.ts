import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng, angleDiff } from '@futuremagic/core';
import { Level } from '../src/gen/level';
import { SNAP, Snapdragons, awake } from '../src/combat/snapdragon';
import { Thrown } from '../src/combat/thrown';
import { Cooked } from '../src/loot/recipes';
import type { Fighter } from '../src/combat/combat';

const DT = 1 / 60;
const sowing = Cooked.from({ snapdragon: 1 }).snapdragon!;

function dummy(x: number, z: number, radius = 0.3): Fighter & { health: number; cause: string } {
  return { x, y: 0, z, vx: 0, vz: 0, radius, height: 0.6, health: 500, cause: '', get dead() { return this.health <= 0; }, hurt(a: number, c: string) { this.health -= a; this.cause = c; } };
}

test('a snapdragon comes up before it bites, then bites the nearest in reach as the snapdragon', () => {
  const g = new Snapdragons(), rng = new Rng(1), near = dummy(1.2, 0), far = dummy(0, -1.9), out = dummy(4, 0);
  const p = g.sow(0, 0, 0, 0, sowing);
  for (let t = 0; t < SNAP.grow - 0.05; t += DT) assert.deepEqual(g.step(DT, [far, near, out], rng), []);
  assert.equal(near.health, 500, 'nothing bitten while it comes up');
  let bites = 0;
  for (let t = 0; t < 4; t += DT) bites += g.step(DT, [far, near, out], rng).length;
  assert.ok(bites >= 2 && near.cause === 'snapdragon', `it bit the nearest (${bites})`);
  assert.equal(far.health, 500, 'only the nearest');
  assert.equal(out.health, 500, 'nothing out of reach');
  assert.ok(Math.abs(angleDiff(p.yaw, Math.atan2(-near.x, -near.z))) < SNAP.aim, 'its head turned to it');
});

test('it bites the nobody too, and lets go of one who steps well out of reach', () => {
  const g = new Snapdragons(), rng = new Rng(2), nobody = dummy(0, 1.5, 0.35);
  g.sow(0, 0, 0, 0, sowing);
  for (let t = 0; t < SNAP.grow + 2; t += DT) g.step(DT, [nobody], rng);
  assert.ok(nobody.health < 500 && nobody.cause === 'snapdragon');
  nobody.z = sowing.reach + SNAP.keep + 1;
  const left = nobody.health;
  for (let t = 0; t < 3; t += DT) g.step(DT, [nobody], rng);
  assert.equal(nobody.health, left, 'out of reach, safe');
  assert.equal(g.plants[0].target, null);
});

test('between two in reach its head turns one way, never back and forth (no jitter)', () => {
  const g = new Snapdragons(), rng = new Rng(3), a = dummy(1.5, 0), b = dummy(-1.5, 0);
  const p = g.sow(0, 0, 0, Math.PI / 2 + 0.01, sowing);
  let flips = 0, last = 0, prev = p.yaw;
  for (let t = 0; t < 8; t += DT) {
    g.step(DT, [a, b], rng);
    const d = Math.sign(angleDiff(prev, p.yaw));
    if (d !== 0 && last !== 0 && d !== last) flips++;
    if (d !== 0) last = d;
    prev = p.yaw;
  }
  assert.ok(flips <= 1, `it turned back ${flips} times`);
});

test('it wilts when its time is up and is gone', () => {
  const g = new Snapdragons(), rng = new Rng(4), p = g.sow(0, 0, 0, 0, sowing);
  for (let t = 0; t < sowing.lasts + 0.1; t += DT) g.step(DT, [], rng);
  assert.ok(!awake(p), 'wilting');
  for (let t = 0; t < SNAP.wilt; t += DT) g.step(DT, [], rng);
  assert.equal(g.plants.length, 0);
});

test('a tossed seed comes down on the floor and is handed on to come up', () => {
  const level = new Level(1, 1), [x, , z] = level.arrival, y = level.groundAt(x, z);
  const t = new Thrown();
  t.toss(x, y + 1.45, z, 0, 'seed');
  for (let s = 0; s < 240 && !t.sown.length; s++) t.fly(level, [], new Rng(5), DT);
  assert.equal(t.sown.length, 1, 'it came down');
  const s = t.sown[0];
  assert.ok(Math.abs(s.y - level.groundAt(s.x, s.z)) < 1e-6, 'on the floor');
  assert.equal(t.missiles.length, 0, 'no longer in flight');
});
