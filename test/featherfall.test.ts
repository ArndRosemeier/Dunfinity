import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshKit } from '../src/loot/items';
import { GEAR, GEAR_ORDER, buyGear, ilseSells } from '../src/loot/hardware';
import { Body, MOVE } from '../src/world/traverse/body';
import { Level } from '../src/gen/level';

test('nothing worn: no featherfall; the slowest worn piece wins, its quality slowing it more', () => {
  const kit = freshKit();
  assert.equal(kit.featherfall, null);
  kit.put({ kind: 'salt-feather', quality: 'sound' });
  assert.equal(kit.featherfall, 11);
  kit.put({ kind: 'umbrella', quality: 'sound' });
  assert.equal(kit.featherfall, 9);
  kit.put({ kind: 'owl-cloak', quality: 'fine' });
  assert.ok(Math.abs(kit.featherfall! - 4 / 1.25) < 1e-9);
  for (const k of ['umbrella', 'salt-feather', 'owl-cloak'] as const) {
    const one = freshKit();
    one.put({ kind: k, quality: 'worn' });
    assert.ok(one.featherfall! < MOVE.safeImpact, `${k}, even worn, lands one unhurt`);
  }
});

test('Kemal sells the umbrella (key 9); Ilse her salt feather always, the owl-down cloak once the stranger is in town', () => {
  assert.equal(GEAR_ORDER.indexOf('umbrella'), 8);
  assert.deepEqual(ilseSells(false), ['feather']);
  assert.deepEqual(ilseSells(true), ['feather', 'cloak', 'satchel']);
  const kit = freshKit();
  assert.equal(buyGear(kit, 'umbrella', 100).euros, 100 - GEAR.umbrella.price);
  assert.equal(kit.worn.off?.kind, 'umbrella');
  buyGear(kit, 'cloak', 500);
  assert.equal(kit.worn.body?.kind, 'owl-cloak');
});

test('a body worn with the cloak falls slowly and lands unhurt from high up', () => {
  const level = new Level(1, 0), kit = freshKit();
  kit.put({ kind: 'owl-cloak', quality: 'sound' });
  // High over the street.
  const b = new Body(-19, 2.7 + 40, 0), dt = 1 / 120;
  b.featherfall = kit.featherfall;
  let fastest = 0;
  for (let t = 0; t < 30 && !b.grounded; t += dt) {
    b.step(level, { forward: 0, right: 0, yaw: 0, sprint: false, jump: false }, dt);
    fastest = Math.max(fastest, -b.vy);
  }
  assert.ok(b.grounded, 'landed');
  assert.ok(fastest <= 4 + 1e-6, `fell at most 4 m/s: ${fastest.toFixed(2)}`);
  assert.equal(b.health, MOVE.maxHealth);
});
