import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VILLAGE, nearestHouse, townAir } from '../src/gen/town';
import { VILLAGERS, villagers } from '../src/world/villagers';

test('the villagers walk the streets: never into a house, onto other streets, and they keep going', () => {
  const all = villagers(), dt = 1 / 20;
  assert.equal(all.length, VILLAGERS.count);
  const start = all.map((v) => [v.x, v.z]), roads = all.map((v) => new Set([v.road.id]));
  let walking = 0, steps = 0;
  for (let t = 0; t < 600; t += dt) {
    for (const [i, v] of all.entries()) {
      v.stroll(dt, t, 1e6, 1e6);
      roads[i].add(v.road.id);
      assert.ok(Number.isFinite(v.x + v.z + v.y + v.yaw), `villager ${i} at ${v.x}, ${v.z}`);
      assert.ok(nearestHouse(v.x, v.y + 1, v.z).d > 0.2, `villager ${i} in a house at ${v.x.toFixed(1)}, ${v.z.toFixed(1)}`);
      assert.ok(townAir(v.x, v.y + 0.9, v.z) > 0.2, `villager ${i} in the ground at ${v.x.toFixed(1)}, ${v.z.toFixed(1)}`);
      if (v.walking) walking++;
      steps++;
    }
  }
  assert.ok(walking / steps > 0.7, `walking ${(walking / steps).toFixed(2)} of the time`);
  assert.ok(all.filter((v, i) => Math.hypot(v.x - start[i][0], v.z - start[i][1]) > 30).length > VILLAGERS.count / 2, 'most have gone somewhere');
  assert.ok(roads.filter((r) => r.size > 1).length > VILLAGERS.count / 2, 'most have turned into another street');
  assert.ok(VILLAGE.roads.length > 3);
});

test('a villager stops for whoever stands in the way and turns to them, without stepping back and forth', () => {
  const v = villagers()[0], dt = 1 / 60;
  // Stand a metre ahead of them.
  const px = v.x - Math.sin(v.yaw) * 1, pz = v.z - Math.cos(v.yaw) * 1;
  const x0 = v.x, z0 = v.z;
  for (let t = 0; t < 5; t += dt) v.stroll(dt, t, px, pz);
  assert.ok(Math.hypot(v.x - x0, v.z - z0) < 0.05, 'stood still');
  assert.ok(v.waiting);
  const face = Math.atan2(-(px - v.x), -(pz - v.z));
  assert.ok(Math.abs(Math.atan2(Math.sin(face - v.yaw), Math.cos(face - v.yaw))) < 0.05, 'turned to them');
});
