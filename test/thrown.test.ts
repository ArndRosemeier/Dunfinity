import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '@futuremagic/core';
import { Level } from '../src/gen/level';
import { THROW, Thrown } from '../src/combat/thrown';
import type { Fighter } from '../src/combat/combat';

const level = new Level(1, 1);
const [ax, , az] = level.arrival;
const g = level.groundAt(ax, az);

function dummy(x: number, z: number): Fighter & { health: number; cause: string } {
  return { x, y: level.groundAt(x, z), z, vx: 0, vz: 0, radius: 0.3, height: 0.5, health: 50, cause: '', get dead() { return this.health <= 0; }, hurt(a: number, c: string) { this.health -= a; this.cause = c; } };
}

/** A direction from the arrival with open floor for `d` metres. */
function open(d: number): number {
  for (let a = 0; a < 16; a++) {
    const yaw = a * 0.39;
    let ok = true;
    for (let r = 0.5; r <= d && ok; r += 0.5) ok = level.sdf(ax - Math.sin(yaw) * r, g + 1.2, az - Math.cos(yaw) * r) > 0.8;
    if (ok) return yaw;
  }
  throw new Error('no open way');
}

test('a thrown knife flies to the creature it is aimed at, hurts it as the knife, and drops', () => {
  const yaw = open(9), rat = dummy(ax - Math.sin(yaw) * 8, az - Math.cos(yaw) * 8);
  const t = new Thrown(), rng = new Rng(1);
  t.throw(ax, g + 1.45, az, yaw + 0.2, [rat]); // not quite where it looks: it homes in
  let hit = false;
  for (let s = 0; s < 120 && !hit; s++) hit = t.fly(level, [rat], rng, 1 / 60).length > 0;
  assert.ok(hit, 'it hit');
  assert.ok(rat.health <= 50 - THROW.damage[0] && rat.cause === 'knife');
  for (let s = 0; s < 240; s++) t.fly(level, [rat], rng, 1 / 60);
  assert.ok(t.knives.length === 0 || t.knives[0].landed >= 0, 'it came down');
  assert.ok(rat.health > 50 - 2 * THROW.damage[1], 'only once');
});

test('a knife that hits nothing lands, lies a while, and is gone', () => {
  const t = new Thrown(), rng = new Rng(1);
  t.throw(ax, g + 1.45, az, open(4), []);
  for (let s = 0; s < 180 && t.knives[0].landed < 0; s++) t.fly(level, [], rng, 1 / 60);
  const k = t.knives[0];
  assert.ok(k.landed >= 0 && level.sdf(k.x, k.y, k.z) < 0.05, 'on the rock or the floor');
  for (let s = 0; s < (THROW.lies + 0.5) * 60; s++) t.fly(level, [], rng, 1 / 60);
  assert.equal(t.knives.length, 0);
});
