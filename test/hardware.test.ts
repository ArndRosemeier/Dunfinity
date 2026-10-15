import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GEAR, GEAR_EFFECT, Gear } from '../src/loot/hardware';
import { HOUSES, TOWN, shopDoor } from '../src/gen/town';
import { Level } from '../src/gen/level';
import { Body } from '../src/world/traverse/body';

test("Kemal sells each thing once, for euros from grandma's purse, and it helps", () => {
  const g = new Gear();
  assert.deepEqual([g.climb, g.edge, g.armour], [1, 1, 1]);
  const poor = g.buy('helmet', 10);
  assert.equal(poor.euros, 10);
  assert.match(poor.line, /€45/);
  let r = g.buy('gloves', 100);
  assert.equal(r.euros, 100 - GEAR.gloves.price);
  assert.equal(g.climb, GEAR_EFFECT.climb);
  assert.equal(g.buy('gloves', r.euros).euros, r.euros, 'not twice');
  r = g.buy('helmet', r.euros);
  assert.equal(g.armour, GEAR_EFFECT.armour);
  assert.deepEqual(new Gear(g.data).data.sort(), ['gloves', 'helmet'], 'kept in the save');
});

test('a helmet takes a share off a blow, not off a fall', () => {
  const b = new Body(0, 0, 0);
  b.armour = 0.8;
  b.hurt(10, 'rat');
  assert.equal(b.health, 100 - 8);
  b.hurt(10, 'fall');
  assert.equal(b.health, 100 - 18);
});

test("his store is next door to grandma's, up the street, and one can stand at its door", () => {
  const { house, x, z } = shopDoor('hardware');
  assert.equal(HOUSES.filter((h) => h.shop === 'hardware').length, 1);
  assert.ok(house.x0 >= TOWN.street.x[1] && house.faces === -1, "on her side of the street, facing it");
  assert.ok(house.z0 > TOWN.grandma.z[1] && house.z0 < TOWN.grandma.z[1] + 4, 'next door');
  const level = new Level(1, 0);
  assert.ok(level.sdf(x, TOWN.ground + 1, z) > 0.5, 'on the street before his door');
});
