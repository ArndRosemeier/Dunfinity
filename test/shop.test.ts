import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pack, type Find } from '../src/loot/finds';
import { GEAR, GEAR_ORDER } from '../src/loot/hardware';
import { Kit } from '../src/loot/items';
import { resale, rowPrice, sellFinds, shopRows, townMerchant, trade } from '../src/loot/shop';

const find = (id: number, value: number): Find => ({ id, kind: 'coin', x: 0, y: 0, z: 0, yaw: 0, value });

test("Kemal's counter: his goods to buy, and he buys nothing", () => {
  const m = townMerchant('hardware', false), pack = new Pack(), kit = new Kit();
  pack.add(find(1, 30));
  const rows = shopRows(m, pack);
  assert.deepEqual(rows.map((r) => r.what === 'buy' && r.kind), [...GEAR_ORDER]);
  assert.equal(typeof m.buys, 'string');
  const gloves = rows[0];
  assert.deepEqual(rowPrice(gloves, kit, pack, 10), { price: GEAR.gloves.price, can: false, yours: false }, 'too dear');
  const r = trade(m, gloves, kit, pack, 100, 0);
  assert.ok(r.done && r.euros === 100 - GEAR.gloves.price && kit.has('work-gloves'));
  assert.equal(rowPrice(gloves, kit, pack, r.euros).yours, true);
  assert.equal(trade(m, gloves, kit, pack, r.euros, 0).done, false, 'not twice');
  assert.equal(sellFinds(m, pack, 5, 0).done, false, 'he will not take the find');
  assert.equal(pack.items.length, 1);
});

test("Ilse's counter: her goods, then the finds and spare items she would buy, one at a time or all the finds", () => {
  const m = townMerchant('pawn', true), pack = new Pack(), kit = new Kit();
  pack.add(find(1, 12)); pack.add(find(2, 30));
  pack.stow({ kind: 'hatchet', quality: 'sound' });
  const rows = shopRows(m, pack);
  assert.deepEqual(rows.map((r) => r.what), ['buy', 'buy', 'buy', 'find', 'find', 'spare']);
  assert.equal(resale({ kind: 'hatchet', quality: 'sound' }), Math.floor(GEAR.hatchet.price / 2));
  let r = trade(m, rows[3], kit, pack, 0, 0);
  assert.ok(r.done && r.euros === 12 && /€12/.test(r.line));
  assert.deepEqual(pack.items.map((f) => f.id), [2], 'that one find gone');
  r = trade(m, shopRows(m, pack).at(-1)!, kit, pack, r.euros, 1);
  assert.equal(r.euros, 12 + resale({ kind: 'hatchet', quality: 'sound' }));
  assert.equal(pack.spare.length, 0, 'the hatchet sold');
  r = sellFinds(m, pack, r.euros, 2);
  assert.ok(r.done && pack.items.length === 0);
  assert.equal(shopRows(townMerchant('pawn', false), pack).length, 1, 'only the feather before the stranger is in town');
});
