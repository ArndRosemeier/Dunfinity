import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Key } from '../src/lore/key';
import { breakLines, letter } from '../src/lore/scripts';
import { CELLAR } from '../src/gen/cellar';
import { CELLAR_WARD, canRead, inscriptionsAt, letteringOf, onRing } from '../src/gen/inscriptions';
import { PropBuilder } from '../src/gen/propMesh';
import { inscribeRing } from '../src/gen/inscriptions';

test('the cellar has grandma\'s ward round her salt circle, and no other level has writing yet', () => {
  const [ward] = inscriptionsAt(0);
  assert.equal(ward.script, 'thread');
  assert.equal(ward.text, CELLAR_WARD);
  assert.deepEqual(inscriptionsAt(1), []);
});

test('the ward lies outside the salt, inside the room, round almost all the circle without meeting itself', () => {
  const [ward] = inscriptionsAt(0), p = ward.place, l = letteringOf(ward), c = CELLAR.circle, room = CELLAR.room;
  const pts = [...l.strokes.flat(), ...l.dots.map(([u, v]) => [u, v] as const)];
  for (const [u, v] of pts) {
    const [x, z] = onRing(p, u, v);
    const d = Math.hypot(x - c.x, z - c.z);
    assert.ok(d > c.r + 0.03, `a stroke on the salt (${d.toFixed(2)} m)`);
    assert.ok(Math.hypot(x - room.x, z - room.z) < room.r - 0.3, 'a stroke under the wall');
  }
  const turn = (l.width * p.scale) / p.r;
  assert.ok(turn > Math.PI * 1.8 && turn < Math.PI * 2, `turns ${turn}`);
});

test('the ward is laid into the glow props and can be read from where one arrives', () => {
  const b = new PropBuilder(), [ward] = inscriptionsAt(0);
  inscribeRing(b, ward, 0.022, [1, 1, 1]);
  assert.ok(!b.empty);
  assert.ok(canRead(ward, CELLAR.start.x, 0, CELLAR.start.z));
  assert.ok(!canRead(ward, CELLAR.circle.x, 0, CELLAR.circle.z));
});

test('grandma\'s key: each inscription teaches its commonest unknown letter once, and keeps it', () => {
  const k = new Key();
  assert.equal(k.makeOut('thread', 'let them sleep'), '___ ___ _____');
  assert.equal(k.read('w', 'thread', 'let them sleep'), 'e');
  assert.equal(k.read('w', 'thread', 'let them sleep'), null);
  assert.equal(k.makeOut('thread', 'let them sleep'), '_e_ _e_ __ee_');
  const again = new Key(k.data);
  assert.ok(again.knows('thread', 'e'));
  assert.equal(again.read('w', 'thread', 'let them sleep'), null);
  assert.equal(again.read('x', 'kerf', 'the fire'), 'e'); // the commonest
  assert.equal(again.read('y', 'kerf', 'fir'), 'f'); // first seen breaks the tie
});

test('a text wraps at words to the width asked', () => {
  const lines = breakLines('thread', CELLAR_WARD, 22);
  assert.equal(lines.join(' '), CELLAR_WARD);
  assert.ok(lines.length > 1);
  for (const t of lines) assert.ok(letter('thread', t).width <= 22 || !t.includes(' '));
});
