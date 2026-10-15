import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, CHAPTERS, Cooked } from '../src/loot/recipes';
import { Tin } from '../src/loot/tin';
import { Level } from '../src/gen/level';
import { Campfire, FIRE } from '../src/world/fire';

test('cooking a card costs salt from the tin, rank by rank, and stops at its last rank', () => {
  const tin = new Tin(), c = new Cooked();
  tin.salt = 3;
  assert.equal(c.cantCook('hold-it', tin, 1), null);
  assert.equal(c.cook('hold-it', tin), 1);
  assert.equal(tin.salt, 0);
  assert.match(c.cantCook('hold-it', tin, 1)!, /Not enough salt/);
  tin.salt = 100;
  c.cook('hold-it', tin);
  c.cook('hold-it', tin);
  assert.equal(tin.salt, 100 - 6 - 10);
  assert.match(c.cantCook('hold-it', tin, 1)!, /Nothing more/);
});

test('cards change the numbers: the knife, resting, climbing', () => {
  const tin = new Tin(), c = new Cooked();
  tin.salt = 100;
  assert.deepEqual(c.knife, { damage: 1, time: 1 });
  c.cook('hold-it', tin);
  assert.ok(c.knife.damage > 1 && c.knife.time === 1);
  c.cook('hold-it', tin);
  assert.ok(c.knife.time < 1);
  assert.equal(c.soup, 1);
  c.cook('soup', tin);
  assert.equal(c.soup, 2);
  assert.equal(c.climbing, 1);
  c.cook('kneading', tin);
  assert.ok(c.climbing < 1);
});

test('every card belongs to a chapter of the tin, with a line for each rank after the first and a cost and effect per rank', () => {
  for (const k of CARDS) {
    assert.ok(CHAPTERS.includes(k.chapter), k.title);
    assert.equal(k.ranks.length, k.cost.length - 1, k.title);
    assert.equal(k.does.length, k.cost.length, k.title);
  }
});

test('Chicken Soup: wounds close faster resting by the fire', () => {
  const level = new Level(1, 1), [ax, , az] = level.arrival;
  const rest = (soup: number) => {
    const c = new Campfire(level, 100, 12), r = { x: ax, y: level.groundAt(ax, az), z: az, vx: 0, vz: 0, health: 20, stamina: 12 };
    let yaw = 0;
    while (c.whyNot(r, yaw, false, 0) !== '') yaw += 0.4;
    c.soup = soup;
    c.light(r, yaw, 0);
    for (let t = FIRE.kindle; t < FIRE.kindle + 5; t += 0.1) c.step(r, false, t, 0.1);
    return r.health - 20;
  };
  assert.ok(Math.abs(rest(2) - 2 * rest(1)) < 1, `${rest(2)} vs ${rest(1)}`);
});

test('Way Home is open from the start, and its second rank is the way back', () => {
  const c = new Cooked(), tin = new Tin();
  tin.salt = 40;
  assert.equal(c.wayHome, 0);
  assert.equal(c.cantCook('way-home', tin, 0), null);
  c.cook('way-home', tin);
  assert.equal(c.wayHome, 1);
  c.cook('way-home', tin);
  assert.equal(c.wayHome, 2);
  assert.equal(tin.salt, 40 - 12 - 20);
});

test('Tenderising is open from the start: one blow, then everything in reach', () => {
  const c = new Cooked(), tin = new Tin();
  tin.salt = 20;
  assert.equal(c.tenderising === null, true);
  assert.equal(c.cantCook('tenderising', tin, 0), null);
  c.cook('tenderising', tin);
  assert.deepEqual(c.tenderising, { damage: [14, 20], all: false });
  c.cook('tenderising', tin);
  assert.equal(c.tenderising!.all, true);
});

test('grandma\'s salt-magic opens at level 0: Stove Flame, Cold Larder, Rolling Pin, each stronger at rank 2', () => {
  const c = new Cooked(), tin = new Tin();
  tin.salt = 40;
  assert.equal(c.flame, null); assert.equal(c.larder, null); assert.equal(c.pin, null);
  for (const id of ['stove-flame', 'cold-larder', 'rolling-pin'] as const) assert.equal(c.cantCook(id, tin, 0), null, id);
  for (const id of ['stove-flame', 'cold-larder', 'rolling-pin'] as const) c.cook(id, tin);
  const [f1, l1, p1] = [c.flame!, c.larder!, c.pin!];
  for (const id of ['stove-flame', 'cold-larder', 'rolling-pin'] as const) c.cook(id, tin);
  assert.ok(c.flame!.reach > f1.reach && c.flame!.damage[0] > f1.damage[0] && c.flame!.every < f1.every);
  assert.ok(c.larder!.r > l1.r && c.larder!.slow < l1.slow && c.larder!.lasts > l1.lasts);
  assert.ok(c.pin!.reach > p1.reach && c.pin!.knock > p1.knock);
  assert.equal(tin.salt, 40 - 3 * (4 + 8));
});

test('every way of playing starts at level 0: each chapter with cards has one open from the start', () => {
  for (const ch of CHAPTERS) {
    const cards = CARDS.filter((k) => k.chapter === ch && !k.lost);
    if (cards.length) assert.ok(cards.some((k) => !k.opens), ch);
  }
});
