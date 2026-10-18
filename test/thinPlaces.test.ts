import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { THIN, THIN_LIFE, Pocket, ThinPlaces, glimpseOf, openness, steppedIn, type ThinPlace } from '../src/world/thinPlaces';

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

test('walking into an open thin place steps through; a pocket holds one a while, grows unstable and lets go', () => {
  const level = new Level(1, 3), [x, y, z] = level.arrival, thin = new ThinPlaces(level);
  let p: ThinPlace | null = null;
  for (let t = 0; t < 1500 && !p; t += 0.25) { thin.advance(0.25, x, y + 1.6, z, 0, -1); p = thin.current; }
  assert.ok(p, 'one opened');
  p.age = THIN.open + 1;
  const feet = p.y - THIN.over;
  assert.ok(steppedIn(p, p.x, feet, p.z), 'through its middle');
  assert.ok(!steppedIn(p, p.x + 5, feet, p.z), 'not beside it');
  assert.ok(!steppedIn(p, p.x, feet + 4, p.z), 'not over it');
  assert.ok(!steppedIn({ ...p, age: 0.1 }, p.x, feet, p.z), 'not while it is still opening');

  let held = 0, gifts = 0;
  for (let k = 0; k < 6; k++) {
    const g = glimpseOf(1, 3, k), there = new Level(1, g.depth), pocket: Pocket = new Pocket(3, { ...p, glimpse: g }, there);
    const at = pocket.at;
    assert.ok(there.sdf(at[0], at[1] + 1.7, at[2]) >= 1.8, 'one comes out in open air');
    assert.ok(there.dry(at[0], at[2], 0.2), 'on dry floor');
    if (pocket.gift) {
      gifts++;
      const [gx, gy, gz] = pocket.gift, d = Math.hypot(gx - at[0], gz - at[2]);
      assert.ok(d >= THIN.giftNear - 1e-6 && d <= THIN.gift[1] + 1e-6, `the gift lies a few steps off (${d.toFixed(1)} m)`);
      assert.ok(there.dry(gx, gz, 0.3) && Math.abs(gy - there.groundAt(gx, gz, at[1] + 2)) < 1e-6, 'on dry floor');
    }
    if (!pocket.way) continue;
    held++;
    assert.equal(pocket.way.glimpse.depth, 3, 'the way back shows home');
    const w = pocket.way;
    assert.ok(pocket.walksBack(w.x, w.y - THIN.over, w.z), 'walking into the way back takes you home');
    assert.ok(!pocket.walksBack(...at), 'not where one comes out');
  }
  assert.ok(held >= 3, `the way back has room (${held} of 6)`);
  assert.ok(gifts >= 2, `a gift waits in some (${gifts} of 6)`);
  // Over many: some hunted (and those always hold a gift), most not; gifts in about `giftChance` of the rest.
  let hunted = 0, givers = 0, n = 0;
  for (const d of [2, 5, 9]) for (let k = 0; k < 12; k++) {
    const g = glimpseOf(2, d, k), pk = new Pocket(d, { ...p, glimpse: g }, new Level(2, g.depth));
    n++;
    if (pk.hunted) { hunted++; assert.ok(pk.gift, 'a hunted pocket holds a gift'); }
    if (pk.gift) givers++;
  }
  assert.ok(hunted >= 3 && hunted <= 18, `hunted: ${hunted} of ${n}`);
  assert.ok(givers >= n * 0.45 && givers < n, `gifts: ${givers} of ${n}`);
  const pocket = new Pocket(3, p, new Level(1, p.glimpse.depth));
  let over = false, t = 0, low = 1;
  for (; t < THIN.stay + 1 && !over; t += 0.1) {
    over = pocket.advance(0.1);
    if (pocket.age < THIN.shaky) assert.ok(pocket.instability === 0 && pocket.open === 1, 'steady at first');
    low = Math.min(low, pocket.open);
    assert.ok(pocket.open >= 0 && pocket.open <= 1);
  }
  assert.ok(over && Math.abs(t - THIN.stay) < 0.2, `lets go after ${THIN.stay} s`);
  assert.ok(low < 0.6, 'the way back flickers before it does');
});
