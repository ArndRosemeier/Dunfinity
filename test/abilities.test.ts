import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ABILITIES, barOf, passivesOf } from '../src/game/abilities';
import { CARDS, Cooked } from '../src/loot/recipes';

test('the bar shows the cooked cards used by a key, in its order; the rest are passives', () => {
  const none = new Cooked();
  assert.deepEqual(barOf(none), []);
  assert.deepEqual(passivesOf(none), []);
  const all = Cooked.from(Object.fromEntries(CARDS.map((c) => [c.id, 1])));
  assert.deepEqual(barOf(all).map((a) => a.card), ABILITIES.map((a) => a.card));
  assert.deepEqual(passivesOf(all), ['hold-it', 'soup', 'kneading']);
  const some = Cooked.from({ duck: 1, candle: 2, soup: 1 });
  assert.deepEqual(barOf(some).map((a) => a.card), ['duck', 'candle']);
});

test('every ability is a card, once, with a key of its own', () => {
  assert.equal(new Set(ABILITIES.map((a) => a.card)).size, ABILITIES.length);
  assert.equal(new Set(ABILITIES.map((a) => a.key)).size, ABILITIES.length);
  for (const a of ABILITIES) assert.ok(CARDS.some((c) => c.id === a.card), a.card);
});
