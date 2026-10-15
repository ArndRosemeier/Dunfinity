import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { RAT, Rats } from '../src/creatures/rats';
import { damage, type Fighter } from '../src/combat/combat';

const level = new Level(1, 1);

function nests(r: Rats, n = 12) {
  const out = [];
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) { const s = r.denAt(i, j); if (s) out.push([s.x, s.z, s.count]); }
  return out;
}

test('nests are the same for the same level and lie on open floor', () => {
  const a = nests(new Rats(level)), b = nests(new Rats(level));
  assert.ok(a.length > 20, `some nests (${a.length})`);
  assert.deepEqual(a, b);
  for (const [x, z] of a) assert.ok(level.sdf(x, level.groundAt(x, z) + 0.6, z) > 0.3, 'air over a nest');
});

/** A player standing still at a nest, who keeps count of bites. */
function standAtNest(r: Rats): Fighter & { taken: number } {
  const n = nests(r).find(([x, z]) => Math.hypot(x - level.arrival[0], z - level.arrival[2]) > 30)!;
  const [x, z] = n;
  return {
    x: x + 1.5, y: level.groundAt(x + 1.5, z), z, vx: 0, vz: 0, radius: 0.3, height: 1.7, taken: 0,
    get dead() { return false; },
    hurt(a: number) { this.taken += a; },
  };
}

test('rats wake near you, chase and bite, and die of the knife', () => {
  const r = new Rats(level), me = standAtNest(r);
  for (let k = 0; k < 600; k++) { r.advance(1 / 60, me); me.vx = me.vz = 0; }
  assert.ok(r.list.length >= RAT.count[0], 'the nest woke');
  assert.ok(me.taken > 0, 'bitten');
  const before = r.list.filter((x) => x.dead).length;
  for (const rat of r.list) damage(rat, 100, me.x, me.z, 3, 'knife');
  r.advance(1 / 60, me);
  assert.equal(r.list.filter((x) => x.dead).length, r.list.length);
  assert.equal(r.killed, r.list.length - before);
});

test('rats behave the same for the same level and player', () => {
  const run = () => {
    const r = new Rats(level), me = standAtNest(r);
    for (let k = 0; k < 300; k++) { r.advance(1 / 60, me); me.vx = me.vz = 0; }
    return [me.taken, ...r.list.map((x) => x.x.toFixed(4))];
  };
  assert.deepEqual(run(), run());
});
