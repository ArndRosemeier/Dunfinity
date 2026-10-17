import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { Body, type BodyInput } from '../src/world/traverse/body';
import { noticed, type Fighter } from '../src/combat/combat';
import { RAT, Rats } from '../src/creatures/rats';
import { afterYou } from '../src/creatures/animals';
import { Cooked } from '../src/loot/recipes';
import { Tin } from '../src/loot/tin';

const level = new Level(1, 1);

test('Tiptoe: cooked, Z walks slowly and hushed; not cooked, it does nothing', () => {
  const [sx, , sz] = level.spawn();
  const inp: BodyInput = { forward: 1, right: 0, yaw: 0, sprint: false, jump: false, sneak: true };
  const go = (b: Body) => { for (let i = 0; i < 240; i++) b.step(level, inp, 1 / 120); return Math.hypot(b.vx, b.vz); };
  const plain = new Body(sx, level.groundAt(sx, sz) + 0.1, sz);
  assert.ok(go(plain) > 3.5 && plain.hush === 1 && !plain.sneaking);
  const c = new Cooked(), tin = new Tin();
  tin.salt = 100;
  c.cook('tiptoe', tin);
  const quiet = new Body(sx, level.groundAt(sx, sz) + 0.1, sz);
  quiet.tiptoe = c.tiptoe;
  assert.ok(Math.abs(go(quiet) - 1.6) < 0.2 && quiet.sneaking);
  assert.equal(quiet.hush, 0.5);
  c.cook('tiptoe', tin);
  assert.deepEqual(c.tiptoe, { speed: 2.2, hush: 0.33 });
  inp.sprint = true;
  go(quiet);
  assert.ok(!quiet.sneaking, 'running is not tiptoeing');
  assert.equal(quiet.hush, 1);
});

test('things notice a hushed nobody from that much nearer', () => {
  const me = { hush: 0.5 } as Fighter;
  assert.ok(noticed({} as Fighter, 8, 9) && !noticed(me, 8, 9) && noticed(me, 4, 9));
});

test('rats that would come for you leave a tiptoeing nobody be', () => {
  const r0 = new Rats(level);
  const [ax, , az] = level.arrival;
  let nest: { x: number; z: number } | null = null;
  for (let j = -12; j <= 12 && !nest; j++) for (let i = -12; i <= 12 && !nest; i++) {
    const s = r0.denAt(i, j);
    if (s && Math.hypot(s.x - ax, s.z - az) > 30 && level.dry(s.x + 6, s.z, 0.1)) nest = s;
  }
  assert.ok(nest);
  const chased = (hush: number) => {
    const r = new Rats(level), x = nest!.x + 6, z = nest!.z;
    const me = { x, y: level.groundAt(x, z), z, vx: 0, vz: 0, radius: 0.35, height: 1.75, hush, get dead() { return false; }, hurt() {} };
    let n = 0;
    for (let k = 0; k < 300; k++) { r.advance(1 / 60, me); me.vx = me.vz = 0; n = Math.max(n, r.list.filter((x) => afterYou(x)).length); }
    return n;
  };
  assert.ok(RAT.notice > 6);
  assert.ok(chased(1) > 0, 'heard');
  assert.equal(chased(0.33), 0, 'not heard');
});
