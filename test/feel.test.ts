import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEEL, Feel } from '../src/game/feel';

test('a blow that lands holds the world a moment, a kill longer, and the hold ends on the wall clock', () => {
  const f = new Feel();
  assert.equal(f.frame(1 / 60), 1, 'nothing landed: the world runs');
  f.struck(0.5, false);
  assert.equal(f.frame(1 / 60), FEEL.slow);
  let held = 1 / 60;
  while (f.frame(1 / 60) < 1) held += 1 / 60;
  assert.ok(held >= FEEL.stop && held <= FEEL.stop + FEEL.stopPerShare + 0.02, `held ${held}`);
  const k = new Feel();
  k.struck(1, true);
  let killHeld = 0;
  while (k.frame(1 / 60) < 1) killHeld += 1 / 60;
  assert.ok(killHeld > held, 'a kill holds longer than a blow');
});

test('a blow taken jolts the camera, more the harder it is, and the jolt dies away', () => {
  const small = new Feel(), big = new Feel();
  small.took(0.03); big.took(0.3);
  let a = 0, b = 0;
  for (let i = 0; i < 6; i++) { small.frame(0.004); big.frame(0.004); a = Math.max(a, Math.abs(small.yaw)); b = Math.max(b, Math.abs(big.yaw)); }
  assert.ok(b > a && a > 0);
  assert.ok(b <= FEEL.hurtMax);
  for (let i = 0; i < 120; i++) big.frame(1 / 60);
  assert.equal(Math.abs(big.yaw), 0);
  assert.ok(big.red === 0, 'the red edge fades');
});

test('reduced motion never moves the camera, but keeps the hold and the red edge', () => {
  const f = new Feel(true);
  f.took(0.5);
  f.struck(0.5, false);
  assert.equal(f.frame(0.01), FEEL.slow);
  assert.equal(Math.abs(f.yaw), 0);
  assert.equal(Math.abs(f.pitch), 0);
  assert.ok(f.red > 0);
});
