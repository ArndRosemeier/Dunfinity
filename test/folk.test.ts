import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEEP_FOLK, deepFolk, folkAt } from '../src/creatures/folk';
import { Level } from '../src/gen/level';
import { SCAVENGER, Scavengers, lookOf } from '../src/creatures/scavengers';
import { Stranger, STRANGER } from '../src/world/stranger';
import { shopDoor } from '../src/gen/town';

test('each game has two peoples of the deep, never dwarves, elves, goblins or giantkin', () => {
  const seen = new Set<string>();
  for (let seed = 1; seed < 60; seed++) {
    const [a, b] = deepFolk(seed);
    assert.notEqual(a, b);
    for (const r of [a, b]) { assert.ok(DEEP_FOLK.includes(r)); seen.add(r); }
    assert.ok(!['dwarf', 'elf', 'goblin', 'giantkin', 'human'].includes(a));
  }
  assert.equal(seen.size, DEEP_FOLK.length, 'every people turns up in some game');
});

test('our people down to level 10, one of the two per stratum below, the same all through it', () => {
  for (const d of [0, 4, 10]) assert.equal(folkAt(3, d), -1);
  const picks = new Set<number>();
  for (const from of [11, 21, 41, 61, 71, 81, 91]) {
    const f = folkAt(3, from);
    assert.ok(f === 0 || f === 1);
    for (let d = from; d < from + 9; d++) assert.equal(folkAt(3, d), f, `level ${d}`);
    picks.add(f);
  }
  assert.equal(picks.size, 2, 'both peoples turn up');
});

test('scavenger camps below level 10 wear the bodies of their people', () => {
  assert.deepEqual([0, 1, 2].map((k) => lookOf(-1, 5, k)), [2, 0, 1]);
  assert.deepEqual([0, 1, 2].map((k) => lookOf(1, 5, k)), [7, 8, 9]);
  for (const depth of [6, 14]) {
    const l = new Level(1, depth), s = new Scavengers(l), [ax, , az] = l.arrival;
    let camps = 0;
    for (let j = -8; j <= 8; j++) for (let i = -8; i <= 8; i++) {
      const c = s.denAt(Math.floor(ax / SCAVENGER.cell) + i, Math.floor(az / SCAVENGER.cell) + j);
      if (c) { camps++; assert.equal(c.folk, folkAt(1, depth)); }
    }
    assert.ok(camps > 0, `camps on level ${depth}`);
  }
});

test('the stranger stands by Ilse\'s door once the family has been below level 10', () => {
  assert.equal(Stranger.here({ deepest: 10, fallen: 0 }), false);
  assert.equal(Stranger.here({ deepest: STRANGER.from, fallen: 2 }), true);
  const s = new Stranger(), d = shopDoor('pawn');
  assert.ok(Math.hypot(s.x - d.x, s.z - d.z) < 3);
  const a = s.talk(1), b = s.talk(2);
  assert.notEqual(a, b);
  assert.ok(s.talking(3) && !s.talking(2 + STRANGER.talk + 0.1));
});
