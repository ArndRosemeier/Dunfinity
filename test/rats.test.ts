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

test('rats keep away from a Sunday candle, even when they are after you, and bite less', () => {
  const bites = (candle: boolean) => {
    const r = new Rats(level), me = standAtNest(r);
    if (candle) r.glare = [{ x: me.x, z: me.z }];
    let near = 0;
    for (let k = 0; k < 900; k++) {
      r.advance(1 / 60, me); me.vx = me.vz = 0;
      if (k > 300) near += r.list.filter((x) => !x.dead && Math.hypot(x.x - me.x, x.z - me.z) < 1.5).length;
    }
    return { taken: me.taken, near };
  };
  const dark = bites(false), lit = bites(true);
  assert.ok(lit.near < dark.near * 0.3, `${lit.near} rat-steps close by the candle vs ${dark.near} without`);
  assert.ok(lit.taken < dark.taken, `${lit.taken} vs ${dark.taken}`);
});

test('chilled rats (grandma\'s Cold Larder) move slower while it lasts', () => {
  const walked = (chill: boolean) => {
    const r = new Rats(level), me = standAtNest(r);
    for (let k = 0; k < 120; k++) { r.advance(1 / 60, me); me.vx = me.vz = 0; }
    me.x += 6; // step off, so they come after you
    if (chill) for (const rat of r.list) rat.chill = { left: 99, by: 0.4 };
    let d = 0;
    for (let k = 0; k < 30; k++) {
      const at = r.list.map((x) => [x.x, x.z]);
      r.advance(1 / 60, me); me.vx = me.vz = 0;
      r.list.forEach((x, i) => { if (at[i]) d += Math.hypot(x.x - at[i][0], x.z - at[i][1]); });
    }
    return d;
  };
  const free = walked(false), cold = walked(true);
  assert.ok(free > 1, `they came (${free.toFixed(1)} m)`);
  assert.ok(cold < free * 0.7, `${cold.toFixed(1)} m chilled vs ${free.toFixed(1)} m`);
});
