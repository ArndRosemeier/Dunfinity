import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { CAMP } from '../src/gen/grandmasCamp';
import { PROP_TILE, quarryProps } from '../src/gen/quarryProps';

test("grandma's first camp is on level 9, on dry level floor a walk from the arrival, and nowhere else", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const l = new Level(seed, CAMP.depth), c = l.camp;
    assert.ok(c, `seed ${seed}: no camp`);
    const [ax, , az] = l.arrival, d = Math.hypot(c.x - ax, c.z - az);
    assert.ok(d >= CAMP.near - 1 && d <= CAMP.far, `seed ${seed}: ${d.toFixed(0)} m out`);
    assert.ok(l.dry(c.x, c.z, 0.3));
    // The note lies on its stone, in the air just above it.
    const [nx, ny, nz] = c.note;
    assert.ok(l.sdf(nx, ny + 0.3, nz) > 0.2 && Math.abs(ny - l.groundAt(nx, nz) - 0.24) < 0.01);
    // Its props are built with its tile.
    assert.ok(quarryProps(l, Math.floor(c.x / PROP_TILE), Math.floor(c.z / PROP_TILE)).solid);
  }
  for (const d of [1, 8, 10]) assert.equal(new Level(1, d).camp, null);
});
