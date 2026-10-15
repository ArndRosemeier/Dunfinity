import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kinOf, OURS } from '../src/creatures/kin';

const SPECIES = ['feral_dog', 'quarry_rat', 'cave_cricket', 'lumen_slime', 'murk_slime', 'brine_eel'];
const changed = (k: object) => Object.entries(k).filter(([n, v]) => n !== 'stripes' && n !== 'grain' && Math.abs(v - (OURS as unknown as Record<string, number>)[n]) > 0.15).map(([n]) => n);

test('above level 11 every creature is ours; so is a species without kin', () => {
  for (const d of [0, 1, 5, 10]) for (const s of SPECIES) assert.deepEqual(kinOf(1, d, s), OURS);
  assert.deepEqual(kinOf(1, 40, 'toadstool'), OURS);
});

test('one stratum\'s kin are all the same kind of wrong; the next stratum\'s are another', () => {
  for (const s of SPECIES) {
    assert.deepEqual(kinOf(3, 41, s), kinOf(3, 48, s), `${s}: same on every level of a stratum`);
    assert.deepEqual(kinOf(3, 41, s), kinOf(3, 41, s), 'and drawn from the seed');
  }
  const looks = new Set([11, 21, 41, 61, 71, 81, 91].map((d) => JSON.stringify(kinOf(3, d, 'feral_dog'))));
  assert.equal(looks.size, 7, 'each stratum its own');
});

test('the deeper the stratum, the further its kin stray', () => {
  let shallow = 0, deep = 0;
  for (let seed = 1; seed <= 40; seed++) {
    shallow += changed(kinOf(seed, 11, 'feral_dog')).length;
    deep += changed(kinOf(seed, 400, 'feral_dog')).length;
  }
  assert.ok(deep > shallow && deep > 40, `deeper strata stray more (${shallow} vs ${deep})`);
});

test('kin keep a body that can still walk its clips', () => {
  for (let seed = 1; seed <= 60; seed++) for (const s of SPECIES) for (const d of [11, 61, 500]) {
    const k = kinOf(seed, d, s);
    assert.ok(k.long >= 0.75 && k.long <= 1.45 && k.tall >= 0.75 && k.tall <= 1.35, `${s} ${seed} ${d}: proportions ${k.long} ${k.tall}`);
    assert.ok(k.sat >= 0 && k.val > 0.3 && k.pattern >= 0 && k.pattern <= 1, `${s}: coat`);
    if (s === 'brine_eel') assert.ok(k.long === 1 && k.tall === 1, 'the eel keeps its chain');
  }
});
