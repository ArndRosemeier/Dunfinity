import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '@futuremagic/core';
import { Level } from '../src/gen/level';
import { PET, PETS, Pets } from '../src/creatures/pets';
import { Rats } from '../src/creatures/rats';
import { Cooked } from '../src/loot/recipes';
import { byYou, type Fighter } from '../src/combat/combat';
import { GRUDGE } from '../src/creatures/creature';

const DT = 1 / 60;
const level = new Level(1, 1);
const [ax, , az] = level.arrival;

function dummy(x: number, z: number, health = 500): Fighter & { health: number; cause: string; facing: number; grudge: Fighter | null } {
  return { x, y: level.groundAt(x, z), z, vx: 0, vz: 0, radius: 0.35, height: 1.7, health, cause: '', facing: 0, grudge: null, get dead() { return this.health <= 0; }, hurt(a: number, c: string) { this.health -= a; this.cause = c; } };
}

/** Somewhere open round the arrival: `n` metres off along +x (or the arrival). */
function along(n: number): number {
  return ax + n;
}

test('by rank, the card pours a salt rat or a salt dog, for pinches of the tin', () => {
  assert.deepEqual(Cooked.from({ 'salt-pet': 1 }).pet, { kind: 'rat', pinches: 2, every: 20 });
  assert.equal(Cooked.from({ 'salt-pet': 2 }).pet!.kind, 'dog');
  assert.equal(Cooked.from({}).pet, null);
});

test('it stands up out of the salt, follows to heel and stands still there (no jitter)', () => {
  const pets = new Pets(level), owner = dummy(ax, az), p = pets.summon('rat', along(1), owner.y, az, 0);
  for (let t = 0; t < PET.form + 0.1; t += DT) pets.accompany(DT, owner, [], null, new Rng(1));
  assert.equal(p.mode, 'heel');
  // The owner walks off 8 m and stops.
  for (let t = 0; t < 2; t += DT) { owner.x += 4 * DT; owner.y = level.groundAt(owner.x, owner.z); pets.accompany(DT, owner, [], null, new Rng(1)); }
  for (let t = 0; t < 4; t += DT) pets.accompany(DT, owner, [], null, new Rng(1));
  const d = Math.hypot(owner.x - p.x, owner.z - p.z);
  assert.ok(d < owner.radius + p.radius + PET.heel + PET.follow + 0.2, `at heel (${d.toFixed(2)} m)`);
  // Standing: it does not move back and forth.
  let moved = 0;
  for (let t = 0; t < 2; t += DT) { const x = p.x, z = p.z; pets.accompany(DT, owner, [], null, new Rng(1)); moved += Math.hypot(p.x - x, p.z - z); }
  assert.ok(moved < 0.05, `still (${moved.toFixed(3)} m)`);
});

test('it goes for what comes at you and bites it; the bitten turns on it', () => {
  const pets = new Pets(level), owner = dummy(ax, az), foe = dummy(along(4), az, 60), p = pets.summon('dog', along(1), owner.y, az, 0);
  p.mode = 'heel';
  let bites = 0;
  for (let t = 0; t < 6; t += DT) bites += pets.accompany(DT, owner, [foe], null, new Rng(2)).length;
  assert.ok(bites >= 2, `bit ${bites} times`);
  assert.equal(foe.cause, 'salt-pet');
  assert.ok(foe.health <= 60 - 2 * PETS.dog.bite[0]);
  assert.equal(foe.grudge, p, 'the bitten turns on it');
});

test('a creature with a grudge goes for the pet, not for you', () => {
  const rats = new Rats(level), nest = rats.nearestDen(ax, az)!;
  const you = dummy(nest.x + 40, nest.z), pet = dummy(nest.x, nest.z + 5);
  rats.advance(DT, dummy(nest.x, nest.z)); // wake the nest
  const r = rats.list[0];
  assert.ok(r, 'a rat');
  r.grudge = pet;
  const start = Math.hypot(pet.x - r.x, pet.z - r.z);
  for (let t = 0; t < 3 && pet.health === 500; t += DT) rats.advance(DT, you);
  assert.ok(Math.hypot(pet.x - r.x, pet.z - r.z) < start || pet.health < 500, 'it went for the pet');
  assert.equal(you.health, 500);
});

test('it mends like you do; it dies and falls back into salt; left far behind, it stands up again at your side', () => {
  const pets = new Pets(level), owner = dummy(ax, az), p = pets.summon('rat', along(1), owner.y, az, 0);
  p.mode = 'heel';
  p.hurt(20, 'rat');
  for (let t = 0; t < PET.healAfter + 5; t += DT) pets.accompany(DT, owner, [], null, new Rng(1));
  assert.ok(p.health > PETS.rat.health - 20, 'mended some');
  owner.x += PET.leash + 5;
  pets.accompany(DT, owner, [], null, new Rng(1));
  assert.equal(p.mode, 'form');
  assert.ok(Math.hypot(owner.x - p.x, owner.z - p.z) < 3, 'at your side');
  p.hurt(999, 'dog');
  assert.equal(pets.alive, null);
  for (let t = 0; t < PET.crumble + 0.1; t += DT) pets.accompany(DT, owner, [], null, new Rng(1));
  assert.equal(pets.list.length, 0, 'gone to salt');
});

test('down (or up) a level it comes along, as hurt as it was, and stands up at your side', () => {
  const pets = new Pets(level), owner = dummy(ax, az), p = pets.summon('dog', along(1), owner.y, az, 0);
  p.mode = 'heel';
  p.hurt(30, 'rat');
  const below = new Level(1, 2), [bx, by, bz] = below.arrival, you = dummy(bx, bz);
  you.y = by;
  pets.moveTo(below);
  pets.accompany(DT, you, [], null, new Rng(1));
  assert.equal(pets.alive, p, 'the same pet');
  assert.equal(p.mode, 'form');
  assert.ok(Math.abs(p.health - (PETS.dog.health - 30)) < 0.01, `kept its health (${p.health})`);
  assert.ok(Math.hypot(you.x - p.x, you.z - p.z) < 3, 'at your side');
});

test('what your pet (or a card) kills counts as yours, for the tally and the salt; what another creature kills does not', () => {
  const rats = new Rats(level), nest = rats.nearestDen(ax, az)!, you = dummy(nest.x + 40, nest.z);
  rats.advance(DT, dummy(nest.x, nest.z)); // wake the nest
  const [a, b] = rats.list;
  assert.ok(a && b, 'two rats');
  a.hurt(999, GRUDGE);
  b.hurt(999, 'dog');
  rats.advance(DT, you);
  assert.equal(rats.killed, 1);
  assert.equal(rats.fallen.length, 1, 'one to give salt for');
  for (const c of ['knife', 'fire', 'force', 'flour', 'match', 'snapdragon', 'horseradish', GRUDGE]) assert.ok(byYou(c), c);
  assert.ok(!byYou('dog') && !byYou('spores'));
});
