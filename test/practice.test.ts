import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Practice, SKILLS, skillOf, usesFor, type Skill } from '../src/loot/practice';
import { CARDS, Cooked } from '../src/loot/recipes';

test('each level takes step × n more uses: open-ended, progressively harder, never exponentially', () => {
  const p = new Practice(), step = SKILLS.knife.step;
  const ups: number[] = [];
  for (let k = 1; k <= usesFor('knife', 10); k++) { const l = p.use('knife'); if (l) ups.push(k); }
  assert.deepEqual(ups, Array.from({ length: 10 }, (_, i) => (step * (i + 1) * (i + 2)) / 2));
  assert.equal(p.level('knife'), 10);
  assert.equal(p.level('throwing'), 0);
  assert.equal(p.progress('knife'), 0);
  p.use('knife', step * 11 / 2);
  assert.ok(Math.abs(p.progress('knife') - 0.5) < 1e-9);
  // Far out it keeps going, each level a little dearer than the last.
  const q = Practice.from({ climbing: 1e6 });
  assert.ok(q.level('climbing') > 400);
  assert.ok(usesFor('climbing', 401) - usesFor('climbing', 400) > usesFor('climbing', 400) - usesFor('climbing', 399));
});

test('a level grows what grows by a fixed step, and shrinks a cost by a share, never to nothing', () => {
  const p = Practice.from({ guard: usesFor('guard', 5) });
  assert.ok(Math.abs(p.more('guard') - (1 + 5 * SKILLS.guard.per)) < 1e-9);
  assert.ok(Math.abs(p.less('guard') - 1 / (1 + 5 * SKILLS.guard.per)) < 1e-9);
  assert.ok(p.more('guard', 3) > p.more('guard'), 'levels worn count on top');
  assert.ok(Practice.from({ guard: 1e9 }).less('guard') > 0);
});

test('climbing counts metres, a few at a time', () => {
  const p = new Practice();
  assert.equal(p.use('climbing', 12), 1);
  assert.equal(p.use('climbing', 0.5), 0);
  assert.ok(p.less('climbing') < 1);
});

test('every card has its skill, and practice moves its numbers the right way', () => {
  for (const c of CARDS) assert.ok(skillOf(c.id), `${c.id} has no skill`);
  const all = Object.fromEntries(CARDS.map((c) => [c.id, c.cost.length]));
  const plain = Cooked.from(all), keen = Cooked.from(all);
  const p = Practice.from(Object.fromEntries((Object.keys(SKILLS) as Skill[]).map((s) => [s, usesFor(s, 10)])));
  keen.trained = (id) => p.trained(id);
  assert.ok(keen.flame!.damage[0] > plain.flame!.damage[0] && keen.flame!.every < plain.flame!.every);
  assert.equal(keen.flame!.reach, plain.flame!.reach, 'reach stays the card\'s');
  assert.ok(keen.knife.damage > plain.knife.damage);
  assert.ok(keen.duck!.stamina < plain.duck!.stamina);
  assert.ok(keen.larder!.lasts > plain.larder!.lasts && keen.larder!.slow < plain.larder!.slow);
  assert.ok(keen.horseradish!.every < plain.horseradish!.every);
  assert.ok(keen.snapdragon!.lasts > plain.snapdragon!.lasts);
  assert.ok(keen.saltLine!.keeps > plain.saltLine!.keeps && keen.saltLine!.r === plain.saltLine!.r);
  assert.ok(keen.candleBurns > 1 && plain.candleBurns === 1);
  assert.ok(keen.climbing < plain.climbing);
});
