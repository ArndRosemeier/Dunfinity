import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ABILITIES, BAR, MOVES, MainBar, SLOT_KEYS, barOf, passivesOf } from '../src/game/abilities';
import { CARDS, Cooked } from '../src/loot/recipes';

test('the main bar fills its free slots in the order cards are cooked, and holds eight', () => {
  const bar = new MainBar();
  assert.deepEqual(barOf(bar), new Array(BAR).fill(null));
  assert.equal(bar.place('candle'), 0);
  assert.equal(bar.place('duck'), 1);
  assert.equal(bar.place('candle'), 0, 'already on it');
  assert.equal(bar.place('soup'), -1, 'a passive takes no slot');
  assert.equal(bar.place('spring'), -1, 'nor a card that makes a move better');
  for (const a of ABILITIES.slice(2)) bar.place(a.card);
  assert.equal(bar.slots.filter(Boolean).length, BAR, 'eight and no more');
  assert.equal(new Set(bar.slots).size, BAR);
});

test('a card set in a slot leaves the slot it was in; the one it replaces goes back in the tin', () => {
  const bar = new MainBar();
  bar.place('candle'); bar.place('duck'); bar.place('stove-flame');
  assert.ok(bar.set(0, 'stove-flame'));
  assert.deepEqual(bar.slots.slice(0, 3), ['stove-flame', 'duck', null]);
  assert.equal(bar.slotOf('candle'), -1);
  assert.ok(!bar.set(1, 'kneading'), 'a passive cannot go on the bar');
});

test('a kept bar comes back, without cards no longer cooked; an older save fills it from what was cooked', () => {
  const cooked = Cooked.from({ duck: 1, candle: 2, soup: 1, 'stove-flame': 1 });
  const bar = MainBar.from([null, 'candle', 'nonsense', 'tenderising', 'duck', 'candle'], cooked);
  assert.deepEqual(bar.slots, [null, 'candle', null, null, 'duck', null, null, null]);
  assert.deepEqual(MainBar.from(JSON.parse(JSON.stringify(bar.data)), cooked).slots, bar.slots);
  assert.deepEqual(MainBar.from(undefined, cooked).slots.filter(Boolean), ['duck', 'stove-flame', 'candle']);
});

test('the cards that take no slot are the passives and the moves; every card is one or the other', () => {
  const all = Cooked.from(Object.fromEntries(CARDS.map((c) => [c.id, 1])));
  assert.deepEqual(passivesOf(all), ['hold-it', 'spring', 'soup', 'kneading', 'tiptoe']);
  for (const m of MOVES) assert.ok(!ABILITIES.some((a) => a.card === m));
  assert.equal(new Set(ABILITIES.map((a) => a.card)).size, ABILITIES.length);
  assert.equal(new Set(ABILITIES.map((a) => a.key)).size, ABILITIES.length);
  for (const a of ABILITIES) assert.ok(CARDS.some((c) => c.id === a.card), a.card);
  for (const a of ABILITIES) assert.ok(!/^(Key|Digit|Mouse)|^Space$/.test(a.key), `${a.card} has no key of its own`);
  assert.equal(SLOT_KEYS.length, BAR);
});
