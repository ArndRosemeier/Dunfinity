import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { Fauna } from '../src/creatures/fauna';
import { LEADS, Leads, leadsOf } from '../src/game/leads';

test('every level below the cellar chalks a few places worth walking to, the same each time, story first', () => {
  for (const depth of [1, 2, 5, 9, 10]) {
    const level = new Level(1, depth), a = leadsOf(level, new Fauna(level)), b = leadsOf(level, new Fauna(level));
    assert.ok(a.length >= 2 && a.length <= LEADS.most, `level ${depth}: ${a.length} leads`);
    assert.deepEqual(a, b);
    assert.equal(new Set(a.map((l) => l.id)).size, a.length, 'one of each kind');
    if (level.page && !level.camp) assert.equal(a[0].id, 'page');
    if (level.camp) assert.equal(a[0].id, 'camp');
    if (level.lair) assert.ok(a.some((l) => l.id === 'lair'));
  }
  const cellar = new Level(1, 0);
  assert.deepEqual(leadsOf(cellar, new Fauna(cellar)), []);
});

test('a lead is found once one walks up to it, and only once', () => {
  const level = new Level(1, 1), leads = new Leads(leadsOf(level, new Fauna(level)));
  const l = leads.list[0];
  assert.deepEqual(leads.walk(l.x + 100, l.z), []);
  assert.ok(leads.walk(l.x + 1, l.z).some((x) => x.id === l.id));
  assert.ok(!leads.walk(l.x, l.z).some((x) => x.id === l.id), 'found once');
  assert.ok(!leads.over || leads.list.length === 1);
});
