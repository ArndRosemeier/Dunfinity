import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { Body, MOVE, type BodyInput } from '../src/world/traverse/body';

const level = new Level(1, 1);
const [sx, , sz] = level.spawn();
const STEP = 1 / 120;

function run(b: Body, seconds: number, input: Partial<BodyInput> = {}): void {
  const inp: BodyInput = { forward: 0, right: 0, yaw: 0, sprint: false, jump: false, ...input };
  for (let i = 0; i < seconds / STEP; i++) b.step(level, inp, STEP);
}

function standing(): Body {
  const b = new Body(sx, level.groundAt(sx, sz) + 0.5, sz);
  run(b, 1);
  return b;
}

test('a body dropped onto the floor comes to rest on it, outside the rock', () => {
  const b = standing();
  assert.ok(b.grounded);
  assert.ok(Math.abs(b.y - level.groundAt(b.x, b.z)) < 0.3, `feet ${b.y.toFixed(2)} vs ground ${level.groundAt(b.x, b.z).toFixed(2)}`);
  assert.ok(level.sdf(b.x, b.y + MOVE.height / 2, b.z) > MOVE.radius - 0.05);
  assert.equal(b.health, MOVE.maxHealth);
});

test('walking covers ground at walking pace and never ends up inside rock', () => {
  for (const yaw of [0, 1.5, 3]) {
    const b = standing();
    const x0 = b.x, z0 = b.z;
    for (let s = 0; s < 8; s++) {
      run(b, 0.5, { forward: 1, yaw });
      for (const h of [MOVE.radius, MOVE.height / 2, MOVE.height - MOVE.radius]) assert.ok(level.sdf(b.x, b.y + h, b.z) > MOVE.radius - 0.1);
    }
    if (b.mode === 'walk') assert.ok(Math.hypot(b.x - x0, b.z - z0) > 8, `moved ${Math.hypot(b.x - x0, b.z - z0).toFixed(1)} m at yaw ${yaw}`);
  }
});

test('walking into rock climbs it, using stamina; an empty bar means a fall', () => {
  // Find a wall: the nearest rock in some horizontal direction from the spawn.
  const b = standing();
  let yaw = 0, dist = Infinity;
  for (let a = 0; a < Math.PI * 2; a += 0.1) {
    const t = level.trace(b.x, b.y + 0.9, b.z, -Math.sin(a), 0, -Math.cos(a), 60);
    if (t < dist) { dist = t; yaw = a; }
  }
  assert.ok(dist < 60, 'no wall near the spawn');
  const y0 = b.y;
  let climbed = false, top = -Infinity;
  for (let s = 0; s < 40 && !b.dead; s++) {
    run(b, 0.5, { forward: 1, yaw });
    if (b.mode === 'climb') climbed = true;
    top = Math.max(top, b.y);
  }
  assert.ok(climbed, 'never started climbing');
  assert.ok(top - y0 > 5, `climbed only ${(top - y0).toFixed(1)} m`);
  assert.ok(b.stamina < MOVE.stamina);
});

test('a long fall hurts, a short hop does not', () => {
  const hop = standing();
  run(hop, 1, { jump: true });
  assert.equal(hop.health, MOVE.maxHealth);
  const b = standing();
  b.y += 25;
  run(b, 3);
  assert.ok(b.health < MOVE.maxHealth * 0.5, `health ${b.health}`);
});

test('in deep water the body swims with its head out', () => {
  // The deepest water within 1.5 km of the origin for seed 1, about 2 m deep.
  let spot: [number, number] | null = null;
  for (let x = -790; x < -770 && !spot; x += 1) for (let z = 1352; z < 1372 && !spot; z += 1) {
    if (level.waterAt(x, z) - level.floorAt(x, z) > 1.8 && level.sdf(x, level.waterAt(x, z) + 0.5, z) > 2) spot = [x, z];
  }
  assert.ok(spot, 'no deep water found');
  const b = new Body(spot[0], level.waterAt(spot[0], spot[1]) - 0.5, spot[1]);
  run(b, 3);
  assert.equal(b.mode, 'swim');
  assert.ok(b.y + 1.6 > level.waterAt(b.x, b.z), 'head under water');
});
