import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { LAIR } from '../src/gen/lair';
import { Cooked, SALT_RINGS } from '../src/loot/recipes';
import { Tin } from '../src/loot/tin';
import { SALT_LINE, SaltLine } from '../src/world/saltLine';
import { Rats } from '../src/creatures/rats';
import { SaltTouched, TOUCHED } from '../src/creatures/touched';
import { TallOnes } from '../src/creatures/tallOne';
import type { Fighter } from '../src/combat/combat';

type Prey = Fighter & { taken: number };
const someone = (level: Level, x: number, z: number): Prey => ({
  x, y: level.groundAt(x, z), z, vx: 0, vz: 0, radius: 0.35, height: 1.75, taken: 0,
  get dead() { return false; }, hurt(a: number) { this.taken += a; },
});
const ring = SALT_RINGS[0];

/** A circle poured round `me` and closed at once. */
function poured(level: Level, me: Prey, r: number = ring.r): SaltLine {
  const s = new SaltLine();
  assert.equal(s.whyNot(level, me.x, me.z, r, true), null, 'the floor takes a line');
  s.pour(level, me.x, me.z, r, ring.keeps, 0);
  return s;
}

test('Salt Line is a lost card: not in the tin until found, then cooked like any other, and kept', () => {
  const c = new Cooked(), tin = new Tin();
  tin.salt = 50;
  assert.equal(c.has('salt-line'), false);
  assert.ok(c.cantCook('salt-line', tin, 0));
  assert.ok(c.find('salt-line'));
  assert.equal(c.find('salt-line'), false, 'found once');
  assert.equal(c.cantCook('salt-line', tin, 0), null);
  assert.equal(c.saltLine, null, 'found is not cooked');
  const kept = Cooked.from(c.data);
  assert.ok(kept.has('salt-line'), 'found, kept in the save');
  kept.cook('salt-line', tin);
  assert.deepEqual(Cooked.from(kept.data).saltLine, ring);
  assert.equal(new Cooked().has('salt-line'), false, 'the next grandchild must find it again');
});

test('the line works once it is closed, and wears off', () => {
  const level = new Level(1, 1), [x, , z] = level.arrival, s = new SaltLine();
  s.pour(level, x, z, ring.r, ring.keeps, 10);
  assert.ok(s.pouring(10 + SALT_LINE.pour / 2));
  assert.equal(s.keeping(10 + SALT_LINE.pour / 2).length, 0, 'not while it is poured');
  assert.equal(s.keeping(10 + SALT_LINE.pour + 1).length, 1);
  assert.ok(Math.abs(s.shown(10 + SALT_LINE.pour / 2).poured - 0.5) < 1e-9);
  assert.ok(s.shown(10 + SALT_LINE.pour + ring.keeps - 1).bright < 1, 'its crystals go dull at the end');
  assert.equal(s.keeping(10 + SALT_LINE.pour + ring.keeps + 0.1).length, 0);
  assert.equal(s.circle, null, 'gone');
});

/** A player standing still by a rats' nest (well away from the arrival). */
function byNest(level: Level, r: Rats): Prey {
  for (let j = -12; j <= 12; j++) for (let i = -12; i <= 12; i++) {
    const n = r.denAt(i, j);
    if (!n || Math.hypot(n.x - level.arrival[0], n.z - level.arrival[2]) < 30) continue;
    const me = someone(level, n.x + 1.5, n.z);
    if (new SaltLine().whyNot(level, me.x, me.z, ring.r, true) === null) return me;
  }
  throw new Error('no nest');
}

test('rats will not cross it: they bite far less, and never jitter at the line', () => {
  const level = new Level(1, 1);
  const bites = (salted: boolean) => {
    const r = new Rats(level), me = byNest(level, r);
    if (salted) r.salt = poured(level, me).keeping(SALT_LINE.pour);
    let back = 0;
    const last = new Map<object, [number, number, number, number, number]>();
    for (let k = 0; k < 900; k++) {
      r.advance(1 / 60, me); me.vx = me.vz = 0;
      for (const x of r.list) {
        if (x.dead) continue;
        const p = last.get(x);
        const dx = x.x - (p?.[0] ?? x.x), dz = x.z - (p?.[1] ?? x.z);
        if (p && Math.hypot(dx, dz) > 0.002) {
          if (dx * p[2] + dz * p[3] < 0 && k - p[4] < 12) back++;
          last.set(x, [x.x, x.z, dx, dz, dx * p[2] + dz * p[3] < 0 ? k : p[4]]);
        } else if (!p) last.set(x, [x.x, x.z, 0, 0, -99]);
      }
    }
    return { taken: me.taken, back };
  };
  const bare = bites(false), salted = bites(true);
  assert.ok(bare.taken > 0, 'bitten without it');
  assert.ok(salted.taken < bare.taken * 0.3, `${salted.taken} vs ${bare.taken}`);
  assert.ok(salted.back <= bare.back + 2, `back and forth at the line: ${salted.back} (${bare.back} without)`);
});

test('the Salt-Touched walk straight over it', () => {
  const level = new Level(1, 3), st = new SaltTouched(level), [ax, , az] = level.arrival;
  let me: Prey | null = null;
  for (let j = -6; j <= 6 && !me; j++) for (let i = -6; i <= 6 && !me; i++) {
    const s = st.denAt(Math.floor(ax / TOUCHED.cell) + i, Math.floor(az / TOUCHED.cell) + j) as { x: number; z: number; yaw: number } | null;
    if (!s) continue;
    const x = s.x + Math.sin(s.yaw) * 6, z = s.z + Math.cos(s.yaw) * 6;
    if (level.sdf(x, level.groundAt(x, z) + 1, z) < 0.6 || new SaltLine().whyNot(level, x, z, ring.r, true)) continue;
    me = someone(level, x, z);
  }
  assert.ok(me);
  st.salt = poured(level, me).keeping(SALT_LINE.pour);
  for (let k = 0; k < 60 * 20 && me.taken === 0; k++) { st.advance(1 / 60, me); me.vx = me.vz = 0; }
  assert.ok(me.taken > 0, 'it came in and hit');
});

test('the Tall One will not cross a poured line: no reach, no stare', () => {
  const level = new Level(1, LAIR.depth), lair = level.lair!;
  let me: Prey | null = null;
  for (let a = 0; a < 48 && !me; a++) {
    const x = lair.x + Math.cos(a * 0.13) * 14, z = lair.z + Math.sin(a * 0.13) * 14;
    if (!level.dry(x, z, 0.1) || lair.circles.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 4)) continue;
    if (new SaltLine().whyNot(level, x, z, ring.r, true)) continue;
    me = someone(level, x, z);
  }
  assert.ok(me);
  const bare = new TallOnes(level), salted = new TallOnes(level), twin = { ...me, taken: 0, hurt(a: number) { this.taken += a; } } as Prey;
  salted.salt = poured(level, me).keeping(SALT_LINE.pour);
  for (let k = 0; k < 60 * 40; k++) {
    bare.advance(1 / 60, twin); twin.vx = twin.vz = 0;
    salted.advance(1 / 60, me); me.vx = me.vz = 0;
  }
  assert.ok(twin.taken > 0, 'without it, it gets you');
  assert.equal(me.taken, 0);
  const o = salted.list[0];
  assert.ok(Math.hypot(o.x - me.x, o.z - me.z) > ring.r + o.radius, 'outside the line');
});
