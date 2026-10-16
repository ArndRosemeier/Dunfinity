import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { HURT, runEnd } from '../src/game/runEnd';
import { Tin } from '../src/loot/tin';
import { Pack, type Find } from '../src/loot/finds';
import { Cooked } from '../src/loot/recipes';
import { Practice } from '../src/loot/practice';
import { kitFromGear } from '../src/loot/hardware';
import { Kit } from '../src/loot/items';
import { fallenAt, notaryList } from '../src/gen/notary';

const state = () => ({ tin: new Tin(), saltAtStart: 3, key: { kerf: [], thread: [] }, euros: 0, taken: 0, pack: new Pack(), cooked: new Cooked(), practice: new Practice(), kit: new Kit() });

test('a grandchild who had only just started loses nothing much, and the tin is kept', () => {
  const end = runEnd(state());
  assert.match(end.kept[0], /3 pinches/);
  assert.doesNotMatch(end.kept[0], /more than when they took it up/);
  assert.deepEqual(end.lost, ['Nothing much. They had only just started.']);
});

test('what the family keeps and what goes down with the grandchild', () => {
  const s = state();
  s.tin.killed('rats'); s.tin.reached(4); s.tin.page(3); s.tin.salt += 20;
  const cooked = new Cooked();
  cooked.cook('hold-it', s.tin);
  const practice = new Practice();
  practice.use('climbing', 12);
  const pack = new Pack();
  pack.add({ id: 1, kind: 'coin', x: 0, y: 0, z: 0, yaw: 0, value: 5 } as Find);
  const end = runEnd({ ...s, key: { kerf: ['t', 'h'], thread: ['a'] }, euros: 40, taken: 7, cooked, practice, kit: kitFromGear(['helmet']), pack });
  const kept = end.kept.join('\n'), lost = end.lost.join('\n');
  assert.match(kept, /more than when they took it up/);
  assert.match(kept, /level 4/);
  assert.match(kept, /1 page put back/);
  assert.match(kept, /3 letters pencilled in/);
  assert.match(kept, /€40/);
  assert.match(kept, /7 finds/);
  assert.match(lost, /cooked: /);
  assert.match(lost, /Climbing 1/);
  assert.match(lost, /miner's helmet/);
  assert.match(lost, /1 find, about €/);
});

test('every way a creature can kill you has its death line', () => {
  const causes = new Set<string>();
  for (const f of readdirSync('src/creatures')) {
    const src = readFileSync(`src/creatures/${f}`, 'utf8');
    for (const m of src.matchAll(/(?:damage|pickSwing)\([^;]*?'([a-z-]+)'(?:, dt)?\)/g)) causes.add(m[1]);
  }
  assert.ok(causes.size >= 10, [...causes].join());
  for (const c of causes) assert.ok(HURT[c], `no death line for '${c}'`);
});

test('the notary writes where and of what, the same on his list as on the death screen', () => {
  const f = { heir: 1, depth: 3, what: 'a rat bites' };
  assert.equal(fallenAt(f), 'level 3, a rat bites');
  assert.equal(fallenAt({ ...f, depth: 0 }), 'in the cellar, a rat bites');
  assert.ok(notaryList([f], 2, 1)[0].endsWith(`(${fallenAt(f)})`));
});
