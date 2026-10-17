import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PACK, Pack, type Find } from '../src/loot/finds';
import { Kit, freshKit, packRows, rummage, withRucksack, type PackRow } from '../src/loot/items';
import { GEAR, GEAR_ORDER, ILSE_ORDER, buyGear, kitFromGear } from '../src/loot/hardware';

const coin = (id: number): Find => ({ id, kind: 'coin', x: 0, y: 0, z: 0, yaw: 0, value: 2 });
const back: PackRow = { what: 'slot', slot: 'back' };
const fill = (p: Pack, n: number) => { for (let i = 0; i < n; i++) assert.ok(p.add(coin(i))); };

test('a new grandchild has a plain rucksack on the back; the pack holds what it holds', () => {
  const kit = freshKit(), p = new Pack(() => kit.room);
  assert.equal(kit.worn.back?.kind, 'rucksack');
  assert.equal(kit.room, PACK.room);
  fill(p, PACK.room);
  assert.ok(p.full && !p.add(coin(99)));
  assert.equal(packRows(p).filter((r) => r.what === 'slot').length, 9, 'the back is a slot of the kit');
});

test('a bigger rucksack holds more, a worn one less, and the salt-woven satchel far more', () => {
  const kit = freshKit();
  kit.put({ kind: 'army-rucksack', quality: 'sound' });
  assert.equal(kit.room, 14);
  kit.put({ kind: 'army-rucksack', quality: 'worn' });
  assert.equal(kit.room, 11);
  kit.put({ kind: 'salt-satchel', quality: 'sound' });
  assert.equal(kit.room, 40);
});

test("taking the rucksack off leaves only the pockets; one won't swap to a bag too small for what is carried", () => {
  const kit = freshKit(), p = new Pack(() => kit.room);
  fill(p, 5);
  assert.match(rummage(back, p, kit).line, /pockets/);
  assert.equal(kit.worn.back?.kind, 'rucksack', 'kept on');
  // A bigger one packed, then put on: the old one goes in its place in the pack.
  kit.put({ kind: 'army-rucksack', quality: 'sound' });
  fill(p, 7);
  assert.equal(p.count, 12);
  assert.ok(p.stow({ kind: 'rucksack', quality: 'sound' }));
  const swap = rummage({ what: 'spare', i: 0 }, p, kit);
  assert.match(swap.line, /more than a canvas rucksack holds/);
  assert.equal(kit.worn.back?.kind, 'army-rucksack');
  // Emptied down to the pockets' worth, it comes off.
  while (p.items.length > 1) p.takeOut(0);
  p.spare.length = 0;
  rummage(back, p, kit);
  assert.equal(kit.worn.back, undefined);
  assert.equal(kit.room, PACK.pockets);
  assert.equal(p.spare[0].kind, 'army-rucksack');
});

test('saves from before rucksacks get the plain one, unless one is worn or packed', () => {
  assert.equal(withRucksack(new Kit(), new Pack()).room, PACK.room);
  assert.equal(withRucksack(kitFromGear(['gloves']), new Pack()).worn.back?.kind, 'rucksack');
  const p = new Pack();
  p.stow({ kind: 'army-rucksack', quality: 'sound' });
  assert.equal(withRucksack(new Kit(), p).worn.back, undefined);
});

test('Kemal sells the army rucksack (key 8); Ilse the satchel the stranger brought her', () => {
  assert.equal(GEAR_ORDER.indexOf('rucksack'), 7);
  assert.deepEqual(ILSE_ORDER, ['satchel']);
  const kit = freshKit();
  let r = buyGear(kit, 'rucksack', 100);
  assert.equal(r.euros, 100 - GEAR.rucksack.price);
  assert.equal(kit.room, 14);
  r = buyGear(kit, 'satchel', 20);
  assert.match(r.line, /^Ilse shakes her head/);
  r = buyGear(kit, 'satchel', 500);
  assert.equal(kit.room, 40);
  assert.match(r.line, /Ilse/);
});
