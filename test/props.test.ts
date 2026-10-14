import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { quarryProps, PROP_TILE } from '../src/gen/quarryProps';
import { PropBuilder } from '../src/gen/propMesh';

const level = new Level(1, 1);
// A 6 × 6 tile patch around the seed-1 spawn (an intact grand hall with tracks, carts and a shack).
const [sx, , sz] = level.spawn();
const tiles = [] as ReturnType<typeof quarryProps>[];
for (let tz = -3; tz < 3; tz++) for (let tx = -3; tx < 3; tx++) tiles.push(quarryProps(level, Math.floor(sx / PROP_TILE) + tx, Math.floor(sz / PROP_TILE) + tz));
const total = (k: keyof (typeof tiles)[0]['counts']) => tiles.reduce((s, t) => s + t.counts[k], 0);

test('props are deterministic per seed', () => {
  const a = quarryProps(new Level(1, 1), -9, 1), b = quarryProps(new Level(1, 1), -9, 1);
  assert.deepEqual(a.counts, b.counts);
  assert.deepEqual(a.solid?.positions, b.solid?.positions);
  assert.deepEqual(a.lamps, b.lamps);
});

test('things are left against the rock, and derricks stand in the open', () => {
  assert.ok(total('leftovers') >= 5, `left behind ${total('leftovers')}`);
  assert.ok(total('derricks') >= 1, `derricks ${total('derricks')}`);
});

test('the quarry around the spawn has tracks, carts, lamps and a shack', () => {
  assert.ok(total('sleepers') > 100, `sleepers ${total('sleepers')}`);
  assert.ok(total('carts') >= 1);
  assert.ok(total('shacks') >= 1);
  const lit = total('lit');
  assert.ok(lit >= 3 && lit < 200, `lit lamps ${lit}`);
  assert.ok(lit <= total('lamps'));
});

test('props stand on the floor, not inside rock, and burning lamps hang in open air', () => {
  for (const t of tiles) {
    for (const m of [t.solid, t.glow]) {
      if (!m) continue;
      for (let i = 0; i < m.positions.length; i += 3) {
        const d = level.sdf(m.positions[i], m.positions[i + 1], m.positions[i + 2]);
        assert.ok(d > -1, `prop vertex ${d.toFixed(2)} m inside rock`);
      }
    }
    for (let i = 0; i < t.lamps.length; i += 3) assert.ok(level.sdf(t.lamps[i], t.lamps[i + 1], t.lamps[i + 2]) > 0.3);
  }
});

test('a tile only places what lies inside it', () => {
  const tx = Math.floor(sx / PROP_TILE) - 2, tz = Math.floor(sz / PROP_TILE);
  const t = quarryProps(level, tx, tz);
  for (let i = 0; i < t.lamps.length; i += 3) {
    // A lamp hangs within a metre or so of the point that placed it.
    assert.ok(t.lamps[i] > tx * PROP_TILE - 2 && t.lamps[i] < (tx + 1) * PROP_TILE + 2);
    assert.ok(t.lamps[i + 2] > tz * PROP_TILE - 2 && t.lamps[i + 2] < (tz + 1) * PROP_TILE + 2);
  }
});

test('prop boxes wind outwards', () => {
  const b = new PropBuilder();
  b.upright(0, 0, 0, 0.7, 1, 2, 3, [1, 1, 1]);
  b.beam(0, 0, 0, 3, 1, 2, 0.2, 0.3, [1, 1, 1]);
  b.cylinder(1, 2, 3, 0.3, 0.4, [1, 1, 1], 12, 0.12);
  b.cylinder(1, 2, 3, 0.2, 0.2, [1, 1, 1], 8, 0, 0.2);
  const m = b.build()!;
  for (let i = 0; i < m.indices.length; i += 3) {
    const [a, c, d] = [m.indices[i], m.indices[i + 1], m.indices[i + 2]].map((k) => [m.positions[3 * k], m.positions[3 * k + 1], m.positions[3 * k + 2]]);
    const e1 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const k = 3 * m.indices[i];
    assert.ok(n[0] * m.normals[k] + n[1] * m.normals[k + 1] + n[2] * m.normals[k + 2] > 0, 'face winds against its normal');
  }
});

test('standing water lies on the water table, and props stay dry', () => {
  // A patch that holds a flooded low working (found near the seed-1 spawn).
  const wet = [] as ReturnType<typeof quarryProps>[];
  for (let tz = -2; tz < 1; tz++) for (let tx = -12; tx < -9; tx++) wet.push(quarryProps(level, tx, tz));
  assert.ok(wet.reduce((s, t) => s + t.counts.wet, 0) > 50, 'expected a flooded working');
  for (const t of [...wet, ...tiles]) {
    if (t.water) {
      const p = t.water.positions;
      for (let i = 0; i < p.length; i += 3) assert.ok(Math.abs(p[i + 1] - level.waterAt(p[i], p[i + 2])) < 1e-4);
    }
    for (let i = 0; i < t.lamps.length; i += 3) assert.ok(t.lamps[i + 1] > level.waterAt(t.lamps[i], t.lamps[i + 2]) + 1);
  }
});

test('the spawn is not under water', () => {
  const [x, , z] = level.spawn();
  assert.ok(level.floorAt(x, z) > level.waterAt(x, z));
});

test('loose stones lie on the floor, out of the water', () => {
  const stones = tiles.reduce((s, t) => s + t.counts.stones, 0);
  assert.ok(stones > 200, `stones on the floor (${stones})`);
  for (const t of tiles) {
    if (!t.stones) continue;
    const p = t.stones.positions;
    for (let i = 0; i < p.length; i += 3 * 24) assert.ok(level.waterAt(p[i], p[i + 2]) < level.groundAt(p[i], p[i + 2]) + 0.6, 'a stone in the water');
  }
});

test('the Salt Works has salt statues, chapels and electric lamps hanging from the roof; the quarry has none', () => {
  const salt = new Level(1, 3);
  const [ax, , az] = salt.arrival;
  const sum = { statues: 0, chapels: 0, hanging: 0 };
  for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
    const c = quarryProps(salt, Math.floor(ax / PROP_TILE) + i, Math.floor(az / PROP_TILE) + j).counts;
    sum.statues += c.statues; sum.chapels += c.chapels; sum.hanging += c.hanging;
  }
  assert.ok(sum.statues > 0 && sum.chapels > 0 && sum.hanging > 0, JSON.stringify(sum));
  assert.equal(total('statues') + total('chapels') + total('hanging'), 0);
});
