import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRANGE_CAP, genome, strangeness, stratumOf } from '../src/gen/genome';
import { bandOf, mixOf } from '../src/gen/bands';
import { Level } from '../src/gen/level';

const ids = (m: readonly (readonly [string, number])[]) => m.map(([id]) => id);

test('every ten levels from level 1 are a stratum, named for what it is most made of', () => {
  assert.equal(stratumOf(0), null);
  assert.equal(stratumOf(1), stratumOf(10));
  assert.notEqual(stratumOf(10), stratumOf(11));
  assert.equal(stratumOf(61), stratumOf(70));
  assert.notEqual(stratumOf(70), stratumOf(71));
  assert.equal(bandOf(3, 15), bandOf(3, 19), 'one band per stratum');
  const names = new Set(Array.from({ length: 40 }, (_, i) => bandOf(i + 1, 15).name));
  assert.ok(names.size >= 5, `worlds name level 15 alike: ${[...names]}`);
});

test('nothing is kept for the deep: every style can turn up on the first levels, and depth only shifts the odds', () => {
  const count = (from: number, style: string) => Array.from({ length: 400 }, (_, i) => ids(genome(i + 1, stratumOf(from)!))).filter((m) => m.includes(style)).length;
  for (const [id] of stratumOf(1)!.palette) assert.ok(count(1, id) > 0, `${id} never on levels 1–10`);
  for (const id of ['lava', 'geode', 'organic']) assert.ok(count(61, id) > 2 * count(1, id), `${id}: ${count(1, id)} near the top, ${count(61, id)} deep`);
  assert.ok(count(1, 'collapse') > count(61, 'collapse'), 'fallen workings are commoner near the top');
});

test('a stratum is the same make-up on all its levels, and another world draws another', () => {
  for (const s of [1, 11, 21, 41, 61, 95].map((d) => stratumOf(d)!)) {
    // (Level 1 keeps only the workings and the strongest style: see below.)
    const one = ids(mixOf(3, s.from + 1)), differs = [1, 2, 4, 5, 6, 7].some((seed) => ids(genome(seed, s)).join() !== one.join());
    for (let d = s.from + 1; d < s.from + 6; d++) assert.deepEqual(ids(mixOf(3, d)), one, `level ${d}`);
    assert.ok(differs, `from ${s.from}: every world alike`);
  }
});

test('level 1 is easy to read, near the town: the workings round the ladder and one other style, the stratum\'s strongest', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const m = mixOf(seed, 1), g = genome(seed, stratumOf(1)!).slice(1);
    assert.equal(m.length, 2, `seed ${seed}: ${ids(m)}`);
    assert.equal(m[0][0], 'excavation');
    assert.equal(m[1][0], g.reduce((a, b) => (b[1] > a[1] ? b : a))[0]);
    assert.ok(m[0][1] > m[1][1] * 1.4, `seed ${seed}: the workings lead`);
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

test('strangeness: none in the town, rising with depth for ever, one lean per stratum, a little strange from level 1, one law on each of levels 1–10', () => {
  assert.deepEqual(strangeness(1, 0), { trend: 0, swing: 1, s: 0, amplitude: 0, laws: 0 });
  for (let d = 1; d <= 10; d++) {
    const k = strangeness(5, d);
    assert.equal(k.swing, 1, `level ${d}`);
    assert.equal(k.laws, 1, `level ${d}: one law of its own`);
  }
  for (let d = 1; d < 2000; d = Math.ceil(d * 1.3)) assert.ok(strangeness(1, d + 1).trend > strangeness(1, d).trend, `level ${d}`);
  assert.ok(Math.abs(strangeness(1, 4).trend - 1) < 1e-9);
  assert.ok(strangeness(1, 1).s > 0.6, 'level 1 is already a little off');
  const swings = new Set<number>();
  for (let seed = 1; seed <= 30; seed++) for (const s of [11, 21, 41, 61, 300].map((d) => stratumOf(d)!)) {
    const a = strangeness(seed, s.from), b = strangeness(seed, s.from + 7);
    assert.equal(a.swing, b.swing, `seed ${seed} from ${s.from}: one lean for the stratum`);
    assert.ok(a.swing >= 0.6 && a.swing <= 1.4);
    assert.ok(a.amplitude <= STRANGE_CAP && a.amplitude <= a.s);
    assert.equal(a.laws, 1 + Math.floor(a.s));
    swings.add(a.swing);
  }
  assert.ok(swings.size > 100, 'strata lean their own ways');
  assert.equal(strangeness(1, 500).amplitude, STRANGE_CAP, 'deviations stop growing');
  assert.ok(strangeness(1, 2000).laws > strangeness(1, 61).laws || strangeness(2, 2000).laws > strangeness(2, 61).laws, 'laws keep coming');
});
