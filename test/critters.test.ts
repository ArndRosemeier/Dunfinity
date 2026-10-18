import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '@futuremagic/core';
import { AGGRESSION, aggressionOf, bestiaryOf, grow, PEACEFUL, type CritterRole } from '../src/creatures/bestiary';
import { anatomyOf } from '../src/creatures/anatomy';
import { fleshOf } from '../src/creatures/flesh';

const ROLES: CritterRole[] = ['scuttler', 'grazer', 'floater', 'giant', 'watcher', 'hunter', 'lurker', 'swarmer', 'brute'];
const BONES = 96; // CRITTER_BONES (materials.ts needs a browser to import)

test('a level\'s bestiary is the same every time, and has peaceful ones', () => {
  for (const d of [1, 5, 10, 15, 40]) {
    const a = bestiaryOf(7, d), b = bestiaryOf(7, d);
    assert.deepEqual(a, b);
    assert.ok(a.filter((s) => s.peaceful).length >= 1, `depth ${d}: a peaceful species at least`);
    for (const s of a) assert.equal(s.peaceful, s.aggression < AGGRESSION.attack);
  }
});

test('aggression is a dial, not a type: every kind of body can come out passive or aggressive, leaning by its role', () => {
  const seen = new Map<CritterRole, { calm: number; mean: number }>();
  for (const role of ROLES) {
    const s = { calm: 0, mean: 0 };
    for (let k = 0; k < 200; k++) { const a = aggressionOf(`${role}.${k}`, role); if (a < AGGRESSION.attack) s.calm++; else s.mean++; }
    seen.set(role, s);
  }
  for (const r of ROLES) assert.ok(seen.get(r)!.calm > 0 && seen.get(r)!.mean > 0, `${r}: both ends (${JSON.stringify(seen.get(r))})`);
  assert.ok(seen.get('grazer')!.calm > seen.get('grazer')!.mean && seen.get('hunter')!.mean > seen.get('hunter')!.calm, 'leaning by role');
  for (const role of PEACEFUL) assert.ok(seen.get(role)!.calm > 150, `${role} mostly passive`);
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

test('a pocket\'s hunter: stalk wakes one of the level\'s hunters a little way off', async () => {
  const { Level } = await import('../src/gen/level');
  const { Critters } = await import('../src/creatures/critters');
  // Seed 1 depth 15 has only peaceful kinds: its most quarrelsome one is turned mean.
  for (const [seed, depth] of [[1, 15], [3, 20], [3, 30]]) {
    const level = new Level(seed, depth), [x, , z] = level.arrival, cr = new Critters(level);
    assert.ok(cr.stalk(x, z, 14, 22), `depth ${depth}: room for a hunter`);
    const me = { x, y: level.groundAt(x, z), z, vx: 0, vz: 0, radius: 0.35, height: 1.75, taken: 0, get dead() { return false; }, hurt(a: number) { this.taken += a; } };
    cr.advance(1 / 60, me, null);
    const h = cr.list.find((c) => !c.species.peaceful && c.herd.key < 0);
    assert.ok(h, 'it wakes');
    const d0 = Math.hypot(h!.x - x, h!.z - z);
    assert.ok(d0 >= 12 && d0 <= 70, `${d0.toFixed(1)} m off`);
  }
});
