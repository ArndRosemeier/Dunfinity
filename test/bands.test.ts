import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { CISTERN, QUARRY, SALT, THRESHOLD, bandOf } from '../src/gen/bands';
import { ladderOf } from '../src/gen/descents';

test('levels 1–2 are the Quarry, 3–5 the Salt Works, 6–8 the Cisterns, 9–10 the Threshold', () => {
  assert.equal(bandOf(1), QUARRY);
  assert.equal(bandOf(2), QUARRY);
  for (const d of [3, 4, 5]) assert.equal(bandOf(d), SALT);
  for (const d of [6, 7, 8]) assert.equal(bandOf(d), CISTERN);
  for (const d of [9, 10]) assert.equal(bandOf(d), THRESHOLD);
  assert.equal(new Level(1, 3).band.name, 'The Salt Works');
});

test('in the Salt Works and the Cisterns one arrives at a way up, dry, with a way down within reach', () => {
  for (const [seed, depth] of [[1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [1, 6], [2, 6], [3, 7], [4, 8], [1, 9], [2, 9], [3, 10], [4, 10]]) {
    const l = new Level(seed, depth), a = l.ascent;
    assert.ok(a && a.up, `seed ${seed}: no way up`);
    const [x, y, z] = l.arrival;
    assert.ok(l.waterAt(x, z) < y, `seed ${seed}: arrival under the brine`);
    const L = ladderOf(a);
    for (let h = L.floor + 1; h < L.hi; h += 2) assert.ok(l.sdf(L.x - L.nx * 0.4, h, L.z - L.nz * 0.4) > 0.25, `seed ${seed}: ladder blocked at ${h}`);
    assert.ok(l.descents.nearest(x, z, 1500), `seed ${seed}: no way down`);
  }
});

test("salt pillars are carved: their sides are fluted, the Quarry's are flat", () => {
  // Walk along a whole pillar's side just outside it and see the distance to rock rise and fall.
  for (const [depth, fluted] of [[1, false], [3, true]] as const) {
    const l = new Level(1, depth), [sx, , sz] = l.spawn();
    let found = false;
    for (let k = 0; k < 40 && !found; k++) {
      const w = l.workingAt(sx + k * 37, sz - k * 23);
      const s = w.spacing, half = w.pillar / 2;
      for (let iu = -3; iu <= 3 && !found; iu++) {
        if (l.field.excavation.pillarAt(w, iu, 0) !== 'whole') continue;
        const ds: number[] = [];
        for (let t = -0.6; t <= 0.6; t += 0.05) {
          const [x, z] = l.field.excavation.fromGrid(w, (iu + 0.5) * s + half + 0.6, 0.5 * s + t * half);
          const col = l.columnAt(x, z);
          if (col.working.id !== w.id || col.wall < 5) { ds.length = 0; break; }
          ds.push(col.pillarD);
        }
        if (ds.length < 20) continue;
        found = true;
        const range = Math.max(...ds) - Math.min(...ds);
        if (fluted) assert.ok(range > 0.15, `salt pillar side varies by ${range.toFixed(2)} m`);
        else assert.ok(range < 0.05, `quarry pillar side varies by ${range.toFixed(2)} m`);
      }
    }
    assert.ok(found, `no whole pillar found at depth ${depth}`);
  }
});

test('in the Threshold, natural caverns break through: no pillars, a walkable floor, rough rock above it', () => {
  for (const [seed, depth] of [[1, 9], [2, 10]]) {
    const l = new Level(seed, depth), [ax, , az] = l.arrival;
    let cave = 0, all = 0, steep = 0, open = 0;
    for (let z = az - 600; z < az + 600; z += 7) for (let x = ax - 600; x < ax + 600; x += 7) {
      all++;
      const col = l.columnAt(x, z);
      if (col.cavern < 0.99) continue;
      cave++;
      assert.equal(l.field.excavation.pillarAt(col.working, 0, 0), 'none');
      if (col.pillarD < 1 || col.border < 15 || col.rubble > 0.05) continue;
      open++;
      // The floor rises and falls no more than a slope one can walk.
      const f = col.floor, fx = l.columnAt(x + 1, z).floor, fz = l.columnAt(x, z + 1).floor;
      if (Math.hypot(fx - f, fz - f) > 0.5) steep++;
    }
    assert.ok(cave / all > 0.2 && cave / all < 0.8, `seed ${seed}: ${((cave / all) * 100).toFixed(0)}% cavern`);
    assert.ok(steep / open < 0.02, `seed ${seed}: ${steep} of ${open} too steep`);
  }
  for (const d of [1, 3, 6]) {
    const l = new Level(1, d);
    for (let k = 0; k < 200; k++) assert.equal(l.columnAt(k * 31, k * 17).cavern, 0);
  }
});
