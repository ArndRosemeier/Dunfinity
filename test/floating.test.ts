/**
 * The floating islands (src/gen/floating.ts): ground over a void found by marching down
 * (`Level.groundAt` with a height), every island walkable to, walkers that will not step off, and a
 * body that falls into the void is told it has fallen out (`Level.fellOut`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level, FALL_OUT } from '../src/gen/level';
import { Floating, type Drop } from '../src/gen/floating';
import { Steer, type Walker } from '../src/creatures/steer';

const level = new Level(1, 75, 'floating');
const style = level.field.styles.find((s) => s.id === 'floating') as Floating;
/** The drops of the cells round the arrival. */
const drops: Drop[] = [];
for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) { const d = style.dropOf(i, j); if (d) drops.push(d); }

test('a level of floating islands has drops, each with islands hung in it', () => {
  assert.ok(drops.length >= 10, `${drops.length} drops`);
  for (const d of drops) assert.ok(d.islands.length >= 2, `a drop at ${d.x.toFixed(0)}, ${d.z.toFixed(0)} has ${d.islands.length} islands`);
  // Never over the arrival.
  const [ax, , az] = level.arrival;
  for (const d of drops) assert.ok(Math.hypot(ax - d.x, az - d.z) > d.r + 10, 'the arrival is on the rim');
});

test('the ground under a body is the first rock under its height: an island\'s top from over it, the void\'s bottom from under it', () => {
  for (const d of drops.slice(0, 6)) for (const p of d.islands) {
    const x = p.x + p.r * 0.3, z = p.z;
    const f = level.floorAt(x, z), top = level.groundAt(x, z);
    assert.ok(Math.abs(top - p.top) < 0.6, `the topmost ground is the island's top (${top.toFixed(2)} for ${p.top.toFixed(2)})`);
    assert.ok(Math.abs(level.groundAt(x, z, p.top + 1.2) - top) < 0.05, 'a body on the island stands on it');
    // A walker under the island, below its point: the void's bottom under it, not the island over it.
    const under = level.groundAt(x, z, p.top - p.under - 2);
    assert.ok(under < f - FALL_OUT, `under the island the ground is the void's bottom (${under.toFixed(1)}), not its top`);
    assert.ok(level.waterAt(x, z) < under, 'no water table over the void: it drains into the drops');
  }
});

test('every island of a drop can be walked to from its rim, over the arches', () => {
  for (const d of drops.slice(0, 4)) {
    // A walk over a 1 m grid from the rim: steps of at most 0.6 m up or down, room to stand.
    const n = Math.ceil((d.r + 16) * 2), o = n / 2, seen = new Float64Array(n * n).fill(NaN), queue: number[] = [];
    const xOf = (i: number) => d.x - o + i, zOf = (k: number) => d.z - o + k;
    for (let i = 0; i < n; i++) for (const k of [0, n - 1]) {
      const g = level.groundAt(xOf(i), zOf(k));
      seen[i + n * k] = g; queue.push(i + n * k);
    }
    while (queue.length) {
      const c = queue.pop()!, ci = c % n, ck = (c - ci) / n, g = seen[c];
      for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const i = ci + di, k = ck + dk;
        if (i < 0 || k < 0 || i >= n || k >= n || !Number.isNaN(seen[i + n * k])) continue;
        const x = xOf(i), z = zOf(k), h = level.groundAt(x, z, g + 1.1);
        if (Math.abs(h - g) > 0.6 || level.sdf(x, h + 1, z) < 0.3) continue;
        seen[i + n * k] = h; queue.push(i + n * k);
      }
    }
    for (const p of d.islands) {
      const i = Math.round(p.x - d.x + o), k = Math.round(p.z - d.z + o);
      assert.ok(!Number.isNaN(seen[i + n * k]), `the island at ${p.x.toFixed(0)}, ${p.z.toFixed(0)} (top ${p.top.toFixed(1)}) can be walked to`);
    }
  }
});

test('walkers never step off an island or the rim into the void', () => {
  const steer = new Steer(level, { arrive: 0.5, still: 0.08, step: 0.6, drop: 1.4, accel: 10, turn: 9, face: 10 });
  const w = (x: number, y: number, z: number): Walker => ({ x, y, z, vx: 0, vz: 0, yaw: 0, side: 1, radius: 0.4, height: 0.8, dead: false });
  for (const d of drops.slice(0, 6)) {
    // On the rim, facing the drop.
    for (let a = 0; a < 8; a++) {
      const ux = Math.cos(a), uz = Math.sin(a), rx = d.x + ux * (d.r + 1.5), rz = d.z + uz * (d.r + 1.5);
      if (d.arches.some((t) => Math.hypot(t.ax - rx, t.az - rz) < 12 || Math.hypot(t.bx - rx, t.bz - rz) < 12)) continue;
      const g = level.groundAt(rx, rz);
      assert.equal(steer.walkable(w(rx, g, rz), d.x + ux * (d.r - 1.5), d.z + uz * (d.r - 1.5)), false, 'no step off the rim');
    }
    // On an island, at its edge, facing out.
    for (const p of d.islands) {
      const x = p.x + p.r - 0.8, z = p.z, out = p.x + p.r + 1.5;
      if (d.arches.some((t) => Math.hypot(t.ax - out, t.az - z) < 8 || Math.hypot(t.bx - out, t.bz - z) < 8)) continue;
      assert.equal(steer.walkable(w(x, p.top, z), out, z), false, 'no step off an island');
      assert.equal(steer.walkable(w(x, p.top, z), x - 1, z), true, 'it walks on the island');
    }
  }
});

test('a body deep in the void has fallen out; one on an island or on another style\'s ground has not', () => {
  const d = drops[0], p = d.islands[0], f = level.floorAt(d.x, d.z);
  assert.equal(level.fellOut(p.x, p.top + 0.1, p.z), false);
  assert.equal(level.fellOut(d.x + (d.r - 2), f - FALL_OUT - 1, d.z), true);
  const mixed = new Level(1, 9);
  const [ax, ay, az] = mixed.arrival;
  assert.equal(mixed.fellOut(ax, ay - 200, az), false, 'only a void falls out');
});
