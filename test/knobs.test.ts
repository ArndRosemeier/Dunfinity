import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '@futuremagic/core';
import { grow, PLANS, ROLES } from '../src/creatures/bestiary';
import { anatomyOf } from '../src/creatures/anatomy';
import { fleshOf } from '../src/creatures/flesh';
import { KNOBS, knobsOf, tune } from '../src/creatures/knobs';

test('every knob reads off a grown species within its range, and setting them all as read changes nothing', () => {
  for (const role of ROLES) {
    const sp = grow(new Rng(9 + ROLES.indexOf(role)), role, 1.5, `t.${role}`);
    const v = knobsOf(sp);
    for (const k of KNOBS) assert.ok(v[k.key] >= k.min - 1e-9 && v[k.key] <= k.max + 1e-9, `${sp.id} ${k.key} = ${v[k.key]} outside ${k.min}..${k.max}`);
    assert.deepEqual(tune(sp, v), sp);
  }
});

test('a knob turned settles what follows from it: a longer torso weighs more and runs faster on longer legs', () => {
  const sp = grow(new Rng(3), 'grazer', 0.5, 't.g', { plan: 'quadruped' });
  const big = tune(sp, { length: sp.length * 2 });
  assert.ok(big.mass > sp.mass * 6, `mass ${sp.mass} -> ${big.mass}`);
  assert.ok(big.totalLength > sp.totalLength && big.hipHeight > sp.hipHeight);
  assert.equal(tune(sp, { eyes: 3.4 }).head.eyes, 3);
  assert.equal(tune(sp, { length: 99 }).length, 4.5);
});

test('the plan and skin can be given, and any plan at any knob extreme still makes a body', () => {
  for (const plan of PLANS) {
    const sp = grow(new Rng(PLANS.indexOf(plan) + 1), 'hunter', 2, `t.${plan}`, { plan, integument: 'scales' });
    assert.equal(sp.plan, plan);
    assert.equal(sp.integument, 'scales');
    for (const end of ['min', 'max'] as const) {
      const t = tune(sp, Object.fromEntries(KNOBS.map((k) => [k.key, k[end]])));
      const an = anatomyOf(t);
      assert.ok(an.bones.length <= 96, `${plan} at ${end}: ${an.bones.length} bones`);
      for (const b of an.bones) assert.ok(b.pos.every(Number.isFinite), `${plan} at ${end}: bone ${b.name}`);
    }
  }
  // And it meshes (a few: meshing takes a moment).
  for (const plan of ['quadruped', 'octopod', 'floater'] as const) for (const end of ['min', 'max'] as const) {
    const sp = tune(grow(new Rng(4), 'watcher', 1, `m.${plan}`, { plan }), Object.fromEntries(KNOBS.map((k) => [k.key, k[end]])));
    const f = fleshOf(anatomyOf(sp), sp, 24);
    assert.ok(f.indices.length > 0 && f.positions.every(Number.isFinite), `${plan} at ${end}: a mesh`);
  }
});
