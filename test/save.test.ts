import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Tin } from '../src/loot/tin';
import { Cooked } from '../src/loot/recipes';
import { Practice } from '../src/loot/practice';
import { readSave } from '../src/persist/save';

test('the tin, the cards and the practice come back as they were kept (through JSON)', () => {
  const tin = new Tin();
  tin.killed('rats');
  tin.reached(3);
  const back = Tin.from(JSON.parse(JSON.stringify(tin.data)));
  assert.equal(back.salt, tin.salt);
  assert.equal(back.deepest, 3);
  assert.equal(back.reached(3), null, 'level 3 was reached before');
  assert.notEqual(back.killed('rats')?.why, 'The first rat you have killed.');
  const c = new Cooked();
  tin.salt = 50;
  c.cook('duck', tin);
  c.cook('duck', tin);
  const cb = Cooked.from(JSON.parse(JSON.stringify(c.data)));
  assert.equal(cb.rank('duck'), 2);
  assert.equal(Cooked.from({ 'no-such-card': 3 }).data['duck' as const], undefined);
  const p = new Practice();
  p.use('climbing', 33);
  assert.equal(Practice.from(JSON.parse(JSON.stringify(p.data))).tier('climbing'), 2);
});

test('no storage, no save (and no throw)', () => {
  assert.equal(readSave(1), null);
});
