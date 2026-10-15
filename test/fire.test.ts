import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { Campfire, FIRE, type Rester } from '../src/world/fire';

const level = new Level(1, 1);
const [ax, , az] = level.arrival;
const me = (): Rester => ({ x: ax, y: level.groundAt(ax, az), z: az, vx: 0, vz: 0, health: 40, stamina: 2 });

/** Facing somewhere a fire fits in front. */
function facing(c: Campfire, r: Rester): number {
  for (let a = 0; a < 16; a++) if (c.whyNot(r, a * 0.4, false, 0) === '') return a * 0.4;
  throw new Error('nowhere for a fire');
}

test('a fire takes a moment to light, then resting by it heals far faster than waiting', () => {
  const c = new Campfire(level, 100, 12), r = me(), yaw = facing(c, r);
  c.light(r, yaw, 0);
  assert.ok(c.kindling(1) >= 0 && !c.burning(1), 'still kneeling');
  c.step(r, false, 1, 1);
  assert.equal(r.health, 40, 'no rest before it burns');
  for (let t = FIRE.kindle; t < FIRE.kindle + 10; t += 0.1) c.step(r, false, t, 0.1);
  assert.ok(c.resting && r.health > 40 + FIRE.heal * 9 && r.stamina === 12, `${r.health}`);
});

test('no resting with something after you, walking about, or once it has burnt down; no lighting one when hunted', () => {
  const c = new Campfire(level, 100, 12), r = me(), yaw = facing(c, r);
  assert.notEqual(c.whyNot(r, yaw, true, 0), '');
  c.light(r, yaw, 0);
  const t0 = FIRE.kindle + 1;
  c.step(r, true, t0, 1);
  assert.ok(!c.resting && r.health === 40);
  c.step({ ...r, vx: 2 }, false, t0, 1);
  assert.ok(!c.resting);
  c.step(r, false, FIRE.kindle + FIRE.burn + 1, 1);
  assert.ok(!c.resting && c.fire === null, 'burnt out');
});

test('no fire in the water', () => {
  const c = new Campfire(level, 100, 12);
  for (let k = 0; k < 4000; k++) {
    const x = ax + (k % 63) * 7 - 220, z = az + Math.floor(k / 63) * 7 - 220;
    if (level.waterAt(x, z) > level.groundAt(x, z) + 0.3) {
      assert.notEqual(c.whyNot({ x, y: level.groundAt(x, z), z, vx: 0, vz: 0, health: 50, stamina: 5 }, 0, false, 0), '');
      return;
    }
  }
  assert.fail('no water found');
});
