import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { EXPLORE, Explored } from '../src/world/explored';
import { MapCells, sheetOf } from '../src/app/mapSheet';

test("the map's shapes: only seen cells, smooth walls along them, contours on the floor", () => {
  const level = new Level(1, 0), seen = new Explored(), c = EXPLORE.cell;
  seen.see(level, 0, 0, 0);
  const sheet = sheetOf(new MapCells(level), seen, -15, -15, 15, 15);
  for (let j = 0; j < sheet.ny; j++) for (let i = 0; i < sheet.nx; i++) {
    assert.equal(!!sheet.cells[j * sheet.nx + i], seen.has(0, sheet.i0 + i, sheet.j0 + j), `cell ${sheet.i0 + i}, ${sheet.j0 + j}`);
  }
  assert.ok(sheet.walls.length > 0 && sheet.ticks.length > 8, 'the cellar walls round the seen floor');
  const near = (x: number, z: number, want: boolean) => [-1, 0, 1].some((a) => [-1, 0, 1].some((b) => seen.has(0, Math.floor(x / c) + a, Math.floor(z / c) + b) === want));
  for (const l of sheet.walls) for (let k = 0; k < l.length; k += 2) {
    assert.ok(near(l[k], l[k + 1], true) && near(l[k], l[k + 1], false), `wall point ${l[k]}, ${l[k + 1]} lies between seen floor and the unseen`);
    if (k) assert.ok(Math.hypot(l[k] - l[k - 2], l[k + 1] - l[k - 1]) < c, 'finely drawn');
  }
  for (const t of sheet.ticks) assert.ok(!seen.has(0, Math.floor((t.x + t.nx * 0.5) / c), Math.floor((t.z + t.nz * 0.5) / c)), 'a tick faces into the unseen rock');
  const k = sheet.contours;
  for (let i = 0; i < k.length; i += 2) assert.ok(seen.has(0, Math.round(k[i] / c - 0.5), Math.round(k[i + 1] / c - 0.5)) || near(k[i], k[i + 1], true), 'contours only on the seen floor');
});

test('up in the village the map shows all of it, buildings as walls, and names the shops and grandma\'s house', async () => {
  const { VILLAGE_KNOWN, VILLAGE_MARKS, inVillage } = await import('../src/app/villageMap');
  const { TOWN } = await import('../src/gen/town');
  const level = new Level(1, 0);
  assert.ok(inVillage(level, TOWN.ground) && !inVillage(level, 0) && !inVillage(new Level(1, 3), TOWN.ground), 'the village is up at street level of depth 0 only');
  const sheet = sheetOf(new MapCells(level, VILLAGE_KNOWN), new Explored(), -60, -40, 20, 40);
  const at = (x: number, z: number) => sheet.cells[(Math.floor(z) - sheet.j0) * sheet.nx + (Math.floor(x) - sheet.i0)];
  assert.ok(at(-19, 0), 'her street, never walked');
  assert.equal(at(-11, 0), null, "grandma's house is a building");
  assert.ok(sheet.walls.length > 10, 'the houses outlined');
  assert.deepEqual(VILLAGE_MARKS.map((m) => m.name).sort(), ["Frau Weber", "Grandma's house", "Ilse's pawn shop", "Kemal's hardware store"]);
});
