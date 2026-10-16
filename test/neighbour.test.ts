import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { HOUSES, homeDoor, shopDoor } from '../src/gen/town';
import { Neighbour, WEBER } from '../src/world/neighbour';

test('Frau Weber lives across the street, not in a shop, and stands on her step out in the air', () => {
  const homes = HOUSES.filter((h) => h.role === 'weber');
  assert.equal(homes.length, 1);
  assert.ok(Math.abs(homes[0].yaw - Math.PI / 2) < 0.01 && homes[0].cz < 0, 'across the street, down from the lane');
  const d = homeDoor('weber'), pawn = shopDoor('pawn');
  assert.ok(Math.hypot(d.x - pawn.x, d.z - pawn.z) > 3, 'not at the pawn shop door');
  const w = new Neighbour(), level = new Level(1, 0);
  assert.ok(level.sdf(w.x, w.y + 1, w.z) > 0.3, 'she stands in the air, not in a wall');
  assert.ok(level.sdf(d.x, w.y + 1, d.z) > 0.4, 'there is room to stand at her door');
  assert.ok(w.canHear(d.x, w.y, d.z), 'from her door one can talk to her');
});

test('she greets the first visit, mourns the fallen once each, and her rumours open with depth', () => {
  const w = new Neighbour();
  assert.match(w.talk({ deepest: 0, fallen: 0 }, 0), /Grete's/);
  const shallow = new Set<string>();
  for (let i = 0; i < 12; i++) shallow.add(w.talk({ deepest: 0, fallen: 0 }, i));
  assert.ok(![...shallow].some((l) => /Tall|foreman|bricked/.test(l)), 'nothing from the deep before anyone went');
  assert.match(w.talk({ deepest: 2, fallen: 1 }, 20), /notary/);
  assert.doesNotMatch(w.talk({ deepest: 2, fallen: 1 }, 21), /notary/);
  const deep = new Set<string>();
  for (let i = 0; i < 20; i++) deep.add(w.talk({ deepest: 10, fallen: 1 }, 30 + i));
  assert.ok([...deep].some((l) => /Tall/.test(l)), 'the deepest rumour once the family has been to 10');
  assert.ok(w.talking(30 + 19 + WEBER.talk - 0.1) && !w.talking(30 + 19 + WEBER.talk + 0.1));
});

test('she turns to whoever comes near, steadily, and back to the street once they go', () => {
  const w = new Neighbour(), street = w.yaw;
  const x = w.x + 3, z = w.z + 3;
  let last = w.yaw, flips = 0, prevStep = 0;
  for (let i = 0; i < 120; i++) {
    w.turn(x, z, 1 / 60);
    const step = w.yaw - last;
    if (step * prevStep < 0) flips++;
    if (step !== 0) prevStep = step;
    last = w.yaw;
  }
  assert.ok(Math.abs(Math.atan2(Math.sin(w.yaw - Math.atan2(-3, -3)), Math.cos(w.yaw - Math.atan2(-3, -3)))) < 0.05, 'faces the visitor');
  assert.equal(flips, 0, 'no jitter');
  for (let i = 0; i < 300; i++) w.turn(w.x + 50, w.z, 1 / 60);
  assert.ok(Math.abs(w.yaw - street) < 0.05, 'back to the street');
});
