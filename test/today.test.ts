import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CharacterCatalog } from '@actors/generator';
import { today } from '../src/render/actors/today';

const catalog = {
  races: [{ id: 'human' }, { id: 'orc' }],
  garments: [{ id: 'jeans' }, { id: 'tshirt' }, { id: 'wizard-robe' }, { id: 'future-wrap' }, { id: 'future-halo' }],
  outfits: [
    { id: 'casual', garments: ['jeans', 'tshirt'] },
    { id: 'future-daily', garments: ['future-wrap', 'jeans'] },
  ],
  hair: [],
} as unknown as CharacterCatalog;

test('people of today wear neither fantasy nor Commonwear 3026 clothes', () => {
  const c = today(catalog);
  assert.deepEqual(c.garments.map((g) => g.id), ['jeans', 'tshirt']);
  assert.deepEqual(c.outfits.map((o) => o.id), ['casual']);
  assert.deepEqual(c.races.map((r) => r.id), ['human']);
});
