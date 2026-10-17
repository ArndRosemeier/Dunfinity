import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEEP_FOLK, deepFolk } from '../src/creatures/folk';
import { Level } from '../src/gen/level';
import { SCAVENGER, Scavenger, Scavengers, lookOf } from '../src/creatures/scavengers';
import { GOBLIN_FOLK } from '../src/creatures/goblins';
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

test('the scavenger camps are goblins on every level, wearing the view\'s goblins', () => {
  assert.deepEqual([0, 1, 2].map((k) => lookOf(5, k)), [2, 0, 1]);
  for (const depth of [6, 14, 45]) {
    const l = new Level(1, depth), s = new Scavengers(l), [ax, , az] = l.arrival;
    let camps = 0;
    for (let j = -8; j <= 8; j++) for (let i = -8; i <= 8; i++) if (s.denAt(Math.floor(ax / SCAVENGER.cell) + i, Math.floor(az / SCAVENGER.cell) + j)) camps++;
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

test('no other people below the town: the camps are goblins, goblin-sized', () => {
  const l = new Level(1, 6), s = new Scavengers(l), [ax, , az] = l.arrival;
  let seen = 0;
  for (let j = -8; j <= 8 && !seen; j++) for (let i = -8; i <= 8 && !seen; i++) {
    const c = s.denAt(Math.floor(ax / SCAVENGER.cell) + i, Math.floor(az / SCAVENGER.cell) + j);
    if (!c) continue;
    const g = new Scavenger(0, c, 0, lookOf(c.key, 0));
    assert.equal(g.height, GOBLIN_FOLK.height);
    seen++;
  }
  assert.ok(seen, 'a camp on level 6');
});
