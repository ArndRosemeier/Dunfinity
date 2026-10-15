import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToRgb } from '@futuremagic/core';
import { airOf } from '../src/gen/air';
import { LAWS, lawsOf } from '../src/gen/laws';
import { bandOf } from '../src/gen/bands';
import { strangeness, stratumOf } from '../src/gen/genome';

test('down to level 10 the air is ours, every world alike', () => {
  for (let d = 0; d <= 10; d++) for (const seed of [1, 2, 99]) {
    const a = airOf(seed, d);
    assert.deepEqual(a.fog, hexToRgb(0x050607));
    assert.deepEqual(a.lamp, hexToRgb(0xfff0dc));
    assert.equal(a.clear, 1);
    assert.equal(a.veins, bandOf(d).veins);
    assert.deepEqual(lawsOf(seed, d), []);
  }
});

test('a stratum has its laws on all its levels, as many as its strangeness says, only those it has reached', () => {
  const seen = new Set<string>();
  for (let seed = 1; seed <= 60; seed++) for (const d of [11, 21, 41, 61, 150, 400]) {
    const laws = lawsOf(seed, d), k = strangeness(seed, stratumOf(d)!.from);
    assert.deepEqual(lawsOf(seed, stratumOf(d)!.from + 5), laws, `seed ${seed} level ${d}`);
    assert.equal(new Set(laws).size, laws.length);
    for (const id of laws) assert.ok(LAWS.find((l) => l.id === id)!.from <= k.s, `seed ${seed} level ${d}: ${id} at ${k.s}`);
    assert.equal(laws.length, Math.min(k.laws, Math.ceil(LAWS.filter((l) => l.from <= k.s).length / 2)));
    laws.forEach((id) => seen.add(id));
  }
  assert.equal(seen.size, LAWS.length, 'every law turns up somewhere');
});

test('the laws show in the air: tinted light, thick air, glowing seams; and deep air stays in its ranges', () => {
  for (let seed = 1; seed <= 80; seed++) for (const d of [15, 45, 120, 600]) {
    const a = airOf(seed, d), laws = lawsOf(seed, d);
    for (const c of [a.fog, a.sky, a.ground, a.lamp]) for (const v of c) assert.ok(v >= 0 && v <= 1, `seed ${seed} level ${d}`);
    assert.ok(a.clear >= 0.35 && a.clear <= 1.4);
    if (laws.includes('haze')) assert.equal(a.clear, 0.4);
    if (laws.includes('glow')) assert.equal(a.veins, 1);
    // The headlamp stays a bright light, whatever its tint.
    assert.ok(a.lamp[0] + a.lamp[1] + a.lamp[2] > 1.8, `seed ${seed} level ${d}: lamp ${a.lamp}`);
  }
});
