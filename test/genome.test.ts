import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRATA, genome, stratumOf } from '../src/gen/genome';
import { bandOf, mixOf } from '../src/gen/bands';
import { Level } from '../src/gen/level';

const ids = (m: readonly (readonly [string, number])[]) => m.map(([id]) => id);

test('below level 10 each run of levels is a stratum, named, and from 61 on one every ten levels', () => {
  assert.equal(stratumOf(10), null);
  assert.equal(stratumOf(11)!.name, 'The Ossuaries');
  assert.equal(stratumOf(20), stratumOf(11));
  assert.equal(stratumOf(21)!.name, 'The Old Halls');
  assert.equal(stratumOf(41)!.name, 'Before People');
  assert.equal(stratumOf(61), stratumOf(70));
  assert.notEqual(stratumOf(70), stratumOf(71));
  assert.equal(bandOf(15).name, 'The Ossuaries');
  assert.equal(bandOf(15), bandOf(19), 'one band per stratum');
});

test('a stratum is the same make-up on all its levels, and another world draws another', () => {
  for (const s of [...STRATA, stratumOf(61)!, stratumOf(95)!]) {
    const one = ids(mixOf(3, s.from)), differs = [1, 2, 4, 5, 6, 7].some((seed) => ids(genome(seed, s)).join() !== one.join());
    for (let d = s.from; d < s.from + 5; d++) assert.deepEqual(ids(mixOf(3, d)), one, `level ${d}`);
    assert.ok(differs, `${s.name} from ${s.from}: every world alike`);
  }
});

test('every stratum level is a mix: the workings where one arrives, three or more styles besides, dungeon rooms never the main thing', () => {
  for (let seed = 1; seed <= 40; seed++) for (const d of [11, 23, 47, 66, 120]) {
    const m = mixOf(seed, d), all = m.reduce((a, [, w]) => a + w, 0);
    assert.equal(m[0][0], 'excavation');
    assert.ok(m.length >= 4, `seed ${seed} level ${d}: ${ids(m)}`);
    for (const [id, w] of m) if (id === 'dungeon') assert.ok(w / all < 0.3, `seed ${seed} level ${d}: dungeon ${(w / all).toFixed(2)}`);
  }
});

test('deep levels have their way up where one arrives and a way down within reach', () => {
  for (const [seed, depth] of [[1, 11], [2, 25], [3, 45], [4, 61], [5, 88]]) {
    const l = new Level(seed, depth), [x, , z] = l.arrival;
    assert.ok(l.ascent?.up, `seed ${seed} level ${depth}: a way up`);
    assert.ok(l.descents.nearest(x, z, 1200), `seed ${seed} level ${depth}: a way down`);
  }
});
