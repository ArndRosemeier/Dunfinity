import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToRgb } from '@futuremagic/core';
import { airOf } from '../src/gen/air';
import { LAWS, lawsOf } from '../src/gen/laws';
import { bandOf } from '../src/gen/bands';
import { strangeness, stratumOf } from '../src/gen/genome';

test('the air is ours in the town and the cellar; each of levels 1–10 has one law of its own, never one its band already shows', () => {
  for (const seed of [1, 2, 99]) {
    const a = airOf(seed, 0);
    assert.deepEqual(a.fog, hexToRgb(0x050607));
    assert.deepEqual(a.lamp, hexToRgb(0xfff0dc));
    assert.deepEqual(a.flame, hexToRgb(0xffbe80));
    assert.equal(a.clear, 1);
    assert.equal(a.veins, bandOf(1, 0).veins);
    assert.deepEqual(lawsOf(seed, 0), []);
  }
  const seen = new Set<string>();
  for (let seed = 1; seed <= 40; seed++) for (let d = 1; d <= 10; d++) {
    const laws = lawsOf(seed, d), band = bandOf(seed, d);
    assert.equal(laws.length, 1, `seed ${seed} level ${d}`);
    if (laws[0] === 'glow') assert.ok(band.veins < 1, `level ${d} glows anyway`);
    if (laws[0] === 'uphill') assert.ok(band.uphill < 0.5, `level ${d}: its water climbs anyway`);
    seen.add(`${d} ${laws[0]}`);
  }
  for (let d = 1; d <= 10; d++) assert.ok([...seen].filter((k) => k.startsWith(`${d} `)).length >= 2, `level ${d}: worlds differ`);
});

test('a stratum has its laws on all its levels, as many as its strangeness says, only those it has reached', () => {
  const seen = new Set<string>();
  for (let seed = 1; seed <= 60; seed++) for (const d of [11, 21, 41, 61, 150, 400]) {
    const laws = lawsOf(seed, d), k = strangeness(seed, stratumOf(d)!.from);
    assert.deepEqual(lawsOf(seed, stratumOf(d)!.from + 5), laws, `seed ${seed} level ${d}`);
    assert.equal(new Set(laws).size, laws.length);
    for (const id of laws) assert.ok(LAWS.find((l) => l.id === id)!.from <= Math.max(1, k.s), `seed ${seed} level ${d}: ${id} at ${k.s}`);
    assert.ok(laws.length >= 1 && laws.length <= Math.min(k.laws, Math.ceil(LAWS.filter((l) => l.from <= Math.max(1, k.s)).length / 2)));
    laws.forEach((id) => seen.add(id));
  }
  assert.equal(seen.size, LAWS.length, 'every law turns up somewhere');
});

test('the laws show in the air: tinted light, thick air, glowing seams; and deep air stays in its ranges', () => {
  for (let seed = 1; seed <= 80; seed++) for (const d of [15, 45, 120, 600]) {
    const a = airOf(seed, d), laws = lawsOf(seed, d);
    for (const c of [a.fog, a.sky, a.ground, a.lamp, a.flame]) for (const v of c) assert.ok(v >= 0 && v <= 1, `seed ${seed} level ${d}`);
    assert.ok(a.clear >= 0.35 && a.clear <= 1.4);
    if (laws.includes('haze')) assert.equal(a.clear, 0.4);
    if (laws.includes('glow')) assert.equal(a.veins, 1);
    // The headlamp stays a bright light, whatever its tint.
    assert.ok(a.lamp[0] + a.lamp[1] + a.lamp[2] > 1.6, `seed ${seed} level ${d}: lamp ${a.lamp}`);
  }
});
