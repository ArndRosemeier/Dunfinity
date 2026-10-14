import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { Rats, RAT } from '../src/creatures/rats';
import { FIND, FINDS, Finds, Pack } from '../src/loot/finds';

const level = new Level(1, 1);
const rats = new Rats(level);
const finds = (taken = new Set<number>()) => new Finds(level, (i, j) => rats.nestAt(i, j), taken);
const [ax, , az] = level.arrival;

test("finds lie in the rats' cells, so hoards line up with nests", () => {
  assert.equal(FIND.cell, RAT.cell);
});

test('finds are the same for the same level, lie on open floor and none at the arrival', () => {
  const a = finds().near(ax, az, 300), b = finds().near(ax, az, 300);
  assert.ok(a.length > 40, `plenty of finds (${a.length})`);
  assert.deepEqual(a, b);
  assert.equal(new Set(a.map((f) => f.id)).size, a.length, 'ids are unique');
  for (const f of a) {
    assert.ok(Math.hypot(f.x - ax, f.z - az) >= FIND.quiet);
    assert.ok(level.sdf(f.x, f.y + 0.5, f.z) > 0.2, 'air over a find');
    const [lo, hi] = FINDS[f.kind].value;
    assert.ok(f.value >= lo && f.value <= hi);
  }
});

test('nests hoard finds, rings only there', () => {
  const all = finds().near(ax, az, 400);
  const nests: { x: number; z: number }[] = [];
  const ci = Math.floor(ax / RAT.cell), cj = Math.floor(az / RAT.cell);
  for (let j = cj - 13; j <= cj + 13; j++) for (let i = ci - 13; i <= ci + 13; i++) { const n = rats.nestAt(i, j); if (n) nests.push(n); }
  const byNest = all.filter((f) => nests.some((n) => Math.hypot(n.x - f.x, n.z - f.z) <= FIND.spread + 1e-6));
  assert.ok(byNest.length >= nests.filter((n) => Math.hypot(n.x - ax, n.z - az) < 380).length * 0.6, 'most nests have a hoard');
  for (const f of all) if (f.kind === 'ring') assert.ok(byNest.includes(f), 'rings only in hoards');
});

test('a taken find is gone for good, also for the next grandchild', () => {
  const taken = new Set<number>();
  const f = finds(taken).near(ax, az, 200)[0];
  const p = new Pack();
  const near = finds(taken).inReach(f.x, f.y, f.z)!;
  assert.equal(near.id, f.id);
  finds(taken).take(near);
  p.add(near);
  assert.equal(p.worth, f.value);
  assert.ok(!finds(taken).near(ax, az, 200).some((g) => g.id === f.id));
});
