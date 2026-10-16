import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pack, type Find } from '../src/loot/finds';
import { sell } from '../src/loot/pawn';
import { HOUSES, TOWN, shopDoor } from '../src/gen/town';
import { Level } from '../src/gen/level';

const find = (id: number, value: number): Find => ({ id, kind: 'coin', x: 0, y: 0, z: 0, yaw: 0, value });

test('Ilse buys the whole pack for what it is worth, and says so', () => {
  const pack = new Pack();
  pack.add(find(1, 3)); pack.add(find(2, 40));
  const r = sell(pack, 0);
  assert.equal(r.paid, 43);
  assert.equal(pack.items.length, 0);
  assert.match(r.line, /€43/);
  assert.equal(sell(pack, 1).paid, 0, 'nothing left to sell');
});

test("her shop is across the street from grandma's, and one can stand at its door", () => {
  const { house, x, z } = shopDoor('pawn');
  assert.equal(HOUSES.filter((h) => h.role === 'pawn').length, 1);
  assert.ok(house.cx + house.hv <= TOWN.street.x[0] + 0.01 && Math.abs(house.yaw - Math.PI / 2) < 0.01, 'across the street, facing it');
  assert.ok(z > 0 && z < 25, `up the street: ${z.toFixed(1)}`);
  const level = new Level(1, 0);
  assert.ok(level.sdf(x, TOWN.ground + 1, z) > 0.5 && Math.abs(level.groundAt(x, z) - TOWN.ground) < 0.1, 'on the street before her door');
});
