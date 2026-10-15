import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { SaltTouched, TOUCHED, type Touched } from '../src/creatures/touched';
import type { Fighter } from '../src/combat/combat';

const salt = new Level(1, 3);

/** Someone standing `away` metres out from the nearest working spot to the arrival. */
function setup(away: number): { st: SaltTouched; me: Fighter & { taken: number; hits: number[] }; spot: { x: number; z: number } } {
  const st = new SaltTouched(salt);
  const [ax, , az] = salt.arrival;
  let spot: { x: number; z: number } | null = null, best = Infinity;
  for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) {
    const s = st.spotAt(Math.floor(ax / TOUCHED.cell) + i, Math.floor(az / TOUCHED.cell) + j);
    if (!s) continue;
    // Room in front of it to stand.
    const [ox, oz] = out(s as never);
    const x = s.x + ox * away, z = s.z + oz * away;
    if (salt.sdf(x, salt.groundAt(x, z) + 1, z) < 0.6 || Math.abs(salt.groundAt(x, z) - salt.groundAt(s.x, s.z)) > 0.5) continue;
    const d = Math.hypot(s.x - ax, s.z - az);
    if (d < best) { best = d; spot = s; }
  }
  assert.ok(spot, 'a Salt-Touched near the arrival');
  const [ox, oz] = out(spot as never);
  const x = spot.x + ox * away, z = spot.z + oz * away;
  const me = { x, y: salt.groundAt(x, z), z, vx: 0, vz: 0, radius: 0.35, height: 1.75, taken: 0, hits: [] as number[], get dead() { return false; }, hurt(a: number) { this.taken += a; } };
  return { st, me, spot };
}
const out = (s: { yaw: number }): [number, number] => [Math.sin(s.yaw), Math.cos(s.yaw)];

test('the Salt-Touched work the salt, not the quarry', () => {
  const q = new SaltTouched(new Level(1, 1)), s = new SaltTouched(salt);
  let inQuarry = 0, inSalt = 0;
  for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) { if (q.spotAt(i, j)) inQuarry++; if (s.spotAt(i, j)) inSalt++; }
  assert.equal(inQuarry, 0);
  assert.ok(inSalt > 10, `${inSalt} in the salt`);
});

test('one comes for you and brings the pick down after a plain wind-up', () => {
  const { st, me } = setup(6);
  let first = -1, swingAt = -1;
  for (let k = 0; k < 60 * 20 && first < 0; k++) {
    const before = me.taken;
    st.advance(1 / 60, me);
    const t = st.list.find((u) => !u.dead && u.mode === 'swing');
    if (t && swingAt < 0) swingAt = k / 60;
    if (me.taken > before) first = k / 60;
    me.vx = me.vz = 0;
  }
  assert.ok(first > 0, 'it hit');
  assert.ok(me.taken >= TOUCHED.swing.damage[0], `a hard blow (${me.taken.toFixed(0)})`);
  assert.ok(first - swingAt >= 0.9, `the wind-up shows ${(first - swingAt).toFixed(2)} s before the blow`);
});

test('stepping back in the wind-up dodges the blow', () => {
  const { st, me, spot } = setup(6);
  const [ox, oz] = out(spot as never);
  let dodged = false;
  for (let k = 0; k < 60 * 20; k++) {
    st.advance(1 / 60, me);
    const t = st.list.find((u) => !u.dead && u.mode === 'swing' && u.swingT < 0.1);
    if (t && !dodged) { me.x += ox * 1.6; me.z += oz * 1.6; me.y = salt.groundAt(me.x, me.z); dodged = true; break; }
    me.vx = me.vz = 0;
  }
  assert.ok(dodged);
  const before = me.taken;
  for (let k = 0; k < 60; k++) st.advance(1 / 60, me);
  assert.equal(me.taken, before, 'the blow missed');
});

test('they never jitter: no going back and forth while after you', () => {
  for (const dt of [1 / 60, 1 / 10]) {
    const { st, me } = setup(7);
    const last = new Map<Touched, [number, number, number, number]>();
    let back = 0, lastRev = -9, run = false;
    for (let k = 0; k * dt < 25; k++) {
      // Walk round slowly, so it has to follow.
      me.x += Math.cos(k * dt * 0.4) * 0.8 * dt; me.z += Math.sin(k * dt * 0.4) * 0.8 * dt; me.y = salt.groundAt(me.x, me.z);
      st.advance(dt, me);
      me.vx = me.vz = 0;
      for (const t of st.list) {
        const p = last.get(t);
        if (p) {
          const dx = t.x - p[0], dz = t.z - p[1];
          if (Math.hypot(dx, dz) > 0.002) {
            if (dx * p[2] + dz * p[3] < 0) {
              const quick = k * dt - lastRev < 0.4;
              if (quick && run) back++;
              run = quick;
              lastRev = k * dt;
            }
            last.set(t, [t.x, t.z, dx, dz]);
          }
        } else last.set(t, [t.x, t.z, 0, 0]);
      }
    }
    assert.equal(back, 0, `back and forth ${back} times at dt ${dt}`);
  }
});

test('the dead stay dead on this visit', () => {
  const { st, me } = setup(6);
  st.advance(1 / 60, me);
  const t = st.list.find((u) => Math.hypot(u.x - me.x, u.z - me.z) < 8)!;
  t.hurt(TOUCHED.health, 'knife');
  st.advance(1 / 60, me);
  assert.equal(st.killed, 1);
  const far = { ...me, x: me.x + 500, z: me.z + 500 };
  st.advance(1 / 60, far);
  st.advance(1 / 60, me);
  assert.ok(!st.list.some((u) => u.id === t.id && !u.dead));
});
