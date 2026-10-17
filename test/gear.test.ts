import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '@futuremagic/core';
import { Level } from '../src/gen/level';
import { Rats } from '../src/creatures/rats';
import { Finds, Pack } from '../src/loot/finds';
import { FOUND, foundGear } from '../src/loot/found';
import { GIFTS, ITEMS, Kit, findName, giftsOf, isItem, itemName, itemWhat } from '../src/loot/items';
import { Practice } from '../src/loot/practice';
import { resale } from '../src/loot/shop';
import { Campfire } from '../src/world/fire';
import { withBand } from './where';

test('gifts add up over what is worn, scaled by quality; skills only by whole tiers', () => {
  const kit = new Kit([{ kind: 'moleskins', quality: 'fine' }, { kind: 'barbara-medal', quality: 'sound' }, { kind: 'leather-apron', quality: 'master' }]);
  assert.equal(kit.gift('stamina'), 3 * 1.25);
  assert.equal(kit.gift('health'), 12);
  assert.equal(kit.gift('knife'), 4, 'a master apron: 3 × 1.5, in whole levels');
  assert.equal(kit.gift('pace'), 0);
  const p = new Practice();
  assert.equal(p.level('knife', kit.gift('knife')), 4);
  assert.ok(p.more('knife', 1) > p.more('knife'));
});

test('a property is one gift more, and is named and kept', () => {
  const it = { kind: 'hobnail-boots', quality: 'worn', of: 'leap' } as const;
  assert.ok(isItem(it) && !isItem({ kind: 'hobnail-boots', quality: 'sound', of: 'flying' }));
  assert.equal(itemName(it), 'hobnail boots of the hare (worn)');
  assert.deepEqual(giftsOf(it), { pace: 0.07 * 0.8, leap: GIFTS.leap.step * 0.8 });
  assert.match(itemWhat(it), /quicker.*higher/);
  assert.deepEqual(new Kit([it]).data[0], it, 'put on with its property');
  assert.ok(resale(it) > resale({ kind: 'hobnail-boots', quality: 'worn' }));
});

test('found gear: only the believable things, better and stranger deeper, same for the same draw', () => {
  const draw = (depth: number, n = 600) => Array.from({ length: n }, (_, k) => foundGear(new Rng(k + 1), depth));
  assert.deepEqual(foundGear(new Rng(7), 3), foundGear(new Rng(7), 3));
  const near = draw(1), deep = draw(40);
  for (const it of [...near, ...deep]) assert.ok(it.kind in FOUND && isItem(it));
  const share = (xs: { quality: string; of?: string }[], f: (x: { quality: string; of?: string }) => boolean) => xs.filter(f).length / xs.length;
  assert.ok(share(deep, (x) => x.quality === 'master') > share(near, (x) => x.quality === 'master') * 2);
  assert.ok(share(near, (x) => !!x.of) < 0.1 && share(deep, (x) => !!x.of) > 0.2);
  for (const it of deep) if (it.of) assert.ok(!(it.of in (ITEMS[it.kind].gifts ?? {})), 'a property is never the gift it has');
});

test('gear lies on the floor and in sheds, never in a hoard; picked up it goes among the spare items', () => {
  const level = new Level(...withBand('quarry')), rats = new Rats(level), [ax, , az] = level.arrival;
  const all = new Finds(level, (i, j) => rats.denAt(i, j), new Set(), foundGear).near(ax, az, 400);
  const gear = all.filter((f) => f.item);
  assert.ok(gear.length >= 3, `some gear about (${gear.length} of ${all.length})`);
  for (const f of gear) assert.ok(f.kind === 'gear' && (f.id % 8 < 2 || f.id % 8 >= 5), 'floor or shed slots');
  assert.equal(new Finds(level, (i, j) => rats.denAt(i, j), new Set()).near(ax, az, 400).filter((f) => f.item).length, 0, 'none without a gear source');
  const pack = new Pack();
  assert.ok(pack.add(gear[0]));
  assert.deepEqual(pack.spare, [gear[0].item]);
  assert.equal(pack.items.length, 0);
  assert.equal(findName(gear[0]), itemName(gear[0].item!));
});

test('a campfire mends up to what the body can hold now', () => {
  const level = new Level(...withBand('quarry')), [ax, , az] = level.arrival;
  const c = new Campfire(level, 100, 12), r = { x: ax, y: level.groundAt(ax, az), z: az, vx: 0, vz: 0, health: 100, stamina: 12, maxHealth: 124, maxStamina: 15 };
  c.step(r, false, 0, 1);
  if (c.resting) assert.ok(c.mending && r.health > 100);
});
