import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Body } from '../src/world/traverse/body';
import { damage } from '../src/combat/combat';
import { Cooked } from '../src/loot/recipes';
import { Tin } from '../src/loot/tin';

function guarded(rank: number): Body {
  const c = new Cooked(), tin = new Tin();
  tin.salt = 100;
  for (let r = 0; r < rank; r++) c.cook('pot-lid', tin);
  const b = new Body(0, 0, 0);
  b.facing = 0; // facing -z
  b.lid = c.lid;
  b.guarding = true;
  return b;
}

test('the raised lid takes most of a blow from in front, and costs breath', () => {
  const b = guarded(1);
  damage(b, 10, 0, -1, 4, 'rat');
  assert.ok(Math.abs(b.health - 97) < 1e-9, `${b.health}`);
  assert.ok(Math.abs(b.vz - 1.2) < 1e-9, 'knocked less');
  assert.equal(b.stamina, 12 - 1.5);
  const r2 = guarded(2);
  damage(r2, 10, 0, -1, 4, 'rat');
  assert.ok(Math.abs(r2.health - 99) < 1e-9);
});

test('not from behind, not lowered, not out of breath, not without the card', () => {
  const behind = guarded(1);
  damage(behind, 10, 0, 1, 4, 'rat');
  assert.equal(behind.health, 90);
  const lowered = guarded(1);
  lowered.guarding = false;
  damage(lowered, 10, 0, -1, 4, 'rat');
  assert.equal(lowered.health, 90);
  const tired = guarded(1);
  tired.stamina = 1;
  damage(tired, 10, 0, -1, 4, 'rat');
  assert.equal(tired.health, 90);
  const none = guarded(0);
  damage(none, 10, 0, -1, 4, 'rat');
  assert.equal(none.health, 90);
});
