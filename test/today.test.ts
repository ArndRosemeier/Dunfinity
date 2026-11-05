import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowCatalog, type CharacterCatalog } from '@actors/generator';
import { GRANDCHILD, today, uncredited } from '../src/render/actors/today';

const catalog = {
  races: [{ id: 'human' }, { id: 'orc', themes: ['fantasy'] }],
  garments: [
    { id: 'jeans', themes: ['modern'] },
    { id: 'tshirt', themes: ['modern'] },
    { id: 'socks' },
    { id: 'fedora', themes: ['vintage'] },
    { id: 'wizard-robe', themes: ['fantasy'] },
    { id: 'med-tunic', themes: ['fantasy', 'medieval'] },
    { id: 'future-wrap', themes: ['future'] },
    { id: 'santa-hat', themes: ['modern', 'real-faith'] },
    { id: 'army-helmet', themes: ['modern'] },
    { id: 'credited-coat', themes: ['modern'], credit: 'someone' },
  ],
  outfits: [
    { id: 'casual', garments: ['jeans', 'tshirt'] },
    { id: 'future-daily', garments: ['future-wrap', 'jeans'] },
    { id: 'peasant', garments: ['med-tunic'] },
  ],
  hair: [],
} as unknown as CharacterCatalog;

test('people of today wear modern and vintage clothes: no fantasy, medieval, Commonwear 3026, religious or credited garments', () => {
  const c = today(catalog);
  assert.deepEqual(c.garments.map((g) => g.id), ['jeans', 'tshirt', 'socks', 'fedora']);
  assert.deepEqual(c.outfits.map((o) => o.id), ['casual']);
  assert.deepEqual(c.races.map((r) => r.id), ['human']);
});

test('the grandchild may be only human, in any uncredited clothes: medieval and 3026 too', () => {
  const c = uncredited(allowCatalog(catalog, GRANDCHILD));
  assert.deepEqual(c.races.map((r) => r.id), ['human']);
  assert.deepEqual(c.garments.map((g) => g.id), catalog.garments.filter((g) => !(g as { credit?: string }).credit).map((g) => g.id));
  assert.deepEqual(c.outfits.map((o) => o.id), ['casual', 'future-daily', 'peasant']);
});
