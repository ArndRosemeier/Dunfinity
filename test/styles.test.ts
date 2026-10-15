import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hash3f } from '@futuremagic/core';
import { Level } from '../src/gen/level';

/** A fingerprint of a level's field: the distance and the ground at 4000 seeded points over 1.2 km. */
function fingerprint(depth: number): string {
  const l = new Level(7, depth);
  let h = 0;
  for (let k = 0; k < 4000; k++) {
    const x = (hash3f(1, k, depth, 0) - 0.5) * 1200, z = (hash3f(1, k, depth, 1) - 0.5) * 1200;
    const g = l.groundAt(x, z), y = g + (hash3f(1, k, depth, 2) - 0.2) * 12;
    h = (Math.imul(h, 31) + Math.round(l.sdf(x, y, z) * 1000) + Math.round(g * 1000)) | 0;
  }
  return (h >>> 0).toString(16);
}

test('one style per level: the field is what it was before styles (v0.072)', () => {
  const was: Record<number, string> = { 0: '6026bf78', 1: '70210ab0', 2: '6c831faa', 3: '14ff75f3', 5: '144e7e44', 7: 'e3aa9b28', 9: '1eb2b425', 10: '772510f1' };
  for (const [d, h] of Object.entries(was)) assert.equal(fingerprint(+d), h, `level ${d}`);
});

test('each level says which style it is', () => {
  assert.deepEqual(new Level(7, 0).field.styles.map((s) => s.id), ['cellar']);
  assert.deepEqual(new Level(7, 4).field.styles.map((s) => s.id), ['excavation']);
});
