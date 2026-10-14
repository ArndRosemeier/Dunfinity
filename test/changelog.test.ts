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
