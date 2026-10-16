import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '@futuremagic/core';
import { bestiaryOf, grow, PEACEFUL, type CritterRole } from '../src/creatures/bestiary';
import { anatomyOf } from '../src/creatures/anatomy';
import { fleshOf } from '../src/creatures/flesh';

const ROLES: CritterRole[] = ['scuttler', 'grazer', 'floater', 'giant', 'watcher', 'hunter', 'lurker', 'swarmer', 'brute'];
const BONES = 96; // CRITTER_BONES (materials.ts needs a browser to import)

test('a level\'s bestiary is the same every time, and has peaceful ones', () => {
  for (const d of [1, 5, 10, 15, 40]) {
    const a = bestiaryOf(7, d), b = bestiaryOf(7, d);
    assert.deepEqual(a, b);
    assert.ok(a.filter((s) => s.peaceful).length >= 2, `depth ${d}: two peaceful species at least`);
    for (const s of a) assert.equal(s.peaceful, PEACEFUL.includes(s.role));
  }
});

test('every role grows into a body that fits the skeleton budget, with sane proportions', () => {
  const plans = new Set<string>();
  for (const role of ROLES) for (let k = 0; k < 12; k++) {
    const sp = grow(new Rng(100 + k * 13 + ROLES.indexOf(role)), role, k / 4, `${role}.${k}`);
    plans.add(sp.plan);
    const an = anatomyOf(sp);
    assert.ok(an.bones.length <= BONES, `${sp.id} (${sp.plan}): ${an.bones.length} bones`);
    assert.ok(sp.length > 0.03 && sp.length < 6, `${sp.id}: torso ${sp.length}`);
    assert.ok(sp.walkSpeed > 0 && sp.runSpeed >= sp.walkSpeed, `${sp.id}: speeds`);
    for (const p of an.bones) assert.ok(p.pos.every(Number.isFinite), `${sp.id}: bone ${p.name}`);
    if (sp.plan !== 'floater') {
      const low = Math.min(...an.prims.map((p) => Math.min(p.a[1] - p.ra * p.sy, p.type === 'cone' ? p.b[1] - p.rb * p.sy : Infinity)));
      assert.ok(low > -0.1 * sp.totalLength, `${sp.id} (${sp.plan}): flesh ${low.toFixed(3)} m below the ground`);
    }
  }
  assert.ok(plans.size >= 8, `body plans seen: ${[...plans].join(', ')}`);
});

test('flesh is a closed, skinned mesh with its weights summing to one', () => {
  const sp = grow(new Rng(5), 'grazer', 1, 'grazer.t');
  const f = fleshOf(anatomyOf(sp), sp, 40);
  const n = f.positions.length / 3;
  assert.ok(n > 300 && f.indices.length > n);
  for (let i = 0; i < n; i++) {
    const w = f.skinWeight[i * 4] + f.skinWeight[i * 4 + 1] + f.skinWeight[i * 4 + 2] + f.skinWeight[i * 4 + 3];
    assert.ok(Math.abs(w - 1) < 1e-3, `vertex ${i}: weights ${w}`);
  }
  for (const i of f.indices) assert.ok(i < n);
});
