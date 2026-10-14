import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { meshChunk } from '../src/gen/chunkMesh';

const level = new Level(1, 1);

test('the field is deterministic per seed and depth, and differs between them', () => {
  const a = new Level(1, 1), b = new Level(1, 1), c = new Level(2, 1), d = new Level(1, 2);
  const pts = [[0, 5, 0], [120, 8, -40], [-333, 20, 777]];
  for (const [x, y, z] of pts) assert.equal(a.sdf(x, y, z), b.sdf(x, y, z));
  assert.ok(pts.some(([x, y, z]) => a.sdf(x, y, z) !== c.sdf(x, y, z)));
  assert.ok(pts.some(([x, y, z]) => a.sdf(x, y, z) !== d.sdf(x, y, z)));
});

test('the spawn point is in open air above a floor', () => {
  const [x, y, z] = level.spawn();
  assert.ok(level.sdf(x, y, z) > 2);
  assert.ok(y - level.floorAt(x, z) > 5);
});

test('big, mostly open halls: at head height about half to most of a square km is air', () => {
  let air = 0, n = 0;
  for (let x = -500; x < 500; x += 13) for (let z = -500; z < 500; z += 13) {
    n++;
    if (level.sdf(x, level.floorAt(x, z) + 2, z) > 0) air++;
  }
  const share = air / n;
  assert.ok(share > 0.4 && share < 0.9, `air share ${share.toFixed(2)}`);
});

test('pillars stand in the halls: a walk across a hall passes rock and air in turn', () => {
  const [x0, , z0] = level.spawn();
  let changes = 0, prev = true;
  for (let t = -120; t <= 120; t += 0.5) {
    const x = x0 + t, z = z0 + t * 0.3;
    const air = level.sdf(x, level.floorAt(x, z) + 2, z) > 0;
    if (air !== prev) changes++;
    prev = air;
  }
  assert.ok(changes >= 6, `only ${changes} rock/air changes`);
});

test('chunk skipping is safe: a chunk skipped as far from rock surfaces really has none', () => {
  // meshChunk skips a chunk by one sample at its centre, trusting the field to be close to a distance.
  let skipped = 0;
  for (let i = 0; i < 160; i++) {
    const lod = i % 3, step = 2 ** lod, size = 32 * step;
    const ox = (((i * 7919) % 41) - 20) * size, oy = ((i % 4) - 1) * size, oz = (((i * 104729) % 37) - 18) * size;
    const r = { ox, oy, oz, step, cells: 32, lod, colorMode: 'rock' as const, overlap: 0 };
    if (meshChunk(level, r) !== null) continue;
    const half = size / 2;
    if (Math.abs(level.sdf(ox + half, oy + half, oz + half)) <= half * Math.sqrt(3) + 3 + step * 2) continue; // sampled, not skipped
    skipped++;
    const g = level.sampleGrid(ox, oy, oz, step * 4, 9);
    const sign = g.d[0] < 0;
    assert.ok(g.d.every((v) => (v < 0) === sign), `skipped chunk ${ox},${oy},${oz} lod ${lod} has a surface`);
  }
  assert.ok(skipped > 20, `only ${skipped} skipped chunks checked`);
});

test('a chunk at the spawn meshes; one deep in the rock or high in the air does not', () => {
  const [x, y, z] = level.spawn();
  const req = (ox: number, oy: number, oz: number, step = 1) => ({ ox, oy, oz, step, cells: 32, lod: 0, colorMode: 'rock' as const, overlap: 0 });
  const m = meshChunk(level, req(Math.floor(x / 32) * 32, Math.floor((level.floorAt(x, z) - 4) / 32) * 32, Math.floor(z / 32) * 32));
  assert.ok(m && m.indices.length > 300 && m.colors.length === m.positions.length);
  assert.equal(meshChunk(level, req(0, -2048, 0)), null);
  assert.equal(meshChunk(level, req(0, 2048, 0)), null);
  void y;
});
