import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { SKY, SkyBuilder, skyLights, skyOf } from '../src/gen/glowworms';
import { quarryProps } from '../src/gen/quarryProps';
import { PROP_TILE } from '../src/gen/propGrid';

test('glow-worm skies hang on high cavern roofs, a few per level, the same for a seed', () => {
  for (const d of [1, 3, 7]) {
    const l = new Level(1, d), [x, , z] = l.arrival;
    const skies = l.skies.near(x, z, 250);
    assert.ok(skies.length >= 2, `level ${d}: ${skies.length} skies`);
    assert.deepEqual(skies, new Level(1, d).skies.near(x, z, 250));
    for (const s of skies) {
      const up = l.trace(s.x, s.y + 1, s.z, 0, 1, 0, SKY.roof[1]) + 1;
      assert.ok(up >= SKY.roof[0] - 0.1 && up <= SKY.roof[1], `a roof to look up at (${up.toFixed(1)} m)`);
    }
  }
  assert.equal(new Level(1, 0).skies.near(0, 0, 300).length, 0, 'none in the cellar or the town');
});

test('a sky\'s lights cling just under the rock of its roof, a few stars among the faint ones', () => {
  const l = new Level(1, 3), s = l.skies.closest(l.arrival[0], l.arrival[2])!, b = new SkyBuilder();
  const n = skyLights(l, s, b), mesh = b.mesh()!;
  assert.ok(n > 300 && n <= SKY.most, `${n} lights`);
  assert.equal(mesh.positions.length, n * 12);
  let stars = 0;
  for (let k = 0; k < n; k++) {
    const i = k * 12, x = mesh.positions[i], y = mesh.positions[i + 1], z = mesh.positions[i + 2];
    assert.ok(l.sdf(x, y, z) > -0.02 && l.sdf(x, y + 0.3, z) < 0.2, 'under the rock, close to it');
    if (mesh.colors[i] > 0.65) stars++;
  }
  assert.ok(stars > 5 && stars < n * 0.15, `${stars} stars`);
});

test('the sky comes with its props tile, and strange levels change its look', () => {
  const l = new Level(1, 3), s = l.skies.closest(l.arrival[0], l.arrival[2])!;
  const tile = quarryProps(l, Math.floor(s.x / PROP_TILE), Math.floor(s.z / PROP_TILE));
  assert.ok(tile.sky && tile.counts.skies >= 1);
  const ours = skyOf(1, 1);
  assert.equal(ours.arms, 0, 'level 1: still');
  assert.ok(ours.color[1] > ours.color[0] && ours.color[1] > ours.color[2] * 0.9, 'blue-green');
  let turned = 0;
  for (let d = 11; d < 60; d++) if (skyOf(1, d).arms > 0) turned++;
  assert.ok(turned > 10, 'deep skies turn in arms');
});
