import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { QUARRY, SALT, bandOf } from '../src/gen/bands';
import { ladderOf } from '../src/gen/descents';

test('levels 1–2 are the Quarry, 3–5 the Salt Works', () => {
  assert.equal(bandOf(1), QUARRY);
  assert.equal(bandOf(2), QUARRY);
  for (const d of [3, 4, 5]) assert.equal(bandOf(d), SALT);
  assert.equal(new Level(1, 3).band.name, 'The Salt Works');
});

test('in the Salt Works one arrives at a way up, dry, with a way down within reach', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const l = new Level(seed, 3), a = l.ascent;
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
        if (l.field.pillarAt(w, iu, 0) !== 'whole') continue;
        const ds: number[] = [];
        for (let t = -0.6; t <= 0.6; t += 0.05) {
          const [x, z] = l.field.fromGrid(w, (iu + 0.5) * s + half + 0.6, 0.5 * s + t * half);
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
