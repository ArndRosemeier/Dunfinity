import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { VILLAGE, townGround } from '../src/gen/town';
import { Rats, TOWN_RAT, type Nest } from '../src/creatures/rats';
import { Dogs, TOWN_DOG, type Pack } from '../src/creatures/dogs';
import { damage, type Fighter } from '../src/combat/combat';
import { Tin } from '../src/loot/tin';

const town = new Level(1, 0);
const V = VILLAGE.spec;

type Prey = Fighter & { taken: number };
const someone = (x: number, z: number): Prey => ({
  x, y: townGround(x, z).y, z, vx: 0, vz: 0, radius: 0.35, height: 1.75, taken: 0,
  get dead() { return false; }, hurt(a: number) { this.taken += a; },
});

/** The dens of a population over the village, nearest its square first. */
function densOf<D extends { x: number; z: number }>(p: { denAt(i: number, j: number): D | null }, cell: number): D[] {
  const out: D[] = [], n = Math.ceil(V.r / cell) + 1, ci = Math.floor(V.x / cell), cj = Math.floor(V.z / cell);
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) { const d = p.denAt(ci + i, cj + j); if (d) out.push(d); }
  return out.sort((a, b) => Math.hypot(a.x - V.x, a.z - V.z) - Math.hypot(b.x - V.x, b.z - V.z));
}

/** Someone `away` metres from den `d`, on open town ground. */
function by(d: { x: number; z: number }, away: number): Prey {
  for (let a = 0; a < 16; a++) {
    const x = d.x + Math.cos(a) * away, z = d.z + Math.sin(a) * away, y = townGround(x, z).y;
    if (town.sdf(x, y + 1, z) > 0.6) return someone(x, z);
  }
  throw new Error('no room by the den');
}

function step(p: Rats | Dogs, me: Prey, seconds: number, each?: () => void): void {
  for (let t = 0; t < seconds; t += 1 / 30) { if (p instanceof Dogs) p.advance(1 / 30, me, 0); else p.advance(1 / 30, me); me.vx = me.vz = 0; each?.(); }
}

test('the town has ordinary rats and dogs; the deep has none of them, and the town none of the feral ones', () => {
  assert.ok(densOf<Nest>(new Rats(town, true), TOWN_RAT.cell).length >= 6, 'rat holes in the village');
  assert.ok(densOf<Pack>(new Dogs(town, true), TOWN_DOG.cell).length >= 3, 'village dogs');
  const deep = new Level(1, 3);
  assert.equal(densOf<Nest>(new Rats(deep, true), TOWN_RAT.cell).length, 0);
  assert.equal(densOf<Pack>(new Dogs(deep, true), TOWN_DOG.cell).length, 0);
  assert.equal(densOf<Nest>(new Rats(town), TOWN_RAT.cell).length, 0, 'no quarry rats in the town');
});

test('a village dog lets you be until you hit it, then its lot bites, then calms down', () => {
  const dogs = new Dogs(town, true), pack = densOf<Pack>(dogs, TOWN_DOG.cell)[0], me = by(pack, 3);
  step(dogs, me, 20);
  assert.ok(dogs.list.length > 0, 'they woke');
  assert.equal(me.taken, 0, 'no bites unprovoked');
  assert.ok(!pack.hunting);
  const g = dogs.list.find((d) => d.pack === pack)!;
  damage(g, 2, me.x, me.z, 0, 'knife');
  let angry = 0;
  step(dogs, me, 10, () => { if (pack.hunting) angry++; });
  assert.ok(angry > 0, 'its lot turns on you');
  assert.ok(me.taken > 0, 'and bites');
  step(dogs, me, TOWN_DOG.calm + 5);
  assert.ok(!pack.hunting, 'calmed down');
  const bitten = me.taken;
  step(dogs, me, 10);
  assert.equal(me.taken, bitten, 'and lets you be again');
});

test('a badly hurt village dog runs from you', () => {
  const dogs = new Dogs(town, true), pack = densOf<Pack>(dogs, TOWN_DOG.cell)[0], me = by(pack, 3);
  step(dogs, me, 2);
  const g = dogs.list.find((d) => d.pack === pack)!;
  damage(g, g.health * 0.75, me.x, me.z, 0, 'knife');
  const d0 = Math.hypot(g.x - me.x, g.z - me.z);
  let fled = false;
  step(dogs, me, 3, () => { fled ||= g.mode === 'flee'; });
  assert.ok(fled, 'it flees');
  assert.ok(Math.hypot(g.x - me.x, g.z - me.z) > d0 + 2, 'away from you');
});

test('a town rat pays you no mind, scurries off when you come close, and bolts from a blow; it never bites', () => {
  const rats = new Rats(town, true), nest = densOf<Nest>(rats, TOWN_RAT.cell)[0], me = by(nest, 7);
  step(rats, me, 10);
  assert.ok(rats.list.length > 0);
  const r = rats.list.find((x) => x.nest === nest)!;
  damage(r, 1, me.x, me.z, 0, 'knife');
  const close = by(r, 1.2);
  let fled = false;
  step(rats, close, 2, () => { fled ||= r.mode === 'flee'; });
  assert.ok(fled, 'it bolts');
  assert.ok(Math.hypot(r.x - close.x, r.z - close.z) > 3, 'away from you');
  step(rats, close, 20);
  assert.equal(me.taken + close.taken, 0, 'no bites');
});

test('the town animals drop no salt', () => {
  const tin = new Tin(), start = tin.salt;
  for (let k = 0; k < 25; k++) { assert.equal(tin.killed('town-rats'), null); assert.equal(tin.killed('town-dogs'), null); }
  assert.equal(tin.salt, start);
});
