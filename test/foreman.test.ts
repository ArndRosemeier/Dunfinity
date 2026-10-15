import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { Foreman, FOREMAN, type Boss } from '../src/creatures/foreman';
import type { SaltTouched } from '../src/creatures/touched';
import { Fauna } from '../src/creatures/fauna';
import { damage, type Fighter } from '../src/combat/combat';

type Me = Fighter & { taken: number };

/** Level 5 of `seed`, his hall, and someone standing `away` metres out in front of him. */
function setup(seed: number, away: number): { fm: Foreman; st: SaltTouched; me: Me; boss: () => Boss } {
  const l = new Level(seed, 5), fauna = new Fauna(l), fm = fauna.foreman, st = fauna.touched, h = fm.hall;
  assert.ok(h, `seed ${seed}: a hall on level 5`);
  const x = h.x - Math.sin(h.yaw) * away, z = h.z - Math.cos(h.yaw) * away;
  const me: Me = { x, y: l.groundAt(x, z), z, vx: 0, vz: 0, radius: 0.35, height: 1.75, taken: 0, get dead() { return false; }, hurt(a: number) { this.taken += a; } };
  return { fm, st, me, boss: () => fm.list[0] };
}

/** Steps until `done` or `secs`; the prey stays put. */
function run(fm: Foreman, st: SaltTouched, me: Me, secs: number, done: () => boolean = () => false): number {
  for (let k = 0; k < secs * 60; k++) {
    fm.advance(1 / 60, me, st);
    st.advance(1 / 60, me);
    me.vx = me.vz = 0;
    if (done()) return k / 60;
  }
  return -1;
}

test('the Foreman is on level 5 only, in a cathedral', () => {
  let found = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const l = new Level(seed, 5), h = new Foreman(l).hall;
    if (!h) continue;
    found++;
    assert.ok(l.columnAt(h.x, h.z).working.height >= FOREMAN.cathedral, 'a tall hall');
    assert.ok(Math.hypot(h.x - l.arrival[0], h.z - l.arrival[2]) >= FOREMAN.quiet, 'not at the arrival');
  }
  assert.ok(found >= 5, `${found} of 6 seeds have him`);
  for (const d of [3, 4, 6]) assert.equal(new Foreman(new Level(1, d)).hall, null, `none on level ${d}`);
});

test('roused, he rings the bell and the Salt-Touched answer it from far off', () => {
  const { fm, st, me, boss } = setup(1, 10);
  run(fm, st, me, 0.1);
  // His crew, at work round the hall, too far off to notice you.
  const far = st.list.filter((t) => !t.angry);
  assert.ok(far.length >= 3, `${far.length} of his crew at work`);
  const rang = run(fm, st, me, 6, () => boss().rung > 0);
  assert.ok(rang > 0, 'he rang');
  assert.equal(boss().mode, 'ring');
  for (const t of far) assert.ok(t.angry && t.called > 0, 'a far one answers');
});

test('his pick comes down after a long wind-up, and it hurts', () => {
  const { fm, st, me, boss } = setup(1, 6);
  let swingAt = -1;
  const hit = run(fm, st, me, 30, () => {
    if (swingAt < 0 && boss().mode === 'swing') swingAt = 0;
    else if (swingAt >= 0) swingAt += 1 / 60;
    return me.taken >= FOREMAN.swing.damage[0];
  });
  assert.ok(hit > 0, 'he hit');
  assert.ok(swingAt >= 1.1, `the wind-up shows ${swingAt.toFixed(2)} s first`);
});

test('a knife from in front skids off his crust; from behind it goes in', () => {
  const { fm, st, me, boss } = setup(2, 5);
  run(fm, st, me, 0.1);
  const f = boss();
  // In front of him.
  me.x = f.x - Math.sin(f.yaw) * 1.5; me.z = f.z - Math.cos(f.yaw) * 1.5;
  run(fm, st, me, 1 / 60);
  let h = f.health;
  damage(f, 10, me.x, me.z, 0, 'knife');
  const front = h - f.health;
  // Behind him.
  me.x = f.x + Math.sin(f.yaw) * 1.5; me.z = f.z + Math.cos(f.yaw) * 1.5;
  run(fm, st, me, 1 / 60);
  h = f.health;
  damage(f, 10, me.x, me.z, 0, 'knife');
  const back = h - f.health;
  assert.ok(front <= 3, `front ${front}`);
  assert.ok(back >= 12, `back ${back}`);
});

test('he never jitters', () => {
  const { fm, st, me, boss } = setup(3, 9);
  let last: [number, number] | null = null, prev: [number, number] | null = null, back = 0;
  for (let k = 0; k < 60 * 25; k++) {
    me.x += Math.cos(k / 60 * 0.3) * 0.9 / 60; me.z += Math.sin(k / 60 * 0.3) * 0.9 / 60;
    fm.advance(1 / 60, me, st);
    me.vx = me.vz = 0;
    const f = boss();
    if (f.mode !== 'chase') { last = prev = null; continue; }
    if (last) {
      const vx = f.x - last[0], vz = f.z - last[1];
      if (Math.hypot(vx, vz) > 1e-3) {
        if (prev && vx * prev[0] + vz * prev[1] < 0) back++;
        prev = [vx, vz];
      }
    }
    last = [f.x, f.z];
  }
  assert.ok(back < 6, `${back} reversals`);
});
