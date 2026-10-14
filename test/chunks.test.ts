import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunksAround, DEFAULT_VIEW, CELLS } from '../src/world/chunks';

test('chunks tile space: no overlaps, no gaps inside the visited top-level nodes', () => {
  const view = { ...DEFAULT_VIEW, radius: 300 };
  const ks = chunksAround(37, 12, -55, view);
  // Break every chunk into lod-0 cubes: each cube is claimed at most once.
  const seen = new Set<string>();
  const tops = new Set<string>();
  const up = 2 ** view.maxLod;
  for (const k of ks) {
    const n = 2 ** k.lod;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) for (let c = 0; c < n; c++) {
      const id = `${k.ix * n + a}:${k.iy * n + b}:${k.iz * n + c}`;
      assert.ok(!seen.has(id), `overlap at ${id}`);
      seen.add(id);
    }
    tops.add(`${Math.floor((k.ix * n) / up)}:${Math.floor((k.iz * n) / up)}`);
  }
  // Every lod-0 cube inside the level's height range under a visited top-level column is covered.
  const y0 = view.yMin / CELLS, y1 = view.yMax / CELLS;
  for (const t of tops) {
    const [tx, tz] = t.split(':').map(Number);
    for (let a = 0; a < up; a++) for (let c = 0; c < up; c++) for (let y = y0; y < y1; y++) {
      assert.ok(seen.has(`${tx * up + a}:${y}:${tz * up + c}`), `gap at ${tx * up + a}:${y}:${tz * up + c}`);
    }
  }
});

test('fine near the viewer, coarse far away, nearest first per lod', () => {
  const ks = chunksAround(0, 10, 0);
  const near = ks.filter((k) => k.dist === 0);
  assert.ok(near.length > 0 && near.every((k) => k.lod === 0));
  assert.ok(ks.some((k) => k.lod === DEFAULT_VIEW.maxLod));
  for (let i = 1; i < ks.length; i++) if (ks[i].lod === ks[i - 1].lod) assert.ok(ks[i].dist >= ks[i - 1].dist);
  assert.ok(ks.length < 1500, `too many chunks: ${ks.length}`);
});

test('a chunk marks exactly the sides where a coarser chunk touches it', () => {
  const ks = chunksAround(5, 10, 5);
  const byId = new Map(ks.map((k) => [k.id, k]));
  const leafAt = (lod: number, x: number, y: number, z: number) => {
    for (let l = lod; l <= DEFAULT_VIEW.maxLod; l++) {
      const f = 2 ** (l - lod);
      const k = byId.get(`${l}:${Math.floor(x / f)}:${Math.floor(y / f)}:${Math.floor(z / f)}`);
      if (k) return k;
    }
    return null;
  };
  let marked = 0;
  for (const k of ks) for (let axis = 0; axis < 3; axis++) for (let side = 0; side < 2; side++) {
    const n = [k.ix, k.iy, k.iz];
    n[axis] += side ? 1 : -1;
    const nb = leafAt(k.lod, n[0], n[1], n[2]);
    const want = !!nb && nb.lod > k.lod;
    assert.equal(!!(k.overlap & (1 << (2 * axis + side))), want, `${k.id} axis ${axis} side ${side}`);
    if (want) marked++;
  }
  assert.ok(marked > 10);
});
