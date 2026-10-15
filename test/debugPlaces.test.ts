import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { Fauna } from '../src/creatures/fauna';
import { Body, type BodyInput } from '../src/world/traverse/body';
import { placesOn } from '../src/game/debugPlaces';

const STEP = 1 / 120;
const still: BodyInput = { forward: 0, right: 0, yaw: 0, sprint: false, jump: false };

/** Every place on `depth` of seed 1: one is put down there (as the debug menu does) and stands, or swims, where it was put. */
function check(depth: number, want: string[]): void {
  const level = new Level(1, depth), fauna = new Fauna(level), [ax, , az] = level.arrival;
  const places = placesOn(level, fauna, ax, az), names = places.map((p) => p.name).join(' | ');
  for (const w of want) assert.ok(names.includes(w), `level ${depth}: "${w}" in ${names}`);
  for (const p of places) {
    const b = new Body(p.x, p.y + 0.2, p.z);
    for (let i = 0; i < 1.5 / STEP; i++) b.step(level, still, STEP);
    assert.ok(b.mode === 'swim' || b.grounded, `level ${depth}, ${p.name}: stands (${b.mode})`);
    assert.ok(Math.hypot(b.x - p.x, b.z - p.z) < 1.5 && Math.abs(b.y - p.y) < 2, `level ${depth}, ${p.name}: stays where put`);
    assert.ok(b.health > 0 && b.health === new Body(0, 0, 0).health, `level ${depth}, ${p.name}: not hurt arriving`);
  }
}

test('grandma\'s house, the cellar and the street', () => check(0, ['armchair', 'pawn shop', 'hardware', 'Frau Weber', 'old shaft', 'street']));
test('a Quarry level: the ways up and down, dens', () => check(1, ['way up', 'way down', 'rat nest']));
test('level 5: the Foreman', () => check(5, ['Foreman']));
test('level 9: grandma\'s camp', () => check(9, ['camp']));
test('level 10: the Tall One and a salt circle', () => check(10, ['Tall One', 'salt circle']));

test('invulnerable: blows and falls take nothing, but still show', () => {
  const b = new Body(0, 0, 0);
  b.invulnerable = true;
  b.hurt(30, 'rat');
  b.hurt(30, 'fall');
  assert.equal(b.health, new Body(0, 0, 0).health);
  assert.equal(b.lastCause, 'fall');
  assert.ok(b.hurtAt > -Infinity);
});
