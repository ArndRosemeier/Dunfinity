import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '@futuremagic/core';
import { Level } from '../src/gen/level';
import { FLOUR, Flour, type Blindable } from '../src/combat/flour';
import { Thrown } from '../src/combat/thrown';
import { Cooked } from '../src/loot/recipes';
import { damage } from '../src/combat/combat';
import { Body } from '../src/world/traverse/body';

const DT = 1 / 60;
const bag = Cooked.from({ 'flour-bag': 1 }).flour!;
const match = Cooked.from({ matchstick: 1 }).match!;

function dummy(x: number, z: number, radius = 0.3): Blindable & { health: number; cause: string } {
  return { x, y: 0, z, vx: 0, vz: 0, radius, height: 0.6, health: 500, cause: '', get dead() { return this.health <= 0; }, hurt(a: number, c: string) { this.health -= a; this.cause = c; } };
}

test('a cloud blinds what is in it, and it stays blind a while after; the cloud thins away', () => {
  const f = new Flour(), inside = dummy(1, 0), out = dummy(bag.r + 2, 0);
  f.burst(0, 0, 0, bag);
  for (let t = 0; t < FLOUR.spread + 0.1; t += DT) f.step(DT, [inside, out]);
  assert.ok((inside.blind ?? 0) > 0, 'in the cloud: blind');
  assert.equal(out.blind ?? 0, 0, 'out of it: not');
  inside.x = 20;
  for (let t = 0; t < bag.blind - 0.2; t += DT) f.step(DT, [inside]);
  assert.ok((inside.blind ?? 0) > 0, 'still blind just after getting out');
  for (let t = 0; t < 0.4; t += DT) f.step(DT, [inside]);
  assert.equal(inside.blind, 0, 'then it sees again');
  for (let t = 0; t < bag.hangs; t += DT) f.step(DT, []);
  assert.equal(f.clouds.length, 0, 'the cloud is gone');
});

test('a blow struck from inside a cloud, or by someone blind, finds no one', () => {
  const f = new Flour(), body = new Body(10, 0, 0), blind = dummy(15, 0);
  f.burst(0, 0, 0, bag);
  for (let t = 0; t < FLOUR.spread; t += DT) f.step(DT, []);
  body.unseenFrom = (x, z) => f.blinds(x, body.y, z, [blind]);
  const hp = body.health;
  damage(body, 10, 0.5, 0, 3, 'rat');
  assert.equal(body.health, hp, 'from in the cloud: a miss');
  blind.blind = 1;
  damage(body, 10, 15, 0, 3, 'rat');
  assert.equal(body.health, hp, 'from someone blind: a miss');
  damage(body, 10, 12, 3, 3, 'rat');
  assert.ok(body.health < hp, 'from someone who sees: it lands');
});

test('a cloud going up hurts all in it, the thrower too, sets off the clouds it touches, and nothing beyond', () => {
  const f = new Flour(), rng = new Rng(3), a = dummy(0.5, 0), b = dummy(bag.r * 1.8, 0), nobody = dummy(-1, 0.5, 0.35), far = dummy(bag.r * 4, 0);
  const first = f.burst(0, 0, 0, bag);
  f.burst(bag.r * 1.8, 0, 0, bag);
  f.burst(-30, 0, 0, bag);
  for (let t = 0; t < FLOUR.spread; t += DT) f.step(DT, []);
  const up = f.goUp(first, [a, b, nobody, far], match.damage, match.knock, rng);
  assert.equal(up.clouds.length, 2, 'the touching cloud went up with it');
  assert.equal(f.clouds.length, 1, 'the far cloud hangs on');
  assert.deepEqual(new Set(up.hit), new Set([a, b, nobody]));
  for (const d of [a, b, nobody]) assert.ok(d.health <= 500 - match.damage[0] && d.cause === 'flour');
  assert.equal(far.health, 500);
  assert.ok(Math.hypot(a.vx, a.vz) > 1, 'shoved out');
});

test('a bag bursts on the creature it hits; a match flown into a cloud is caught there', () => {
  const level = new Level(1, 1), t = new Thrown(), rat = dummy(0, 0);
  const [x, y, z] = level.arrival;
  rat.x = x; rat.y = level.groundAt(x, z - 6); rat.z = z - 6;
  t.throw(x, y + 1.4, z, 0, [rat], 'flour');
  for (let s = 0; s < 120 && t.burst.length === 0; s++) t.fly(level, [rat], new Rng(1), DT);
  assert.equal(t.burst.length, 1, 'it burst');
  assert.ok(Math.hypot(t.burst[0].x - rat.x, t.burst[0].z - rat.z) < 0.6, 'on the rat');
  assert.equal(t.missiles.length, 0);
  const f = new Flour(), c = f.burst(rat.x, rat.y, rat.z, bag);
  let caught = false;
  t.throw(x, y + 1.4, z, 0, [], 'match', { x: c.x, y: c.y + 1, z: c.z });
  for (let s = 0; s < 120 && !caught; s++) t.fly(level, [], new Rng(1), DT, (m) => (caught = !!f.at(m.x, m.y, m.z)));
  assert.ok(caught, 'the match reached the cloud');
  assert.equal(t.missiles.length, 0, 'and is gone');
});

test('the nearest cloud ahead is the one a match is flicked at', () => {
  const f = new Flour();
  const near = f.burst(0, 0, -5, bag), behind = f.burst(0, 0, 3, bag);
  f.burst(0, 0, -12, bag);
  assert.equal(f.ahead(0, 0, 0, 16, 0.6), near);
  assert.equal(f.ahead(0, 0, Math.PI, 16, 0.6), behind);
  assert.equal(f.ahead(0, 0, Math.PI / 2, 16, 0.3), null);
});
