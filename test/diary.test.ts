import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAGES, pageOn, theBook } from '../src/lore/diary';
import { Level } from '../src/gen/level';
import { CAMP } from '../src/gen/grandmasCamp';
import { Tin, SALT } from '../src/loot/tin';

test('her torn-out pages lie one to a level, deeper as the dates go on, none in the cellar or at her camp; the kept pages come after', () => {
  const torn = PAGES.filter((p) => p.depth !== null), kept = PAGES.filter((p) => p.depth === null);
  assert.ok(torn.length >= 12 && kept.length >= 4);
  for (let i = 1; i < torn.length; i++) assert.ok(torn[i].depth! > torn[i - 1].depth!, torn[i].date);
  assert.ok(!torn.some((p) => p.depth === 0 || p.depth === CAMP.depth));
  assert.equal(PAGES.findIndex((p) => p.depth === null), torn.length, 'a kept page among the torn-out ones');
  assert.equal(pageOn(40)?.date, '2 September 1966');
  assert.equal(pageOn(4), null);
});

test('each page lies on its level, on dry floor away from the arrival, and is what the level offers to read', () => {
  for (const seed of [1, 2]) for (const p of PAGES.filter((q) => q.depth !== null && q.depth <= 11)) {
    const l = new Level(seed, p.depth!), s = l.page, w = l.writing;
    assert.ok(s, `no spot for the page on level ${p.depth} (seed ${seed})`);
    assert.equal(s.page, p);
    assert.ok(l.dry(s.x, s.z, 0.3));
    assert.ok(Math.hypot(s.x - l.arrival[0], s.z - l.arrival[2]) >= 50);
    assert.equal(w?.kind, 'page');
  }
  assert.equal(new Level(1, 9).writing?.kind, 'note');
  assert.equal(new Level(1, 4).page, null);
});

test('a page read goes back in the book, gives salt once, and stays with the tin', () => {
  const tin = new Tin(), before = tin.salt;
  assert.equal(tin.hasPage(3), false);
  assert.equal(tin.page(3)?.amount, SALT.page);
  assert.equal(tin.page(3), null);
  assert.equal(tin.salt, before + SALT.page);
  const again = Tin.from(tin.data);
  assert.ok(again.hasPage(3) && !again.hasPage(5));
  const book = theBook((d) => again.hasPage(d));
  assert.equal(book.length, PAGES.length);
  assert.equal(book.find((b) => b.page.depth === 3)?.text, pageOn(3)!.text);
  assert.equal(book.find((b) => b.page.depth === 5)?.text, null);
  assert.ok(book.filter((b) => b.page.depth === null).every((b) => b.text));
});
