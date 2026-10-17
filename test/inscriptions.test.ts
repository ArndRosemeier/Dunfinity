import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRANDMA_KERF, Key } from '../src/lore/key';
import { DIGGERS, KEEPERS, THRESHOLD_LINTELS, frieze, numberWords, ribLine } from '../src/lore/fragments';
import { Level } from '../src/gen/level';
import { PROP_TILE, quarryProps } from '../src/gen/quarryProps';
import { breakLines, letter } from '../src/lore/scripts';
import { CELLAR } from '../src/gen/cellar';
import { CELLAR_WARD, type Inscription, type PathPlace, onPath, type RingPlace, type WallPlace, canRead, inscriptionsAt, letteringOf, onRing } from '../src/gen/inscriptions';
import { PropBuilder } from '../src/gen/propMesh';
import { inscribe } from '../src/gen/inscriptions';
import { DWARVEN } from '../src/gen/dwarven';
import { withBand } from './where';

test('the cellar has grandma\'s ward round her salt circle, and no other level has writing yet', () => {
  const [ward] = inscriptionsAt(0);
  assert.equal(ward.script, 'thread');
  assert.equal(ward.text, CELLAR_WARD);
  assert.deepEqual(inscriptionsAt(1), []);
});

test('the ward lies outside the salt, inside the room, round almost all the circle without meeting itself', () => {
  const [ward] = inscriptionsAt(0), p = ward.place as RingPlace, l = letteringOf(ward), c = CELLAR.circle, room = CELLAR.room;
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
  inscribe(b, ward, 0.022, 0.008, [1, 1, 1]);
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

test('crypt fronts at the Threshold carry a dwarven warning on their lintel, readable from in front and below', () => {
  const found: Inscription[] = [];
  for (const [seed, depth] of [withBand('threshold'), withBand('threshold', 1), withBand('threshold', 2)]) {
    const l = new Level(seed, depth), [ax, , az] = l.arrival, n = 5;
    for (let j = -n; j <= n && found.length < 3; j++) for (let i = -n; i <= n; i++) found.push(...quarryProps(l, Math.floor(ax / PROP_TILE) + i, Math.floor(az / PROP_TILE) + j).inscriptions);
  }
  assert.ok(found.length >= 1, 'no lintel found');
  for (const ins of found) {
    assert.equal(ins.script, 'kerf');
    assert.ok(THRESHOLD_LINTELS.includes(ins.text));
    const p = ins.place as WallPlace, w = letteringOf(ins).width * p.scale;
    assert.ok(w <= 4.8 + 1e-9, `${w} m wide`);
    const mx = p.x + p.rx * w / 2, mz = p.z + p.rz * w / 2;
    assert.ok(canRead(ins, mx + p.nx * 2.5, p.y - 6, mz + p.nz * 2.5), 'not readable from the floor in front');
    assert.ok(!canRead(ins, mx - p.nx * 2.5, p.y - 6, mz - p.nz * 2.5), 'readable from behind');
  }
});

test('grandma\'s rubbing pencils in her runes once', () => {
  const k = new Key();
  assert.equal(k.pencil('kerf', GRANDMA_KERF), GRANDMA_KERF.length);
  assert.equal(k.pencil('kerf', GRANDMA_KERF), 0);
  assert.equal(k.makeOut('kerf', 'do not wake the tall'), 'do not _a_e the ta__');
});

test('the dwarven halls carry gold runes: hall names over the gates, friezes on the panels, readable from the floor', () => {
  // Tiles (from the arrival) where halls stand, found by looking.
  const found: [Level, Inscription][] = [];
  for (const [seed, tiles] of [[7, [[-3, 2], [-2, -2]]], [2, [[0, -3], [3, 0]]]] as const) {
    const l = new Level(seed, 25, 'dwarven'), [ax, , az] = l.arrival;
    for (const [i, j] of tiles) for (const ins of quarryProps(l, Math.floor(ax / PROP_TILE) + i, Math.floor(az / PROP_TILE) + j).inscriptions) found.push([l, ins]);
  }
  const ids = found.map(([, s]) => s.id).filter((id) => !id.startsWith('lintel:'));
  const gates = ids.filter((id) => id.startsWith('gate:')), friezes = ids.filter((id) => id.startsWith('frieze:'));
  assert.ok(gates.length >= 1 && friezes.length >= 6, `${gates.length} gates, ${friezes.length} friezes`);
  assert.equal(new Set(ids).size, ids.length, 'an inscription placed twice');
  for (const [l, ins] of found) {
    if (ins.id.startsWith('lintel:')) continue;
    assert.equal(ins.script, 'kerf');
    const p = ins.place as WallPlace, w = letteringOf(ins).width * p.scale;
    assert.ok(p.scale >= 0.14, `${ins.text}: runes ${(p.scale * 200).toFixed(0)} cm`);
    const mx = p.x + p.rx * w / 2, mz = p.z + p.rz * w / 2, floor = l.groundAt(mx + p.nx * 2.5, mz + p.nz * 2.5);
    assert.ok(canRead(ins, mx + p.nx * 2.5, floor, mz + p.nz * 2.5), `${ins.id} not readable from the floor before it`);
  }
  for (const [, g] of found) if (g.id.startsWith('gate:')) assert.match(g.text, /^hall of the /);
});

test('frieze texts are English the dwarves could cut: the diggers\' lines and the halls\' records', () => {
  assert.equal(numberWords(47), 'forty seven');
  assert.equal(numberWords(30), 'thirty');
  assert.equal(numberWords(13), 'thirteen');
  const seen = new Set<string>();
  for (let s = 0; s < 400; s++) seen.add(frieze((k) => ((s * 7919 + k * 104729) % 1000) / 1000));
  assert.ok([...seen].some((t) => DIGGERS.includes(t)) && [...seen].some((t) => t.endsWith('fathoms to the fire')) && [...seen].some((t) => t.startsWith('here ')));
  for (const t of seen) assert.ok(/^[a-z ]+$/.test(t), t);
  // Every one fits a panel in runes at least 28 cm tall.
  const P = DWARVEN.panel, room = DWARVEN.pillar.pitch * P.share - 1.2;
  for (const t of [...DIGGERS, ...seen]) assert.ok(letter('kerf', t).width * 0.14 <= room, t);
});

test('the elven vaults carry the keepers\' Thread script up over their ribs, salt-white, readable from the nave floor under it', () => {
  // The arrival is in the excavation's ground; the vaults stand further out.
  const l = new Level(1, 25, 'elven'), [ax, , az] = l.arrival, found: Inscription[] = [];
  for (let j = 1; j <= 2; j++) for (let i = -1; i <= 1; i++) found.push(...quarryProps(l, Math.floor((ax - 1000) / PROP_TILE) + i, Math.floor((az - 1000) / PROP_TILE) + j).inscriptions.filter((s) => s.id.startsWith('rib:')));
  assert.ok(found.length >= 3, `${found.length} ribs written`);
  for (const ins of found) {
    assert.equal(ins.script, 'thread');
    const p = ins.place as PathPlace, apex = p.pts[(p.pts.length - 1) / 2], at = onPath(p);
    assert.ok(p.scale >= 0.3, `${ins.text}: ${p.scale}`);
    // The line runs left to right as one faces it, its letters' tops towards the vault.
    const [x0, , z0] = at(0, 0), [x1, , z1] = at(letteringOf(ins).width, 0), up = at(letteringOf(ins).width / 2, 1);
    assert.ok((x1 - x0) * p.nz - (z1 - z0) * p.nx > 0, 'runs right to left');
    assert.ok(up[1] > at(letteringOf(ins).width / 2, 0)[1], 'upside down at the point of the arch');
    const fx = apex[0] + p.nx * 3, fz = apex[2] + p.nz * 3, g = l.groundAt(fx, fz);
    assert.ok(apex[1] - g > 15, 'not high under the vault');
    assert.ok(canRead(ins, fx, g, fz), `${ins.id} not readable from the floor under it`);
    assert.ok(!canRead(ins, apex[0] - p.nx * 3, g, apex[2] - p.nz * 3), `${ins.id} readable from behind`);
  }
  const lines = new Set<string>();
  for (let s = 0; s < 300; s++) lines.add(ribLine((k) => ((s * 7919 + k * 104729) % 997) / 997));
  assert.ok([...lines].some((t) => KEEPERS.includes(t)) && [...lines].some((t) => t.startsWith('remember ')));
});
