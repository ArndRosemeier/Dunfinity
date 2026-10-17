/**
 * The level styles and the edge contract (docs/design/level-styles.md §2, §4): every style alone,
 * and wherever two meet.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hash3f } from '@futuremagic/core';
import { Level } from '../src/gen/level';
import { mixOf } from '../src/gen/bands';
import { newColumn } from '../src/gen/quarry';
import { PASSAGE } from '../src/gen/styledField';
import { MAP_FLOOR } from '../src/gen/style';
import { farFromSurface } from '../src/gen/chunkMesh';

/** Levels with more than one style: level 1 (the workings and one style), and levels of strata near the top and deep (src/gen/genome.ts). */
const MIXED = [1, 4, 7, 9, 25, 45, 61, 131];

/** `n` seeded columns within `span` metres of the arrival on `l`, as (x, z). */
function* spots(l: Level, n: number, span: number, salt: number): Generator<[number, number]> {
  const [ax, , az] = l.arrival;
  for (let k = 0; k < n; k++) yield [ax + (hash3f(salt, k, l.depth, 0) - 0.5) * span, az + (hash3f(salt, k, l.depth, 1) - 0.5) * span];
}

const atEdge = (l: Level, x: number, z: number) => {
  const c = l.columnAt(x, z);
  return !!c.mix || c.passage > -PASSAGE.half * 2;
};

test('each level is made of its band\'s styles; the cellar is one', () => {
  assert.deepEqual(new Level(7, 0).field.styles.map((s) => s.id), ['cellar']);
  for (const d of MIXED) assert.deepEqual(new Level(7, d).field.styles.map((s) => s.id), mixOf(7, d).map(([id]) => id));
  assert.ok(MIXED.some((d) => mixOf(7, d).some(([id]) => id === 'rift')), 'the rift is in some mix');
});

test('the styles cover about their share of a level, and the arrival is in the first', () => {
  for (const d of MIXED) {
    const l = new Level(3, d), mix = l.field.regions.mix, total = mix.reduce((a, [, w]) => a + w, 0), area = mix.map(() => 0);
    let all = 0;
    for (let z = -4000; z <= 4000; z += 80) for (let x = -4000; x <= 4000; x += 80) { all++; area[l.field.regions.styleAt(x, z)]++; }
    mix.forEach(([id, w], i) => {
      if (i === 0) return; // (the first also has the arrival's region)
      assert.ok(Math.abs(area[i] / all - w / total) < 0.12, `level ${d}: ${id} ${((area[i] / all) * 100).toFixed(0)}% of the area, want ${((w / total) * 100).toFixed(0)}%`);
    });
    const [ax, , az] = l.arrival;
    assert.equal(l.field.regions.styleAt(ax, az), 0, `level ${d}: the arrival is in the excavation`);
  }
});

test('away from edges, the field is exactly its style\'s', () => {
  for (const d of MIXED) {
    const l = new Level(1, d);
    let checked = 0;
    for (const [x, z] of spots(l, 3000, 2400, 11)) {
      const c = l.columnAt(x, z);
      if (c.mix || c.passage > -40 || c.clamp < 40) continue;
      const style = l.field.styles[c.style], own = style.column(x, z, newColumn());
      for (const dy of [-3, 1, 5, 12]) {
        const y = c.floor + dy, want = style.at(own, x, y, z);
        // (Where a passage's air is nearer than the style's own, the passage is the answer, E3.)
        if (Math.abs(want) < c.clamp && c.passage < want) assert.equal(l.field.at(c, x, y, z), want, `level ${d} at ${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}`);
      }
      checked++;
    }
    assert.ok(checked > 100, `level ${d}: ${checked} columns checked`);
  }
});

test('E1, E2, E4: across edges the field and the floor are continuous, and no steeper than inside the styles', () => {
  for (const d of MIXED) {
    const l = new Level(1, d), slopes = { edge: [] as number[], core: [] as number[] };
    let floorJump = 0;
    for (const [x, z] of spots(l, 30000, 2400, 12)) {
      const edge = atEdge(l, x, z), c = l.columnAt(x, z), f = c.floor;
      const y = f + hash3f(12, x, z, 2) * 14 - 2, v = l.sdf(x, y, z);
      for (const [dx, dy, dz] of [[0.5, 0, 0], [0, 0.5, 0], [0, 0, 0.5]]) (edge ? slopes.edge : slopes.core).push(Math.abs(l.sdf(x + dx, y + dy, z + dz) - v) / 0.5);
      if (edge) floorJump = Math.max(floorJump, Math.abs(l.columnAt(x + 0.25, z).floor - f), Math.abs(l.columnAt(x, z + 0.25).floor - f));
    }
    const at = (a: number[], q: number) => [...a].sort((p, r) => p - r)[Math.floor(a.length * q)];
    assert.ok(slopes.edge.length > 2000, `level ${d}: ${slopes.edge.length} samples at edges`);
    for (const q of [0.99, 0.999]) assert.ok(at(slopes.edge, q) <= at(slopes.core, q) + 0.15, `level ${d}: at edges the ${q} slope is ${at(slopes.edge, q).toFixed(2)}, inside the styles ${at(slopes.core, q).toFixed(2)}`);
    assert.ok(Math.max(...slopes.edge) < 40, `level ${d}: no jump at an edge (${Math.max(...slopes.edge).toFixed(1)})`);
    assert.ok(floorJump < 1, `level ${d}: the floor jumps ${floorJump.toFixed(2)} m in a quarter metre at an edge`);
  }
});

test('E3: between every two regions of different styles, a passage one can walk through', () => {
  for (const d of MIXED) {
    const l = new Level(1, d), field = l.field, [ax, , az] = l.arrival;
    /** Room for a body at (x, z): air 0.4 m and 1.7 m over the ground. */
    const room = (x: number, z: number) => { const g = l.groundAt(x, z); return l.sdf(x, g + 0.4, z) > 0.05 && l.sdf(x, g + 1.7, z) > 0.1; };
    const done = new Set<string>();
    let borders = 0;
    for (let k = 0; k < 600 && borders < 6; k++) {
      const x = ax + (hash3f(14, k, d, 0) - 0.5) * 2400, z = az + (hash3f(14, k, d, 1) - 0.5) * 2400;
      const a = field.regions.regionAt(x, z), b = field.regions.regionAt(x + 40, z);
      if (a.id === b.id || field.regions.styleAt(x, z) === field.regions.styleAt(x + 40, z) || done.has(`${a.id},${b.id}`)) continue;
      done.add(`${a.id},${b.id}`); done.add(`${b.id},${a.id}`);
      const mx = (a.px + b.px) / 2, mz = (a.pz + b.pz) / 2, at = field.regions.regionAt(mx, mz);
      if (at.id !== a.id && at.id !== b.id) continue; // (they meet elsewhere, not across the middle)
      borders++;
      assert.ok(l.columnAt(mx, mz).passage > PASSAGE.half - 0.5, `level ${d}: a passage through the middle of the border at ${mx.toFixed(0)}, ${mz.toFixed(0)}`);
      // Walk it both ways from the middle, keeping to its middle, until it opens out: room all along.
      for (const [tx, tz] of [[a.px, a.pz], [b.px, b.pz]]) {
        let x = mx, z = mz, hx = tx - mx, hz = tz - mz, n = Math.hypot(hx, hz), steps = 0;
        hx /= n; hz /= n;
        for (; steps < 120; steps++) {
          assert.ok(room(x, z), `level ${d}: room in the passage at ${x.toFixed(0)}, ${z.toFixed(0)}`);
          let best = -Infinity, bx = 0, bz = 0;
          for (let t = -0.8; t <= 0.8; t += 0.2) {
            const c = Math.cos(t), s2 = Math.sin(t), dx = hx * c - hz * s2, dz = hx * s2 + hz * c, p = l.columnAt(x + dx * 2, z + dz * 2).passage;
            if (p > best) { best = p; bx = dx; bz = dz; }
          }
          if (best < PASSAGE.half - 1) break; // (its end: open ground of the style)
          x += bx * 2; z += bz * 2; hx = bx; hz = bz;
        }
        assert.ok(steps < 120 && room(x, z), `level ${d}: the passage ends in open ground (${steps} steps, at ${x.toFixed(0)}, ${z.toFixed(0)})`);
      }
    }
    assert.ok(borders > 0, `level ${d}: some borders between styles`);
  }
});

test('E5: the miners\' things stand only in the excavation\'s own ground', () => {
  for (const d of MIXED) {
    const l = new Level(1, d), share = l.field.excavation.share!;
    let karst = 0;
    for (const [x, z] of spots(l, 2000, 2400, 15)) {
      if (share(x, z) >= 0.9) continue;
      karst++;
      const w = l.workingAt(x, z), [u, v] = l.field.excavation.toGrid(w, x, z);
      const iu = Math.floor(u / w.spacing), iv = Math.floor(v / w.spacing), [px, pz] = l.field.excavation.fromGrid(w, (iu + 0.5) * w.spacing, (iv + 0.5) * w.spacing);
      if (share(px, pz) < 0.9) assert.equal(l.field.excavation.pillarAt(w, iu, iv), 'none', `level ${d}: no pillar in another style's ground`);
    }
    assert.ok(karst > 100);
  }
});

test('E4: a chunk is skipped only if it has no surface, at edges too', () => {
  for (const d of MIXED) {
    const l = new Level(1, d);
    let edgeChunks = 0;
    for (const [x, z] of spots(l, 400, 2000, 16)) {
      if (!atEdge(l, x, z)) continue;
      edgeChunks++;
      const g = l.columnAt(x, z).floor;
      for (const [size, oy] of [[32, g - 16], [64, g - 70], [64, g + 30]] as const) {
        const ox = Math.floor(x / size) * size, oz = Math.floor(z / size) * size, step = size / 16;
        if (!farFromSurface(l, ox, oy, oz, size, step)) continue;
        const grid = l.sampleGrid(ox, oy, oz, step, 17);
        const pos = grid.d.some((v) => v > 0), neg = grid.d.some((v) => v < 0);
        assert.ok(!(pos && neg), `level ${d}: chunk at ${ox}, ${oy.toFixed(0)}, ${oz} (size ${size}) skipped but has a surface`);
      }
    }
    assert.ok(edgeChunks > 20, `level ${d}: ${edgeChunks} chunks at edges`);
  }
});

test('E6: the same level twice is the same, whatever was asked first', () => {
  const a = new Level(5, 9), b = new Level(5, 9);
  const pts = [...spots(a, 300, 2000, 17)];
  const one = pts.map(([x, z]) => a.sdf(x, a.columnAt(x, z).floor + 1.5, z));
  const two = [...pts].reverse().map(([x, z]) => b.sdf(x, b.columnAt(x, z).floor + 1.5, z)).reverse();
  assert.deepEqual(one, two);
});

test('the karst is not the excavation: no pillars, smooth domes, a different share of open floor', () => {
  let karstCols = 0, pillars = 0;
  for (const seed of [1, 2, 3]) {
    const l = new Level(seed, 9);
    for (const [x, z] of spots(l, 4000, 2400, 18)) {
      const c = l.columnAt(x, z);
      if (c.mix || l.field.styles[c.style].id !== 'karst') continue;
      karstCols++;
      if (c.pillarD < 50) pillars++;
    }
  }
  assert.ok(karstCols > 500, `${karstCols} karst columns`);
  assert.equal(pillars, 0);
});

test('a level can be asked to be all one style (?style=): that style but where one arrives, with its way up', () => {
  for (const d of [2, 7]) {
    const l = new Level(1, d, 'karst');
    assert.deepEqual(l.field.styles.map((s) => s.id), ['excavation', 'karst']);
    let karst = 0, all = 0;
    for (let z = -3000; z <= 3000; z += 100) for (let x = -3000; x <= 3000; x += 100) { all++; if (l.field.regions.styleAt(x, z) === 1) karst++; }
    assert.ok(karst / all > 0.95, `level ${d}: karst ${((karst / all) * 100).toFixed(0)}%`);
    const [ax, , az] = l.arrival;
    assert.equal(l.field.regions.styleAt(ax, az), 0);
    assert.ok(l.ascent?.up, `level ${d}: a way up`);
    assert.deepEqual(new Level(1, d, 'karst').key, { seed: 1, depth: d, style: 'karst' });
  }
  assert.deepEqual(new Level(1, 0, 'karst').field.styles.map((s) => s.id), ['cellar']);
});

test('on the map, the caves show apart from the worked stone', () => {
  const [ex, karst] = new Level(1, 9).field.styles;
  assert.equal(ex.mapFloor, undefined);
  assert.ok(karst.mapFloor && karst.mapFloor.join() !== MAP_FLOOR.join());
});
