import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { Fauna } from '../src/creatures/fauna';
import { Body, type BodyInput } from '../src/world/traverse/body';
import { DEBUG_STYLES, depthWithStyle, placesOn, styleSpot } from '../src/game/debugPlaces';
import { damage } from '../src/combat/combat';
import { positionReport, readPosition } from '../src/game/report';

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

test('invulnerable: blows and falls do nothing at all', () => {
  const b = new Body(0, 0, 0);
  b.invulnerable = true;
  b.hurt(30, 'fall');
  damage(b, 30, 1, 0, 5, 'rat');
  assert.equal(b.health, new Body(0, 0, 0).health);
  assert.equal(b.hurtAt, -Infinity, 'no red flash, flinch or cry');
  assert.equal(b.vx, 0, 'not pushed');
});

test('invulnerable among every creature on levels 5 and 7: never hurt', () => {
  for (const depth of [5, 7]) {
    const l = new Level(1, depth), [ax, , az] = l.arrival;
    for (const [name, pop] of Object.entries(new Fauna(l))) {
      const den = (pop as { nearestDen?: (x: number, z: number, r: number) => { x: number; z: number } | null }).nearestDen?.(ax, az, 8);
      if (!den) continue;
      const b = new Body(den.x + 1, l.groundAt(den.x + 1, den.z), den.z), fauna = new Fauna(l), lamp = { x: b.x, y: b.y + 1.8, z: b.z, dx: 0, dy: 0, dz: -1, cos: 0.8 };
      b.invulnerable = true;
      for (let i = 0; i < 60 * 8; i++) { b.step(l, still, 1 / 60); fauna.advance(1 / 60, b, lamp, b.facing); }
      assert.equal(b.health, new Body(0, 0, 0).health, `level ${depth}, ${name}`);
      assert.equal(b.hurtAt, -Infinity, `level ${depth}, ${name}: no hurt shown`);
    }
  }
});

test('every level style: a level that has it, and open floor inside it', () => {
  for (const id of DEBUG_STYLES) {
    const d = depthWithStyle(1, 1, id);
    assert.ok(d !== null, `${id}: some level has it`);
    const l = new Level(1, d), [ax, , az] = l.arrival, p = styleSpot(l, id, ax, az);
    assert.ok(p, `${id}: found on level ${d}`);
    assert.equal(l.field.styles[l.field.regions.styleAt(p.x, p.z)].id, id, `${id}: the spot is its own ground`);
    const b = new Body(p.x, p.y + 0.2, p.z);
    for (let i = 0; i < 1.5 / STEP; i++) b.step(l, still, STEP);
    assert.ok(b.mode === 'swim' || b.grounded, `${id}: stands (${b.mode})`);
    assert.ok(Math.hypot(b.x - p.x, b.z - p.z) < 1.5, `${id}: stays where put`);
  }
});

test('copy position: the block names the spot, and reading it back gives the same place', () => {
  const l = new Level(7, 6), [ax, , az] = l.arrival, b = new Body(ax + 0.123456, l.groundAt(ax, az), az - 0.5);
  const text = positionReport('v0.999', 'https://example.org/Dunfinity/', l, b, { yaw: 0.5, pitch: -0.2, distance: 4 }, null);
  assert.match(text, /^Dunfinity v0\.999/);
  assert.match(text, /style \w+ \(region -?\d+\)/);
  assert.match(text, /rock distance: feet/);
  const p = readPosition(`look, it is here:\n${text}\nthanks`);
  assert.ok(p?.pos);
  assert.equal(p.seed, 7);
  assert.equal(p.depth, 6);
  assert.ok(Math.abs(p.pos[0] - b.x) < 0.001 && Math.abs(p.pos[1] - b.y) < 0.001 && Math.abs(p.pos[2] - b.z) < 0.001);
  assert.ok(p.look && Math.abs(p.look[0] - (0.5 * 180) / Math.PI) < 0.1);
  assert.equal(readPosition('nothing here'), null);
});
