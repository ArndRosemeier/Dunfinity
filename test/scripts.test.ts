import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KERF, THREAD, kerf, kerfSpell, parsePath, thread, threadSpell } from '../src/lore/scripts';

test('Kerf runes: straight cuts only, never a level one, inside the box', () => {
  for (const [letter, segs] of Object.entries(KERF)) {
    for (const [x1, y1, x2, y2] of segs) {
      assert.notEqual(y1, y2, `${letter}: a level cut`);
      for (const v of [x1, x2]) assert.ok(v >= 0 && v <= 1, letter);
      for (const v of [y1, y2]) assert.ok(v >= 0 && v <= 2, letter);
    }
  }
});

test('every glyph of each script is drawn differently (readable means tellable apart)', () => {
  const kerfShapes = Object.values(KERF).map((s) => JSON.stringify([...s].map((g) => g.join()).sort()));
  assert.equal(new Set(kerfShapes).size, kerfShapes.length);
  const threadShapes = Object.values(THREAD).map((h) => JSON.stringify(h));
  assert.equal(new Set(threadShapes).size, threadShapes.length);
});

test('the dwarves spell by ear: no C, Q or X, TH is one rune', () => {
  assert.deepEqual(kerfSpell('The quick axe, cat & cider'), [['th', 'e'], ['k', 'w', 'i', 'k'], ['a', 'k', 's', 'e'], ['k', 'a', 't'], ['s', 'i', 'd', 'e', 'r']]);
});

test('the elves hang vowels on the consonant before them, else on a carrier; CH is said SH', () => {
  assert.deepEqual(threadSpell('keep church'), [
    [{ c: 'k', v: ['e'] }, { c: null, v: ['e'] }, { c: 'p', v: [] }],
    [{ c: 'sh', v: ['u'] }, { c: 'r', v: [] }, { c: 'sh', v: [] }],
  ]);
});

test('a line lays out left to right, one glyph per rune or syllable, and is pure', () => {
  const k = kerf('forty fathoms to the fire');
  assert.equal(k.glyphs.length, 'fortyfathomstothefire'.length - 2); // th twice
  for (let i = 1; i < k.glyphs.length; i++) assert.ok(k.glyphs[i].x > k.glyphs[i - 1].x);
  assert.deepEqual(kerf('forty fathoms to the fire'), k);
  const t = thread('they are only going home');
  assert.ok(t.width > 0 && t.strokes.length > 5);
  for (const s of t.strokes) for (const [, y] of s) assert.ok(y > -1.05 && y < 0.5);
});

test('the path language: lines and cubics', () => {
  const [a, b] = parsePath('M0 0 L1 0 M0 1 C0 2 1 2 1 1');
  assert.deepEqual(a, [[0, 0], [1, 0]]);
  assert.deepEqual(b[b.length - 1], [1, 1]);
});
