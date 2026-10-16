import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PACK, Pack, type Find } from '../src/loot/finds';
import { Kit, isItem, packRows, rowUse, rummage, type PackRow } from '../src/loot/items';

const coin = (id: number): Find => ({ id, kind: 'coin', x: 0, y: 0, z: 0, yaw: 0, value: 2 });
const slot = (s: 'head' | 'main'): PackRow => ({ what: 'slot', slot: s });

test('a grandchild starts with grandma\'s knife in the hand and nothing else', () => {
  const k = new Kit();
  assert.deepEqual(k.data, [{ kind: 'kitchen-knife', quality: 'sound' }]);
  assert.equal(k.edge, 1);
  assert.equal(k.armour, 1);
});

test('the open pack lists the slots, then the finds, then the spare items', () => {
  const p = new Pack();
  p.add(coin(1));
  p.stow({ kind: 'work-gloves', quality: 'worn' });
  const rows = packRows(p);
  assert.equal(rows.length, 8 + 2);
  assert.deepEqual(rows.slice(8), [{ what: 'find', i: 0 }, { what: 'spare', i: 0 }]);
});

test('taking off, putting on, swapping, and the knife stays', () => {
  const p = new Pack(), k = new Kit([{ kind: 'kitchen-knife', quality: 'sound' }, { kind: 'miners-helmet', quality: 'sound' }]);
  assert.equal(rowUse(slot('main'), k), '', 'nothing to do with the knife');
  assert.match(rummage(slot('main'), p, k).line, /stays/);
  assert.equal(rowUse(slot('head'), k), 'take it off');
  rummage(slot('head'), p, k);
  assert.ok(!k.worn.head);
  assert.equal(p.spare.length, 1);
  assert.equal(k.armour, 1);
  p.stow({ kind: 'miners-helmet', quality: 'master' });
  rummage({ what: 'spare', i: 1 }, p, k);
  assert.equal(k.data[0].quality, 'master');
  rummage({ what: 'spare', i: 0 }, p, k);
  assert.equal(k.data[0].quality, 'sound', 'swapped back');
  assert.equal(p.spare[0].quality, 'master', 'and the other one packed');
  assert.ok(Math.abs(k.armour - 0.8) < 1e-9);
});

test('a full pack shares its room between finds and spare items', () => {
  const p = new Pack(), k = new Kit([{ kind: 'kitchen-knife', quality: 'sound' }, { kind: 'work-gloves', quality: 'sound' }]);
  for (let i = 0; i < PACK.room; i++) p.add(coin(i));
  assert.ok(!p.stow({ kind: 'miners-helmet', quality: 'sound' }));
  assert.match(rummage({ what: 'slot', slot: 'hands' }, p, k).line, /No room/);
  assert.equal(k.worn.hands?.kind, 'work-gloves');
  const r = rummage({ what: 'find', i: 0 }, p, k);
  assert.equal(r.left?.id, 0);
  assert.match(r.line, /Pfennig/);
  assert.ok(!p.full);
});

test('a save with things this build does not know keeps only what it knows', () => {
  assert.ok(!isItem({ kind: 'garden-hose', quality: 'sound' }));
  assert.ok(!isItem({ kind: 'work-gloves', quality: 'legendary' }));
  assert.deepEqual(new Kit([{ kind: 'garden-hose', quality: 'sound' } as never]).data, []);
});
