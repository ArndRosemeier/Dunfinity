import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GEAR, buyGear, hasGear, kitFromGear } from '../src/loot/hardware';
import { Kit } from '../src/loot/items';
import { HOUSES, TOWN, shopDoor } from '../src/gen/town';
import { Level } from '../src/gen/level';
import { Body } from '../src/world/traverse/body';

test("Kemal sells each thing once, for euros from grandma's purse, put on at once, and it helps", () => {
  const k = new Kit();
  assert.deepEqual([k.climb, k.edge, k.armour], [1, 1, 1]);
  const poor = buyGear(k, 'helmet', 10);
  assert.equal(poor.euros, 10);
  assert.match(poor.line, /€45/);
  let r = buyGear(k, 'gloves', 100);
  assert.equal(r.euros, 100 - GEAR.gloves.price);
  assert.equal(k.climb, 0.75);
  assert.equal(k.worn.hands?.kind, 'work-gloves');
  assert.equal(buyGear(k, 'gloves', r.euros).euros, r.euros, 'not twice');
  r = buyGear(k, 'helmet', r.euros);
  assert.equal(k.armour, 0.8);
  r = buyGear(k, 'whetstone', r.euros);
  assert.equal(k.knife.quality, 'fine', 'the whetstone hones her knife');
  assert.equal(k.edge, 1.25);
  assert.ok(hasGear(k, 'whetstone') && hasGear(k, 'helmet'));
  assert.deepEqual(new Kit(k.data).data, k.data, 'kept in the save');
});

test('an older save of what was bought becomes the same kit', () => {
  const k = kitFromGear(['gloves', 'whetstone', 'helmet', 'garden-hose']);
  assert.deepEqual(k.data.map((i) => `${i.kind}:${i.quality}`), ['miners-helmet:sound', 'work-gloves:sound', 'kitchen-knife:fine']);
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
  assert.equal(HOUSES.filter((h) => h.role === 'hardware').length, 1);
  assert.ok(house.cx - house.hv >= TOWN.street.x[1] - 0.01 && Math.abs(house.yaw + Math.PI / 2) < 0.01, "on her side of the street, facing it");
  const z0 = house.cz - house.hu;
  assert.ok(z0 > TOWN.grandma.z[1] && z0 < TOWN.grandma.z[1] + 4, 'next door');
  const level = new Level(1, 0);
  assert.ok(level.sdf(x, TOWN.ground + 1, z) > 0.5, 'on the street before his door');
});

test('Kemal sells a hatchet, a crowbar and a pick, one in the hand at a time', () => {
  const k = new Kit();
  let r = buyGear(k, 'hatchet', 100);
  assert.equal(k.move, 'chop');
  r = buyGear(k, 'crowbar', r.euros);
  assert.equal(r.euros, 100 - GEAR.hatchet.price, 'not with the hatchet in hand');
  assert.match(r.line, /hand is full/);
  r = buyGear(k, 'whetstone', r.euros);
  assert.equal(k.knife.quality, 'fine', 'the knife in the belt can still be honed');
});
