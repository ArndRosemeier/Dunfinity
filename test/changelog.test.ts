import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { noteHtml, parseChangelog } from '../src/app/changelog';

test('the changelog has one release per version, newest first, counting up by 0.001', () => {
  const rs = parseChangelog(readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8'));
  assert.ok(rs.length >= 10);
  rs.forEach((r, i) => {
    assert.ok(r.title && r.notes.length > 0, r.version);
    assert.equal(r.version, `v0.${String(rs.length - i).padStart(3, '0')}`);
  });
});

test('notes are escaped, with code and bold', () => {
  assert.equal(noteHtml('a <b> `x` **y**'), 'a &lt;b&gt; <code>x</code> <b>y</b>');
});

test('change notes waiting in changes/ are well formed, and fold on top as the next versions', async () => {
  // @ts-expect-error (a plain .mjs tool, no types)
  const { fold, notesIn, parseNote } = await import('../tools/changelog.mjs');
  const notes = notesIn(new URL('../changes', import.meta.url).pathname);
  const md = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  const before = parseChangelog(md), after = parseChangelog(fold(md, notes));
  assert.equal(after.length, before.length + notes.length);
  after.forEach((r, i) => assert.equal(r.version, `v0.${String(after.length - i).padStart(3, '0')}`));
  const two = parseChangelog(fold('# Changelog\n\n## v0.002 — B\n\n- b\n', [parseNote('x', '# X\n\n- x'), parseNote('y', '# Y\n\n- y')]));
  assert.deepEqual(two.map((r) => `${r.version} ${r.title}`), ['v0.004 Y', 'v0.003 X', 'v0.002 B']);
  assert.throws(() => parseNote('bad', '## v0.010 — Z\n\n- z'));
});
