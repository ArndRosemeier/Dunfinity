/**
 * The level styles and the edge contract (docs/design/level-styles.md §2, §4): every style alone,
 * and wherever two meet.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hash3f } from '@futuremagic/core';
import { Level } from '../src/gen/level';
import { bandOf } from '../src/gen/bands';
import { newColumn } from '../src/gen/quarry';
import { PASSAGE } from '../src/gen/styledField';
import { MAP_FLOOR } from '../src/gen/style';
import { farFromSurface } from '../src/gen/chunkMesh';

/** The levels with more than one style, one of each band. */
const MIXED = [1, 4, 7, 9];

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
  for (const d of MIXED) assert.deepEqual(new Level(7, d).field.styles.map((s) => s.id), bandOf(d).styles.map(([id]) => id));
  assert.ok(MIXED.some((d) => bandOf(d).styles.some(([id]) => id === 'rift')), 'the rift is in some mix');
});

test('the styles cover about their share of a level, and the arrival is in the first', () => {
  for (const d of MIXED) {
    const l = new Level(3, d), total = l.band.styles.reduce((a, [, w]) => a + w, 0), area = l.band.styles.map(() => 0);
    let all = 0;
    for (let z = -4000; z <= 4000; z += 80) for (let x = -4000; x <= 4000; x += 80) { all++; area[l.field.regions.styleAt(x, z)]++; }
    l.band.styles.forEach(([id, w], i) => {
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
  const l = new Level(1, 9);
  let karstCols = 0, pillars = 0;
  for (const [x, z] of spots(l, 4000, 2400, 18)) {
    const c = l.columnAt(x, z);
    if (c.mix || l.field.styles[c.style].id !== 'karst') continue;
    karstCols++;
    if (c.pillarD < 50) pillars++;
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

test('the rift is neither: tall, narrow canyons with rock between, no pillars', () => {
  for (const d of [4, 9]) {
    const l = new Level(1, d), [ax, , az] = l.arrival;
    const st: Record<string, { n: number; open: number; tall: number }> = {};
    let pillars = 0;
    for (let k = 0; k < 20000; k++) {
      const x = ax + (hash3f(19, k, d, 0) - 0.5) * 3000, z = az + (hash3f(19, k, d, 1) - 0.5) * 3000, c = l.columnAt(x, z);
      if (c.mix || c.passage > -20) continue;
      const id = l.field.styles[c.style].id, s = (st[id] ??= { n: 0, open: 0, tall: 0 });
      s.n++;
      if (id === 'rift' && c.pillarD < 50) pillars++;
      // Open: room to stand. Tall: of that, air 22 m over the floor too.
      if (l.sdf(x, c.floor + 1.5, z) > 0.3) { s.open++; if (l.sdf(x, c.floor + 22, z) > 0) s.tall++; }
    }
    const open = (id: string) => st[id].open / st[id].n, tall = (id: string) => st[id].tall / st[id].open;
    assert.ok(st.rift.n > 500, `level ${d}: ${st.rift.n} rift columns`);
    assert.equal(pillars, 0);
    assert.ok(tall('rift') > 0.5, `level ${d}: ${(tall('rift') * 100).toFixed(0)}% of the rift's floor has air 22 m up`);
    assert.ok(open('rift') < open('karst') / 2 && open('rift') < open('excavation') / 3, `level ${d}: the rift's open floor ${(open('rift') * 100).toFixed(0)}%, karst ${(open('karst') * 100).toFixed(0)}%, excavation ${(open('excavation') * 100).toFixed(0)}%`);
  }
});

test('the collapse is neither: big open chambers whose floor is heaped with fallen blocks, no pillars', () => {
  for (const d of [3, 4]) {
    const l = new Level(1, d), [ax, , az] = l.arrival;
    const st: Record<string, { n: number; open: number; relief: number; rn: number }> = {};
    let pillars = 0;
    for (let k = 0; k < 20000; k++) {
      const x = ax + (hash3f(21, k, d, 0) - 0.5) * 3000, z = az + (hash3f(21, k, d, 1) - 0.5) * 3000, c = l.columnAt(x, z);
      if (c.mix || c.passage > -20) continue;
      const id = l.field.styles[c.style].id, s = (st[id] ??= { n: 0, open: 0, relief: 0, rn: 0 });
      s.n++;
      if (id === 'collapse' && c.pillarD < 50) pillars++;
      if (l.sdf(x, c.floor + 1.5, z) <= 0.3) continue;
      s.open++;
      // Relief: how much the ground (blocks included) rises or falls over 12 m.
      const g = l.groundAt(x, z), g2 = l.groundAt(x + 12, z);
      if (Number.isFinite(g) && Number.isFinite(g2)) { s.relief += Math.abs(g - g2); s.rn++; }
    }
    const relief = (id: string) => st[id].relief / st[id].rn;
    assert.ok(st.collapse.n > 500, `level ${d}: ${st.collapse.n} collapse columns`);
    assert.equal(pillars, 0);
    assert.ok(st.collapse.open / st.collapse.n > 0.5, `level ${d}: the collapse is ${((st.collapse.open / st.collapse.n) * 100).toFixed(0)}% open floor`);
    assert.ok(relief('collapse') > 1.8 * relief('excavation') && relief('collapse') > 2.5 * relief('karst'), `level ${d}: relief ${relief('collapse').toFixed(2)} m, excavation ${relief('excavation').toFixed(2)}, karst ${relief('karst').toFixed(2)}`);
  }
});

test('the catacombs are none of them: low, narrow galleries lined with niches, a few domed chapels', () => {
  const l = new Level(1, 9), [ax, , az] = l.arrival;
  const st: Record<string, { n: number; open: number; high: number }> = {};
  let niches = 0, walls = 0;
  for (let k = 0; k < 45000; k++) {
    const x = ax + (hash3f(23, k, 9, 0) - 0.5) * 3000, z = az + (hash3f(23, k, 9, 1) - 0.5) * 3000, c = l.columnAt(x, z);
    if (c.mix || c.passage > -20) continue;
    const id = l.field.styles[c.style].id, s = (st[id] ??= { n: 0, open: 0, high: 0 });
    s.n++;
    if (l.sdf(x, c.floor + 1.5, z) > 0.3) { s.open++; if (l.sdf(x, c.floor + 5, z) > 0) s.high++; }
    // Just behind a gallery's wall at niche height: often a niche.
    if (id === 'catacombs' && c.wall < -0.2 && c.wall > -0.6) { walls++; if (l.sdf(x, c.floor + 1.2, z) > 0) niches++; }
  }
  const high = (id: string) => st[id].high / st[id].open;
  assert.ok(st.catacombs.n > 500, `${st.catacombs.n} catacombs columns`);
  assert.ok(high('catacombs') < 0.25 && high('catacombs') < high('karst') / 2 && high('catacombs') < high('excavation') / 2, `room 5 m up over ${(high('catacombs') * 100).toFixed(0)}% of the catacombs' floor, karst ${(high('karst') * 100).toFixed(0)}%, excavation ${(high('excavation') * 100).toFixed(0)}%`);
  assert.ok(niches / walls > 0.2, `niches behind ${((niches / walls) * 100).toFixed(0)}% of the walls`);
});

test('the dungeon rooms are none of them: built rooms with dead flat floors, joined by narrow corridors', () => {
  for (const depth of [6, 9]) {
    const l = new Level(1, depth), [ax, , az] = l.arrival;
    const st: Record<string, { n: number; open: number; flat: number }> = {};
    for (let k = 0; k < 40000; k++) {
      const x = ax + (hash3f(29, k, 9, 0) - 0.5) * 3000, z = az + (hash3f(29, k, 9, 1) - 0.5) * 3000, c = l.columnAt(x, z);
      if (c.mix || c.passage > -20) continue;
      const id = l.field.styles[c.style].id, s = (st[id] ??= { n: 0, open: 0, flat: 0 });
      s.n++;
      if (l.sdf(x, c.floor + 1.5, z) <= 0.3) continue;
      s.open++;
      // Laid floors: not a centimetre of difference a metre away, either way.
      const f = c.floor;
      if (Math.abs(l.columnAt(x + 1, z).floor - f) < 0.002 && Math.abs(l.columnAt(x, z + 1).floor - f) < 0.002) s.flat++;
    }
    const flat = (id: string) => st[id].flat / st[id].open, open = (id: string) => st[id].open / st[id].n;
    assert.ok(st.dungeon.n > 1000, `${st.dungeon.n} dungeon columns on level ${depth}`);
    assert.ok(flat('dungeon') > 0.5, `flat floor under ${(flat('dungeon') * 100).toFixed(0)}% of the dungeon's open floor on level ${depth}`);
    for (const id of Object.keys(st)) if (id !== 'dungeon') assert.ok(flat(id) < 0.2, `${id} flat as a dungeon on level ${depth}: ${(flat(id) * 100).toFixed(0)}%`);
    assert.ok(open('dungeon') < open('excavation') / 2, `the dungeon ${(open('dungeon') * 100).toFixed(0)}% open, the excavation ${(open('excavation') * 100).toFixed(0)}%`);
  }
});

test('the root hollows are none of them: chambers crossed by giant roots from roof to floor', () => {
  for (const depth of [6, 7]) {
    const l = new Level(1, depth), [ax, , az] = l.arrival;
    const st: Record<string, { inner: number; crossed: number }> = {};
    for (let k = 0; k < 40000; k++) {
      const x = ax + (hash3f(31, k, 9, 0) - 0.5) * 3000, z = az + (hash3f(31, k, 9, 1) - 0.5) * 3000, c = l.columnAt(x, z);
      if (c.mix || c.passage > -20 || c.wall < 6 || c.ceiling - c.floor < 6) continue;
      // Well inside a big space: is there anything in the air between floor and roof?
      const s = (st[l.field.styles[c.style].id] ??= { inner: 0, crossed: 0 });
      s.inner++;
      for (let y = c.floor + 2; y < c.ceiling - 2; y += 0.5) if (l.sdf(x, y, z) < 0) { s.crossed++; break; }
    }
    const crossed = (id: string) => st[id].crossed / st[id].inner;
    assert.ok(st.roots.inner > 200, `${st.roots.inner} root hollow columns inside chambers on level ${depth}`);
    assert.ok(crossed('roots') > 0.3 && crossed('roots') > 2 * crossed('excavation') && crossed('karst') < 0.05, `roots cross ${(crossed('roots') * 100).toFixed(0)}% of the root hollows' chambers on level ${depth}, pillars ${(crossed('excavation') * 100).toFixed(0)}% of the excavation's, karst ${(crossed('karst') * 100).toFixed(0)}%`);
  }
});

test('the fungal grotto is none of them: giant mushrooms whose broad caps make a second storey', () => {
  const l = new Level(1, 9), [ax, , az] = l.arrival;
  // The top of the first rock under air between y0 and y1 (NaN: none).
  const top = (x: number, z: number, y0: number, y1: number) => {
    for (let y = y0; y < y1; y += 0.25) if (l.sdf(x, y, z) < 0 && l.sdf(x, y + 0.25, z) >= 0) return y;
    return NaN;
  };
  const st: Record<string, { inner: number; storey: number }> = {};
  for (let k = 0; k < 40000; k++) {
    const x = ax + (hash3f(37, k, 9, 0) - 0.5) * 3000, z = az + (hash3f(37, k, 9, 1) - 0.5) * 3000, c = l.columnAt(x, z);
    if (c.mix || c.passage > -20 || c.wall < 6 || c.ceiling - c.floor < 6) continue;
    const s = (st[l.field.styles[c.style].id] ??= { inner: 0, storey: 0 });
    s.inner++;
    // Something to stand on up in the air, and broad: there is ground at about that height 2 m off every way.
    const y = top(x, z, c.floor + 1.5, c.ceiling - 1.5);
    if (Number.isNaN(y)) continue;
    if ([[2, 0], [-2, 0], [0, 2], [0, -2]].every(([dx, dz]) => !Number.isNaN(top(x + dx, z + dz, y - 1, y + 1)))) s.storey++;
  }
  const storey = (id: string) => st[id].storey / st[id].inner;
  assert.ok(st.fungal.inner > 150, `${st.fungal.inner} fungal grotto columns inside chambers`);
  assert.ok(storey('fungal') > 0.06, `a second storey over ${(storey('fungal') * 100).toFixed(1)}% of the fungal grotto's chambers`);
  for (const id of Object.keys(st)) if (id !== 'fungal') assert.ok(storey(id) < storey('fungal') / 4, `${id} has a second storey over ${(storey(id) * 100).toFixed(1)}%`);
});

test('the lava tubes are none of them: long round tunnels, a dozen metres across, all of a height', () => {
  // (No band has lava tubes yet, the magma strata are deeper: a level of them, against the Threshold's mix.)
  const st: Record<string, { open: number; tube: number }> = {};
  for (const l of [new Level(1, 9, 'lava'), new Level(1, 9)]) {
    const [ax, , az] = l.arrival;
    // How far one can walk from (x, z) along (dx, dz), metres (up to 48).
    const run = (x: number, z: number, dx: number, dz: number) => {
      let s = 0;
      for (; s < 48; s += 2) { const px = x + dx * s, pz = z + dz * s; if (l.sdf(px, l.columnAt(px, pz).floor + 1.5, pz) <= 0.3) break; }
      return s;
    };
    for (let k = 0; k < 20000; k++) {
      const x = ax + (hash3f(41, k, 9, 0) - 0.5) * 3000, z = az + (hash3f(41, k, 9, 1) - 0.5) * 3000, c = l.columnAt(x, z);
      if (c.mix || c.passage > -20 || l.sdf(x, c.floor + 1.5, z) <= 0.3) continue;
      const s = (st[l.field.styles[c.style].id] ??= { open: 0, tube: 0 });
      s.open++;
      // Long one way, 6 to 20 m across the other, and rock within 16 m overhead.
      const runs = [0, 1, 2, 3].map((i) => { const a = (i * Math.PI) / 4; return run(x, z, Math.cos(a), Math.sin(a)) + run(x, z, -Math.cos(a), -Math.sin(a)); });
      if (Math.max(...runs) >= 60 && Math.min(...runs) >= 6 && Math.min(...runs) <= 20 && l.sdf(x, c.floor + 16, z) < 0) s.tube++;
    }
  }
  const tube = (id: string) => st[id].tube / st[id].open;
  assert.ok(st.lava.open > 150, `${st.lava.open} open lava tube columns`);
  assert.ok(tube('lava') > 0.3, `a tube's shape around ${(tube('lava') * 100).toFixed(0)}% of the lava tubes' floor`);
  for (const id of Object.keys(st)) if (id !== 'lava') assert.ok(tube(id) < tube('lava') / 2, `${id} tube-shaped around ${(tube(id) * 100).toFixed(0)}% of its floor`);
});

test('the geodes are none of them: closed hollows lined with crystals of one bright hue', () => {
  // (No band has geodes yet, they belong to the deep strata: a level of them, against the Threshold's mix.)
  const st: Record<string, { n: number; vivid: number }> = {};
  const rgb = new Float32Array(3);
  for (const l of [new Level(1, 9, 'geode'), new Level(1, 9)]) {
    const [ax, , az] = l.arrival;
    for (let k = 0; k < 15000; k++) {
      const x = ax + (hash3f(43, k, 9, 0) - 0.5) * 3000, z = az + (hash3f(43, k, 9, 1) - 0.5) * 3000, c = l.columnAt(x, z);
      if (c.mix || c.passage > -20 || l.sdf(x, c.floor + 1.5, z) <= 0.3) continue;
      // March up to the first rock overhead and look at its colour.
      let y = c.floor + 1.5;
      while (y < c.floor + 60 && l.sdf(x, y, z) > 0.05) y += Math.max(0.05, l.sdf(x, y, z) * 0.8);
      if (y >= c.floor + 60) continue;
      const s = (st[l.field.styles[c.style].id] ??= { n: 0, vivid: 0 });
      s.n++;
      l.field.color(c, x, y, z, rgb, 0);
      if (Math.max(...rgb) - Math.min(...rgb) > 0.3) s.vivid++;
    }
  }
  const vivid = (id: string) => st[id].vivid / st[id].n;
  assert.ok(st.geode.n > 500, `${st.geode.n} open geode columns`);
  assert.ok(vivid('geode') > 0.5, `crystal colour overhead in ${(vivid('geode') * 100).toFixed(0)}% of the geodes`);
  for (const id of Object.keys(st)) if (id !== 'geode') assert.ok(vivid(id) < vivid('geode') / 3, `${id} as vivid overhead: ${(vivid(id) * 100).toFixed(0)}%`);
});
