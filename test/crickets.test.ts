import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { CRICKET, Crickets, type Cricket, type Lamp } from '../src/creatures/crickets';
import type { Fighter } from '../src/combat/combat';

const level = new Level(1, 2); // (a group whose wall leaves room to land by you)

/** Someone standing near the cave crickets' group nearest the arrival. */
function setup(): { cr: Crickets; me: Fighter & { taken: number } } {
  const cr = new Crickets(level);
  const [ax, , az] = level.spawn(); // (the grand hall near the origin)
  let best: { x: number; z: number } | null = null, bd = Infinity;
  for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) {
    const g = cr.denAt(Math.floor(ax / CRICKET.cell) + i, Math.floor(az / CRICKET.cell) + j);
    if (g && Math.hypot(g.x - ax, g.z - az) < bd) { bd = Math.hypot(g.x - ax, g.z - az); best = g; }
  }
  assert.ok(best, 'a group near the arrival');
  const { x, z } = best;
  const me = { x, y: level.groundAt(x, z), z, vx: 0, vz: 0, radius: 0.35, height: 1.75, taken: 0, get dead() { return false; }, hurt(a: number) { this.taken += a; } };
  return { cr, me };
}

/** The headlamp held on the nearest living cricket. */
function torch(cr: Crickets, me: Fighter): Lamp {
  const lamp: Lamp = { x: me.x, y: me.y + 1.7, z: me.z, dx: 0, dy: 0, dz: -1, cos: Math.cos(0.6) };
  let near: Cricket | null = null, nd = Infinity;
  for (const c of cr.list) { const d = Math.hypot(c.x - me.x, c.z - me.z); if (!c.dead && d < nd) { nd = d; near = c; } }
  if (near) {
    const dx = near.x - lamp.x, dy = near.y + 0.2 - lamp.y, dz = near.z - lamp.z, d = Math.hypot(dx, dy, dz);
    lamp.dx = dx / d; lamp.dy = dy / d; lamp.dz = dz / d;
  }
  return lamp;
}

test('cave crickets cling to the rock, a few metres up', () => {
  const { cr, me } = setup();
  cr.advance(1 / 60, { ...me, x: me.x + 25 }, null); // near enough to wake them, too far to be noticed
  assert.ok(cr.list.length > 0);
  for (const c of cr.list) {
    assert.equal(c.mode, 'perch');
    assert.ok(Math.abs(level.sdf(c.x, c.y, c.z) - 0.12) < 0.1, 'on the rock');
    assert.ok(c.y - level.groundAt(c.x, c.z) > 1.2, 'up the wall');
  }
});

test('in the dark they leap down at you after a crouch, and bite', () => {
  const { cr, me } = setup();
  let crouchedFor = 0, leaps = 0;
  const seen = new Map<Cricket, string>();
  for (let k = 0; k < 60 * 15; k++) {
    cr.advance(1 / 60, me, null);
    me.vx = me.vz = 0;
    for (const c of cr.list) {
      if (c.mode === 'crouch' && seen.get(c) !== 'crouch' && !c.fleeing) crouchedFor = c.t;
      if (c.mode === 'leap' && seen.get(c) !== 'leap') leaps++;
      seen.set(c, c.mode);
    }
  }
  assert.ok(leaps > 0, 'they leap');
  assert.ok(crouchedFor >= 0.35, `the crouch shows (${crouchedFor.toFixed(2)} s)`);
  assert.ok(me.taken > 0, 'they hurt you');
});

test('one held in the headlamp keeps away', () => {
  const { cr, me } = setup();
  cr.advance(1 / 60, { ...me, x: me.x + 25 }, null);
  for (const c of cr.list.slice(1)) c.hurt(CRICKET.health, 'test');
  for (let k = 0; k < 60 * 15; k++) {
    cr.advance(1 / 60, me, torch(cr, me));
    me.vx = me.vz = 0;
  }
  assert.equal(me.taken, 0);
});

test('on the floor they never jitter', () => {
  for (const dt of [1 / 60, 1 / 10]) {
    const { cr, me } = setup();
    const last = new Map<Cricket, [number, number, number, number]>();
    let back = 0, lastRev = -9, run = false;
    for (let k = 0; k * dt < 20; k++) {
      me.x += Math.cos(k * dt * 0.4) * 0.6 * dt; me.z += Math.sin(k * dt * 0.4) * 0.6 * dt; me.y = level.groundAt(me.x, me.z);
      cr.advance(dt, me, null);
      me.vx = me.vz = 0;
      for (const c of cr.list) {
        if (c.mode !== 'ground') { last.delete(c); continue; }
        const p = last.get(c);
        if (p) {
          const dx = c.x - p[0], dz = c.z - p[1];
          if (Math.hypot(dx, dz) > 0.002) {
            if (dx * p[2] + dz * p[3] < 0) {
              const quick = k * dt - lastRev < 0.3;
              if (quick && run) back++;
              run = quick;
              lastRev = k * dt;
            }
            last.set(c, [c.x, c.z, dx, dz]);
          }
        } else last.set(c, [c.x, c.z, 0, 0]);
      }
    }
    assert.equal(back, 0, `back and forth ${back} times at dt ${dt}`);
  }
});

test('a dead one falls off the wall to the floor', () => {
  const { cr, me } = setup();
  cr.advance(1 / 60, { ...me, x: me.x + 1000 }, null);
  const far = { ...me, x: me.x + 30 };
  cr.advance(1 / 60, me, null);
  const c = cr.list[0];
  c.hurt(CRICKET.health, 'knife');
  for (let k = 0; k < 120; k++) cr.advance(1 / 60, far, null);
  assert.ok(Math.abs(c.y - level.groundAt(c.x, c.z)) < 0.05, 'on the floor');
  assert.equal(cr.killed, 1);
});
