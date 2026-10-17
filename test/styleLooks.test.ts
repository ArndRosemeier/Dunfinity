/**
 * The level styles one by one (the rift to the fungal grotto): what makes each unlike the others
 * (docs/design/level-styles.md §2). Split from styles.test.ts so the slow ones run side by side.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hash3f } from '@futuremagic/core';
import { Level } from '../src/gen/level';
import { withStyles } from './where';

test('the rift is neither: tall, narrow canyons with rock between, no pillars', () => {
  for (const [seed, d] of [0, 1].map((n) => withStyles(['rift', 'karst'], n))) {
    const l = new Level(seed, d), [ax, , az] = l.arrival;
    const st: Record<string, { n: number; open: number; tall: number }> = {};
    let pillars = 0;
    for (let k = 0; k < 20000; k++) {
      const x = ax + (hash3f(19, k, d, 0) - 0.5) * 4000, z = az + (hash3f(19, k, d, 1) - 0.5) * 4000, c = l.columnAt(x, z);
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
  for (const [seed, d] of [0, 1].map((n) => withStyles(['collapse', 'karst'], n))) {
    const l = new Level(seed, d), [ax, , az] = l.arrival;
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
  const l = new Level(...withStyles(['catacombs', 'karst'])), [ax, , az] = l.arrival;
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
  for (const [seed, depth] of [0, 1].map((n) => withStyles(['dungeon'], n, 0.08))) {
    const l = new Level(seed, depth), [ax, , az] = l.arrival;
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
  for (const [seed, depth] of [0, 1].map((n) => withStyles(['roots', 'karst'], n))) {
    const l = new Level(seed, depth), [ax, , az] = l.arrival;
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
    assert.ok(st.roots.inner > 150, `${st.roots.inner} root hollow columns inside chambers on level ${depth}`);
    assert.ok(crossed('roots') > 0.3 && crossed('roots') > 2 * crossed('excavation') && crossed('karst') < 0.05, `roots cross ${(crossed('roots') * 100).toFixed(0)}% of the root hollows' chambers on level ${depth}, pillars ${(crossed('excavation') * 100).toFixed(0)}% of the excavation's, karst ${(crossed('karst') * 100).toFixed(0)}%`);
  }
});

test('the fungal grotto is none of them: giant mushrooms whose broad caps make a second storey', () => {
  const l = new Level(...withStyles(['fungal'])), [ax, , az] = l.arrival;
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
