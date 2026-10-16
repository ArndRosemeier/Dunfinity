import { test } from 'node:test';
import assert from 'node:assert/strict';
import { express, gene, pushChance } from '../src/gen/genes';
import { STRATA } from '../src/gen/genome';

const dome = gene('test.dome', 14, [8, 24], [4, 60]);

test('a gene is its standard in the town, inside its safe range through level 10, and never outside its strange range', () => {
  assert.equal(express(dome, 1, 0), 14);
  for (let seed = 1; seed <= 50; seed++) {
    for (let d = 1; d <= 10; d++) {
      const v = express(dome, seed, d);
      assert.ok(v >= 8 && v <= 24, `seed ${seed} level ${d}: ${v}`);
    }
    for (const d of [11, 30, 61, 200, 900]) {
      const v = express(dome, seed, d);
      assert.ok(v >= 4 && v <= 60, `seed ${seed} level ${d}: ${v}`);
    }
  }
  assert.throws(() => gene('bad', 30, [8, 24], [4, 60]));
});

test('a stratum expresses a gene the same on all its levels, other worlds otherwise, and the deep pushes some genes out of the safe range', () => {
  for (const s of STRATA) assert.equal(express(dome, 7, s.from), express(dome, 7, s.from + 6), s.name);
  const deep = Array.from({ length: 200 }, (_, i) => express(dome, i + 1, 300));
  assert.ok(new Set(deep).size > 150, 'worlds differ');
  const out = deep.filter((v) => v < 8 || v > 24).length;
  assert.ok(out > 40 && out < 160, `${out} of 200 worlds push it`);
  assert.equal(pushChance(0.5), 0);
});
