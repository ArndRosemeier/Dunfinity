import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { THIN, THIN_LIFE, ThinPlaces, glimpseOf, openness } from '../src/world/thinPlaces';

test('a thin place opens now and then ahead of the viewer, in open air with nothing between, and closes again', () => {
  const level = new Level(1, 3), [x, y, z] = level.arrival, thin = new ThinPlaces(level);
  let opened = 0, open = 0;
  for (let t = 0; t < 1500; t += 0.25) {
    thin.advance(0.25, x, y + 1.6, z, 0, -1);
    for (const p of thin.opened.splice(0)) {
      opened++;
      const d = Math.hypot(p.x - x, p.z - z);
      assert.ok(d >= THIN.ahead[0] - 0.1 && d <= THIN.ahead[1] + 0.1, `ahead (${d.toFixed(1)} m)`);
      assert.ok(level.sdf(p.x, p.y, p.z) >= THIN.half[1], 'in open air');
      assert.ok(p.glimpse.depth > level.depth, 'a world below');
    }
    if (thin.current) open += 0.25;
  }
  assert.ok(opened >= 3 && opened <= 25, `${opened} in 25 minutes`);
  assert.ok(Math.abs(open - opened * THIN_LIFE) < opened, 'each stays open its life');
  const cellar = new ThinPlaces(new Level(1, 0));
  for (let t = 0; t < 600; t += 1) cellar.advance(1, 0, 1.6, 0, 0, -1);
  assert.equal(cellar.current, null, 'none at home');
});

test('opening and closing are smooth, and the glimpsed worlds differ', () => {
  let last = 0;
  for (let a = 0; a <= THIN_LIFE; a += 0.02) {
    const o = openness(a);
    assert.ok(o >= 0 && o <= 1 && Math.abs(o - last) < 0.03, `smooth at ${a.toFixed(2)}`);
    last = o;
  }
  assert.equal(openness(THIN_LIFE), 0);
  const a = glimpseOf(1, 3, 0), b = glimpseOf(1, 3, 1);
  assert.notDeepEqual(a, b);
  assert.deepEqual(a, glimpseOf(1, 3, 0));
});
