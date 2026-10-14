import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { RAT, Rats, type Rat } from '../src/creatures/rats';
import type { Fighter } from '../src/combat/combat';

const level = new Level(1, 1);

/** Someone standing (or circling) by a nest, never hurt (so the rats keep at it). */
function prey(r: Rats): Fighter & { taken: number } {
  const [ax, , az] = level.arrival;
  let nest = null;
  for (let j = -15; j <= 15 && !nest; j++) for (let i = -15; i <= 15 && !nest; i++) {
    const n = r.nestAt(Math.floor(ax / RAT.cell) + i, Math.floor(az / RAT.cell) + j);
    if (n && Math.hypot(n.x - ax, n.z - az) > 30) nest = n;
  }
  const x = nest!.x + 1.5, z = nest!.z;
  return { x, y: level.groundAt(x, z), z, vx: 0, vz: 0, radius: 0.3, height: 1.7, taken: 0, get dead() { return false; }, hurt(a: number) { this.taken += a; } };
}

/**
 * Jitter: a rat that moves one way and straight back, then again, within a moment, while chasing
 * (a bite's rear and lunge are meant). One quick turn back can be a sensible change of mind; going
 * back and forth (a quick reversal right after another) is the jitter. Counts those, per rat.
 */
const JITTER = 0.25;
function reversals(seconds: number, dt: number, walk = 0): Map<Rat, number> {
  const rats = new Rats(level), me = prey(rats);
  const last = new Map<Rat, [number, number, number, number]>(), out = new Map<Rat, number>(), at = new Map<Rat, number>(), run = new Map<Rat, boolean>();
  for (let k = 0; k * dt < seconds; k++) {
    if (walk) { me.x += Math.cos(k * dt * 0.5) * walk * dt; me.z += Math.sin(k * dt * 0.5) * walk * dt; me.y = level.groundAt(me.x, me.z); }
    rats.advance(dt, me);
    me.vx = me.vz = 0;
    for (const r of rats.list) {
      if (r.dead || r.mode !== 'chase') { last.delete(r); continue; }
      const p = last.get(r);
      if (p) {
        const dx = r.x - p[0], dz = r.z - p[1];
        if (Math.hypot(dx, dz) > 0.002) {
          if (dx * p[2] + dz * p[3] < 0) {
            const quick = k * dt - (at.get(r) ?? -9) < JITTER;
            if (quick && run.get(r)) out.set(r, (out.get(r) ?? 0) + 1);
            run.set(r, quick);
            at.set(r, k * dt);
          }
          last.set(r, [r.x, r.z, dx, dz]);
        }
      } else last.set(r, [r.x, r.z, 0, 0]);
    }
  }
  return out;
}

for (const [name, dt, walk] of [['at 60 fps', 1 / 60, 0], ['at 10 fps', 1 / 10, 0], ['round a walking prey', 1 / 60, 1.2]] as const) {
  test(`rats close in and bite without jittering (${name})`, () => {
    const rev = reversals(12, dt, walk);
    const worst = Math.max(0, ...rev.values());
    assert.equal(worst, 0, `a rat went back and forth ${worst} times in 12 s`);
  });
}
