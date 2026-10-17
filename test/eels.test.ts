import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { EEL, Eels, type Eel, type Pool } from '../src/creatures/eels';
import type { Fighter } from '../src/combat/combat';

const level = new Level(1, 6);
const depth = (x: number, z: number) => level.waterAt(x, z) - level.groundAt(x, z);

type Prey = Fighter & { taken: number };
const someone = (x: number, z: number): Prey => ({
  x, y: level.groundAt(x, z), z, vx: 0, vz: 0, radius: 0.35, height: 1.75, taken: 0,
  get dead() { return false; }, hurt(a: number) { this.taken += a; },
});

function pools(e: Eels, l = level, n = 10): Pool[] {
  const [ax, , az] = l.arrival, out: Pool[] = [];
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
    const p = e.denAt(Math.floor(ax / EEL.cell) + i, Math.floor(az / EEL.cell) + j);
    if (p) out.push(p);
  }
  return out.sort((a, b) => Math.hypot(a.x - ax, a.z - az) - Math.hypot(b.x - ax, b.z - az));
}

/** Someone wading (water `lo`–`hi` deep) `away` metres from the nearest den, or on dry land if `dry`. */
function near(away: number, lo: number, hi: number): { eels: Eels; me: Prey } {
  const eels = new Eels(level);
  for (const p of pools(eels)) {
    for (let a = 0; a < 24; a++) {
      const x = p.x + Math.cos(a) * away, z = p.z + Math.sin(a) * away, w = depth(x, z);
      if (w >= lo && w <= hi && level.sdf(x, level.groundAt(x, z) + 1, z) > 0.6) return { eels, me: someone(x, z) };
    }
  }
  throw new Error('no such spot');
}

function run(eels: Eels, me: Prey, seconds: number, dt = 1 / 60, each?: (t: number) => void): void {
  for (let k = 0; k * dt < seconds; k++) {
    eels.advance(dt, me);
    me.vx = me.vz = 0;
    each?.(k * dt);
  }
}

test('brine eels lie in deep water, on any level: above level 5 rarer, and alone', () => {
  const ps = pools(new Eels(level)), mobs = (p: Pool[]) => p.reduce((s, x) => s + x.count, 0);
  assert.ok(ps.length > 3, `${ps.length} on level 6`);
  for (const p of ps) assert.ok(depth(p.x, p.z) >= EEL.deep, 'in deep water');
  const top = pools(new Eels(new Level(1, 1)), new Level(1, 1));
  assert.ok(top.length > 0, 'some on level 1');
  assert.ok(mobs(top) < mobs(ps) / 4, `far fewer on level 1 (${mobs(top)} vs ${mobs(ps)})`);
  assert.ok(top.every((p) => p.count === 1), 'alone on level 1');
});

test('one comes for you as you wade, rears up, then strikes', () => {
  const { eels, me } = near(5, 0.4, 0.9);
  let riseAt = -1, hitAt = -1;
  run(eels, me, 30, 1 / 60, (t) => {
    if (riseAt < 0 && eels.list.some((e) => e.mode === 'rise')) riseAt = t;
    if (hitAt < 0 && me.taken > 0) hitAt = t;
  });
  assert.ok(hitAt > 0, 'it bit');
  assert.ok(hitAt - riseAt >= EEL.rise, `the head shows ${(hitAt - riseAt).toFixed(2)} s first`);
});

test('they never leave the water, and leave you alone on dry land away from it', () => {
  const { eels, me } = near(5, 0.4, 0.9);
  let dryHead = 0;
  run(eels, me, 20, 1 / 60, () => { for (const e of eels.list) if (depth(e.x, e.z) < EEL.wet * 0.8 - 1e-6) dryHead++; });
  assert.equal(dryHead, 0, 'always in the water');
  // Now someone well up on dry floor.
  const eels2 = new Eels(level);
  let spot: Prey | null = null;
  for (const p of pools(eels2)) for (let r = 6; r < 25 && !spot; r += 1) for (let a = 0; a < 24 && !spot; a++) {
    const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
    let dry = true;
    for (let b = 0; b < 12 && dry; b++) dry = depth(x + Math.cos(b) * 2, z + Math.sin(b) * 2) < -0.2;
    if (dry && level.sdf(x, level.groundAt(x, z) + 1, z) > 0.6) spot = someone(x, z);
  }
  assert.ok(spot);
  run(eels2, spot, 15);
  assert.equal(spot.taken, 0);
});

test('they never jitter', () => {
  for (const dt of [1 / 60, 1 / 10]) {
    const { eels, me } = near(6, 0.4, 0.9);
    const last = new Map<Eel, [number, number, number, number]>(), lastRev = new Map<Eel, number>(), twice = new Map<Eel, boolean>();
    let back = 0;
    run(eels, me, 20, dt, (t) => {
      for (const e of eels.list) {
        if (e.mode !== 'hunt' && e.mode !== 'cruise') { last.delete(e); continue; }
        const p = last.get(e);
        if (!p) { last.set(e, [e.x, e.z, 0, 0]); continue; }
        const dx = e.x - p[0], dz = e.z - p[1];
        if (Math.hypot(dx, dz) < 0.002) continue;
        if (dx * p[2] + dz * p[3] < 0) {
          const quick = t - (lastRev.get(e) ?? -9) < 0.3;
          if (quick && twice.get(e)) back++;
          twice.set(e, quick);
          lastRev.set(e, t);
        }
        last.set(e, [e.x, e.z, dx, dz]);
      }
    });
    assert.equal(back, 0, `back and forth ${back} times at dt ${dt}`);
  }
});
