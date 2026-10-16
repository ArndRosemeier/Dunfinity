import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRANGE_CAP, STRATA, genome, strangeness, stratumOf } from '../src/gen/genome';
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

test('strangeness: none in the town, rising with depth for ever, one lean per stratum, laws only below level 10', () => {
  assert.deepEqual(strangeness(1, 0), { trend: 0, swing: 1, s: 0, amplitude: 0, laws: 0 });
  for (let d = 1; d <= 10; d++) {
    const k = strangeness(5, d);
    assert.equal(k.swing, 1, `level ${d}`);
    assert.equal(k.laws, 0, `level ${d}: its oddities are placed by hand`);
  }
  for (let d = 1; d < 2000; d = Math.ceil(d * 1.3)) assert.ok(strangeness(1, d + 1).trend > strangeness(1, d).trend, `level ${d}`);
  assert.ok(Math.abs(strangeness(1, 8).trend - 1) < 1e-9);
  const swings = new Set<number>();
  for (let seed = 1; seed <= 30; seed++) for (const s of [...STRATA, stratumOf(61)!, stratumOf(300)!]) {
    const a = strangeness(seed, s.from), b = strangeness(seed, s.from + 7);
    assert.equal(a.swing, b.swing, `seed ${seed} ${s.name}: one lean for the stratum`);
    assert.ok(a.swing >= 0.6 && a.swing <= 1.4);
    assert.ok(a.amplitude <= STRANGE_CAP && a.amplitude <= a.s);
    assert.equal(a.laws, 1 + Math.floor(a.s));
    swings.add(a.swing);
  }
  assert.ok(swings.size > 100, 'strata lean their own ways');
  assert.equal(strangeness(1, 500).amplitude, STRANGE_CAP, 'deviations stop growing');
  assert.ok(strangeness(1, 2000).laws > strangeness(1, 61).laws || strangeness(2, 2000).laws > strangeness(2, 61).laws, 'laws keep coming');
});
