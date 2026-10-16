/**
 * Style genes (docs/design/generative-depth.md §4.1): a style read with its genes at the ends of their
 * strange ranges still keeps the contract. Its field is no steeper than the style at our standard
 * (E4), its floors stay walkable slopes (E1), and it stays open with room at its portals (E3). Checked
 * for every gene at its low end, every gene at its high end, and seeded mixes of the two.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hash2i, hash3f, hashToFloat } from '@futuremagic/core';
import { bandOf } from '../src/gen/bands';
import { STANDARD, type Gene, type Traits } from '../src/gen/genes';
import { Karst, KARST_GENES } from '../src/gen/karst';
import { Rift, RIFT_GENES } from '../src/gen/rift';
import { Collapse, COLLAPSE_GENES } from '../src/gen/collapse';
import { Fungal, FUNGAL_GENES } from '../src/gen/fungal';
import { Lava, LAVA_GENES } from '../src/gen/lava';
import { Level } from '../src/gen/level';
import { newColumn } from '../src/gen/quarry';
import type { Style } from '../src/gen/style';

/** The styles with genes: how to make one read with given genes, and its genes. */
const GENED: [string, (t: Traits) => Style, Record<string, Gene>][] = [
  ['karst', (t) => new Karst(7, bandOf(45), t), KARST_GENES],
  ['rift', (t) => new Rift(7, bandOf(45), t), RIFT_GENES],
  ['collapse', (t) => new Collapse(7, bandOf(45), t), COLLAPSE_GENES],
  ['fungal', (t) => new Fungal(7, bandOf(45), t), FUNGAL_GENES],
  ['lava', (t) => new Lava(7, bandOf(45), t), LAVA_GENES],
];

/** Every gene low, every gene high, and four seeded mixes of the ends. */
function ends(genes: Gene[]): [string, Traits][] {
  const out: [string, Traits][] = [['low', (g) => g.strange[0]], ['high', (g) => g.strange[1]]];
  for (let m = 0; m < 4; m++) out.push([`mix ${m}`, (g) => (hashToFloat(hash2i(m, genes.indexOf(g), 9)) < 0.5 ? g.strange[0] : g.strange[1])]);
  return out;
}

/** How steep the field gets over `n` seeded probes 0.25 m apart (its 99.9th percentile: a style's own roughness makes the very steepest a matter of luck), the steepest floor, the share of open floor, and the least room at a portal. */
function measure(st: Style, n: number) {
  const c = newColumn(), c2 = newColumn();
  const grads: number[] = [];
  let floor = 0, open = 0, room = Infinity;
  for (let k = 0; k < n; k++) {
    const x = (hash3f(3, k, 0, 0) - 0.5) * 3000, z = (hash3f(3, k, 0, 1) - 0.5) * 3000;
    st.column(x, z, c);
    const y = c.floor + 0.3 + hash3f(3, k, 0, 2) * 15, ax = k % 3, dx = ax === 0 ? 0.25 : 0, dy = ax === 1 ? 0.25 : 0, dz = ax === 2 ? 0.25 : 0;
    st.column(x + dx, z + dz, c2);
    grads.push(Math.abs(st.at(c2, x + dx, y + dy, z + dz) - st.at(c, x, y, z)) / 0.25);
    if (ax !== 1) floor = Math.max(floor, Math.abs(c2.floor - c.floor) / 0.25);
    if (st.at(c, x, c.floor + 1.5, z) > 0.5) open++;
  }
  for (let q = 0; q < 40; q++) {
    const [px, pz] = st.portal(q * 97.3, -q * 61.1);
    if (px === q * 97.3 && pz === -q * 61.1) continue;
    st.column(px, pz, c);
    room = Math.min(room, st.at(c, px, c.floor + 1.5, pz));
  }
  grads.sort((a, b) => a - b);
  return { grad: grads[Math.floor(n * 0.999)], floor, open: open / n, room };
}

for (const [id, make, genes] of GENED) {
  test(`${id} at the ends of its genes keeps the contract: no steeper, walkable floors, open, room at its portals`, () => {
    const std = measure(make(STANDARD), 20000);
    for (const [name, t] of ends(Object.values(genes))) {
      const m = measure(make(t), 20000), at = `${id} ${name}`;
      assert.ok(m.grad <= Math.max(1.3, std.grad * 1.1), `${at}: slope (p99.9) ${m.grad.toFixed(2)} (at our standard ${std.grad.toFixed(2)})`);
      assert.ok(m.floor <= 1.3, `${at}: floor slope ${m.floor.toFixed(2)}`);
      assert.ok(m.open >= 0.08, `${at}: open floor ${(m.open * 100).toFixed(0)}%`);
      assert.ok(m.room >= 0.5, `${at}: ${m.room.toFixed(2)} m of air at a portal`);
    }
  });
}

test('deep levels read the genes: the same style differs between two strata, and a stratum agrees with itself', () => {
  const k = (l: Level) => (l.field.styles.find((s) => s.id === 'karst') as Karst).K;
  const a = k(new Level(1, 131, 'karst')), b = k(new Level(1, 138, 'karst')), c = k(new Level(1, 231, 'karst'));
  assert.deepEqual(a, b, 'two levels of one stratum');
  assert.notDeepEqual(a, c, 'two strata');
});
