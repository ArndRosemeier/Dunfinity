import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { CELLAR } from '../src/gen/cellar';
import { HOUSES, TOWN, houseDistance } from '../src/gen/town';
import { quarryProps } from '../src/gen/quarryProps';
import { Blockers } from '../src/world/blockers';
import { Body } from '../src/world/traverse/body';

const level = new Level(1, 0), G = TOWN.ground;

test("grandma's street: open sky over the cobbles, the houses solid, the cellar still roofed", () => {
  for (const z of [-40, -10, 0, 10, 40]) {
    assert.ok(level.sdf(-19, G + 1.2, z) > 0.5, `air in the street at z ${z}`);
    assert.ok(level.sdf(-19, G + 30, z) > 5, `sky at z ${z}`);
    assert.ok(Math.abs(level.groundAt(-19, z) - G) < 0.1, `street level at z ${z}`);
  }
  for (const h of HOUSES.slice(1)) {
    const x = (h.x0 + h.x1) / 2, z = (h.z0 + h.z1) / 2;
    assert.ok(level.sdf(x, G + 1.5, z) < 0, `house at ${x}, ${z} is solid`);
    assert.ok(houseDistance(h, x, h.eaves + 6, z) > 0, 'the sky above its roof');
  }
  // No house stands in another, or in the street.
  for (let i = 0; i < HOUSES.length; i++) for (let j = i + 1; j < HOUSES.length; j++) {
    const a = HOUSES[i], b = HOUSES[j];
    assert.ok(a.x1 <= b.x0 || b.x1 <= a.x0 || a.z1 <= b.z0 || b.z1 <= a.z0, `houses ${i} and ${j} overlap`);
  }
  for (const h of HOUSES) assert.ok(h.x1 <= TOWN.street.x[0] || h.x0 >= TOWN.street.x[1], 'a house in the street');
  // Rock stays over every space of the cellar: none of it opens to the sky.
  // (Over the stairs' top end is her house, on purpose.)
  for (let x = -7; x <= 17; x += 0.5) for (const z of [-2, 0, 2]) {
    if (level.sdf(x, 1.5, z) <= 0) continue;
    let rock = 0, best = 0;
    for (let y = 1.5; y < 40 && best < 1; y += 0.1) best = Math.max(best, (rock = level.sdf(x, y, z) <= 0 ? rock + 0.1 : 0));
    assert.ok(best >= 1, `the cellar at ${x}, ${z} is roofed by ${best.toFixed(1)} m only`);
  }
});

test('out of her front door: a body walks from the hall into the street and down it, and the lamps are lit', () => {
  const blockers = new Blockers();
  for (let tz = -2; tz <= 1; tz++) for (let tx = -2; tx <= 0; tx++) blockers.set(`${tx},${tz}`, quarryProps(level, tx, tz).blockers);
  const b = new Body(-12, CELLAR.house.floor, 0), dt = 1 / 120;
  for (const [tx, tz] of [[-18.5, 0], [-18.5, 25]]) {
    for (let t = 0; t < 15 && Math.hypot(tx - b.x, tz - b.z) > 0.2; t += dt) {
      b.step(level, { forward: 1, right: 0, yaw: Math.atan2(-(tx - b.x), -(tz - b.z)), sprint: false, jump: false }, dt, blockers);
    }
  }
  assert.ok(Math.hypot(b.x + 18.5, b.z - 25) < 0.4 && Math.abs(b.y - G) < 0.2, `stopped at ${b.x.toFixed(2)}, ${b.y.toFixed(2)}, ${b.z.toFixed(2)}`);
  let lit = 0;
  for (const tz of [-1, 0]) lit += quarryProps(level, -1, tz).counts.lit;
  assert.ok(lit >= 12, `lights ${lit}`);
});
