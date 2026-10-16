/**
 * The level styles one by one (the lava tubes to the bone hollows): what makes each unlike the others
 * (docs/design/level-styles.md §2). Split from styles.test.ts so the slow ones run side by side.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hash3f } from '@futuremagic/core';
import { Level } from '../src/gen/level';
import { NAMED_STYLES } from '../src/gen/styles';
import { GLYPH, GLYPH_LINES, glyphLine } from '../src/gen/glyph';
import { segDist } from '../src/gen/shapes';
import { KERF } from '../src/lore/scripts';

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

test('the basalt columns are none of them: a floor of column tops, stepping up or down every few metres', () => {
  // (No band has basalt yet, it belongs to the deep strata: a level of it, against the Threshold's and the Salt Works' mixes.)
  const st: Record<string, { walked: number; steps: number }> = {};
  for (const l of [new Level(1, 9, 'basalt'), new Level(1, 9), new Level(1, 3)]) {
    const [ax, , az] = l.arrival;
    for (let k = 0; k < 5000; k++) {
      const x = ax + (hash3f(47, k, 9, 0) - 0.5) * 3000, z = az + (hash3f(47, k, 9, 1) - 0.5) * 3000, c = l.columnAt(x, z);
      if (c.mix || c.passage > -20 || l.sdf(x, c.floor + 1.5, z) <= 0.3) continue;
      const s = (st[l.field.styles[c.style].id] ??= { walked: 0, steps: 0 });
      // Walk up to 16 m over open ground, a metre at a time: how often a terrace's edge, a step of a
      // quarter metre or more with flat ground (within 5 cm) on both sides.
      const h = [l.groundAt(x, z)];
      for (let t = 1; t <= 16; t++) {
        const g = l.groundAt(x + t, z);
        if (!(l.sdf(x + t, g + 1.5, z) > 0.3)) break;
        h.push(g);
      }
      for (let i = 1; i + 2 < h.length; i++) if (Math.abs(h[i + 1] - h[i]) >= 0.25 && Math.abs(h[i] - h[i - 1]) < 0.05 && Math.abs(h[i + 2] - h[i + 1]) < 0.05) s.steps++;
      s.walked += h.length - 1;
    }
  }
  const per10 = (id: string) => (st[id].steps / st[id].walked) * 10;
  assert.ok(st.basalt.walked > 5000, `${st.basalt.walked} m walked on basalt`);
  assert.ok(per10('basalt') > 0.7, `${per10('basalt').toFixed(2)} terrace edges every 10 m on the basalt`);
  for (const id of Object.keys(st)) if (id !== 'basalt' && st[id].walked > 100) assert.ok(per10(id) < per10('basalt') / 3, `${id}: ${per10(id).toFixed(2)} terrace edges every 10 m`);
});

test('the flooded galleries are none of them: water nearly to the roof, a narrow gap to swim in', () => {
  // (The Cisterns hold a little of them; a level all of them, against the Cisterns', the Salt Works' and the Threshold's mixes.)
  const st: Record<string, { n: number; sump: number }> = {};
  for (const l of [new Level(1, 7, 'flooded'), new Level(1, 7), new Level(1, 4), new Level(1, 9)]) {
    const [ax, , az] = l.arrival;
    for (let k = 0; k < 6000; k++) {
      const x = ax + (hash3f(53, k, 7, 0) - 0.5) * 3000, z = az + (hash3f(53, k, 7, 1) - 0.5) * 3000, c = l.columnAt(x, z);
      if (c.mix || c.passage > -20) continue;
      const id = l.field.styles[c.style].id, w = l.waterAt(x, z);
      // An open cave here: air somewhere from the water or the floor up to 15 m over it.
      let open = false;
      for (let y = Math.min(w, c.floor) + 0.2; y < Math.max(w, c.floor) + 15 && !open; y += 0.5) open = l.sdf(x, y, z) > 0.3;
      if (!open) continue;
      const s = (st[id] ??= { n: 0, sump: 0 });
      s.n++;
      // A sump: air at the water, water over a metre deep, rock within 2 m over it.
      if (l.sdf(x, w + 0.15, z) > 0.05 && l.sdf(x, w - 1.2, z) > 0 && l.sdf(x, w + 2, z) <= 0) s.sump++;
    }
  }
  const sump = (id: string) => st[id].sump / st[id].n;
  assert.ok(st.flooded.n > 500, `${st.flooded.n} open flooded columns`);
  assert.ok(sump('flooded') > 0.25, `a sump over ${(sump('flooded') * 100).toFixed(0)}% of the flooded galleries`);
  for (const id of Object.keys(st)) if (id !== 'flooded' && st[id].n > 100) assert.ok(sump(id) < sump('flooded') / 4, `${id}: a sump over ${(sump(id) * 100).toFixed(0)}%`);
});

test('the dwarven halls are none of them: tall carved halls, crossed by chasms that drop far below the floor', () => {
  // (The Old Halls draw them: a level all of them, against the Old Halls', Before People's and the Threshold's mixes.)
  const st: Record<string, { n: number; deep: number }> = {};
  for (const l of [new Level(1, 25, 'dwarven'), new Level(1, 25), new Level(1, 45), new Level(1, 9)]) {
    const [ax, , az] = l.arrival;
    for (let k = 0; k < 5000; k++) {
      const x = ax + (hash3f(59, k, 25, 0) - 0.5) * 3000, z = az + (hash3f(59, k, 25, 1) - 0.5) * 3000, c = l.columnAt(x, z);
      if (c.mix || c.passage > -20 || l.sdf(x, c.floor + 1.5, z) <= 0.3) continue;
      const s = (st[l.field.styles[c.style].id] ??= { n: 0, deep: 0 });
      s.n++;
      // A chasm: open air 15 m under the floor.
      if (l.sdf(x, c.floor - 15, z) > 0.3) s.deep++;
    }
  }
  const deep = (id: string) => st[id].deep / st[id].n;
  assert.ok(st.dwarven.n > 500, `${st.dwarven.n} open dwarven columns`);
  assert.ok(deep('dwarven') > 0.04, `a chasm under ${(deep('dwarven') * 100).toFixed(1)}% of the dwarven halls`);
  for (const id of Object.keys(st)) if (id !== 'dwarven' && st[id].n > 100) assert.ok(deep(id) < deep('dwarven') / 4, `${id}: a chasm under ${(deep(id) * 100).toFixed(1)}%`);
});

test('the elven vaults are none of them: tall naves that narrow to a pointed vault, wide at the floor', () => {
  // (The Old Halls draw them: a level all of them, against the Old Halls', Before People's and the Threshold's mixes.)
  const st: Record<string, { n: number; pointed: number }> = {};
  // How open the cave is at height y round (x, z): air at 2, 4 and 6 m out each way along x and along z, the narrower way.
  const open = (l: Level, x: number, y: number, z: number) => {
    let ax = 0, az = 0;
    for (const r of [-6, -4, -2, 2, 4, 6]) { if (l.sdf(x + r, y, z) > 0) ax++; if (l.sdf(x, y, z + r) > 0) az++; }
    return Math.min(ax, az);
  };
  const roof = (l: Level, x: number, y: number, z: number) => { while (y < 60 && l.sdf(x, y, z) > 0.05) y += Math.max(0.05, l.sdf(x, y, z) * 0.8); return y; };
  for (const l of [new Level(1, 25, 'elven'), new Level(1, 25), new Level(1, 45), new Level(1, 9)]) {
    const [ax, , az] = l.arrival;
    for (let k = 0; k < 3000; k++) {
      const x = ax + (hash3f(61, k, 25, 0) - 0.5) * 3000, z = az + (hash3f(61, k, 25, 1) - 0.5) * 3000, c = l.columnAt(x, z);
      if (c.mix || c.passage > -20 || l.sdf(x, c.floor + 1.5, z) <= 0.3) continue;
      const s = (st[l.field.styles[c.style].id] ??= { n: 0, pointed: 0 });
      s.n++;
      // Pointed: a roof over 18 m up, wide open at the floor, and narrow near the top.
      const r0 = roof(l, x, c.floor + 1.5, z) - c.floor;
      if (r0 >= 18 && open(l, x, c.floor + 3, z) >= 5 && open(l, x, c.floor + 0.9 * r0, z) <= 3) s.pointed++;
    }
  }
  const pointed = (id: string) => st[id].pointed / st[id].n;
  assert.ok(st.elven.n > 500, `${st.elven.n} open elven columns`);
  assert.ok(pointed('elven') > 0.25, `a pointed vault over ${(pointed('elven') * 100).toFixed(0)}% of the elven vaults`);
  for (const id of Object.keys(st)) if (id !== 'elven' && st[id].n > 100) assert.ok(pointed(id) < pointed('elven') / 4, `${id}: a pointed vault over ${(pointed(id) * 100).toFixed(0)}%`);
});

test('the goblin warrens are none of them: low burrows with more burrows over them', () => {
  // (The Old Halls draw them: a level all of them, against the Old Halls', Before People's and the Threshold's mixes.)
  const st: Record<string, { n: number; stacked: number }> = {};
  for (const l of [new Level(1, 25, 'goblin'), new Level(1, 25), new Level(1, 45), new Level(1, 9)]) {
    const [ax, , az] = l.arrival;
    for (let k = 0; k < 3000; k++) {
      const x = ax + (hash3f(67, k, 25, 0) - 0.5) * 3000, z = az + (hash3f(67, k, 25, 1) - 0.5) * 3000, c = l.columnAt(x, z);
      if (c.mix || c.passage > -20 || l.sdf(x, c.floor + 1.5, z) <= 0.3) continue;
      const s = (st[l.field.styles[c.style].id] ??= { n: 0, stacked: 0 });
      s.n++;
      // Stacked: the roof under 4.5 m up, and over it, past a metre of rock or more, air again within 10 m:
      // a burrow, low again (not the open dome over a giant mushroom's cap).
      let y = c.floor + 1.5;
      while (y < c.floor + 6 && l.sdf(x, y, z) > 0) y += 0.25;
      if (y >= c.floor + 4.5) continue;
      let y2 = y;
      while (y2 < y + 10 && l.sdf(x, y2, z) <= 0) y2 += 0.25;
      let y3 = y2;
      while (y3 < y2 + 6 && l.sdf(x, y3, z) > 0) y3 += 0.25;
      if (y2 < y + 10 && y2 - y >= 1 && y3 < y2 + 6) s.stacked++;
    }
  }
  const stacked = (id: string) => st[id].stacked / st[id].n;
  assert.ok(st.goblin.n > 500, `${st.goblin.n} open goblin columns`);
  assert.ok(stacked('goblin') > 0.08, `burrows over burrows over ${(stacked('goblin') * 100).toFixed(1)}% of the goblin warrens`);
  for (const id of Object.keys(st)) if (id !== 'goblin' && st[id].n > 100) assert.ok(stacked(id) < stacked('goblin') / 4, `${id}: stacked over ${(stacked(id) * 100).toFixed(1)}%`);
});

test('the bone hollows are none of them: arched chambers ribbed every few metres, rib after rib', () => {
  // (Before People draw them: a level all of them, against Before People's, the Old Halls' and the Threshold's mixes.)
  const st: Record<string, { n: number; ribbed: number }> = {};
  const roof = (l: Level, x: number, y: number, z: number) => { while (y < 60 && l.sdf(x, y, z) > 0.05) y += Math.max(0.05, l.sdf(x, y, z) * 0.8); return y; };
  for (const l of [new Level(1, 45, 'bones'), new Level(1, 45), new Level(1, 25), new Level(1, 9)]) {
    const [ax, , az] = l.arrival;
    for (let k = 0; k < 3000; k++) {
      const x = ax + (hash3f(71, k, 45, 0) - 0.5) * 3000, z = az + (hash3f(71, k, 45, 1) - 0.5) * 3000, c = l.columnAt(x, z);
      if (c.mix || c.passage > -20 || l.sdf(x, c.floor + 1.5, z) <= 0.3) continue;
      const r0 = roof(l, x, c.floor + 1.5, z) - c.floor;
      if (r0 < 6 || r0 > 20) continue;
      const s = (st[l.field.styles[c.style].id] ??= { n: 0, ribbed: 0 });
      s.n++;
      // Ribbed: along some line through here the roof dips (by 0.8–4 m, staying over 4 m up) twice, 5.5–9.5 m apart: two ribs.
      let ribbed = false;
      for (let a = 0; a < 8 && !ribbed; a++) {
        const dx = Math.cos((a * Math.PI) / 8), dz = Math.sin((a * Math.PI) / 8), r: number[] = [], dips: number[] = [];
        for (let t = -8.5; t <= 8.5; t += 0.5) r.push(roof(l, x + dx * t, c.floor + 1.5, z + dz * t) - c.floor);
        for (let i = 6; i < r.length - 6; i++) {
          const lo = r[i], before = Math.max(...r.slice(i - 6, i)), after = Math.max(...r.slice(i + 1, i + 7));
          if (lo >= 4 && lo <= Math.min(...r.slice(i - 2, i + 3)) && before - lo > 0.8 && after - lo > 0.8 && Math.max(before, after) - lo < 4) dips.push(i * 0.5);
        }
        for (let i = 1; i < dips.length; i++) if (dips[i] - dips[i - 1] >= 5.5 && dips[i] - dips[i - 1] <= 9.5) ribbed = true;
      }
      if (ribbed) s.ribbed++;
    }
  }
  const ribbed = (id: string) => st[id].ribbed / st[id].n;
  assert.ok(st.bones.n > 300, `${st.bones.n} open bone hollow columns`);
  assert.ok(ribbed('bones') > 0.15, `ribbed over ${(ribbed('bones') * 100).toFixed(1)}% of the bone hollows`);
  for (const id of Object.keys(st)) if (id !== 'bones' && st[id].n > 50) assert.ok(ribbed(id) < ribbed('bones') / 4, `${id}: ribbed over ${(ribbed(id) * 100).toFixed(1)}%`);
});

test('the organic gullets are none of them: flesh-coloured tubes ringed every few metres', () => {
  // (The Deep draws them, 61 on: a level all of them, against a deep mix, Before People's and the Threshold's.)
  const st: Record<string, { n: number; flesh: number }> = {};
  const rgb = new Float32Array(3);
  const roof = (l: Level, x: number, y: number, z: number) => { while (y < 60 && l.sdf(x, y, z) > 0.05) y += Math.max(0.05, l.sdf(x, y, z) * 0.8); return y; };
  for (const l of [new Level(1, 75, 'organic'), new Level(1, 75), new Level(1, 45), new Level(1, 9)]) {
    const [ax, , az] = l.arrival;
    for (let k = 0; k < 3000; k++) {
      const x = ax + (hash3f(73, k, 75, 0) - 0.5) * 3000, z = az + (hash3f(73, k, 75, 1) - 0.5) * 3000, c = l.columnAt(x, z);
      if (c.mix || c.passage > -20 || l.sdf(x, c.floor + 1.5, z) <= 0.3) continue;
      const r0 = roof(l, x, c.floor + 1.5, z);
      if (r0 - c.floor > 14) continue;
      const s = (st[l.field.styles[c.style].id] ??= { n: 0, flesh: 0 });
      s.n++;
      // Flesh: a strong colour overhead (not ivory, not stone), and along some line through here the roof dips twice, 4–9 m apart: two rings.
      l.field.color(c, x, r0, z, rgb, 0);
      if (Math.max(...rgb) - Math.min(...rgb) < 0.25) continue;
      let ringed = false;
      for (let a = 0; a < 8 && !ringed; a++) {
        const dx = Math.cos((a * Math.PI) / 8), dz = Math.sin((a * Math.PI) / 8), r: number[] = [], dips: number[] = [];
        for (let t = -7; t <= 7; t += 0.5) r.push(roof(l, x + dx * t, c.floor + 1.5, z + dz * t) - c.floor);
        for (let i = 4; i < r.length - 4; i++) {
          const lo = r[i], before = Math.max(...r.slice(i - 4, i)), after = Math.max(...r.slice(i + 1, i + 5));
          if (lo >= 3 && lo <= Math.min(...r.slice(i - 2, i + 3)) && before - lo > 0.35 && after - lo > 0.35) dips.push(i * 0.5);
        }
        for (let i = 1; i < dips.length; i++) if (dips[i] - dips[i - 1] >= 4 && dips[i] - dips[i - 1] <= 9) ringed = true;
      }
      if (ringed) s.flesh++;
    }
  }
  const flesh = (id: string) => st[id].flesh / st[id].n;
  console.log(Object.entries(st).map(([id, s]) => `${id} ${s.n} ${(flesh(id) * 100).toFixed(1)}%`).join(', '));
  assert.ok(st.organic.n > 300, `${st.organic.n} open organic columns`);
  assert.ok(flesh('organic') > 0.15, `ringed flesh over ${(flesh('organic') * 100).toFixed(1)}% of the gullets`);
  for (const id of Object.keys(st)) if (id !== 'organic' && st[id].n > 50) assert.ok(flesh(id) < flesh('organic') / 4, `${id}: ringed flesh over ${(flesh(id) * 100).toFixed(1)}%`);
});

test('the glyph-cut halls are none of them: straight-walled slots a few metres wide, a house tall, under a flat roof', () => {
  // (The Deep draws them, 61 on: a level all of them, against a deep mix, Before People's and the Threshold's.)
  const st: Record<string, { n: number; slot: number }> = {};
  const roof = (l: Level, x: number, y: number, z: number) => { while (y < 60 && l.sdf(x, y, z) > 0.05) y += Math.max(0.05, l.sdf(x, y, z) * 0.8); return y; };
  for (const l of [new Level(1, 75, 'glyph'), new Level(1, 75), new Level(1, 45), new Level(1, 9)]) {
    const [ax, , az] = l.arrival;
    // How wide the air is across (x, z) along (dx, dz) at y, metres (up to 20).
    const across = (x: number, y: number, z: number, dx: number, dz: number) => {
      let w = 0;
      for (const s of [1, -1]) for (let t = 0.25; t < 10; t += 0.25, w += 0.25) if (l.sdf(x + dx * t * s, y, z + dz * t * s) <= 0) break;
      return w;
    };
    for (let k = 0; k < 3000; k++) {
      const x = ax + (hash3f(79, k, 75, 0) - 0.5) * 3000, z = az + (hash3f(79, k, 75, 1) - 0.5) * 3000, c = l.columnAt(x, z);
      if (c.mix || c.passage > -20 || l.sdf(x, c.floor + 1.5, z) <= 0.3) continue;
      const s = (st[l.field.styles[c.style].id] ??= { n: 0, slot: 0 });
      s.n++;
      // A slot: narrowest across 3–7 m, the same at knee and at 9 m up, and the roof over it flat across.
      const r0 = roof(l, x, c.floor + 1.5, z) - c.floor;
      if (r0 < 10) continue;
      let best = Infinity, a = 0;
      for (let i = 0; i < 8; i++) { const w = across(x, c.floor + 1.5, z, Math.cos((i * Math.PI) / 8), Math.sin((i * Math.PI) / 8)); if (w < best) { best = w; a = (i * Math.PI) / 8; } }
      const dx = Math.cos(a), dz = Math.sin(a);
      if (best < 3 || best > 7 || Math.abs(across(x, c.floor + 9, z, dx, dz) - best) > 0.6) continue;
      const roofs = [-1, 1].map((t) => roof(l, x + dx * t, c.floor + 1.5, z + dz * t) - c.floor);
      if (Math.max(...roofs.map((q) => Math.abs(q - r0))) < 0.3) s.slot++;
    }
  }
  const slot = (id: string) => st[id].slot / st[id].n;
  console.log(Object.entries(st).map(([id, s]) => `${id} ${s.n} ${(slot(id) * 100).toFixed(1)}%`).join(', '));
  assert.ok(st.glyph.n > 300, `${st.glyph.n} open glyph-cut columns`);
  assert.ok(slot('glyph') > 0.4, `straight slots under ${(slot('glyph') * 100).toFixed(1)}% of the glyph-cut halls`);
  for (const id of Object.keys(st)) if (id !== 'glyph' && st[id].n > 50) assert.ok(slot(id) < slot('glyph') / 4, `${id}: straight slots under ${(slot(id) * 100).toFixed(1)}%`);
});

test('the floating islands are none of them: air under the floor, a void with islands hanging in it', () => {
  // (The Deep draws them, 61 on: a level all of them, against a deep mix and the Threshold's.)
  const st: Record<string, { n: number; void: number }> = {};
  for (const l of [new Level(1, 75, 'floating'), new Level(1, 75), new Level(1, 9)]) {
    const [ax, , az] = l.arrival;
    for (let k = 0; k < 4000; k++) {
      const x = ax + (hash3f(83, k, 75, 0) - 0.5) * 3000, z = az + (hash3f(83, k, 75, 1) - 0.5) * 3000, c = l.columnAt(x, z);
      if (c.mix || c.passage > -20) continue;
      const s = (st[l.field.styles[c.style].id] ??= { n: 0, void: 0 });
      s.n++;
      // Open air 25 m under the floor, and more under that.
      const f = c.floor;
      if (l.sdf(x, f - 25, z) > 0.5 && l.sdf(x, f - 40, z) > 0.5) s.void++;
    }
  }
  const share = (id: string) => st[id].void / st[id].n;
  console.log(Object.entries(st).map(([id, s]) => `${id} ${s.n} ${(share(id) * 100).toFixed(1)}%`).join(', '));
  assert.ok(share('floating') > 0.08, `a void under ${(share('floating') * 100).toFixed(1)}% of the floating level`);
  for (const id of Object.keys(st)) if (id !== 'floating' && st[id].n > 50) assert.ok(share(id) < share('floating') / 8, `${id}: a void under ${(share(id) * 100).toFixed(1)}%`);
});

test('every Kerf rune cut in the glyph-cut halls reaches a ruled line, so every stroke can be walked to', () => {
  for (const [r, segs] of Object.entries(KERF)) {
    // Join strokes that touch or cross; the rune is reachable when every stroke is joined to one on y = 0 or y = 2.
    const on = (s: readonly number[], y: number) => s[1] === y || s[3] === y;
    const touch = (p: readonly number[], q: readonly number[]) => Array.from({ length: 101 }, (_, i) => i / 100).some((t) => segDist(q[0] + (q[2] - q[0]) * t, q[1] + (q[3] - q[1]) * t, p[0], p[1], p[2], p[3]) < 1e-3);
    const reached = new Set<number>();
    segs.forEach((s, i) => { if (on(s, 0) || on(s, 2)) reached.add(i); });
    for (let grew = true; grew;) { grew = false; segs.forEach((s, i) => { if (!reached.has(i) && [...reached].some((j) => touch(segs[j], s))) { reached.add(i); grew = true; } }); }
    assert.equal(reached.size, segs.length, `rune ${r}: ${segs.length - reached.size} strokes cut off`);
  }
  const line = glyphLine(GLYPH_LINES[0], GLYPH.gap, GLYPH.space);
  assert.equal(line.words.length, 7);
});

test('no style is cut through one rock alone: each names several, none more than 80% (Arnd: walls are mixed rock)', () => {
  for (const id of NAMED_STYLES) {
    const l = new Level(1, 25, id), st = l.field.styles.find((s) => s.id === id)!;
    assert.ok(st.rocks, `${id} names its rock`);
    const sum = st.rocks.reduce((a, b) => a + b, 0), kinds = st.rocks.filter((w) => w > 0).length;
    assert.ok(kinds >= 2 && Math.max(...st.rocks) / sum <= 0.8, `${id}: ${kinds} rocks, the most ${((Math.max(...st.rocks) / sum) * 100).toFixed(0)}%`);
  }
});
