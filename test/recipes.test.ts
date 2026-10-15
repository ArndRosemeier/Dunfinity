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
    assert.ok(CHAPTERS.some(([ch]) => ch === k.chapter), k.title);
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

test('Way Home opens only at level 8, and its second rank is the way back', () => {
  const c = new Cooked(), tin = new Tin();
  tin.salt = 40;
  assert.equal(c.wayHome, 0);
  assert.match(c.cantCook('way-home', tin, 7)!, /Way Home divider/);
  assert.equal(c.cantCook('way-home', tin, 8), null);
  c.cook('way-home', tin);
  assert.equal(c.wayHome, 1);
  c.cook('way-home', tin);
  assert.equal(c.wayHome, 2);
  assert.equal(tin.salt, 40 - 12 - 20);
});

test('Tenderising opens at level 5: one blow, then everything in reach', () => {
  const c = new Cooked(), tin = new Tin();
  tin.salt = 20;
  assert.equal(c.tenderising === null, true);
  assert.notEqual(c.cantCook('tenderising', tin, 4), null);
  c.cook('tenderising', tin);
  assert.deepEqual(c.tenderising, { damage: [14, 20], all: false });
  c.cook('tenderising', tin);
  assert.equal(c.tenderising!.all, true);
});
