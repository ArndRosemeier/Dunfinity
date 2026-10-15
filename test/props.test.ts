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
  const sum = { statues: 0, watchers: 0, chapels: 0, hanging: 0 };
  for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
    const c = quarryProps(salt, Math.floor(ax / PROP_TILE) + i, Math.floor(az / PROP_TILE) + j).counts;
    sum.statues += c.statues; sum.watchers += c.watchers; sum.chapels += c.chapels; sum.hanging += c.hanging;
  }
  assert.ok(sum.statues > sum.watchers && sum.watchers > 0 && sum.chapels > 0 && sum.hanging > 0, JSON.stringify(sum));
  assert.equal(total('statues') + total('chapels') + total('hanging'), 0);
});

test('the Cisterns have pipes, pumps and bunker furniture, and no salt statues; the Salt Works has no waterworks', () => {
  const sum = (l: Level) => {
    const [ax, , az] = l.arrival, s = { machines: 0, statues: 0, chapels: 0 };
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
      const c = quarryProps(l, Math.floor(ax / PROP_TILE) + i, Math.floor(az / PROP_TILE) + j).counts;
      s.machines += c.machines; s.statues += c.statues; s.chapels += c.chapels;
    }
    return s;
  };
  const cis = sum(new Level(1, 6)), salt = sum(new Level(1, 3));
  assert.ok(cis.machines > 5, JSON.stringify(cis));
  assert.equal(cis.statues + cis.chapels, 0);
  assert.equal(salt.machines, 0);
});

test('the Threshold has ruins against its cavern walls and no miners\' leavings there; nowhere else has ruins', () => {
  const sum = (l: Level, n: number) => {
    const [ax, , az] = l.arrival, s = { ruins: 0, rails: 0 };
    for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) s.ruins += quarryProps(l, Math.floor(ax / PROP_TILE) + i, Math.floor(az / PROP_TILE) + j).counts.ruins;
    return s;
  };
  const deep = sum(new Level(1, 9), 3).ruins + sum(new Level(2, 10), 3).ruins;
  assert.ok(deep >= 2, `${deep} ruins`);
  assert.equal(sum(new Level(1, 3), 2).ruins + sum(new Level(1, 6), 2).ruins, 0);
});

test('a tube runs between its ends, round', () => {
  const b = new PropBuilder();
  b.tube(0, 1, 0, 2, 1, 0, 0.1, [1, 1, 1], 8);
  const m = b.build()!;
  for (let v = 0; v < m.positions.length / 3; v++) {
    const x = m.positions[v * 3], y = m.positions[v * 3 + 1], z = m.positions[v * 3 + 2];
    assert.ok(Math.abs(x) < 1e-6 || Math.abs(x - 2) < 1e-6, 'at an end');
    assert.ok(Math.abs(Math.hypot(y - 1, z) - 0.1) < 1e-6, 'on the radius');
  }
});

test('in the Cisterns water runs up the rock from the pools, and up only; nowhere else', () => {
  const run = (l: Level, n: number) => {
    const [ax, , az] = l.arrival;
    let up = 0, rises = 0, falls = 0;
    for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
      const t = quarryProps(l, Math.floor(ax / PROP_TILE) + i, Math.floor(az / PROP_TILE) + j);
      up += t.counts.uphill;
      const p = t.flow?.positions;
      if (!p) continue;
      // Each sheet starts at its pool's surface and climbs.
      for (let v = 0; v + 2 < p.length / 3; v += 2) {
        if (p[(v + 2) * 3 + 1] > p[v * 3 + 1]) rises++; else falls++;
      }
    }
    return { up, rises, falls };
  };
  const cis = run(new Level(1, 7), 3);
  assert.ok(cis.up >= 3, JSON.stringify(cis));
  assert.ok(cis.rises > cis.falls * 10, JSON.stringify(cis));
  assert.equal(run(new Level(1, 3), 1).up + run(new Level(1, 9), 1).up, 0);
});

test('some Cistern pillars stand on an older drum: round and wider below, the square pillar on top', () => {
  const l = new Level(1, 7), f = l.field;
  const [ax, , az] = l.arrival;
  let older = 0;
  for (let z = az - 150; z < az + 150 && older < 3; z += 1.5) for (let x = ax - 150; x < ax + 150 && older < 3; x += 1.5) {
    const col = l.columnAt(x, z);
    if (col.olderTop === -Infinity || col.pillarD > -0.3) continue;
    // Inside the drum but outside the square: rock below the drum's top, air above it.
    if (col.squareD < 0.3) continue;
    assert.ok(f.at(col, x, col.olderTop - 0.5, z) < 0, 'in the drum');
    assert.ok(f.at(col, x, col.olderTop + 1.5, z) > 0, 'above the drum, beside the pillar');
    older++;
  }
  assert.ok(older >= 3, `${older} older drums`);
  assert.equal(new Level(1, 3).band.older, 0);
});
