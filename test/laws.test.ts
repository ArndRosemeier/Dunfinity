import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lawsOf } from '../src/gen/laws';
import { bandOf } from '../src/gen/bands';
import { Level } from '../src/gen/level';

test('a level\'s band carries its stratum\'s laws: water up the rock everywhere, pillars on older drums', () => {
  let uphill = 0, older = 0;
  for (let seed = 1; seed <= 40 && (!uphill || !older); seed++) for (const d of [2, 7, 12, 33, 47, 75]) {
    const laws = lawsOf(seed, d), band = new Level(seed, d).band;
    assert.equal(band.name, bandOf(d).name);
    if (laws.includes('uphill')) { assert.ok(band.uphill >= 0.5); uphill++; } else assert.equal(band.uphill, bandOf(d).uphill);
    if (laws.includes('older')) { assert.ok(band.older >= 0.45); older++; } else assert.equal(band.older, bandOf(d).older);
  }
  assert.ok(uphill && older, `uphill ${uphill}, older ${older}`);
  assert.equal(new Level(3, 0).band, bandOf(0), 'the cellar: its band, untouched');
});
