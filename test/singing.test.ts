import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { Geode } from '../src/gen/geode';
import { SING, Singing, noteOf, type Sung } from '../src/world/singing';

/** A geode level, and a place in a geode near crystals. */
function inGeode() {
  const l = new Level(1, 9, 'geode'), geode = l.field.styles.find((s) => s instanceof Geode) as Geode;
  const [x, , z] = l.arrival, y = l.groundAt(x, z) + 1.6;
  return { l, geode, x, y, z };
}

test('longer crystals sing lower, every note in the scale', () => {
  assert.equal(noteOf(SING.long + 2), 0);
  assert.equal(noteOf(SING.short - 0.5), SING.scale - 1);
  for (let len = 0.5; len < 8; len += 0.25) assert.ok(noteOf(len) >= noteOf(len + 0.25));
});

test('in a geode the crystals sing phrases now and then, the same for a seed', () => {
  const { l, geode, x, y, z } = inGeode();
  assert.ok(geode.crystalsNear(x, y, z, SING.reach).length > 0, 'crystals near the arrival');
  const listen = () => {
    const s = new Singing(), out: Sung[] = [], heard: { t: number; note: number }[] = [];
    for (let t = 0; t < 120; t += 1 / 30) for (const n of s.advance(l, 1 / 30, x, y, z, out)) heard.push({ t: Math.round(t * 30), note: n.note });
    return heard;
  };
  const a = listen();
  assert.deepEqual(a, listen());
  assert.ok(a.length >= 3 * 3 && a.length <= 6 * 9, `${a.length} notes in two minutes`);
  for (let k = 1; k < a.length; k++) assert.ok(a[k].t - a[k - 1].t >= Math.floor(SING.step[0] * 30) - 1, 'notes a little apart');
});

test('no singing where there is no geode', () => {
  const l = new Level(1, 3), s = new Singing(), [x, y, z] = l.arrival;
  let n = 0;
  for (let t = 0; t < 120; t += 0.1) n += s.advance(l, 0.1, x, y, z).length;
  assert.equal(n, 0);
});
