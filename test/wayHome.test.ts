import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { CELLAR } from '../src/gen/cellar';
import { HOME_SHOT, WAY, WAY_LIFE, openWay, walksThrough, wayOpen } from '../src/world/wayHome';
import { THIN } from '../src/world/thinPlaces';

test('at home the way back opens in the cellar on the cellar\'s own floor', () => {
  // (Her house's floor is over the cellar: `groundAt` there is the house's, so the way uses the
  // floor one stands on.)
  const l = new Level(1, 0);
  const w = openWay(l, CELLAR.start.x, 0, CELLAR.start.z, CELLAR.start.yaw, { depth: 3 }, 'back', HOME_SHOT, WAY.cellar);
  assert.ok(Math.abs(w.y - WAY.over) < 1e-6, `the way back on the cellar's floor: ${w.y.toFixed(2)}`);
});

test('Way Home opens a few steps ahead, facing one, on the floor, and walking into it goes through', () => {
  for (const [depth, x, z, yaw] of [[3, NaN, NaN, 0.7], [0, CELLAR.start.x, CELLAR.start.z, CELLAR.start.yaw]] as const) {
    const l = new Level(1, depth), px = Number.isNaN(x) ? l.arrival[0] : x, pz = Number.isNaN(z) ? l.arrival[2] : z, py = l.groundAt(px, pz);
    const w = openWay(l, px, py, pz, yaw, { depth: depth ? 0 : 3 }, depth ? 'home' : 'back', HOME_SHOT);
    const d = Math.hypot(w.x - px, w.z - pz);
    assert.ok(d >= WAY.ahead[0] - 1e-6 && d <= WAY.ahead[1] + 1e-6, `${d.toFixed(2)} m ahead`);
    // Ahead (where one looks: -sin yaw, -cos yaw), and its face (sin yaw, cos yaw) turned back to one.
    assert.ok(-(w.x - px) * Math.sin(yaw) - (w.z - pz) * Math.cos(yaw) > 0, 'ahead');
    assert.ok((px - w.x) * Math.sin(w.yaw) + (pz - w.z) * Math.cos(w.yaw) > d * 0.99, 'facing one');
    assert.ok(Math.abs(w.y - WAY.over - l.groundAt(w.x, w.z, py + 1)) < 1e-6, 'standing on the floor');
    // Shut at first; open, walking into its middle goes through, standing where one was does not.
    const feet = w.y - WAY.over;
    assert.equal(walksThrough(w, w.x, feet, w.z), false, 'not while it opens');
    w.age = THIN.open + 1;
    assert.equal(walksThrough(w, w.x, feet, w.z), true);
    assert.equal(walksThrough(w, px, py, pz), false);
    w.age = WAY_LIFE + 0.1;
    assert.equal(wayOpen(w.age), 0, 'shut again after its time');
  }
});
