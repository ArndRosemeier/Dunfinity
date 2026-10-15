import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { Body, MOVE, type BodyInput } from '../src/world/traverse/body';
import { damage } from '../src/combat/combat';

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
    const t = level.trace(b.x, b.y + 1.6, b.z, -Math.sin(a), 0, -Math.cos(a), 60); // (head high: not a rise of the floor)
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

test('health comes back slowly once the nobody has been left alone a while', () => {
  const b = standing();
  b.hurt(40, 'rat');
  run(b, MOVE.healAfter - 1);
  assert.equal(b.health, MOVE.maxHealth - 40, 'no healing straight after a hurt');
  run(b, 11);
  assert.ok(b.health > MOVE.maxHealth - 40 + 5 && b.health < MOVE.maxHealth);
  run(b, 120);
  assert.equal(b.health, MOVE.maxHealth, 'not past full');
});

test('a roll (grandma\'s Duck) carries the body a few metres, costs stamina, and blows miss it for part of it', () => {
  const b = standing(), x0 = b.x, z0 = b.z, s0 = b.stamina;
  // Roll along the open direction: the one with most room.
  let best = [1, 0], room = 0;
  for (let a = 0; a < 8; a++) {
    const dx = Math.cos(a * 0.785), dz = Math.sin(a * 0.785);
    let r = 0;
    while (r < 6 && level.sdf(b.x + dx * r, b.y + 1, b.z + dz * r) > 0.6) r += 0.25;
    if (r > room) { room = r; best = [dx, dz]; }
  }
  assert.ok(b.roll(best[0], best[1], 4, [0.08, 0.42]));
  assert.equal(b.stamina, s0 - 4);
  assert.ok(!b.roll(best[0], best[1], 4, [0.08, 0.42]), 'not twice at once');
  assert.ok(!b.evading, 'not at the very start');
  run(b, 0.2);
  assert.ok(b.evading && b.rolling);
  damage(b, 30, b.x + 1, b.z, 5, 'test');
  assert.equal(b.health, MOVE.maxHealth, 'the blow missed');
  run(b, 0.5);
  assert.ok(!b.rolling && !b.evading);
  const went = Math.hypot(b.x - x0, b.z - z0);
  assert.ok(went > 1.8 && went < 3.5, `${went.toFixed(2)} m`);
  damage(b, 30, b.x + 1, b.z, 5, 'test');
  assert.equal(b.health, MOVE.maxHealth - 30, 'after it, blows land');
  b.stamina = 1;
  assert.ok(!b.roll(1, 0, 4, [0, 1]), 'no roll without the breath for it');
});

test('at the top of a climb the body holds the edge, then is pulled over to stand on the ledge', () => {
  // A broken pillar's stump near the spawn on level 2, its top 1.6 to 4.5 m up, and a spot on the floor beside it.
  const level = new Level(1, 2), [x0, , z0] = level.spawn();
  const run = (b: Body, seconds: number, input: Partial<BodyInput> = {}) => {
    const inp: BodyInput = { forward: 0, right: 0, yaw: 0, sprint: false, jump: false, ...input };
    for (let i = 0; i < seconds / STEP; i++) b.step(level, inp, STEP);
  };
  let start: { x: number; z: number; yaw: number; top: number } | null = null;
  for (let r = 0; r < 500 && !start; r += 1.7) for (let a = 0; a < 6.28 && !start; a += 0.35) {
    const x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r, c = { ...level.columnAt(x, z) };
    if (c.stumpTop === Infinity || c.pillarD > -0.3 || c.stumpTop - c.floor < 1.6 || c.stumpTop - c.floor > 4.5) continue;
    const dx = Math.sin(a), dz = Math.cos(a);
    let out = 0;
    while (out < 8 && level.columnAt(x + dx * out, z + dz * out).pillarD < 0) out += 0.2;
    const sx = x + dx * (out + 1.2), sz = z + dz * (out + 1.2);
    if (Math.abs(level.floorAt(sx, sz) - c.floor) < 0.5 && level.sdf(sx, level.floorAt(sx, sz) + 1, sz) > 1) start = { x: sx, z: sz, yaw: Math.atan2(dx, dz), top: c.stumpTop };
  }
  assert.ok(start, 'no stump near the spawn');
  const b = new Body(start.x, level.floorAt(start.x, start.z) + 0.3, start.z);
  run(b, 0.5);
  for (let t = 0; t < 8 && !b.ledge; t += 0.1) run(b, 0.1, { forward: 1, yaw: start.yaw });
  assert.ok(b.ledge, 'never reached the top');
  assert.ok(b.ledge.floor - b.y <= MOVE.ledge.reach && b.ledge.floor > b.y);
  const y = b.y;
  run(b, 1, { forward: 1, yaw: start.yaw });
  assert.ok(b.ledge && Math.abs(b.y - y) < 0.05, 'holds the edge until pulled over');
  b.overLedge();
  run(b, 0.5);
  assert.equal(b.mode, 'walk');
  assert.ok(b.grounded && Math.abs(b.y - start.top) < 0.6, `stands at ${b.y.toFixed(2)} on a top at ${start.top.toFixed(2)}`);
});
