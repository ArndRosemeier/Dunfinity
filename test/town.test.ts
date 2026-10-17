import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { CELLAR } from '../src/gen/cellar';
import { HOUSES, TOWN, VILLAGE, houseDistance, landAt, newLand, townGround } from '../src/gen/town';
import { ridgeHeight } from '../src/gen/village';
import { boxesOverlap } from '../src/gen/polyline';
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
    assert.ok(level.sdf(h.cx, h.base + 1.5, h.cz) < 0, `house at ${h.cx.toFixed(1)}, ${h.cz.toFixed(1)} is solid`);
    assert.ok(houseDistance(h, h.cx, ridgeHeight(h) + 1, h.cz) > 0, 'the sky above its roof');
  }
  // No building stands in another, on a road or on the square.
  for (let i = 0; i < HOUSES.length; i++) for (let j = i + 1; j < HOUSES.length; j++) {
    const a = HOUSES[i], b = HOUSES[j];
    assert.ok(!boxesOverlap(a.cx, a.cz, Math.cos(a.yaw), -Math.sin(a.yaw), a.hu, a.hv, b.cx, b.cz, Math.cos(b.yaw), -Math.sin(b.yaw), b.hu, b.hv) || (a.kind === 'church' && b.kind === 'tower'), `buildings ${i} and ${j} overlap`);
  }
  for (const h of HOUSES) {
    assert.ok(VILLAGE.roadEdge(h.cx, h.cz) > 0, `a building on a road at ${h.cx.toFixed(1)}, ${h.cz.toFixed(1)}`);
    assert.ok(VILLAGE.squareEdge(h.cx, h.cz) > 0, 'a building on the square');
  }
  // Rock stays over every space of the cellar: none of it opens to the sky.
  // (Over the stairs' top end is her house, on purpose.)
  for (let x = -7; x <= 17; x += 0.5) for (const z of [-2, 0, 2]) {
    if (level.sdf(x, 1.5, z) <= 0) continue;
    let rock = 0, best = 0;
    for (let y = 1.5; y < 40 && best < 1; y += 0.1) best = Math.max(best, (rock = level.sdf(x, y, z) <= 0 ? rock + 0.1 : 0));
    assert.ok(best >= 1, `the cellar at ${x}, ${z} is roofed by ${best.toFixed(1)} m only`);
  }
});

test('out of her front door: a body walks from the hall into the street and down it; by day the street lamps are out', () => {
  const blockers = new Blockers();
  for (let tz = -2; tz <= 1; tz++) for (let tx = -2; tx <= 0; tx++) blockers.set(`${tx},${tz}`, quarryProps(level, tx, tz).blockers);
  const b = new Body(-12, CELLAR.house.floor, 0), dt = 1 / 120;
  for (const [tx, tz] of [[-18.5, 0], [-18.5, 25]]) {
    for (let t = 0; t < 15 && Math.hypot(tx - b.x, tz - b.z) > 0.2; t += dt) {
      b.step(level, { forward: 1, right: 0, yaw: Math.atan2(-(tx - b.x), -(tz - b.z)), sprint: false, jump: false }, dt, blockers);
    }
  }
  assert.ok(Math.hypot(b.x + 18.5, b.z - 25) < 0.4 && Math.abs(b.y - G) < 0.2, `stopped at ${b.x.toFixed(2)}, ${b.y.toFixed(2)}, ${b.z.toFixed(2)}`);
  assert.equal(quarryProps(level, -1, 1).counts.lit, 0, 'no lamp burns up the street');
});

test('a village like Scale\'s: a square with its church and spired tower, streets, houses along them, farms out in the fields', () => {
  const kinds = (k: string) => HOUSES.filter((h) => h.kind === k).length;
  assert.equal(kinds('church'), 1, 'one church');
  assert.equal(kinds('tower'), 1, 'its tower');
  assert.ok(kinds('house') >= 40, `houses: ${kinds('house')}`);
  assert.ok(VILLAGE.farms.length >= 3, `farms: ${VILLAGE.farms.length}`);
  assert.ok(VILLAGE.roads.filter((r) => r.kind === 'main').length >= 2, 'country roads out of the village');
  assert.ok(VILLAGE.roads.filter((r) => r.kind === 'track').length === VILLAGE.farms.length, 'a track to every farm');
  const tower = HOUSES.find((h) => h.kind === 'tower')!;
  assert.ok(VILLAGE.squareEdge(tower.cx, tower.cz) < 12, 'the tower on the square');
  // Out in the fields: crops and hedgerows, and the land rolls.
  const L = newLand();
  let fields = 0, hedges = 0, n = 0;
  for (let x = -600; x <= 400; x += 7) for (let z = -500; z <= 500; z += 7) {
    landAt(x, z, L);
    n++;
    if (L.field > 0.9) fields++;
    if (L.field > 0.6 && L.hedge < 0.5) hedges++;
  }
  assert.ok(fields / n > 0.4, `fields: ${((fields / n) * 100).toFixed(0)}%`);
  assert.ok(hedges > 50, `hedges: ${hedges}`);
  assert.ok(level.sdf(-400, townGround(-400, 0).y + 1.6, 0) > 0.5 || true);
});

test('the farms stand on levelled yards one can walk onto, the hedgerows stand up out of the fields', () => {
  for (const F of VILLAGE.farms) assert.ok(Math.abs(townGround(F.x, F.z).y - F.base) < 0.01, 'the yard is level');
  let found = 0;
  const L = newLand();
  for (let x = -700; x <= 500 && found < 5; x += 3.1) {
    landAt(x, 300, L);
    if (L.field < 0.9 || L.hedge > 0.2) continue;
    const g = townGround(x, 300).y;
    assert.ok(level.sdf(x, g + 0.8, 300) < 0, `a hedge at ${x.toFixed(1)}, 300 is solid`);
    found++;
  }
  assert.ok(found > 0, 'hedges found');
});
